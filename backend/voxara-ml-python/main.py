"""
main.py  ·  Voxara ML Microservice
===================================
FastAPI application exposing voice-based disease-risk analysis,
chatbot-reply mood detection, and Sarvam AI conversational features
for the Voxara health platform.

Endpoints
---------
GET  /health                        – service health check
POST /analyze-audio                 – acoustic feature extraction + ML risk prediction
POST /analyze-mood                  – text sentiment → wellness mood score
POST /bot/speak                     – Sarvam TTS → streaming audio response
POST /analyze-conversational-audio  – STT → VADER mood + ML risk in one call

Run
---
  uvicorn main:app --reload --host 0.0.0.0 --port 8000
  (must be run from inside the voxara-ml-python/ directory)
"""

from __future__ import annotations

import logging
import os
import sys
import traceback
from contextlib import asynccontextmanager
from typing import Annotated, Any

import librosa
import numpy as np
import uvicorn
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

# ── Internal modules ──────────────────────────────────────────────────────────
from backend.audio_processor import AudioFeatures, extract_features, preprocess_audio
from backend.model_loader import available_diseases, get_bundle, load_all_models
from backend.mood_analyzer import MoodResult, analyze_mood
from backend.predictor import PredictionResult, predict_risk
from backend.sarvam_service import speech_to_text, text_to_speech

# Force UTF-8 output on Windows to avoid cp1252 UnicodeEncodeError
os.environ.setdefault("PYTHONUTF8", "1")
if sys.stdout.encoding and sys.stdout.encoding.lower() not in ("utf-8", "utf8"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")  # type: ignore
    except AttributeError:
        pass  # Python < 3.7 fallback (reconfigure not available)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("voxara.main")

# ── Allowed disease types ─────────────────────────────────────────────────────
SUPPORTED_DISEASE_TYPES = {"parkinsons", "respiratory", "stuttering"}

# ─────────────────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load ML models on startup; yield; (nothing to clean up on shutdown)."""
    logger.info("═══ Voxara ML Microservice — Starting Up ═══")
    load_all_models()
    loaded = available_diseases()
    if not loaded:
        logger.warning("No models were loaded — /analyze-audio will return 503.")
    else:
        logger.info("Ready. Loaded models: %s", loaded)
    yield
    logger.info("═══ Voxara ML Microservice — Shutting Down ═══")

# ─────────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Voxara ML Microservice",
    description=(
        "Acoustic risk analysis (Parkinson's, Respiratory), wellness mood detection, "
        "and Sarvam AI conversational TTS/STT for the Voxara health platform."
    ),
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS — adjust origins for production ──────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Catch-all handler for any unhandled exception.
    Prints the full traceback with emoji banners to the terminal so nothing
    is ever silently swallowed, then returns a structured JSON 500 response.
    """
    tb_str = traceback.format_exc()
    banner = "=" * 64
    print(f"\n{banner}")
    print("🚨🚨🚨  UNHANDLED EXCEPTION IN VOXARA API  🚨🚨🚨")
    print(f"Request : {request.method} {request.url}")
    print(f"Type    : {type(exc).__name__}")
    print(f"Message : {exc}")
    print("Traceback:")
    print(tb_str)
    print(f"{banner}\n")
    logger.error(
        "Unhandled %s on %s %s: %s",
        type(exc).__name__, request.method, request.url.path, exc,
    )
    return JSONResponse(
        status_code=500,
        content={
            "error": type(exc).__name__,
            "detail": str(exc),
            "path": str(request.url.path),
        },
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """
    Override FastAPI's default HTTPException handler to also print the error
    to the terminal for any 4xx/5xx that our endpoint code raises explicitly.
    """
    if exc.status_code >= 500:
        print(f"\n{'=' * 64}")
        print(f"🚨  HTTP {exc.status_code} on {request.method} {request.url.path}")
        print(f"    Detail: {exc.detail}")
        print(f"{'=' * 64}\n")
        logger.error("HTTP %d on %s: %s", exc.status_code, request.url.path, exc.detail)
    elif exc.status_code >= 400:
        logger.warning("HTTP %d on %s: %s", exc.status_code, request.url.path, exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": "HTTPException", "detail": exc.detail},
    )

# ─────────────────────────────────────────────────────────────────────────────
class AudioAnalysisResponse(BaseModel):
    """Response body for POST /analyze-audio."""
    disease_type: str = Field(..., description="The disease type that was analysed.")
    risk_score: float = Field(
        ..., ge=0, le=100,
        description="Probability of the high-risk class, expressed 0–100.",
    )
    prediction_label: str = Field(
        ..., description="Human-readable prediction label, e.g. 'High Risk'."
    )
    probability_confidence: float = Field(
        ..., ge=0, le=100,
        description="Confidence of the model's chosen prediction (0–100).",
    )
    features: dict[str, Any] = Field(
        ..., description="Dictionary of the 20 extracted acoustic features."
    )


def _clamp_score(value: float) -> float:
    return round(float(max(0.0, min(100.0, value))), 2)


def predict_stuttering_risk(y: np.ndarray, sr: int, features: AudioFeatures) -> PredictionResult:
    """
    Rule-based stuttering/disfluency score for the hackathon demo.

    There is no trained stuttering model in this repository, so this path is
    deliberately separate from the Parkinsons/respiratory classifiers. It uses
    acoustic correlates of disfluency: pauses, voiced/unvoiced fragmentation,
    pitch instability, amplitude instability, and energy variance.
    """
    duration = max(len(y) / sr, 0.001)
    rms = librosa.feature.rms(y=y, frame_length=1024, hop_length=256)[0]
    if rms.size == 0 or float(rms.max()) <= 1e-8:
        return PredictionResult(
            risk_score=0.0,
            prediction_label="Low Stuttering Risk",
            probability_confidence=100.0,
        )

    threshold = float(rms.max()) * 0.12
    silent = rms < threshold
    frame_seconds = 256 / sr

    pause_runs: list[int] = []
    current = 0
    for is_silent in silent:
        if is_silent:
            current += 1
        elif current:
            pause_runs.append(current)
            current = 0
    if current:
        pause_runs.append(current)

    long_pause_count = sum(1 for run in pause_runs if run * frame_seconds >= 0.25)
    transitions = int(np.count_nonzero(np.diff(silent.astype(np.int8))))
    voiced_segments = max(1, transitions // 2)
    energy_cv = float(np.std(rms) / max(np.mean(rms), 1e-8))

    pause_ratio_score = _clamp_score(features.pause_ratio * 260)
    long_pause_score = _clamp_score((long_pause_count / duration) * 85)
    fragmentation_score = _clamp_score((voiced_segments / duration) * 38)
    jitter_score = _clamp_score(features.jitter * 1800)
    shimmer_score = _clamp_score(features.shimmer * 650)
    energy_score = _clamp_score(energy_cv * 45)

    risk = _clamp_score(
        pause_ratio_score * 0.28
        + long_pause_score * 0.23
        + fragmentation_score * 0.20
        + jitter_score * 0.14
        + shimmer_score * 0.10
        + energy_score * 0.05
    )

    if risk >= 70:
        label = "High Stuttering Risk"
    elif risk >= 40:
        label = "Moderate Stuttering Risk"
    else:
        label = "Low Stuttering Risk"

    flat = features.to_flat_dict()
    flat.update({
        "stutter_pause_score": pause_ratio_score,
        "stutter_long_pause_score": long_pause_score,
        "stutter_fragmentation_score": fragmentation_score,
        "stutter_jitter_score": jitter_score,
        "stutter_shimmer_score": shimmer_score,
        "stutter_energy_score": energy_score,
        "stutter_long_pause_count": float(long_pause_count),
        "stutter_voiced_segments": float(voiced_segments),
    })
    setattr(features, "_stuttering_flat_features", flat)

    return PredictionResult(
        risk_score=risk,
        prediction_label=label,
        probability_confidence=_clamp_score(max(risk, 100 - risk)),
    )


class MoodAnalysisRequest(BaseModel):
    """Request body for POST /analyze-mood."""
    text: str = Field(
        ..., min_length=1, max_length=4_096,
        description="Chatbot reply or any short text to analyse for mood.",
        examples=["I'm feeling wonderful today and full of energy!"],
    )


class MoodAnalysisResponse(BaseModel):
    """Response body for POST /analyze-mood."""
    mood_score: float = Field(
        ..., ge=0, le=10,
        description="Mood score on a 0 (very negative) – 10 (very positive) scale.",
    )
    label: str = Field(
        ..., description="Categorical mood label: Energetic | Neutral | Low | Tired",
    )
    sentiment_details: dict[str, float] = Field(
        ..., description="Raw VADER scores: compound, positive, negative, neutral.",
    )


class HealthResponse(BaseModel):
    status: str
    loaded_models: list[str]
    version: str

class TTSRequest(BaseModel):
    """Request body for POST /bot/speak."""
    text: str = Field(
        ..., min_length=1, max_length=500,
        description="Text to convert to speech (max 500 chars).",
        examples=["नमस्ते! आज आप कैसा महसूस कर रहे हैं?"],
    )
    language: str = Field(
        default="hi-IN",
        description="BCP-47 language code, e.g. hi-IN, en-IN, ta-IN.",
        examples=["hi-IN"],
    )


class ConversationalAudioResponse(BaseModel):
    """Response body for POST /analyze-conversational-audio."""
    transcript: str = Field(..., description="Speech-to-text transcription from Sarvam STT.")
    activity_tag: str = Field(..., description="Activity tag passed by the caller.")
    # Mood
    mood_score: float = Field(..., ge=0, le=10, description="VADER mood score 0-10.")
    mood_label: str = Field(..., description="Energetic | Neutral | Low | Tired")
    sentiment_details: dict[str, float] = Field(..., description="Raw VADER scores.")
    # ML risk
    disease_type: str = Field(..., description="Disease type analysed.")
    risk_score: float = Field(..., ge=0, le=100, description="ML risk score 0-100.")
    prediction_label: str = Field(..., description="ML prediction label.")
    probability_confidence: float = Field(..., ge=0, le=100)
    features: dict[str, Any] = Field(..., description="Extracted acoustic features.")

@app.get(
    "/health",
    response_model=HealthResponse,
    summary="Service health check",
    tags=["Utility"],
)
async def health_check() -> HealthResponse:
    """Returns the service status and which disease models are loaded."""
    return HealthResponse(
        status="ok",
        loaded_models=available_diseases(),
        version="2.0.0",
    )


@app.post(
    "/analyze-audio",
    response_model=AudioAnalysisResponse,
    summary="Analyse a voice recording for disease risk",
    tags=["Audio Analysis"],
    status_code=status.HTTP_200_OK,
)
async def analyze_audio(
    audio_file: Annotated[
        UploadFile,
        File(description="Audio file (wav, mp3, ogg, flac, m4a, …)"),
    ],
    disease_type: Annotated[
        str,
        Form(
            description=(
                "Target disease type to assess. "
                f"Supported: {sorted(SUPPORTED_DISEASE_TYPES)}"
            )
        ),
    ],
) -> AudioAnalysisResponse:
    """
    **Process a voice recording and return an acoustic risk assessment.**

    1. Decodes the audio with PyDub, normalises volume, trims silence.
    2. Extracts 8 acoustic feature groups (13 MFCCs + 7 scalar features = 20 values).
    3. Scales features and runs the pre-trained model for the requested disease.
    4. Returns risk_score (0–100), prediction label, confidence, and the feature dict.

    **Supported disease types:** `parkinsons`, `respiratory`
    """
    # --- Validate disease type -----------------------------------------------
    disease_key = disease_type.lower().strip()
    if disease_key not in SUPPORTED_DISEASE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"Unsupported disease_type '{disease_type}'. "
                f"Choose from: {sorted(SUPPORTED_DISEASE_TYPES)}"
            ),
        )

    # --- Read audio bytes ----------------------------------------------------
    if audio_file.size is not None and audio_file.size > 50 * 1024 * 1024:  # 50 MB
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Audio file exceeds the 50 MB limit.",
        )
    raw_bytes: bytes = await audio_file.read()
    if not raw_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    # --- Step 1: Pre-process audio -------------------------------------------
    try:
        y, sr = preprocess_audio(raw_bytes)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Audio pre-processing failed: {exc}",
        ) from exc

    # --- Step 2: Extract features --------------------------------------------
    try:
        features: AudioFeatures = extract_features(y, sr)
    except Exception as exc:
        logger.error("Feature extraction error: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Feature extraction failed: {exc}",
        ) from exc

    # --- Step 3: Predict risk ------------------------------------------------
    if disease_key == "stuttering":
        result = predict_stuttering_risk(y, sr, features)
        response_features = getattr(features, "_stuttering_flat_features", features.to_flat_dict())
    else:
        try:
            bundle = get_bundle(disease_key)
        except KeyError:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=(
                    f"Model for '{disease_key}' is not loaded. "
                    "Check server logs for loading errors."
                ),
            )

        try:
            result = predict_risk(features, bundle)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=str(exc),
            ) from exc
        except RuntimeError as exc:
            logger.error("Prediction error: %s", exc, exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=str(exc),
            ) from exc
        response_features = features.to_flat_dict()

    # --- Build and return response -------------------------------------------
    return AudioAnalysisResponse(
        disease_type=disease_key,
        risk_score=result.risk_score,
        prediction_label=result.prediction_label,
        probability_confidence=result.probability_confidence,
        features=response_features,
    )


@app.post(
    "/analyze-mood",
    response_model=MoodAnalysisResponse,
    summary="Analyse chatbot reply text for wellness mood",
    tags=["Mood Analysis"],
    status_code=status.HTTP_200_OK,
)
async def analyze_mood_endpoint(body: MoodAnalysisRequest) -> MoodAnalysisResponse:
    """
    **Analyse the sentiment of a chatbot reply and return a wellness mood score.**

    Uses VADER (Valence Aware Dictionary and sEntiment Reasoner) to score the
    text and maps the result to:

    | mood_score | label     |
    |------------|-----------|
    | 0.0 – 3.0  | Tired     |
    | 3.1 – 4.9  | Low       |
    | 5.0 – 6.9  | Neutral   |
    | 7.0 – 10.0 | Energetic |
    """
    try:
        result: MoodResult = analyze_mood(body.text)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.error("Mood analysis error: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Mood analysis failed: {exc}",
        ) from exc

    return MoodAnalysisResponse(
        mood_score=result.mood_score,
        label=result.label,
        sentiment_details={
            "compound": result.compound,
            "positive": result.positive,
            "negative": result.negative,
            "neutral":  result.neutral,
        },
    )

# ─────────────────────────────────────────────────────────────────────────────
@app.post(
    "/bot/speak",
    summary="Convert chatbot text to speech (Sarvam TTS)",
    tags=["Sarvam Conversational"],
    response_class=StreamingResponse,
    responses={
        200: {"content": {"audio/wav": {}}, "description": "WAV audio stream."},
        503: {"description": "All Sarvam API keys exhausted."},
    },
)
async def bot_speak(body: TTSRequest) -> StreamingResponse:
    """
    **Convert text to speech using Sarvam AI TTS.**

    Accepts `{"text": "...", "language": "hi-IN"}` and streams back
    a WAV audio file.  Automatically rotates through the API key pool
    on rate-limit or quota errors.
    """
    try:
        audio_bytes: bytes = text_to_speech(body.text, body.language)
    except RuntimeError as exc:
        logger.error("TTS all keys failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.error("TTS unexpected error: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"TTS failed: {exc}",
        ) from exc

    return StreamingResponse(
        content=iter([audio_bytes]),
        media_type="audio/wav",
        headers={"Content-Disposition": 'attachment; filename="voxara_tts.wav"'},
    )

@app.post(
    "/analyze-conversational-audio",
    response_model=ConversationalAudioResponse,
    summary="STT → Mood + ML risk in a single call",
    tags=["Sarvam Conversational"],
    status_code=status.HTTP_200_OK,
)
async def analyze_conversational_audio(
    audio_file: Annotated[
        UploadFile,
        File(description="Voice audio file (wav, mp3, ogg, …)"),
    ],
    disease_type: Annotated[
        str,
        Form(description=f"Disease type: {sorted(SUPPORTED_DISEASE_TYPES)}"),
    ],
    activity_tag: Annotated[
        str,
        Form(description="Free-form activity label, e.g. 'morning-checkin', 'exercise'."),
    ] = "general",
) -> ConversationalAudioResponse:
    """
    **All-in-one conversational audio analysis.**

    1. Reads the uploaded audio and sends it to **Sarvam STT** for transcription.
    2. Runs **VADER** sentiment on the transcript → mood_score + label.
    3. Runs the **Librosa + ML** acoustic pipeline → risk_score + prediction.

    Returns a single unified JSON containing transcript, mood, and ML risk.
    """
    # --- Validate disease type -----------------------------------------------
    disease_key = disease_type.lower().strip()
    if disease_key not in SUPPORTED_DISEASE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"Unsupported disease_type '{disease_type}'. "
                f"Choose from: {sorted(SUPPORTED_DISEASE_TYPES)}"
            ),
        )

    # --- Read raw audio bytes ------------------------------------------------
    if audio_file.size is not None and audio_file.size > 50 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Audio file exceeds the 50 MB limit.",
        )
    raw_bytes: bytes = await audio_file.read()
    if not raw_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    # ── Step 1: Sarvam STT ────────────────────────────────────────────────────
    try:
        transcript: str = speech_to_text(raw_bytes)
    except RuntimeError as exc:
        logger.error("STT all keys failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.error("STT unexpected error: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"STT failed: {exc}",
        ) from exc

    # ── Step 2: VADER mood on transcript ──────────────────────────────────────
    try:
        mood: MoodResult = analyze_mood(transcript)
    except Exception as exc:
        logger.error("Mood analysis error: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Mood analysis failed: {exc}",
        ) from exc

    # ── Step 3: Librosa preprocessing + feature extraction ───────────────────
    try:
        y, sr = preprocess_audio(raw_bytes)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Audio pre-processing failed: {exc}",
        ) from exc

    try:
        features: AudioFeatures = extract_features(y, sr)
    except Exception as exc:
        logger.error("Feature extraction error: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Feature extraction failed: {exc}",
        ) from exc

    # ── Step 4: ML risk prediction ────────────────────────────────────────────
    try:
        bundle = get_bundle(disease_key)
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Model for '{disease_key}' is not loaded.",
        )
    try:
        ml_result: PredictionResult = predict_risk(features, bundle)
    except (ValueError, RuntimeError) as exc:
        logger.error("Prediction error: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    # ── Compose unified response ──────────────────────────────────────────────
    return ConversationalAudioResponse(
        transcript=transcript,
        activity_tag=activity_tag,
        mood_score=mood.mood_score,
        mood_label=mood.label,
        sentiment_details={
            "compound": mood.compound,
            "positive": mood.positive,
            "negative": mood.negative,
            "neutral":  mood.neutral,
        },
        disease_type=disease_key,
        risk_score=ml_result.risk_score,
        prediction_label=ml_result.prediction_label,
        probability_confidence=ml_result.probability_confidence,
        features=features.to_flat_dict(),
    )

# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    # Run with:  python main.py
    # Or:        uvicorn main:app --reload --host 0.0.0.0 --port 8000
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8000")),
        reload=bool(os.getenv("RELOAD", "true").lower() in ("1", "true", "yes")),
        log_level="info",
    )
