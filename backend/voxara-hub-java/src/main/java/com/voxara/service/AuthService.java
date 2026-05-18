package com.voxara.service;

import com.voxara.dto.AuthResponse;
import com.voxara.dto.RegisterRequest;
import com.voxara.entity.Patient;
import com.voxara.repository.PatientRepository;
import com.voxara.security.JwtUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

/**
 * Handles patient registration and JWT-based login.
 */
@Service
@RequiredArgsConstructor
public class AuthService {

    private final PatientRepository    patientRepository;
    private final PasswordEncoder      passwordEncoder;
    private final JwtUtils             jwtUtils;
    private final AuthenticationManager authManager;

    /** Register a new patient and return a JWT immediately. */
    public AuthResponse register(RegisterRequest req) {
        if (patientRepository.existsByEmail(req.email())) {
            throw new IllegalArgumentException("Email already registered: " + req.email());
        }
        Patient patient = Patient.builder()
                .name(req.name())
                .email(req.email())
                .passwordHash(passwordEncoder.encode(req.password()))
                .condition(req.condition())
                .age(req.age())
                .gender(req.gender())
                .build();

        patientRepository.save(patient);
        String token = jwtUtils.generateToken(patient);
        return new AuthResponse(token, patient.getEmail(), patient.getName(), patient.getCondition());
    }

    /** Authenticate and return a fresh JWT. */
    public AuthResponse login(String email, String password) {
        authManager.authenticate(new UsernamePasswordAuthenticationToken(email, password));
        Patient patient = patientRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Patient not found"));
        String token = jwtUtils.generateToken(patient);
        return new AuthResponse(token, patient.getEmail(), patient.getName(), patient.getCondition());
    }
}
