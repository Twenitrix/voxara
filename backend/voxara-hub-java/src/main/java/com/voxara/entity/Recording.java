package com.voxara.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Stores the result of one voice-analysis session per patient.
 */
@Entity
@Table(name = "recordings")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Recording {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "patient_id", nullable = false)
    private Patient patient;

    @Builder.Default
    @Column(nullable = false)
    private LocalDateTime date = LocalDateTime.now();

    /** Risk score returned by the Python ML model (0–100). */
    @Column(name = "risk_score")
    private Double riskScore;

    /** VADER mood score (0–10). */
    @Column(name = "mood_score")
    private Double moodScore;

    /** e.g. "High Risk", "Low Risk" */
    @Column(name = "prediction_label")
    private String predictionLabel;

    /** e.g. "walking", "rest", "exercise" */
    @Column(name = "activity_type")
    private String activityType;

    /** True when risk_score exceeds the clinical alert threshold (≥ 70). */
    @Builder.Default
    @Column(name = "alert_triggered")
    private Boolean alertTriggered = false;

    @Builder.Default
    @Column(name = "points_earned")
    private Integer pointsEarned = 0;

    /** Relative path: uploads/audio/<filename>.wav */
    @Column(name = "audio_file_url")
    private String audioFileUrl;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(name = "session_tag")
    private SessionTag sessionTag = SessionTag.STANDARD;

    /** STT transcript from Sarvam (may be mock during maintenance). */
    @Column(name = "transcribed_text", columnDefinition = "TEXT")
    private String transcribedText;

    /** AI-generated next physical task for the patient (via OpenRouter). */
    @Column(name = "next_instructions", columnDefinition = "TEXT")
    private String nextInstructions;
}
