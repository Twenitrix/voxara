package com.voxara.controller;

import com.voxara.dto.RecordingResponse;
import com.voxara.entity.Patient;
import com.voxara.service.FileStorageService;
import com.voxara.service.PatientService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import com.voxara.repository.PatientRepository;

import java.util.List;
import java.util.Map;

/**
 * Patient-facing endpoints — all require JWT.
 *
 *  POST /api/patient/analyze/voice          — upload audio for full ML analysis
 *  GET  /api/patient/history                — fetch recording history
 *  GET  /api/patient/audio/{filename}       — stream back a stored audio file
 *  GET  /api/patient/profile                — patient profile + gamification stats
 */

@Slf4j
@RestController
@RequestMapping("/api/patient")
@RequiredArgsConstructor
public class PatientController {

    private final PatientService     patientService;
    private final FileStorageService fileStorageService;
    private final PatientRepository  patientRepository;

    private Patient resolvePatient(Patient patient) {
        if (patient != null) return patient;
        return patientRepository.findAll().stream().findFirst().orElseGet(() -> {
            Patient demo = new Patient();
            demo.setName("Hackathon Demo");
            demo.setEmail("demo@voxara.com");
            demo.setPasswordHash("no-password");
            demo.setCondition("parkinsons");
            return patientRepository.save(demo);
        });
    }

    /**
     * POST /api/patient/analyze/voice
     *
     * Accepts multipart form:
     *   audio_file   (required) — WAV audio
     *   activity_type           — e.g. "morning-checkin"
     *   session_tag             — PRE_ACTIVITY | POST_ACTIVITY | STANDARD
     */
    @PostMapping(value = "/analyze/voice", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<RecordingResponse> analyzeVoice(
            @AuthenticationPrincipal Patient patient,
            @RequestPart("audio_file")                    MultipartFile audioFile,
            @RequestParam(value = "activity_type",  defaultValue = "standard")  String activityType,
            @RequestParam(value = "session_tag",    defaultValue = "STANDARD")  String sessionTag
    ) {
        patient = resolvePatient(patient);
        log.info("Voice analysis request: patient={} activity={}", patient.getId(), activityType);
        RecordingResponse result = patientService.analyzeVoice(
                patient, audioFile, activityType, sessionTag);
        return ResponseEntity.ok(result);
    }

    /**
     * GET /api/patient/history
     * Returns all recordings for the authenticated patient, newest first.
     */
    @GetMapping("/history")
    public ResponseEntity<List<RecordingResponse>> getHistory(
            @AuthenticationPrincipal Patient patient) {
        patient = resolvePatient(patient);
        return ResponseEntity.ok(patientService.getHistory(patient.getId()));
    }

    /**
     * GET /api/patient/audio/{filename}
     * Streams back a stored WAV file as audio/wav.
     */
    @GetMapping("/audio/{filename:.+}")
    public ResponseEntity<Resource> streamAudio(
            @AuthenticationPrincipal Patient patient,
            @PathVariable String filename
    ) {
        patient = resolvePatient(patient);
        Resource resource = fileStorageService.loadAsResource(filename);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("audio/wav"))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "inline; filename=\"" + filename + "\"")
                .body(resource);
    }

    /**
     * GET /api/patient/profile
     * Returns patient profile and gamification summary.
     */
    @GetMapping("/profile")
    public ResponseEntity<Map<String, Object>> getProfile(
            @AuthenticationPrincipal Patient patient) {
        patient = resolvePatient(patient);
        return ResponseEntity.ok(Map.of(
                "id",               patient.getId(),
                "name",             patient.getName(),
                "email",            patient.getEmail(),
                "condition",        patient.getCondition(),
                "age",              patient.getAge(),
                "gender",           patient.getGender() != null ? patient.getGender() : "",
                "currentStreak",    patient.getCurrentStreak(),
                "totalPoints",      patient.getTotalPoints(),
                "lastRecordedDate", patient.getLastRecordedDate() != null
                                    ? patient.getLastRecordedDate().toString() : null
        ));
    }
}
