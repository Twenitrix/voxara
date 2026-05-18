package com.voxara.security;

import com.voxara.repository.PatientRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.*;
import org.springframework.stereotype.Service;

/**
 * Loads Patient by email for Spring Security authentication.
 */
@Service
@RequiredArgsConstructor
public class UserDetailsServiceImpl implements UserDetailsService {

    private final PatientRepository patientRepository;

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        return patientRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException(
                        "Patient not found with email: " + email));
    }
}
