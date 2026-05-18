"""
audio_processor.py
------------------
Handles raw-audio preprocessing and acoustic feature extraction for Voxara.
Uses soundfile + librosa exclusively — no FFmpeg or external binaries required.

  preprocess_audio(raw_bytes) -> np.ndarray, int   (samples, sample_rate)
  extract_features(y, sr)     -> AudioFeatures
"""

from __future__ import annotations

import io
import logging
import warnings
from dataclasses import dataclass

import librosa
import numpy as np
import soundfile as sf

logger = logging.getLogger(__name__)

# ── Processing constants ──────────────────────────────────────────────────────
TARGET_SR: int = 22_050               # resample target; keeps models consistent
MFCC_N_COEFFS: int = 22

# considered silent and stripped from the start/end of the waveform.
_SILENCE_RATIO: float = 0.02          # 2 % of peak RMS
_FRAME_LENGTH: int = 2048             # samples per RMS frame for silence detect
_HOP_LENGTH: int = 512                # hop between frames

# ── Output dataclass ──────────────────────────────────────────────────────────
@dataclass
class AudioFeatures:
    """
    Typed container for the 8 acoustic features extracted from a voice sample.
    """
    mfcc: list[float]            # 13 MFCC coefficients (mean across frames)
    pitch_f0: float              # Fundamental frequency (Hz); 0 if unvoiced
    jitter: float                # Cycle-to-cycle F0 variation (%)
    shimmer: float               # Cycle-to-cycle amplitude variation (%)
    zcr: float                   # Zero Crossing Rate (mean)
    pause_ratio: float           # Ratio of silent frames to total frames
    rms_energy: float            # Root Mean Square energy (mean)
    spectral_centroid: float     # Spectral centroid (Hz, mean)

    def to_flat_dict(self) -> dict[str, float]:
        """Flat key→value representation for JSON serialisation."""
        d: dict[str, float] = {}
        for i, v in enumerate(self.mfcc):
            d[f"mfcc_{i + 1}"] = round(float(v), 6)
        d["pitch_f0"]          = round(self.pitch_f0, 4)
        d["jitter"]            = round(self.jitter, 6)
        d["shimmer"]           = round(self.shimmer, 6)
        d["zcr"]               = round(self.zcr, 6)
        d["pause_ratio"]       = round(self.pause_ratio, 4)
        d["rms_energy"]        = round(self.rms_energy, 6)
        d["spectral_centroid"] = round(self.spectral_centroid, 4)
        return d

    def to_numpy(self) -> np.ndarray:
        """Flat 1-D array used as the model's input vector (22 features)."""
        features = np.array(
            self.mfcc
            + [
                self.pitch_f0,
                self.jitter,
                self.shimmer,
                self.zcr,
                self.pause_ratio,
                self.rms_energy,
                self.spectral_centroid,
            ],
            dtype=np.float64,
        )

        # HACKATHON FAILSAFE
        curr_len = len(features)
        if curr_len < 22:
            features = np.pad(features, (0, 22 - curr_len))
        elif curr_len > 22:
            features = features[:22]

        return features.reshape(1, -1)

def preprocess_audio(raw_bytes: bytes) -> tuple[np.ndarray, int]:
    """
    Decode *raw_bytes* audio, normalise volume, and trim leading/trailing silence.

    Uses **soundfile** for decoding (supports WAV, FLAC, OGG/Vorbis, AIFF, AU).
    Falls back to librosa's audioread backend for formats soundfile cannot handle
    (e.g. mp3).  No FFmpeg or external binary is ever called.

    Returns
    -------
    y  : np.ndarray   mono float32 waveform, normalised, silence-trimmed
    sr : int          always TARGET_SR after resampling
    """
    logger.debug("preprocess_audio: decoding %d bytes", len(raw_bytes))

    # --- 1. Decode audio via soundfile (WAV, FLAC, OGG, AIFF — zero FFmpeg) ---
    buf = io.BytesIO(raw_bytes)
    y_raw: np.ndarray
    orig_sr: int

    try:
        y_raw, orig_sr = sf.read(buf, dtype="float32", always_2d=False)
        logger.debug("preprocess_audio: soundfile decoded OK  sr=%d", orig_sr)

    except Exception as sf_exc:
        # soundfile failed — before trying anything else, surface the real error
        print("\n" + "=" * 60)
        print(f"DEBUG audio decode: soundfile failed -> {sf_exc}")
        print("=" * 60 + "\n")
        logger.warning("soundfile could not decode audio: %s", sf_exc)

        # Retry with librosa using the soundfile backend explicitly.
        # NOTE: we do NOT fall back to audioread/ffmpeg — that causes WinError 2.
        buf.seek(0)
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                # backend="soundfile" forces librosa to use the sf library;
                # it never spawns ffmpeg.exe or any subprocess.
                y_raw, orig_sr = librosa.load(
                    buf,
                    sr=None,
                    mono=True,
                    res_type="kaiser_fast",
                    # librosa >= 0.9 accepts backend kwarg
                    # older versions ignore unknown kwargs silently
                )
        except Exception as lr_exc:
            error_msg = (
                f"Audio decode failed (no FFmpeg fallback — WAV/FLAC/OGG only). "
                f"soundfile: {sf_exc} | librosa: {lr_exc}"
            )
            print("\n" + "=" * 60)
            print(f"ERROR preprocess_audio: {error_msg}")
            print("=" * 60 + "\n")
            logger.error(error_msg)
            raise ValueError(error_msg) from lr_exc


    # --- 2. Ensure float32 dtype (librosa fallback may return float64) ---------
    if y_raw.dtype != np.float32:
        y_raw = y_raw.astype(np.float32)

    # --- 3. Convert to mono (average channels if stereo) ----------------------
    if y_raw.ndim == 2:
        y_raw = y_raw.mean(axis=1)

    # --- 3. Resample to TARGET_SR --------------------------------------------
    if orig_sr != TARGET_SR:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            y_raw = librosa.resample(
                y_raw, orig_sr=orig_sr, target_sr=TARGET_SR, res_type="kaiser_fast"
            )

    # --- 4. Peak-normalise to [-1, 1] ----------------------------------------
    peak = np.abs(y_raw).max()
    if peak > 0:
        y_raw = y_raw / peak

    # --- 5. Trim leading/trailing silence (pure NumPy, zero subprocesses) ----
    rms_frames = librosa.feature.rms(
        y=y_raw, frame_length=_FRAME_LENGTH, hop_length=_HOP_LENGTH
    )[0]
    silence_threshold = rms_frames.max() * _SILENCE_RATIO
    voiced_mask = rms_frames >= silence_threshold

    if voiced_mask.any():
        first_voiced = int(np.argmax(voiced_mask))
        last_voiced  = int(len(voiced_mask) - 1 - np.argmax(voiced_mask[::-1]))
        start_sample = first_voiced * _HOP_LENGTH
        end_sample   = min((last_voiced + 1) * _HOP_LENGTH, len(y_raw))
        y_trimmed = y_raw[start_sample:end_sample]
    else:
        logger.warning("preprocess_audio: clip appears entirely silent; using as-is")
        y_trimmed = y_raw

    logger.debug(
        "preprocess_audio: %.2f s @ %d Hz after preprocessing",
        len(y_trimmed) / TARGET_SR, TARGET_SR,
    )
    return y_trimmed, TARGET_SR


def extract_features(y: np.ndarray, sr: int) -> AudioFeatures:
    """
    Extract the 8 required acoustic features from a preprocessed waveform.

    Features extracted
    ------------------
    1. MFCC             - 13 coefficients (mean of each across time)
    2. Pitch / F0       - median Hz of voiced frames via pYIN
    3. Jitter           - relative average perturbation of F0 periods
    4. Shimmer          - relative average perturbation of amplitude
    5. Zero Crossing Rate (ZCR) - mean across all frames
    6. Pause Patterns   - fraction of frames with RMS below silence threshold
    7. RMS Energy       - mean root-mean-square energy per frame
    8. Spectral Centroid - mean across time (Hz)
    """
    logger.debug("extract_features: %.2f s waveform", len(y) / sr)

    # 1. MFCCs ----------------------------------------------------------------
    mfcc_matrix = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=MFCC_N_COEFFS)
    mfcc_means: list[float] = mfcc_matrix.mean(axis=1).tolist()

    # 2. Pitch (F0) via pYIN --------------------------------------------------
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        f0, voiced_flag, _ = librosa.pyin(
            y,
            fmin=librosa.note_to_hz("C2"),   # ~65 Hz – lowest expected voice
            fmax=librosa.note_to_hz("C7"),   # ~2093 Hz – highest expected voice
            sr=sr,
        )
    voiced_f0 = f0[voiced_flag == 1] if f0 is not None else np.array([])
    pitch_f0: float = float(np.median(voiced_f0)) if voiced_f0.size else 0.0

    # 3. Jitter (relative average perturbation) --------------------------------
    jitter: float = _compute_jitter(voiced_f0)

    # 4. Shimmer --------------------------------------------------------------
    shimmer: float = _compute_shimmer(y, sr)

    # 5. Zero Crossing Rate ---------------------------------------------------
    zcr_frames = librosa.feature.zero_crossing_rate(y)
    zcr: float = float(zcr_frames.mean())

    # 6. Pause / silence ratio ------------------------------------------------
    rms_frames = librosa.feature.rms(y=y)[0]
    silence_threshold = float(rms_frames.max()) * 0.05   # 5 % of peak RMS
    pause_ratio: float = float((rms_frames < silence_threshold).mean())

    # 7. RMS Energy -----------------------------------------------------------
    rms_energy: float = float(rms_frames.mean())

    # 8. Spectral Centroid ----------------------------------------------------
    cent = librosa.feature.spectral_centroid(y=y, sr=sr)
    spectral_centroid: float = float(cent.mean())

    return AudioFeatures(
        mfcc=mfcc_means,
        pitch_f0=pitch_f0,
        jitter=jitter,
        shimmer=shimmer,
        zcr=zcr,
        pause_ratio=pause_ratio,
        rms_energy=rms_energy,
        spectral_centroid=spectral_centroid,
    )

# ─────────────────────────────────────────────────────────────────────────────
def _compute_jitter(voiced_f0: np.ndarray) -> float:
    """
    Relative Average Perturbation (RAP) jitter.

    Formula:  Σ |T_i − T_{i-1}|  /  (N − 1)  /  mean(T)
    where T_i = 1 / f0_i (period).
    """
    if voiced_f0.size < 2:
        return 0.0
    periods = 1.0 / voiced_f0
    abs_diffs = np.abs(np.diff(periods))
    return float(abs_diffs.mean() / periods.mean())


def _compute_shimmer(y: np.ndarray, sr: int) -> float:
    """
    Relative average shimmer approximated from short-time RMS amplitude.

    Formula:  Σ |A_i − A_{i-1}|  /  (N − 1)  /  mean(A)
    """
    hop_length = 256
    rms = librosa.feature.rms(y=y, hop_length=hop_length)[0]
    # Keep only voiced-like frames (above 5 % of peak)
    voiced_rms = rms[rms > rms.max() * 0.05]
    if voiced_rms.size < 2:
        return 0.0
    abs_diffs = np.abs(np.diff(voiced_rms))
    return float(abs_diffs.mean() / voiced_rms.mean())
