package com.voxara.repository;

import com.voxara.entity.Medication;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface MedicationRepository extends JpaRepository<Medication, UUID> {
    List<Medication> findByPatient_IdOrderByDateAscTimeAsc(UUID patientId);
}
