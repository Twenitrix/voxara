package com.voxara.service;

import com.voxara.dto.MlAnalysisResponse;
import com.voxara.dto.RecordingResponse;
import com.voxara.entity.Patient;
import com.voxara.entity.Recording;
import com.voxara.entity.SessionTag;
import com.voxara.repository.PatientRepository;
import com.voxara.repository.RecordingRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;
import org.springframework.transaction.annotation.Transactional;

/**
 * Orchestrates the full voice-analysis pipeline:
 *   save file → proxy to Python → gamification → persist Recording.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PatientService {

    private final FileStorageService  fileStorageService;
    private final MlProxyService      mlProxyService;
    private final GamificationService gamificationService;
    private final OpenRouterService   openRouterService;
    private final RecordingRepository recordingRepository;
    private final PatientRepository   patientRepository;

    /**
     * Full voice-analysis pipeline.
     *
     * @param patient      authenticated patient from JWT
     * @param audioFile    uploaded WAV file
     * @param activityType free-form label (e.g. "morning-checkin")
     * @param sessionTag   PRE_ACTIVITY | POST_ACTIVITY | STANDARD
     * @return             saved RecordingResponse DTO
     */
    @Transactional
    public RecordingResponse analyzeVoice(
            Patient      patient,
            MultipartFile audioFile,
            String        activityType,
            String        sessionTag
    ) {
        // HACKATHON FAILSAFE: Security is off, so we force-load a demo patient
        if (patient == null) {
            patient = patientRepository.findAll().stream().findFirst().orElseGet(() -> {
                Patient demo = new Patient();
                demo.setName("Hackathon Demo User");
                demo.setEmail("guest-" + UUID.randomUUID() + "@voxara.local");
                demo.setPasswordHash("no-password");
                demo.setCondition("parkinsons");
                return patientRepository.save(demo);
            });
        }

        // 1. Persist audio locally
        String audioPath = fileStorageService.store(audioFile);

        // 2. Forward to Python ML service
        MlAnalysisResponse ml = mlProxyService.analyze(
                audioFile,
                patient.getCondition(),
                activityType != null ? activityType : "standard"
        );

        // 3. Gamification — points + streak update
        double riskScore    = ml.riskScore() != null ? ml.riskScore() : 0.0;
        int    pointsEarned = gamificationService.processRecording(patient, riskScore);
        boolean alert       = gamificationService.isAlertTriggered(riskScore);

        if (alert) {
            log.warn("CLINICAL ALERT: patient={} risk={}", patient.getId(), riskScore);
        }

        // 4. Generate AI next-task instruction via OpenRouter (primary → backup → fallback)
        String nextInstructions = openRouterService.generateNextTask(
                ml.transcribedText() != null ? ml.transcribedText() : "Voice recording analysed locally.",
                riskScore);
        log.info("[OpenRouter] nextInstructions=\"{}\"", nextInstructions);

        // 5. Build and save Recording
        SessionTag tag;
        try {
            tag = sessionTag != null ? SessionTag.valueOf(sessionTag.toUpperCase()) : SessionTag.STANDARD;
        } catch (IllegalArgumentException e) {
            tag = SessionTag.STANDARD;
        }

        Recording recording = Recording.builder()
                .patient(patient)
                .riskScore(riskScore)
                .moodScore(ml.moodScore())
                .predictionLabel(ml.predictionLabel())
                .activityType(activityType)
                .alertTriggered(alert)
                .pointsEarned(pointsEarned)
                .audioFileUrl(audioPath)
                .sessionTag(tag)
                .transcribedText(ml.transcribedText())
                .nextInstructions(nextInstructions)
                .build();

        Recording savedEntity = recordingRepository.save(recording);
        log.info("Successfully saved analysis for patient: {}", savedEntity.getId());

        RecordingResponse base = RecordingResponse.from(savedEntity);
        return new RecordingResponse(
                base.id(),
                base.date(),
                base.riskScore(),
                base.moodScore(),
                base.predictionLabel(),
                base.activityType(),
                base.alertTriggered(),
                base.pointsEarned(),
                base.audioFileUrl(),
                base.sessionTag(),
                base.transcribedText(),
                base.nextInstructions(),
                ml.diseaseType(),
                ml.features()
        );
    }

    /** Return all recordings for the authenticated patient, newest first. */
    public List<RecordingResponse> getHistory(UUID patientId) {
        return recordingRepository.findByPatient_IdOrderByDateDesc(patientId)
                .stream()
                .map(RecordingResponse::from)
                .toList();
    }
}
