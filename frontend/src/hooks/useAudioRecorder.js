import { useState, useRef, useCallback } from 'react';

function writeString(view, offset, value) {
    for (let i = 0; i < value.length; i += 1) {
        view.setUint8(offset + i, value.charCodeAt(i));
    }
}

function audioBufferToWav(audioBuffer) {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const samples = audioBuffer.length;
    const bytesPerSample = 2;
    const blockAlign = numberOfChannels * bytesPerSample;
    const buffer = new ArrayBuffer(44 + samples * blockAlign);
    const view = new DataView(buffer);

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + samples * blockAlign, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bytesPerSample * 8, true);
    writeString(view, 36, 'data');
    view.setUint32(40, samples * blockAlign, true);

    let offset = 44;
    const channels = Array.from({ length: numberOfChannels }, (_, channel) => audioBuffer.getChannelData(channel));
    for (let i = 0; i < samples; i += 1) {
        for (let channel = 0; channel < numberOfChannels; channel += 1) {
            const sample = Math.max(-1, Math.min(1, channels[channel][i]));
            view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
            offset += bytesPerSample;
        }
    }

    return new Blob([buffer], { type: 'audio/wav' });
}

async function convertBlobToWav(blob) {
    if (blob.type === 'audio/wav' || blob.type === 'audio/wave') return blob;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
        throw new Error('This browser cannot prepare the recording for analysis.');
    }

    const audioContext = new AudioContextClass();
    try {
        const arrayBuffer = await blob.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        return audioBufferToWav(audioBuffer);
    } finally {
        audioContext.close?.();
    }
}

export default function useAudioRecorder(maxDuration = 15000) {
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const [audioBlob, setAudioBlob] = useState(null);
    const [recorderError, setRecorderError] = useState('');
    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);
    const timerRef = useRef(null);
    const startTimeRef = useRef(null);
    const streamRef = useRef(null);

    const requestPermission = useCallback(async () => {
        if (!navigator.mediaDevices?.getUserMedia) {
            throw new Error('Microphone recording is not supported in this browser.');
        }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        return stream;
    }, []);

    const startRecording = useCallback(async () => {
        chunksRef.current = [];
        setAudioBlob(null);
        setElapsed(0);
        setRecorderError('');

        try {
            let stream = streamRef.current;
            if (!stream) {
                stream = await requestPermission();
            }

            const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : undefined;
            const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = async () => {
                const rawBlob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
                try {
                    const wavBlob = await convertBlobToWav(rawBlob);
                    setAudioBlob(wavBlob);
                } catch (error) {
                    setAudioBlob(rawBlob);
                    setRecorderError(error?.message || 'Could not prepare this recording for analysis.');
                }
            };

            mediaRecorder.start(100);
            setIsRecording(true);
            setIsPaused(false);
            startTimeRef.current = Date.now();

            timerRef.current = setInterval(() => {
                const now = Date.now();
                const ms = now - startTimeRef.current;
                setElapsed(ms);
                if (ms >= maxDuration) {
                    stopRecording();
                }
            }, 100);
        } catch (error) {
            const message = error?.name === 'NotAllowedError'
                ? 'Microphone permission was blocked. Allow microphone access and tap New to try again.'
                : error?.message || 'Could not start microphone recording.';
            setRecorderError(message);
            setIsRecording(false);
            setIsPaused(false);
            throw error;
        }
    }, [maxDuration, requestPermission]);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        clearInterval(timerRef.current);
        setIsRecording(false);
        setIsPaused(false);
    }, []);

    const pauseRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.pause();
            clearInterval(timerRef.current);
            setIsPaused(true);
        }
    }, []);

    const resumeRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
            mediaRecorderRef.current.resume();
            startTimeRef.current = Date.now() - elapsed;
            timerRef.current = setInterval(() => {
                const ms = Date.now() - startTimeRef.current;
                setElapsed(ms);
                if (ms >= maxDuration) stopRecording();
            }, 100);
            setIsPaused(false);
        }
    }, [elapsed, maxDuration, stopRecording]);

    const cleanup = useCallback(() => {
        stopRecording();
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
    }, [stopRecording]);

    return {
        isRecording,
        isPaused,
        elapsed,
        audioBlob,
        recorderError,
        startRecording,
        stopRecording,
        pauseRecording,
        resumeRecording,
        requestPermission,
        cleanup,
        remaining: Math.max(0, maxDuration - elapsed),
    };
}
