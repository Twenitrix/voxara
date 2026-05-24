import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import StatusBar from '../components/voxara/StatusBar';
import WaveformVisualizer from '../components/voxara/WaveformVisualizer';
import useAudioRecorder from '../hooks/useAudioRecorder';
import { analyzeVoice } from '@/lib/backendApi';
import { ArrowLeft, Pause, Play, Check, Plus } from 'lucide-react';

export default function Recording() {
    const navigate = useNavigate();
    const { isRecording, isPaused, elapsed, remaining, audioBlob, recorderError, startRecording, stopRecording, pauseRecording, resumeRecording, cleanup } = useAudioRecorder(15000);
    const [saved, setSaved] = useState(false);
    const [audioUrl, setAudioUrl] = useState(null);
    const [countdown, setCountdown] = useState(3);
    const [analysisError, setAnalysisError] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    useEffect(() => {
        if (countdown > 0) {
            const t = setTimeout(() => setCountdown(c => c - 1), 1000);
            return () => clearTimeout(t);
        } else {
            startRecording().catch(() => {});
        }
    }, [countdown, startRecording]);

    useEffect(() => {
        if (remaining <= 0 && isRecording) stopRecording();
    }, [remaining, isRecording, stopRecording]);

    useEffect(() => {
        if (audioBlob) {
            const url = URL.createObjectURL(audioBlob);
            setAudioUrl(url);
            return () => URL.revokeObjectURL(url);
        }
    }, [audioBlob]);

    const handleSave = useCallback(async () => {
        if (!audioBlob || isAnalyzing) return;
        setSaved(true);
        setIsAnalyzing(true);
        setAnalysisError('');
        localStorage.removeItem('voxara_backend_analysis');

        const recordingPhase = localStorage.getItem('voxara_recording_phase') || 'standard';
        const activityType = localStorage.getItem('voxara_activity_type') || 'standard';
        const sessionTag = recordingPhase === 'pre_activity' ? 'PRE_ACTIVITY' : recordingPhase === 'post_activity' ? 'POST_ACTIVITY' : 'STANDARD';

        // Send to Spring Boot backend for ML analysis
        try {
            const backendResult = await analyzeVoice(audioBlob, activityType, sessionTag);
            if (backendResult) {
                localStorage.setItem('voxara_backend_analysis', JSON.stringify(backendResult));
            }
        } catch (e) {
            console.warn('Backend analysis failed:', e.message);
            localStorage.removeItem('voxara_backend_analysis');
            setSaved(false);
            setIsAnalyzing(false);
            setAnalysisError(e.message || 'Backend analysis failed. Please check that Spring and Python services are running.');
            return;
        }

        if (recordingPhase === 'pre_activity' && localStorage.getItem('voxara_activity_flow') === 'enabled') {
            localStorage.setItem('voxara_recording_phase', 'pre_activity');
            navigate('/activity-challenge');
        } else {
            navigate('/analysis-result');
        }
    }, [audioBlob, isAnalyzing, navigate]);

    const handleNew = useCallback(() => {
        setSaved(false);
        setIsAnalyzing(false);
        setAudioUrl(null);
        setCountdown(3);
    }, []);

    useEffect(() => {
        return () => cleanup();
    }, [cleanup]);

    const formatTime = (ms) => {
        const secs = Math.floor(ms / 1000);
        const mins = Math.floor(secs / 60);
        const s = secs % 60;
        const centis = Math.floor((ms % 1000) / 10);
        return `${String(mins).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(centis).padStart(2, '0')}`;
    };

    return (
        <div className="min-h-screen flex flex-col max-w-lg mx-auto" style={{ background: '#FDF8F3' }}>
            <StatusBar />

            <div className="px-6 py-3 flex items-center gap-3">
                <button onClick={() => { cleanup(); navigate('/home'); }} className="w-[42px] h-[42px] rounded-[12px] bg-white border flex items-center justify-center" style={{ borderColor: '#F0DDD0' }}>
                    <ArrowLeft size={18} className="text-voxara-dark" />
                </button>
                <div className="flex-1 text-center">
                    <span className="text-xs font-medium text-voxara-muted tracking-widest uppercase">Voice Recording</span>
                </div>
                <div className="w-[42px]" />
            </div>

            <div className="flex-1 flex flex-col items-center justify-center px-8 gap-6">
                {countdown > 0 && (
                    <motion.div className="flex flex-col items-center gap-3">
                        <p className="text-sm font-medium text-voxara-muted tracking-widest uppercase">Recording starts in</p>
                        <motion.p key={countdown} initial={{ scale: 1.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.4 }} className="text-9xl font-light text-voxara-primary">
                            {countdown}
                        </motion.p>
                        <p className="text-sm text-voxara-muted">Get ready to speak naturally</p>
                    </motion.div>
                )}

                {countdown === 0 && (
                    <>
                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center">
                            <p className="text-lg font-medium text-voxara-dark">
                                {isRecording ? 'Recording your voice...' : isAnalyzing ? 'Analyzing with voice model...' : audioBlob ? (saved ? 'Recording saved!' : 'Recording complete') : recorderError ? 'Microphone unavailable' : 'Preparing...'}
                            </p>
                            {isAnalyzing && <p className="text-sm text-voxara-muted mt-1">Sending your audio to the backend ML service.</p>}
                            {isRecording && <p className="text-sm text-voxara-muted mt-1">Speak naturally. Every word matters.</p>}
                        </motion.div>

                        {isRecording && (
                            <div className="rounded-[12px] px-5 py-1.5 border" style={{ background: '#FFF5EE', borderColor: '#F0DDD0' }}>
                                <p className={`text-sm font-medium tracking-widest ${Math.ceil(remaining / 1000) <= 5 ? 'text-voxara-red' : 'text-voxara-primary'}`}>
                                    {formatTime(elapsed)} / 0:15
                                </p>
                            </div>
                        )}

                        <div className="relative flex items-center justify-center" style={{ width: 180, height: 180 }}>
                            <div className="absolute rounded-full" style={{ width: 180, height: 180, background: '#F5E4D4', opacity: 0.45 }} />
                            <div className="absolute rounded-full" style={{ width: 150, height: 150, background: '#EDD0B8', opacity: 0.5 }} />
                            {isRecording && (
                                <motion.div className="absolute rounded-full" style={{ width: 116, height: 116, background: 'rgba(200,112,74,0.2)' }}
                                    animate={{ scale: [1, 1.12, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
                            )}
                            <div className="relative rounded-full flex items-center justify-center z-10" style={{ width: 90, height: 90, background: '#C8704A', boxShadow: '0 0 0 4px rgba(200,112,74,0.2)' }}>
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                                    <rect x="9" y="2" width="6" height="11" rx="3" fill="white" />
                                    <path d="M5 11c0 3.866 3.134 7 7 7s7-3.134 7-7" stroke="white" strokeWidth="2" strokeLinecap="round" />
                                    <line x1="12" y1="18" x2="12" y2="22" stroke="white" strokeWidth="2" strokeLinecap="round" />
                                    <line x1="9" y1="22" x2="15" y2="22" stroke="white" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                            </div>
                        </div>

                        <div className="w-full h-20 rounded-[16px] overflow-hidden border px-2" style={{ background: '#FFF5EE', borderColor: '#F0DDD0' }}>
                            <WaveformVisualizer isActive={isRecording && !isPaused} color="#C8704A" />
                        </div>

                        {audioUrl && !isRecording && (
                            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                className="w-full rounded-[16px] p-4 border" style={{ background: '#FFF5EE', borderColor: '#F0DDD0' }}>
                                <p className="text-xs font-medium text-voxara-muted mb-2 tracking-wide">Preview your recording</p>
                                <audio controls src={audioUrl} className="w-full h-10" style={{ accentColor: '#C8704A' }} />
                            </motion.div>
                        )}

                        {analysisError && (
                            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                className="w-full rounded-[16px] p-3 border text-sm"
                                style={{ background: '#FDECEA', borderColor: '#FBCFCC', color: '#D94F3D' }}>
                                {analysisError}
                            </motion.div>
                        )}

                        {recorderError && (
                            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                className="w-full rounded-[16px] p-3 border text-sm"
                                style={{ background: '#FDECEA', borderColor: '#FBCFCC', color: '#D94F3D' }}>
                                {recorderError}
                            </motion.div>
                        )}

                        <motion.p className="text-5xl font-light tracking-wider tabular-nums text-voxara-dark" animate={{ opacity: isRecording ? 1 : 0.5 }}>
                            {formatTime(elapsed)}
                        </motion.p>

                        {isRecording && (
                            <motion.div className="flex items-center gap-2" animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
                                <div className="w-2.5 h-2.5 rounded-full bg-voxara-primary" />
                                <span className="text-sm font-medium text-voxara-primary">Live</span>
                            </motion.div>
                        )}
                    </>
                )}
            </div>

            {countdown === 0 && (
                <div className="px-8 pb-12">
                    <div className="flex items-center justify-center gap-6">
                        <motion.button whileTap={{ scale: 0.9 }} onClick={isPaused ? resumeRecording : pauseRecording} disabled={!isRecording}
                            className="w-14 h-14 rounded-full flex items-center justify-center disabled:opacity-30 border bg-white" style={{ borderColor: '#F0DDD0' }}>
                            {isPaused ? <Play size={22} className="text-voxara-dark ml-0.5" /> : <Pause size={22} className="text-voxara-dark" />}
                        </motion.button>

                        <motion.button whileTap={{ scale: 0.9 }} onClick={isRecording ? stopRecording : handleSave} disabled={(saved && !isRecording) || isAnalyzing}
                            className="w-20 h-20 rounded-full flex items-center justify-center shadow-xl disabled:opacity-30"
                            style={{ background: '#C8704A', boxShadow: '0 0 0 6px rgba(200,112,74,0.15)' }}>
                            <Check size={32} className="text-white" />
                        </motion.button>

                        <motion.button whileTap={{ scale: 0.9 }} onClick={handleNew} disabled={isRecording}
                            className="w-14 h-14 rounded-full flex items-center justify-center disabled:opacity-30 border bg-white" style={{ borderColor: '#F0DDD0' }}>
                            <Plus size={22} className="text-voxara-dark" />
                        </motion.button>
                    </div>
                    <div className="flex justify-center gap-12 mt-4">
                        <span className="text-xs font-medium uppercase text-voxara-muted">Pause</span>
                        <span className="text-xs font-medium uppercase text-voxara-muted">Save</span>
                        <span className="text-xs font-medium uppercase text-voxara-muted">New</span>
                    </div>
                </div>
            )}
        </div>
    );
}
