"""
predictor.py
────────────
Applies a loaded DiseaseBundle (scaler + model) to an AudioFeatures vector
and returns a typed PredictionResult.

Public API
----------
  predict_risk(features, bundle) → PredictionResult
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import numpy as np

from backend.audio_processor import AudioFeatures
from backend.model_loader import DiseaseBundle

logger = logging.getLogger(__name__)


@dataclass
class PredictionResult:
    """Typed result returned by predict_risk."""
    risk_score: float            # 0-100 continuous risk score
    prediction_label: str        # Human-readable class label
    probability_confidence: float  # 0-100 confidence of the predicted class


def predict_risk(
    features: AudioFeatures,
    bundle: DiseaseBundle,
) -> PredictionResult:
    """
    Scale *features*, run model inference, and return a PredictionResult.

    Steps
    -----
    1. Convert AudioFeatures → 2-D numpy array (1 sample × N features).
    2. Apply the bundle's scaler (StandardScaler / MinMaxScaler).
    3. Run model.predict and model.predict_proba.
    4. Map class index → human label via bundle.label_map.
    5. Express probability as 0-100 score; derive risk_score.

    The feature vector produced by AudioFeatures.to_numpy() has 20 elements
    (13 MFCCs + pitch + jitter + shimmer + zcr + pause_ratio + rms + spectral).
    If a model was trained on a different number of features the scaler's
    transform step will raise a clear ValueError.
    """
    raw_vector: np.ndarray = features.to_numpy().reshape(1, -1)
    logger.debug("predict_risk: raw vector shape %s", raw_vector.shape)

    # --- 1. Scale -------------------------------------------------------------
    try:
        scaled: np.ndarray = bundle.scaler.transform(raw_vector)
    except Exception as exc:
        raise ValueError(
            f"Scaler transform failed for disease_type='{bundle.disease_type}'. "
            f"Feature vector has {raw_vector.shape[1]} elements. "
            f"Error: {exc}"
        ) from exc

    # --- 2. Predict -----------------------------------------------------------
    try:
        class_index: int = int(bundle.model.predict(scaled)[0])
    except Exception as exc:
        raise RuntimeError(
            f"Model prediction failed for '{bundle.disease_type}': {exc}"
        ) from exc

    # --- 3. Probability -------------------------------------------------------
    confidence_0_100: float = 50.0   # default if predict_proba not available
    if hasattr(bundle.model, "predict_proba"):
        proba: np.ndarray = bundle.model.predict_proba(scaled)[0]
        raw_confidence: float = float(proba[class_index])
        confidence_0_100 = round(raw_confidence * 100, 2)
    elif hasattr(bundle.model, "decision_function"):
        # For SVMs etc. — map decision score to 0-100 via sigmoid
        decision: float = float(bundle.model.decision_function(scaled)[0])
        confidence_0_100 = round(_sigmoid(decision) * 100, 2)

    # --- 4. Human-readable label ---------------------------------------------
    label: str = bundle.label_map.get(class_index, f"Class {class_index}")

    # --- 5. Risk score (probability of the *positive* / high-risk class) ------
    risk_score: float = confidence_0_100
    if hasattr(bundle.model, "predict_proba"):
        proba_all: np.ndarray = bundle.model.predict_proba(scaled)[0]
        # Positive class is the last class by sklearn convention
        risk_score = round(float(proba_all[-1]) * 100, 2)

    logger.info(
        "predict_risk: disease=%s label=%s risk=%.1f confidence=%.1f",
        bundle.disease_type,
        label,
        risk_score,
        confidence_0_100,
    )

    return PredictionResult(
        risk_score=risk_score,
        prediction_label=label,
        probability_confidence=confidence_0_100,
    )


# ── Helpers ───────────────────────────────────────────────────────────────────

def _sigmoid(x: float) -> float:
    """Numerically stable sigmoid."""
    if x >= 0:
        return 1.0 / (1.0 + np.exp(-x))
    exp_x = np.exp(x)
    return exp_x / (1.0 + exp_x)
