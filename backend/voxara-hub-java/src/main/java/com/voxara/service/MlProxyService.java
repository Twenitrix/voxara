package com.voxara.service;

import com.voxara.dto.MlAnalysisResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

/**
 * Proxies audio to the Python FastAPI service for ML analysis.
 *
 * Python endpoint: POST /analyze-conversational-audio
 *   Form fields  : audio_file (multipart), disease_type, activity_tag
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MlProxyService {

    @Value("${voxara.python-ml-service.url:http://localhost:8000}")
    private String pythonServiceUrl;

    /**
     * Forward a MultipartFile to Python for combined STT + mood + ML analysis.
     *
     * @param file         the WAV audio upload
     * @param diseaseType  "parkinsons" or "respiratory"
     * @param activityTag  e.g. "morning-checkin", "exercise", "standard"
     * @return             parsed MlAnalysisResponse from Python
     */
    public MlAnalysisResponse analyze(
            MultipartFile file,
            String        diseaseType,
            String        activityTag
    ) {
        byte[] audioBytes;
        String filename = file.getOriginalFilename() != null
                          ? file.getOriginalFilename() : "recording.wav";
        try {
            audioBytes = file.getBytes();
        } catch (IOException e) {
            throw new RuntimeException("Failed to read uploaded audio bytes", e);
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();

        ByteArrayResource fileAsResource = new ByteArrayResource(audioBytes) {
            @Override
            public String getFilename() { return filename; }
        };

        body.add("audio_file", fileAsResource);
        body.add("disease_type", diseaseType);
        body.add("activity_tag", "standard");

        log.info("Forwarding audio to Python: disease={} activity={} size={}B",
                diseaseType, activityTag, audioBytes.length);

        HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);
        RestTemplate restTemplate = new RestTemplate();
        
        ResponseEntity<MlAnalysisResponse> responseEntity = restTemplate.postForEntity(
                pythonServiceUrl + "/analyze-conversational-audio",
                requestEntity,
                MlAnalysisResponse.class
        );

        MlAnalysisResponse response = responseEntity.getBody();

        if (response == null) {
            throw new RuntimeException("Python ML service returned an empty response");
        }

        log.info("ML result: risk={} mood={} label={}",
                response.riskScore(), response.moodScore(), response.predictionLabel());
        return response;
    }
}
