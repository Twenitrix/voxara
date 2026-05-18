package com.voxara.dto;

import com.voxara.entity.Recording;
import com.voxara.entity.SessionTag;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Outbound DTO for a Recording — hides internal entity and relationship fields.
 */
public record RecordingResponse(
    UUID          id,
    LocalDateTime date,
    Double        riskScore,
    Double        moodScore,
    String        predictionLabel,
    String        activityType,
    Boolean       alertTriggered,
    Integer       pointsEarned,
    String        audioFileUrl,
    SessionTag    sessionTag,
    String        transcribedText,
    String        nextInstructions
) {
    /** Factory method — converts a Recording entity to this DTO. */
    public static RecordingResponse from(Recording r) {
        return new RecordingResponse(
            r.getId(),
            r.getDate(),
            r.getRiskScore(),
            r.getMoodScore(),
            r.getPredictionLabel(),
            r.getActivityType(),
            r.getAlertTriggered(),
            r.getPointsEarned(),
            r.getAudioFileUrl(),
            r.getSessionTag(),
            r.getTranscribedText(),
            r.getNextInstructions()
        );
    }
}
