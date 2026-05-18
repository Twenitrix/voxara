"""
model_loader.py
---------------
Loads pre-trained ML models and their associated scalers from
  ./backend/models/
on application startup and exposes them as a typed singleton.

Supported disease types
-----------------------
  "parkinsons"   -> voxara_parkinsons_model.pkl  + voxara_parkinsons_scaler.pkl
  "respiratory"  -> voxara_respiratory_model.pkl + voxara_respiratory_scaler.pkl
                    + voxara_respiratory_encoder.pkl   (label encoder)

Filename discovery uses a flexible glob so it tolerates the " (1)" suffixes
that may appear on downloaded files.

Note: All log strings use ASCII only (no Unicode arrows) to avoid
UnicodeEncodeError on Windows cp1252 terminals.
"""

from __future__ import annotations

import glob
import logging
import os
from dataclasses import dataclass, field
from typing import Any

import joblib
import numpy as np

logger = logging.getLogger(__name__)

# ── Path configuration ─────────────────────────────────────────────────────────
_HERE = os.path.dirname(__file__)
MODELS_DIR: str = os.path.join(_HERE, "models")

# ── Typed container ────────────────────────────────────────────────────────────
@dataclass
class DiseaseBundle:
    """Everything needed to make a prediction for one disease type."""
    disease_type: str
    model: Any                              # sklearn / XGBoost estimator
    scaler: Any                             # sklearn StandardScaler / MinMaxScaler
    label_encoder: Any | None = None        # sklearn LabelEncoder (optional)
    label_map: dict[int, str] = field(      # fallback int → human label mapping
        default_factory=lambda: {0: "Low Risk", 1: "High Risk"}
    )

# ── Registry singleton ─────────────────────────────────────────────────────────
_REGISTRY: dict[str, DiseaseBundle] = {}


def _glob_first(pattern: str) -> str | None:
    """Return the first file matching *pattern* (case-insensitive glob)."""
    matches = glob.glob(pattern, recursive=False)
    return matches[0] if matches else None


def load_all_models() -> None:
    """
    Scan MODELS_DIR and populate the global _REGISTRY.

    Called once at FastAPI startup.  Failures are logged but do NOT crash the
    server — endpoints will return 503 for that specific disease type.
    """
    logger.info("Loading ML models from: %s", MODELS_DIR)

    _load_parkinsons()
    _load_respiratory()

    loaded = list(_REGISTRY.keys())
    logger.info("Model registry populated: %s", loaded)


def get_bundle(disease_type: str) -> DiseaseBundle:
    """
    Retrieve the DiseaseBundle for *disease_type*.

    Raises
    ------
    KeyError  if that disease type was not loaded successfully.
    """
    key = disease_type.lower().strip()
    if key not in _REGISTRY:
        available = list(_REGISTRY.keys())
        raise KeyError(
            f"No model loaded for disease_type='{key}'. "
            f"Available: {available}"
        )
    return _REGISTRY[key]


def available_diseases() -> list[str]:
    """Return a list of disease types that have models loaded."""
    return list(_REGISTRY.keys())

def _load_parkinsons() -> None:
    model_path  = _glob_first(os.path.join(MODELS_DIR, "voxara_parkinsons_model*.pkl"))
    scaler_path = _glob_first(os.path.join(MODELS_DIR, "voxara_parkinsons_scaler*.pkl"))

    if not model_path or not scaler_path:
        logger.warning("Parkinson's model/scaler not found — skipping.")
        return

    try:
        model  = joblib.load(model_path)
        scaler = joblib.load(scaler_path)
        logger.info("Loaded Parkinson's model  <- %s", os.path.basename(model_path))
        logger.info("Loaded Parkinson's scaler <- %s", os.path.basename(scaler_path))

        _REGISTRY["parkinsons"] = DiseaseBundle(
            disease_type="parkinsons",
            model=model,
            scaler=scaler,
            label_map={0: "Low Risk", 1: "High Risk"},
        )
    except Exception as exc:
        logger.error("Failed to load Parkinson's bundle: %s", exc, exc_info=True)


def _load_respiratory() -> None:
    model_path   = _glob_first(os.path.join(MODELS_DIR, "voxara_respiratory_model*.pkl"))
    scaler_path  = _glob_first(os.path.join(MODELS_DIR, "voxara_respiratory_scaler*.pkl"))
    encoder_path = _glob_first(os.path.join(MODELS_DIR, "voxara_respiratory_encoder*.pkl"))

    if not model_path or not scaler_path:
        logger.warning("Respiratory model/scaler not found — skipping.")
        return

    try:
        model   = joblib.load(model_path)
        scaler  = joblib.load(scaler_path)
        encoder = joblib.load(encoder_path) if encoder_path else None

        logger.info("Loaded Respiratory model   <- %s", os.path.basename(model_path))
        logger.info("Loaded Respiratory scaler  <- %s", os.path.basename(scaler_path))
        if encoder:
            logger.info("Loaded Respiratory encoder <- %s", os.path.basename(encoder_path))

        # Build label_map from encoder classes if available
        label_map: dict[int, str] = {0: "Healthy", 1: "At Risk"}
        if encoder is not None and hasattr(encoder, "classes_"):
            label_map = {i: str(c) for i, c in enumerate(encoder.classes_)}

        _REGISTRY["respiratory"] = DiseaseBundle(
            disease_type="respiratory",
            model=model,
            scaler=scaler,
            label_encoder=encoder,
            label_map=label_map,
        )
    except Exception as exc:
        logger.error("Failed to load Respiratory bundle: %s", exc, exc_info=True)
