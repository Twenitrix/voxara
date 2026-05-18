package com.voxara.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

/**
 * Application-level beans — RestClient for the Python ML service.
 */
@Configuration
public class AppConfig {

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
}
