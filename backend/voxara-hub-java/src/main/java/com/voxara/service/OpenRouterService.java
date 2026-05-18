package com.voxara.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

/**
 * Calls OpenRouter's OpenAI-compatible endpoint to generate a personalised
 * next physical task for the patient.
 *
 * <p>Waterfall strategy:
 * <ol>
 *   <li>Try with the PRIMARY API key (10-second timeout).</li>
 *   <li>On any exception, retry with the BACKUP API key.</li>
 *   <li>If the backup also fails, return a safe hardcoded instruction.</li>
 * </ol>
 */
@Slf4j
@Service
public class OpenRouterService {

    // ── Injected from application.yml ────────────────────────────────────────
    @Value("${voxara.openrouter.primary-key:}")
    private String primaryKey;

    @Value("${voxara.openrouter.backup-key:}")
    private String backupKey;

    // ── Constants ─────────────────────────────────────────────────────────────
    private static final String OPENROUTER_URL =
            "https://openrouter.ai/api/v1/chat/completions";

    private static final String MODEL = "google/gemini-2.0-flash-001";

    private static final String FALLBACK_INSTRUCTION =
            "DEMO MODE: AI OFFLINE";

    private static final String SYSTEM_PROMPT =
            "You are a friendly medical AI assistant guiding a user through physical tests. " +
            "Respond with exactly one short, encouraging sentence.";

    /** RestTemplate pre-configured with a 10-second connect + read timeout. */
    private final RestTemplate restTemplate;

    public OpenRouterService() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10000);  // 10 seconds
        factory.setReadTimeout(20000);     // 20 seconds — LLMs can be slow
        this.restTemplate = new RestTemplate(factory);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Waterfall entry-point: primary → backup → hardcoded fallback.
     *
     * @param transcript raw STT text from Python
     * @param riskScore  0–100 risk score from the ML model
     * @return one short instruction sentence
     */
    public String generateNextTask(String transcript, double riskScore) {
        // ── 1. Primary key ───────────────────────────────────────────────────
        try {
            String result = callOpenRouter(transcript, riskScore, primaryKey);
            log.info("[OpenRouter] Primary key succeeded.");
            return result;
        } catch (RestClientResponseException e) {
            log.warn("[OpenRouter] Primary key HTTP error: {} {}. Falling back to backup key.",
                    e.getStatusCode(), e.getMessage());
            System.err.println(e.getMessage());
            System.err.println("OPENROUTER ERROR (primary): " + e.getMessage());
            System.err.println("OPENROUTER RESPONSE BODY  : " + e.getResponseBodyAsString());
            System.out.println("OPENROUTER FAILED: " + e.getMessage());
        } catch (Exception e) {
            log.warn("[OpenRouter] Primary key failed: {}. Falling back to backup key.", e.getMessage());
            System.err.println(e.getMessage());
            System.err.println("OPENROUTER ERROR (primary): " + e.getMessage());
            System.out.println("OPENROUTER FAILED: " + e.getMessage());
        }

        // ── 2. Backup key ────────────────────────────────────────────────────
        try {
            String result = callOpenRouter(transcript, riskScore, backupKey);
            log.info("[OpenRouter] Backup key succeeded.");
            return result;
        } catch (RestClientResponseException e2) {
            log.error("[OpenRouter] Backup key HTTP error: {} {}. Using hardcoded fallback.",
                    e2.getStatusCode(), e2.getMessage());
            System.err.println(e2.getMessage());
            System.err.println("OPENROUTER ERROR (backup): " + e2.getMessage());
            System.err.println("OPENROUTER RESPONSE BODY : " + e2.getResponseBodyAsString());
            System.out.println("OPENROUTER FAILED: " + e2.getMessage());
        } catch (Exception e2) {
            log.error("[OpenRouter] Backup key also failed: {}. Using hardcoded fallback.", e2.getMessage());
            System.err.println(e2.getMessage());
            System.err.println("OPENROUTER ERROR (backup): " + e2.getMessage());
            System.out.println("OPENROUTER FAILED: " + e2.getMessage());
        }

        // ── 3. Hardcoded fallback ────────────────────────────────────────────
        return FALLBACK_INSTRUCTION;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal helpers
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Makes a single POST to the OpenRouter chat completion endpoint using the
     * supplied API key.
     *
     * @throws RuntimeException if the HTTP call fails or returns no content
     */
    private String callOpenRouter(String transcript, double riskScore, String providedApiKey) {
        String apiKey = (providedApiKey != null && !providedApiKey.isBlank())
                ? providedApiKey
                : "";

        String userPrompt = String.format(
                "Patient transcript: %s. Risk Score: %.1f. " +
                "Give them exactly one short physical task to do next " +
                "(e.g., walk up stairs, draw a spiral on paper).",
                transcript != null ? transcript : "(no transcript)",
                riskScore
        );

        // ── Build OpenAI-compatible payload ───────────────────────────────────
        Map<String, Object> requestBody = Map.of(
                "model", MODEL,
                "messages", List.of(
                        Map.of("role", "system", "content", SYSTEM_PROMPT),
                        Map.of("role", "user",   "content", userPrompt)
                )
        );

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Authorization", "Bearer " + apiKey);
        // OpenRouter recommends these optional headers for analytics / rate-limit bypass
        headers.set("HTTP-Referer", "https://voxara.app");
        headers.set("X-Title",     "Voxara Health");

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

        log.debug("[OpenRouter] POST {} | model={} | riskScore={}", OPENROUTER_URL, MODEL, riskScore);
        System.out.println(transcript);
        System.out.println("OPENROUTER TRANSCRIPT: " + transcript);
        try {
            System.out.println("DEBUG: Using Key starting with: " + apiKey.substring(0, 8));
        } catch(Exception e) {
            System.out.println("DEBUG: Using Key starting with: " + apiKey);
        }

        @SuppressWarnings("unchecked")
        Map<String, Object> response = restTemplate.postForObject(
                OPENROUTER_URL, entity, Map.class);

        if (response == null) {
            throw new RuntimeException("OpenRouter returned a null response body.");
        }

        // ── Parse: response.choices[0].message.content ───────────────────────
        try {
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> choices =
                    (List<Map<String, Object>>) response.get("choices");

            @SuppressWarnings("unchecked")
            Map<String, Object> message =
                    (Map<String, Object>) choices.get(0).get("message");

            String content = (String) message.get("content");

            if (content == null || content.isBlank()) {
                throw new RuntimeException("OpenRouter choice content was empty.");
            }
            return content.trim();

        } catch (Exception parseEx) {
            throw new RuntimeException("Failed to parse OpenRouter response: " + parseEx.getMessage(), parseEx);
        }
    }
}
