package com.voxara.config;

import com.voxara.entity.Patient;
import com.voxara.repository.PatientRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.client.RestClient;

/**
 * Application-level beans — RestClient for the Python ML service.
 */
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class AppConfig {

    @Bean
    public WebMvcConfigurer corsConfigurer() {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry registry) {
                registry.addMapping("/**")
                        .allowedOriginPatterns("*")
                        .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                        .allowedHeaders("*")
                        .allowCredentials(true);
            }
        };
    }

    @Value("${voxara.python.base-url}")
    private String pythonBaseUrl;

    /**
     * Pre-configured RestClient targeting the Python FastAPI service.
     * Uses Spring 6.1's new RestClient (replaces RestTemplate).
     */
    @Bean
    public RestClient pythonRestClient() {
        return RestClient.builder()
                .baseUrl(pythonBaseUrl)
                .defaultHeader("Accept", "application/json")
                .build();
    }

    @Bean
    public CommandLineRunner initDemoUser(
            PatientRepository patientRepository,
            PasswordEncoder passwordEncoder) {
        return args -> {
            String demoEmail = "demo@voxara.com";
            Patient demo = patientRepository.findByEmail(demoEmail).orElseGet(Patient::new);
            demo.setName("Demo Patient");
            demo.setEmail(demoEmail);
            demo.setPasswordHash(passwordEncoder.encode("password"));
            demo.setCondition("stuttering");
            demo.setAge(24);
            try {
                patientRepository.saveAndFlush(demo);
                System.out.println("--- Demo Patient Ready: demo@voxara.com / password ---");
            } catch (DataIntegrityViolationException ignored) {
                System.out.println("--- Demo Patient Already Exists: demo@voxara.com / password ---");
            }
        };
    }
}
