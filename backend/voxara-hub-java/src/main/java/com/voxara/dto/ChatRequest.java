package com.voxara.dto;

import java.util.List;

public record ChatRequest(
        List<Message> messages,
        String userName,
        boolean greeting
) {
    public record Message(String role, String content) {}
}
