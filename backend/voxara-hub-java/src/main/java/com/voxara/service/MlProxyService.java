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
 * Python endpoint: POST /analyze-audio
 *   Form fields  : audio_file (multipart), disease_type
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MlProxyService {

    @Value("${voxara.python-ml-service.url:http://localhost:8000}")
    private String pythonServiceUrl;

    /**
     * Forward a MultipartFile to Python for local acoustic ML analysis.
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
        body.add("disease_type", normalizeDiseaseType(diseaseType));

        log.info("Forwarding audio to Python: disease={} activity={} size={}B",
                diseaseType, activityTag, audioBytes.length);

        HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);
        RestTemplate restTemplate = new RestTemplate();
        
        ResponseEntity<MlAnalysisResponse> responseEntity = restTemplate.postForEntity(
                pythonServiceUrl + "/analyze-audio",
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

    private String normalizeDiseaseType(String diseaseType) {
        String key = diseaseType == null ? "" : diseaseType.toLowerCase().trim();
        if (key.contains("parkinson")) {
            return "parkinsons";
        }
        if (key.contains("stutter") || key.contains("speech") || key.contains("voice")
                || key.contains("impediment") || key.contains("fluency")) {
            return "stuttering";
        }
        if (key.contains("copd") || key.contains("asthma") || key.contains("pneumonia")
                || key.contains("bronchitis") || key.contains("respiratory")) {
            return "respiratory";
        }
        return "stuttering";
    }
}
