"""
sarvam_service.py
─────────────────
Sarvam AI integration for Voxara — Text-to-Speech (TTS) and
Speech-to-Text (STT) with automatic API key rotation.

Key rotation policy
-------------------
  • Keys are tried left-to-right in _KEY_POOL.
  • On any 429 (rate-limit), 401, or 403 (quota) response the current key is
    marked exhausted for this request cycle and the next key is used instantly.
  • An error is only raised to the caller after ALL keys in the pool fail.
  • _current_key_index advances atomically (thread-safe via threading.Lock) so
    multiple concurrent requests benefit from the rotation across the pool.

Public API
----------
  text_to_speech(text, language_code)  → bytes   (WAV audio)
  speech_to_text(audio_bytes)          → str     (transcribed text)
"""

from __future__ import annotations

import io
import logging
import threading
from typing import Iterator

import httpx

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
_KEY_POOL: list[str] = [
    "sk_hy483lkg_EaaXOKm7zOvWmbZR71nVukD4",
    "sk_b6c9vgv2_jNQweeiblFJimOt53pFEbnNJ",
    "sk_og14y1qz_LEzvjZs5towLQDuOMKKXeLlP",
    "sk_t18ts6ow_FSOTCT1roVNQ0Kg3b9U43lo8",
    "sk_lnlfe103_kctMLF6LOWO7yWVJcPf29Dxb",
    "sk_2381wxio_K6YlFAVtsxChBlHt3pUOt1E9",
    "sk_xn7slh9i_NBDuI89ZHoKdq69wvRCox9dw",
    "sk_7wxkw6hf_5vFOY4Ie9SvvrOpDvKsXJF7D",
    "sk_97uflmvh_TyuasadOgX1okk1RSiVkXsCV",
    "sk_hvnj9p5y_UVjaBrTXp43DcCx9Prn8yPGs",
]

# Status codes that signal quota / rate-limit → rotate key
_ROTATE_ON_STATUS: frozenset[int] = frozenset({401, 403, 429})

# Sarvam AI base URL
_BASE_URL = "https://api.sarvam.ai"

# Set MOCK_MODE = False to use the live Sarvam saaras:v3 API.
MOCK_MODE: bool = False

_MOCK_TRANSCRIPT: str = ""


def _activate_circuit_breaker(reason: str) -> str:
    """Print the maintenance banner and return the mock transcript."""
    banner = "=" * 64
    print(f"\n{banner}")
    print("⚠️  SARVAM MAINTENANCE DETECTED: CIRCUIT BREAKER ACTIVE  ⚠️")
    print(f"Reason  : {reason}")
    print(f"Fallback: {_MOCK_TRANSCRIPT!r}")
    print(f"{banner}\n")
    logger.warning("STT circuit breaker activated: %s", reason)
    return _MOCK_TRANSCRIPT

# Shared round-robin index (advances across requests, not just within one)
_lock = threading.Lock()
_current_key_index: int = 0

# ─────────────────────────────────────────────────────────────────────────────
def _key_iterator(start: int) -> Iterator[tuple[int, str]]:
    """
    Yield (index, key) tuples starting from *start*, cycling through the
    entire pool exactly once before raising StopIteration.
    """
    n = len(_KEY_POOL)
    for offset in range(n):
        idx = (start + offset) % n
        yield idx, _KEY_POOL[idx]


def _advance_global_index(failed_idx: int) -> None:
    """
    Move the shared pool pointer past the failed key so the next independent
    request doesn't waste a call on an already-exhausted key.
    """
    global _current_key_index
    with _lock:
        if _current_key_index == failed_idx:
            _current_key_index = (failed_idx + 1) % len(_KEY_POOL)


def _get_start_index() -> int:
    with _lock:
        return _current_key_index

def text_to_speech(
    text: str,
    language_code: str = "hi-IN",
) -> bytes:
    """
    Convert *text* to speech using the Sarvam AI TTS API.

    Parameters
    ----------
    text          : The text to synthesise (max ~500 chars per Sarvam docs).
    language_code : BCP-47 language tag, e.g. "hi-IN", "en-IN", "ta-IN".

    Returns
    -------
    bytes  WAV audio data.

    Raises
    ------
    RuntimeError  if all API keys are exhausted without a successful response.
    """
    endpoint = f"{_BASE_URL}/text-to-speech"
    payload = {
        "inputs": [text],
        "target_language_code": language_code,
        "speaker": "meera",          # default female voice
        "pitch": 0,
        "pace": 1.0,
        "loudness": 1.5,
        "speech_sample_rate": 22050,
        "enable_preprocessing": True,
        "model": "bulbul:v3",
    }

    start = _get_start_index()
    last_error: str = "Unknown error"

    for idx, key in _key_iterator(start):
        logger.debug("TTS: trying key index %d (…%s)", idx, key[-6:])
        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.post(
                    endpoint,
                    json=payload,
                    headers={
                        "api-subscription-key": key,
                        "Content-Type": "application/json",
                    },
                )

            if response.status_code == 200:
                # Success — update global pointer to this working key
                with _lock:
                    global _current_key_index
                    _current_key_index = idx
                audio_bytes = _extract_tts_audio(response)
                logger.info("TTS: success with key index %d, %d bytes", idx, len(audio_bytes))
                return audio_bytes

            if response.status_code in _ROTATE_ON_STATUS:
                last_error = (
                    f"Key[{idx}] HTTP {response.status_code}: "
                    f"{response.text[:120]}"
                )
                logger.warning("TTS: %s — rotating to next key.", last_error)
                _advance_global_index(idx)
                continue   # try next key

            # Non-rotatable HTTP error (4xx/5xx that isn't quota-related)
            response.raise_for_status()

        except httpx.TimeoutException as exc:
            last_error = f"Key[{idx}] Timeout: {exc}"
            logger.warning("TTS: %s", last_error)
            continue
        except httpx.RequestError as exc:
            last_error = f"Key[{idx}] Network error: {exc}"
            logger.warning("TTS: %s", last_error)
            continue

    raise RuntimeError(
        f"Sarvam TTS failed: all {len(_KEY_POOL)} API keys exhausted. "
        f"Last error: {last_error}"
    )


def speech_to_text(
    audio_bytes: bytes,
    language_code: str = "hi-IN",
) -> str:
    """
    Transcribe *audio_bytes* using the Sarvam AI STT API (saaras:v3).

    Parameters
    ----------
    audio_bytes   : Raw audio bytes (WAV preferred; Sarvam also accepts mp3/ogg).
    language_code : Expected spoken language, e.g. "hi-IN", "en-IN".

    Returns
    -------
    str  Transcribed text (may be empty string if the audio is silent).

    Raises
    ------
    RuntimeError  on 400 Bad Request (exposes exact Sarvam error body)
                  or when all API keys are exhausted on rate-limit errors.

    Notes
    -----
    The `data` payload is intentionally omitted — Sarvam's 2026 saaras:v3
    endpoint auto-detects defaults and rejects explicit model/mode fields
    when sent as multipart form data alongside a file upload.
    """
    endpoint = f"{_BASE_URL}/speech-to-text"

    # ── Circuit breaker: MOCK_MODE bypasses Sarvam entirely ──────────────────
    if MOCK_MODE:
        return _activate_circuit_breaker("MOCK_MODE = True (manual override)")

    start = _get_start_index()
    last_error: str = "Unknown error"

    for idx, key in _key_iterator(start):
        logger.debug("STT: trying key index %d (...%s)", idx, key[-6:])
        try:
            with httpx.Client(timeout=60.0) as client:
                response = client.post(
                    endpoint,
                    headers={"api-subscription-key": key},
                    files={
                        "file": ("test.wav", audio_bytes, "audio/wav"),
                    },
                )

            # ── 500 Server Error: Sarvam is down → circuit breaker ───────────
            if response.status_code == 500:
                reason = (
                    f"Sarvam returned HTTP 500 (server maintenance/outage). "
                    f"Response: {response.text[:200]}"
                )
                return _activate_circuit_breaker(reason)

            # ── 400 Bad Request: surface the exact Sarvam error immediately ──
            if response.status_code == 400:
                error_body: str = response.text
                print("\n" + "=" * 60)
                print("🚨 SARVAM STT 400 BAD REQUEST — EXACT ERROR BODY 🚨")
                print(error_body)
                print("=" * 60 + "\n")
                logger.error(
                    "STT: 400 Bad Request from Sarvam (key index %d). "
                    "Exact error: %s",
                    idx, error_body,
                )
                raise RuntimeError(
                    f"Sarvam STT returned 400 Bad Request: {error_body}"
                )

            # ── 429 / 401 / 403: quota or rate-limit → rotate to next key ──
            if response.status_code in _ROTATE_ON_STATUS:
                last_error = (
                    f"Key[{idx}] HTTP {response.status_code}: "
                    f"{response.text[:120]}"
                )
                logger.warning("STT: %s - rotating to next key.", last_error)
                _advance_global_index(idx)
                continue

            # ── 200 OK: extract and return transcript ─────────────────────────
            if response.status_code == 200:
                with _lock:
                    _current_key_index = idx
                transcript = _extract_stt_text(response)
                logger.info(
                    "STT: success with key index %d, transcript length=%d",
                    idx, len(transcript),
                )
                return transcript

            # ── Any other unexpected status: raise immediately ────────────────
            response.raise_for_status()

        except RuntimeError:
            raise   # re-raise 400 errors immediately; do NOT continue rotating
        except httpx.TimeoutException as exc:
            last_error = f"Key[{idx}] Timeout: {exc}"
            logger.warning("STT: %s", last_error)
            continue
        except httpx.RequestError as exc:
            last_error = f"Key[{idx}] Network error: {exc}"
            logger.warning("STT: %s", last_error)
            continue

    raise RuntimeError(
        f"Sarvam STT failed: all {len(_KEY_POOL)} API keys exhausted. "
        f"Last error: {last_error}"
    )

def _extract_tts_audio(response: httpx.Response) -> bytes:
    """
    Parse the Sarvam TTS response.

    Sarvam returns JSON: {"audios": ["<base64-wav>", ...]}
    The base64 strings are raw WAV data encoded in base64.
    """
    import base64

    content_type = response.headers.get("content-type", "")

    # If Sarvam returns raw audio bytes directly
    if "audio" in content_type:
        return response.content

    # Otherwise parse JSON envelope — log it so we can see the exact shape
    try:
        data = response.json()
        print("\n" + "=" * 60)
        print(f"DEBUG SARVAM TTS JSON: {str(data)[:400]}")
        print("=" * 60 + "\n")
        logger.debug("TTS raw JSON response keys: %s", list(data.keys()) if isinstance(data, dict) else type(data))
    except Exception:
        # Fallback: treat entire response body as audio
        logger.warning("TTS response is not valid JSON; treating body as raw audio bytes")
        return response.content

    audios = data.get("audios") or data.get("audio") or []
    if audios:
        audio_b64: str = audios[0] if isinstance(audios, list) else audios
        # Strip potential data-URI prefix
        if "," in audio_b64:
            audio_b64 = audio_b64.split(",", 1)[1]
        return base64.b64decode(audio_b64)

    # Last resort
    return response.content


def _extract_stt_text(response: httpx.Response) -> str:
    """
    Parse the Sarvam STT (saaras:v3) response.

    Saaras V3 response shapes tried in order:
      1. {"transcript": "..."}                   - flat transcript key
      2. {"data": {"transcript": "..."}}         - nested under data
      3. {"text": "..."}                         - legacy text key
      4. [{"transcript": "..."}, ...]            - list of utterances
      5. raw response text                        - absolute last resort
    """
    # ── Always print the full raw response for terminal debugging ─────────────
    try:
        raw_json = response.json()
        print("\n" + "=" * 60)
        print(f"DEBUG SARVAM STT JSON: {raw_json}")
        print("=" * 60 + "\n")
        logger.debug("STT raw JSON response: %s", raw_json)
    except Exception as parse_exc:
        print("\n" + "=" * 60)
        print(f"DEBUG SARVAM STT RAW TEXT (not JSON): {response.text[:500]}")
        print("=" * 60 + "\n")
        logger.warning("STT response is not valid JSON: %s", parse_exc)
        return response.text.strip()

    data = raw_json

    # 1. Flat transcript key
    transcript = data.get("transcript")
    if transcript:
        if isinstance(transcript, list):
            # list of utterance dicts: [{"transcript": "...", ...}, ...]
            return " ".join(
                t.get("transcript", "") if isinstance(t, dict) else str(t)
                for t in transcript
            ).strip()
        return str(transcript).strip()

    # 2. Nested under "data" key  (saaras:v3 envelope)
    nested = data.get("data")
    if isinstance(nested, dict):
        inner = nested.get("transcript") or nested.get("text") or ""
        if inner:
            return str(inner).strip()

    # 3. Legacy "text" key
    text_val = data.get("text")
    if text_val:
        return str(text_val).strip()

    # 4. Top-level list of utterances
    if isinstance(data, list):
        return " ".join(
            t.get("transcript", "") if isinstance(t, dict) else str(t)
            for t in data
        ).strip()

    # 5. Nothing matched — log and return empty
    logger.warning("STT: could not extract transcript from response shape: %s", list(data.keys()))
    return ""
