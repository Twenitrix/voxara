package com.voxara.service;

import com.voxara.entity.Patient;
import com.voxara.repository.PatientRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDate;

/**
 * Calculates recording points and maintains the patient's daily streak.
 *
 * Rules
 * -----
 *  - +{pointsPerRecording} for every recording submitted.
 *  - +{streakBonus} bonus when the patient records on consecutive calendar days.
 *  - Streak resets to 1 if a day is skipped.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class GamificationService {

    private final PatientRepository patientRepository;

    @Value("${voxara.gamification.points-per-recording}") private int pointsPerRecording;
    @Value("${voxara.gamification.streak-bonus-points}")  private int streakBonusPoints;

    /** Clinical alert threshold — risk score >= this triggers an alert flag. */
    private static final double ALERT_THRESHOLD = 70.0;

    /**
     * Process gamification for a new recording.
     *
     * @param patient   the recording owner (mutated and saved)
     * @param riskScore ML risk score for the current recording
     * @return          total points earned for this recording
     */
    public int processRecording(Patient patient, double riskScore) {
        LocalDate today      = LocalDate.now();
        LocalDate lastRecord = patient.getLastRecordedDate();

        int earned = pointsPerRecording;

        // ── Streak logic ────────────────────────────────────────────────────
        if (lastRecord == null) {
            patient.setCurrentStreak(1);
        } else if (lastRecord.isEqual(today.minusDays(1))) {
            // Consecutive day — extend streak and award bonus
            patient.setCurrentStreak(patient.getCurrentStreak() + 1);
            earned += streakBonusPoints;
            log.info("Streak extended to {} days for patient {}", patient.getCurrentStreak(), patient.getId());
        } else if (!lastRecord.isEqual(today)) {
            // Missed a day — reset streak
            patient.setCurrentStreak(1);
        }
        // If lastRecord == today: same-day re-recording, no streak change

        patient.setLastRecordedDate(today);
        patient.setTotalPoints(patient.getTotalPoints() + earned);
        patientRepository.save(patient);

        log.info("Gamification: patient={} streak={} earned={} total={}",
                patient.getId(), patient.getCurrentStreak(), earned, patient.getTotalPoints());
        return earned;
    }

    /** Returns true if the risk score should trigger a clinical alert. */
    public boolean isAlertTriggered(double riskScore) {
        return riskScore >= ALERT_THRESHOLD;
    }
}
