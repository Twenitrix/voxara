package com.voxara.dto;

public record AuthResponse(
    String token,
    String email,
    String name,
    String condition
) {}
