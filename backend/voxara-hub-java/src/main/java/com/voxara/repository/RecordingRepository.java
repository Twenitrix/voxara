package com.voxara.repository;

import com.voxara.entity.Recording;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface RecordingRepository extends JpaRepository<Recording, UUID> {
    List<Recording> findByPatient_IdOrderByDateDesc(UUID patientId);
}
