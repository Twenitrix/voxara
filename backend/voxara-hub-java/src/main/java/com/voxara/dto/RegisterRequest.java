package com.voxara.dto;

import jakarta.validation.constraints.*;

public record RegisterRequest(
    @NotBlank                  String  name,
    @NotBlank @Email           String  email,
    @NotBlank @Size(min = 6)   String  password,
    @NotBlank                  String  condition,
    @Min(1) @Max(120)          Integer age,
                               String  gender
) {}
