package com.voxara.service;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.*;
import java.util.UUID;

/**
 * Saves audio files to the local filesystem and serves them back as resources.
 * All files are stored under {voxara.storage.upload-dir} (default: ./uploads/audio).
 */
@Slf4j
@Service
public class FileStorageService {

    private final Path uploadRoot;

    public FileStorageService(@Value("${voxara.storage.upload-dir}") String uploadDir) {
        this.uploadRoot = Paths.get(uploadDir).toAbsolutePath().normalize();
    }

    @PostConstruct
    public void init() {
        try {
            Files.createDirectories(uploadRoot);
            log.info("Audio upload directory ready: {}", uploadRoot);
        } catch (IOException e) {
            throw new RuntimeException("Could not create upload directory: " + uploadRoot, e);
        }
    }

    /**
     * Persist a multipart audio file and return the relative storage path.
     *
     * @param file     the uploaded audio file
     * @return         relative path string stored in the Recording entity
     */
    public String store(MultipartFile file) {
        String originalName = file.getOriginalFilename();
        String extension    = (originalName != null && originalName.contains("."))
                              ? originalName.substring(originalName.lastIndexOf('.'))
                              : ".wav";
        String filename     = UUID.randomUUID() + extension;
        Path   target       = uploadRoot.resolve(filename);

        try {
            Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
            log.info("Stored audio file: {}", target);
            return "uploads/audio/" + filename;
        } catch (IOException e) {
            throw new RuntimeException("Failed to store audio file: " + filename, e);
        }
    }

    /**
     * Persist raw bytes (e.g. forwarded from another source) and return the path.
     */
    public String storeBytes(byte[] bytes, String extension) {
        String filename = UUID.randomUUID() + extension;
        Path   target   = uploadRoot.resolve(filename);
        try {
            Files.write(target, bytes);
            return "uploads/audio/" + filename;
        } catch (IOException e) {
            throw new RuntimeException("Failed to store audio bytes", e);
        }
    }

    /**
     * Load a stored file as a Spring Resource for streaming back via HTTP.
     */
    public Resource loadAsResource(String filename) {
        try {
            Path   file     = uploadRoot.resolve(filename).normalize();
            Resource resource = new UrlResource(file.toUri());
            if (resource.exists() && resource.isReadable()) {
                return resource;
            }
            throw new RuntimeException("File not found or not readable: " + filename);
        } catch (MalformedURLException e) {
            throw new RuntimeException("Malformed file path: " + filename, e);
        }
    }
}
