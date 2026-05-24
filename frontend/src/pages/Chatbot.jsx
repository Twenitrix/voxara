import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Keyboard, Mic, Send, Square, Volume2 } from 'lucide-react';
import { sendChatMessage, getGreetingMessage } from '@/lib/backendApi';
import StatusBar from '../components/voxara/StatusBar';

const PHASE = {
    GREETING: 'greeting',
    CHATTING: 'chatting',
    GOING: 'going',
};

function getSpeechRecognition() {
    return window.SpeechRecognition || window.webkitSpeechRecognition;
}

export default function Chatbot() {
    const navigate = useNavigate();
    const [messages, setMessages] = useState([]);
    const [phase, setPhase] = useState(PHASE.GREETING);
    const [isTyping, setIsTyping] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [hasStarted, setHasStarted] = useState(false);
    const [inputText, setInputText] = useState('');
    const [liveText, setLiveText] = useState('');
    const [voiceError, setVoiceError] = useState('');

    const messagesEndRef = useRef(null);
    const recognitionRef = useRef(null);
    const silenceTimerRef = useRef(null);
    const conversationHistoryRef = useRef([]);
    const handledFinalRef = useRef(false);
    const name = localStorage.getItem('voxara_patient_name') || 'there';
    const speechSupported = typeof window !== 'undefined' && Boolean(getSpeechRecognition());

    const addMessage = useCallback((role, text) => {
        if (!text) return;
        setMessages(prev => [...prev, { role, text, id: Date.now() + Math.random() }]);
    }, []);

    const speak = useCallback((text, onEnd) => {
        if (!('speechSynthesis' in window)) {
            onEnd?.();
            return;
        }

        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.93;
        utterance.pitch = 1.05;
        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => {
            setIsSpeaking(false);
            onEnd?.();
        };
        utterance.onerror = () => {
            setIsSpeaking(false);
            onEnd?.();
        };
        window.speechSynthesis.speak(utterance);
    }, []);

    const beginVoiceTest = useCallback((activityType = 'conversation-checkin') => {
        window.speechSynthesis?.cancel();
        recognitionRef.current?.stop();
        localStorage.setItem('voxara_activity_type', activityType);
        localStorage.setItem('voxara_recording_phase', 'standard');
        localStorage.setItem('voxara_diary_answers', JSON.stringify(
            conversationHistoryRef.current.filter(m => m.role === 'user').map(m => m.content)
        ));
        navigate('/recording');
    }, [navigate]);

    const finishConversation = useCallback(() => {
        if (phase === PHASE.GOING) return;
        setPhase(PHASE.GOING);
        const goMsg = "Thanks for checking in. Let's do your voice test now.";
        addMessage('ai', goMsg);
        speak(goMsg);
        setTimeout(() => beginVoiceTest(), 1800);
    }, [addMessage, beginVoiceTest, phase, speak]);

    const handleUserMessage = useCallback(async (transcript) => {
        const cleanTranscript = transcript.trim();
        if (!cleanTranscript || isTyping || phase === PHASE.GOING) return;

        addMessage('user', cleanTranscript);
        setIsTyping(true);
        setVoiceError('');
        window.speechSynthesis?.cancel();

        conversationHistoryRef.current.push({ role: 'user', content: cleanTranscript });

        let rawReply;
        try {
            rawReply = await sendChatMessage(conversationHistoryRef.current, name);
        } catch {
            rawReply = "Thanks for sharing that. Let's capture your voice sample now so Voxara can analyse it. [START_VOICE_TEST]";
        }

        const activityMatch = rawReply.match(/\[SUGGEST_ACTIVITY:\s*(\w+)\]/i);
        const shouldStartVoiceTest = /\[(START_VOICE_TEST|END_CONVERSATION)\]/i.test(rawReply);
        const cleanReply = rawReply
            .replace(/\[SUGGEST_ACTIVITY:[^\]]*\]/gi, '')
            .replace(/\[(START_VOICE_TEST|END_CONVERSATION)\]/gi, '')
            .trim();

        conversationHistoryRef.current.push({ role: 'ai', content: cleanReply });
        addMessage('ai', cleanReply);
        setIsTyping(false);

        if (shouldStartVoiceTest) {
            speak(cleanReply || "Let's do your voice test now.");
            setTimeout(() => beginVoiceTest(), 1800);
            return;
        }

        if (activityMatch) {
            const activity = activityMatch[1].toLowerCase();
            localStorage.setItem('voxara_activity_type', activity);
            localStorage.setItem('voxara_diary_answers', JSON.stringify(
                conversationHistoryRef.current.filter(m => m.role === 'user').map(m => m.content)
            ));

            speak(cleanReply, () => {
                setTimeout(() => {
                    setPhase(PHASE.GOING);
                    const goMsg = "Alright. Let's record your voice now.";
                    addMessage('ai', goMsg);
                    speak(goMsg);
                    setTimeout(() => beginVoiceTest(activity), 1800);
                }, 400);
            });
            return;
        }

        speak(cleanReply);
    }, [addMessage, beginVoiceTest, isTyping, name, phase, speak]);

    const startListening = useCallback(() => {
        const SpeechRecognition = getSpeechRecognition();
        if (!SpeechRecognition) {
            setVoiceError('Voice input is not supported in this browser. You can type instead.');
            return;
        }
        if (isListening || isTyping || phase === PHASE.GOING) return;

        setVoiceError('');
        handledFinalRef.current = false;
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-IN';
        recognitionRef.current = recognition;
        let finalTranscript = '';

        recognition.onstart = () => setIsListening(true);
        recognition.onresult = (event) => {
            clearTimeout(silenceTimerRef.current);
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; i += 1) {
                const result = event.results[i];
                if (result.isFinal) finalTranscript += result[0].transcript;
                else interim += result[0].transcript;
            }
            setLiveText(finalTranscript || interim);
            silenceTimerRef.current = setTimeout(() => recognition.stop(), 1800);
        };
        recognition.onspeechend = () => {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = setTimeout(() => recognition.stop(), 500);
        };
        recognition.onend = () => {
            setIsListening(false);
            setLiveText('');
            const transcript = finalTranscript.trim();
            if (transcript && !handledFinalRef.current) {
                handledFinalRef.current = true;
                handleUserMessage(transcript);
            }
        };
        recognition.onerror = (event) => {
            setIsListening(false);
            setVoiceError(event.error === 'not-allowed'
                ? 'Microphone permission was blocked. Allow microphone access or type your reply.'
                : 'I could not hear that clearly. Try again or type your reply.');
        };

        try {
            recognition.start();
        } catch {
            setIsListening(false);
        }
    }, [handleUserMessage, isListening, isTyping, phase]);

    const stopListening = useCallback(() => {
        clearTimeout(silenceTimerRef.current);
        recognitionRef.current?.stop();
        setIsListening(false);
    }, []);

    const submitTypedMessage = useCallback(() => {
        const text = inputText.trim();
        if (!text) return;
        setInputText('');
        handleUserMessage(text);
    }, [handleUserMessage, inputText]);

    const startConversation = useCallback(() => {
        setHasStarted(true);
        setVoiceError('');
        const greeting = messages.find(m => m.role === 'ai')?.text;
        if (greeting) {
            speak(greeting, () => {
                if (speechSupported) setTimeout(() => startListening(), 250);
            });
        } else if (speechSupported) {
            startListening();
        }
    }, [messages, speak, speechSupported, startListening]);

    useEffect(() => {
        const init = async () => {
            setIsTyping(true);
            const text = await getGreetingMessage(name);
            conversationHistoryRef.current.push({ role: 'ai', content: text });
            addMessage('ai', text);
            setIsTyping(false);
            setPhase(PHASE.CHATTING);
        };
        init();
        return () => {
            window.speechSynthesis?.cancel();
            recognitionRef.current?.stop();
            clearTimeout(silenceTimerRef.current);
        };
    }, [addMessage, name]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping, liveText]);

    return (
        <div className="min-h-screen flex flex-col max-w-lg mx-auto" style={{ background: '#FDF8F3' }}>
            <StatusBar />

            <div className="px-6 py-3 flex items-center gap-3 border-b" style={{ borderColor: '#F0DDD0' }}>
                <button onClick={() => navigate('/home')} className="w-10 h-10 rounded-[12px] bg-white border flex items-center justify-center" style={{ borderColor: '#F0DDD0' }}>
                    <ArrowLeft size={18} className="text-voxara-dark" />
                </button>
                <div className="w-[46px] h-[46px] rounded-[14px] flex items-center justify-center" style={{ background: '#C8704A' }}>
                    <Mic size={23} className="text-white" />
                </div>
                <div className="flex-1">
                    <p className="text-lg font-medium text-voxara-dark">Voxara AI</p>
                    <div className="flex items-center gap-1.5">
                        <motion.div className="w-2 h-2 rounded-full bg-[#4CAF50]"
                            animate={{ scale: isListening ? [1, 1.4, 1] : 1 }}
                            transition={{ duration: 0.7, repeat: isListening ? Infinity : 0 }}
                        />
                        <p className="text-xs font-medium text-[#5A8A5C]">
                            {isTyping ? 'Thinking...' : isSpeaking ? 'Speaking...' : isListening ? 'Listening...' : phase === PHASE.GOING ? 'Preparing recording...' : 'Ready'}
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                <AnimatePresence>
                    {messages.map((msg) => (
                        <motion.div key={msg.id}
                            initial={{ opacity: 0, y: 10, scale: 0.97 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start gap-2.5 items-end'}`}
                        >
                            {msg.role === 'ai' && (
                                <div className="w-9 h-9 rounded-[11px] flex items-center justify-center flex-shrink-0" style={{ background: '#C8704A' }}>
                                    <Mic size={16} className="text-white" />
                                </div>
                            )}
                            <div className={`max-w-[78%] px-4 py-3 ${msg.role === 'user'
                                ? 'rounded-[18px_18px_4px_18px] text-voxara-dark'
                                : 'rounded-[18px_18px_18px_4px] bg-white border'}`}
                                style={msg.role === 'user' ? { background: '#F5E4D4' } : { borderColor: '#F0DDD0' }}
                            >
                                <p className="text-sm leading-relaxed text-voxara-dark">{msg.text}</p>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {isTyping && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start gap-2.5 items-end">
                        <div className="w-9 h-9 rounded-[11px] flex items-center justify-center flex-shrink-0" style={{ background: '#C8704A' }}>
                            <Mic size={16} className="text-white" />
                        </div>
                        <div className="bg-white border rounded-[18px_18px_18px_4px] px-4 py-3 flex gap-1.5" style={{ borderColor: '#F0DDD0' }}>
                            {[0, 1, 2].map(i => (
                                <motion.div key={i} className="w-2.5 h-2.5 rounded-full bg-voxara-primary"
                                    animate={{ opacity: [0.9, 0.2, 0.9] }} transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }} />
                            ))}
                        </div>
                    </motion.div>
                )}

                {isListening && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end">
                        <div className="max-w-[78%] px-4 py-3 rounded-[18px_18px_4px_18px]" style={{ background: '#F5E4D4' }}>
                            {liveText ? (
                                <p className="text-sm text-voxara-dark">{liveText}</p>
                            ) : (
                                <div className="flex items-center gap-2 py-1">
                                    <Mic size={14} className="text-voxara-primary" />
                                    <div className="flex gap-1">
                                        {[0, 1, 2, 3].map(i => (
                                            <motion.div key={i} className="w-1 rounded-full bg-voxara-primary"
                                                animate={{ height: ['8px', '20px', '8px'] }}
                                                transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {phase === PHASE.CHATTING && (
                <div className="px-5 pb-5 pt-3 border-t" style={{ borderColor: '#F0DDD0', background: '#FDF8F3' }}>
                    {voiceError && (
                        <p className="text-xs text-center mb-2" style={{ color: '#D94F3D' }}>{voiceError}</p>
                    )}

                    {!hasStarted ? (
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={startConversation}
                                className="rounded-[16px] px-4 py-3 flex items-center justify-center gap-2 text-white font-medium"
                                style={{ background: '#C8704A' }}>
                                <Volume2 size={16} />
                                Start voice chat
                            </button>
                            <button onClick={finishConversation}
                                className="rounded-[16px] px-4 py-3 flex items-center justify-center gap-2 bg-white border font-medium text-voxara-dark"
                                style={{ borderColor: '#F0DDD0' }}>
                                <Mic size={16} />
                                Voice test
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={isListening ? stopListening : startListening}
                                    disabled={!speechSupported || isTyping}
                                    className="w-12 h-12 rounded-[16px] flex items-center justify-center disabled:opacity-40"
                                    style={{ background: isListening ? '#D94F3D' : '#C8704A' }}
                                    title={speechSupported ? (isListening ? 'Stop listening' : 'Speak') : 'Speech recognition unavailable'}
                                >
                                    {isListening ? <Square size={17} className="text-white" /> : <Mic size={18} className="text-white" />}
                                </button>
                                <div className="flex-1 rounded-[16px] bg-white border px-3 flex items-center gap-2" style={{ borderColor: '#F0DDD0' }}>
                                    <Keyboard size={16} className="text-voxara-muted" />
                                    <input
                                        value={inputText}
                                        onChange={e => setInputText(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') submitTypedMessage();
                                        }}
                                        placeholder={speechSupported ? 'Speak or type a reply' : 'Type your reply'}
                                        className="w-full py-3 bg-transparent text-sm outline-none text-voxara-dark placeholder:text-voxara-muted"
                                        disabled={isTyping}
                                    />
                                </div>
                                <button
                                    onClick={submitTypedMessage}
                                    disabled={!inputText.trim() || isTyping}
                                    className="w-12 h-12 rounded-[16px] flex items-center justify-center disabled:opacity-40"
                                    style={{ background: '#C8704A' }}
                                >
                                    <Send size={17} className="text-white" />
                                </button>
                            </div>
                            <button
                                onClick={finishConversation}
                                className="w-full mt-3 text-xs text-voxara-muted underline underline-offset-2">
                                Finish chat and start voice test
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
