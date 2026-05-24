package com.voxara.controller;

import com.voxara.dto.ChatRequest;
import com.voxara.dto.ChatResponse;
import com.voxara.service.OpenRouterService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/patient/chat")
@RequiredArgsConstructor
public class ChatController {

    private final OpenRouterService openRouterService;

    @PostMapping
    public ResponseEntity<ChatResponse> chat(
            @RequestBody ChatRequest request,
            @org.springframework.security.core.annotation.AuthenticationPrincipal com.voxara.entity.Patient patient) {
        
        String userName = request.userName();
        if (patient != null && (userName == null || userName.isBlank())) {
            userName = patient.getName();
        }
        if (userName == null) {
            userName = "User";
        }
        
        String reply = openRouterService.generateChatReply(request.messages(), userName, request.greeting());
        return ResponseEntity.ok(new ChatResponse(reply));
    }
}
