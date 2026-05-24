// Central API client for Voxara Spring Boot backend
// Change this to your deployed URL when sharing externally
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8080';

// ── Token helpers ──────────────────────────────────────────────────

export function getToken() {
    return localStorage.getItem('voxara_jwt');
}

function authHeaders() {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handleResponse(res) {
    if (!res.ok) {
        const text = await res.text();
        const error = new Error(text || `HTTP ${res.status}`);
        error.status = res.status;
        throw error;
    }
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) return res.json();
    return res.text();
}

// ── Auth ────────────────────────────────────────────────────────────

export async function registerAccount({ name, email, password, condition, age, gender }) {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, condition, age, gender }),
    });
    return handleResponse(res);
}

export async function loginAccount({ email, password }) {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });
    const data = await handleResponse(res);
    // Backend returns: { token, email, name, condition }
    if (data.token) {
        localStorage.setItem('voxara_jwt', data.token);
    }
    return data;
}

export function logout() {
    localStorage.removeItem('voxara_jwt');
    localStorage.removeItem('voxara_patient_name');
    window.location.href = '/';
}

// ── Patient ─────────────────────────────────────────────────────────

export async function getProfile() {
    const res = await fetch(`${BASE_URL}/api/patient/profile`, {
        headers: { ...authHeaders() },
    });
    return handleResponse(res);
}

export async function getHistory() {
    const res = await fetch(`${BASE_URL}/api/patient/history`, {
        headers: { ...authHeaders() },
    });
    return handleResponse(res);
}

// ── Voice Analysis ──────────────────────────────────────────────────

export async function analyzeVoice(audioBlob, activityType = 'standard', sessionTag = 'STANDARD') {
    const formData = new FormData();
    const extension = audioBlob.type.includes('wav') || audioBlob.type.includes('wave')
        ? 'wav'
        : audioBlob.type.includes('ogg')
            ? 'ogg'
            : 'webm';
    formData.append('audio_file', audioBlob, `recording.${extension}`);
    formData.append('activity_type', activityType);
    formData.append('session_tag', sessionTag);

    const res = await fetch(`${BASE_URL}/api/patient/analyze/voice`, {
        method: 'POST',
        headers: { ...authHeaders() },
        body: formData,
    });
    return handleResponse(res);
}

export function getAudioUrl(filename) {
    const token = getToken();
    return `${BASE_URL}/api/patient/audio/${filename}${token ? `?token=${token}` : ''}`;
}

// ── Chat (AI conversation) ──────────────────────────────────────────
// If your backend doesn't have /api/patient/chat yet, this provides
// a simple fallback that generates responses client-side.

export async function sendChatMessage(conversationHistory, userName) {
    // Try backend chat endpoint first
    try {
        const res = await fetch(`${BASE_URL}/api/patient/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify({ messages: conversationHistory, userName }),
        });
        if (res.ok) {
            const data = await handleResponse(res);
            return data.reply || data.message || data;
        }
    } catch {
        // Backend chat not available — fall through
    }

    // Fallback: simple rule-based responses for the hackathon demo
    const lastUserMsg = conversationHistory
        .filter(m => m.role === 'user')
        .pop()?.content?.toLowerCase() || '';

    const exchangeCount = conversationHistory.filter(m => m.role === 'user').length;

    if (exchangeCount >= 3) {
        return "Thanks for sharing that with me. Let's capture your voice sample now so Voxara can analyse it. [START_VOICE_TEST]";
    }

    // Conversational responses
    const responses = [
        "That's really interesting! Tell me more — what's been the best part of your day so far?",
        "I'm glad to hear that! How has your energy been today compared to yesterday?",
        "Thanks for sharing that with me. Have you been getting enough rest lately?",
        "That makes sense. How would you rate your overall mood today on a scale of 1 to 10?",
    ];
    return responses[Math.min(exchangeCount, responses.length - 1)];
}

export async function getGreetingMessage(userName) {
    try {
        const res = await fetch(`${BASE_URL}/api/patient/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify({ messages: [], userName, greeting: true }),
        });
        if (res.ok) {
            const data = await handleResponse(res);
            return data.reply || data.message || data;
        }
    } catch {
        // fallback
    }
    return `Hey ${userName}! How are you doing today? I'd love to hear about your morning.`;
}
