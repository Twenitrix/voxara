package com.voxara.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.Map;

/**
 * Maps the JSON returned by the Python /analyze-conversational-audio endpoint.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record MlAnalysisResponse(

    @JsonProperty("transcript")
    String transcribedText,

    @JsonProperty("activity_tag")
    String activityTag,

    @JsonProperty("mood_score")
    Double moodScore,

    @JsonProperty("mood_label")
    String moodLabel,

    @JsonProperty("sentiment_details")
    Map<String, Double> sentimentDetails,

    @JsonProperty("disease_type")
    String diseaseType,

    @JsonProperty("risk_score")
    Double riskScore,

    @JsonProperty("prediction_label")
    String predictionLabel,

    @JsonProperty("probability_confidence")
    Double probabilityConfidence,

    @JsonProperty("features")
    Map<String, Double> features
) {}
