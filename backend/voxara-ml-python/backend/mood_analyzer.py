"""
mood_analyzer.py
────────────────
Performs text-based sentiment analysis and maps the result to a
structured mood score and label for Voxara's chatbot replies.

Public API
----------
  analyze_mood(text) → MoodResult

Sentiment engine: VADER (vaderSentiment / nltk.sentiment.vader)
Mood scale      : 0–10   (0 = most negative, 10 = most positive)
Mood labels     : Energetic | Neutral | Low | Tired
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# ── VADER bootstrap ────────────────────────────────────────────────────────────
# Download the VADER lexicon silently on first import if not present.
try:
    import nltk
    _NLTK_DATA = os.path.join(os.path.expanduser("~"), "nltk_data")
    if not os.path.exists(os.path.join(_NLTK_DATA, "sentiment", "vader_lexicon.zip")):
        nltk.download("vader_lexicon", quiet=True)
    from nltk.sentiment.vader import SentimentIntensityAnalyzer
    _ANALYZER = SentimentIntensityAnalyzer()
    logger.info("VADER SentimentIntensityAnalyzer loaded via NLTK.")

except Exception as exc_nltk:
    # Fallback: try vaderSentiment standalone package
    logger.warning("NLTK VADER unavailable (%s); trying vaderSentiment package.", exc_nltk)
    try:
        from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer  # type: ignore
        _ANALYZER = SentimentIntensityAnalyzer()
        logger.info("VADER SentimentIntensityAnalyzer loaded via vaderSentiment package.")
    except Exception as exc_vader:
        logger.error("Both VADER backends failed: %s", exc_vader)
        _ANALYZER = None  # type: ignore


# ── Mood thresholds ────────────────────────────────────────────────────────────
# compound score is in [-1, 1]; mapped → 0-10 linearly.
# Labels are calibrated to Voxara's wellness context:
#   0.0 – 3.0  → Tired       (very negative / exhausted tone)
#   3.1 – 4.9  → Low         (mildly negative / subdued)
#   5.0 – 6.9  → Neutral     (balanced / calm)
#   7.0 – 10.0 → Energetic   (positive / upbeat)

_LABEL_THRESHOLDS: list[tuple[float, str]] = [
    (3.0, "Tired"),
    (4.9, "Low"),
    (6.9, "Neutral"),
    (10.0, "Energetic"),
]


@dataclass
class MoodResult:
    mood_score: float   # 0–10 continuous scale
    label: str          # Energetic | Neutral | Low | Tired
    compound: float     # Raw VADER compound [-1, 1]
    positive: float     # VADER pos score
    negative: float     # VADER neg score
    neutral: float      # VADER neu score


def analyze_mood(text: str) -> MoodResult:
    """
    Analyse *text* with VADER and return a MoodResult.

    Parameters
    ----------
    text : str
        Chatbot reply or any short text to analyse.

    Returns
    -------
    MoodResult
    """
    if not text or not text.strip():
        logger.warning("analyze_mood received empty text; returning neutral defaults.")
        return MoodResult(
            mood_score=5.0,
            label="Neutral",
            compound=0.0,
            positive=0.0,
            negative=0.0,
            neutral=1.0,
        )

    if _ANALYZER is None:
        raise RuntimeError(
            "VADER sentiment analyser is not available. "
            "Install 'nltk' or 'vaderSentiment' and ensure the lexicon is downloaded."
        )

    scores: dict[str, float] = _ANALYZER.polarity_scores(text)
    compound: float = scores["compound"]            # in [-1, 1]
    mood_score: float = round((compound + 1) * 5, 2)  # map to [0, 10]
    label: str = _score_to_label(mood_score)

    logger.debug(
        "analyze_mood: compound=%.3f → mood_score=%.2f label=%s",
        compound, mood_score, label,
    )

    return MoodResult(
        mood_score=mood_score,
        label=label,
        compound=round(compound, 4),
        positive=round(scores["pos"], 4),
        negative=round(scores["neg"], 4),
        neutral=round(scores["neu"], 4),
    )


def _score_to_label(score: float) -> str:
    """Map a 0-10 mood_score to a human label."""
    for threshold, label in _LABEL_THRESHOLDS:
        if score <= threshold:
            return label
    return "Energetic"
