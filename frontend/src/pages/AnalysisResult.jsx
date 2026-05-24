import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import StatusBar from '../components/voxara/StatusBar';
import CustomEmoji from '../components/voxara/CustomEmoji';
import { getHistory } from '@/lib/backendApi';

const moodMap = {
    Energetic: { emoji: 'smile', label: 'Your check-in sounded energetic' },
    Neutral: { emoji: 'neutral', label: 'Your check-in sounded neutral' },
    Low: { emoji: 'sad', label: 'Your check-in sounded low' },
    Tired: { emoji: 'neutral', label: 'Your check-in sounded tired' },
    Unavailable: { emoji: 'neutral', label: 'Mood analysis was not available for this recording' },
};

function riskLevel(label, score) {
    if (label === 'High Risk' || score >= 70) return 'High';
    if (label === 'Low Risk' || score < 35) return 'Low';
    return 'Moderate';
}

function formatFeature(value, digits = 3) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return 'N/A';
    return Number(value).toFixed(digits);
}

function featureCards(features = {}) {
    const baseCards = [
        {
            label: 'Pitch F0',
            value: formatFeature(features.pitch_f0, 1),
            unit: 'Hz',
            status: features.pitch_f0 ? 'Measured' : 'Unavailable',
        },
        {
            label: 'Jitter',
            value: formatFeature(features.jitter, 4),
            unit: '',
            status: features.jitter !== undefined ? 'Measured' : 'Unavailable',
        },
        {
            label: 'Shimmer',
            value: formatFeature(features.shimmer, 4),
            unit: '',
            status: features.shimmer !== undefined ? 'Measured' : 'Unavailable',
        },
        {
            label: 'Pause Ratio',
            value: formatFeature(features.pause_ratio, 3),
            unit: '',
            status: features.pause_ratio !== undefined ? 'Measured' : 'Unavailable',
        },
        {
            label: 'RMS Energy',
            value: formatFeature(features.rms_energy, 4),
            unit: '',
            status: features.rms_energy !== undefined ? 'Measured' : 'Unavailable',
        },
        {
            label: 'Spectral Centroid',
            value: formatFeature(features.spectral_centroid, 1),
            unit: 'Hz',
            status: features.spectral_centroid ? 'Measured' : 'Unavailable',
        },
    ];

    const stutterCards = [
        ['Pause Score', 'stutter_pause_score'],
        ['Long Pauses', 'stutter_long_pause_score'],
        ['Fragmentation', 'stutter_fragmentation_score'],
        ['Voice Instability', 'stutter_jitter_score'],
    ]
        .filter(([, key]) => features[key] !== undefined)
        .map(([label, key]) => ({
            label,
            value: formatFeature(features[key], 1),
            unit: '/ 100',
            status: 'Measured',
        }));

    return stutterCards.length ? stutterCards.concat(baseCards.slice(0, 2)) : baseCards;
}

function mapBackendResult(recording) {
    const score = Math.round(recording.riskScore ?? recording.risk_score ?? 0);
    const label = recording.predictionLabel ?? recording.prediction_label ?? 'Model result';
    const moodScore = recording.moodScore ?? recording.mood_score;
    const moodLabel = recording.moodLabel ?? recording.mood_label;
    const features = recording.acousticFeatures ?? recording.acoustic_features ?? {};

    return {
        risk_score: score,
        risk_level: riskLevel(label, score),
        prediction_label: label,
        disease_type: recording.diseaseType ?? recording.disease_type ?? 'voice model',
        mood_score: moodScore,
        mood: moodLabel || (moodScore == null ? 'Unavailable' : 'Neutral'),
        points_earned: recording.pointsEarned ?? recording.points_earned ?? 0,
        transcribed_text: recording.transcribedText ?? recording.transcribed_text,
        next_instructions: recording.nextInstructions ?? recording.next_instructions,
        features,
        cards: featureCards(features),
    };
}

export default function AnalysisResult() {
    const navigate = useNavigate();
    const [analysis, setAnalysis] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const loadAnalysis = async () => {
            const backendRaw = localStorage.getItem('voxara_backend_analysis');

            if (backendRaw) {
                try {
                    const result = mapBackendResult(JSON.parse(backendRaw));
                    setAnalysis(result);
                    localStorage.removeItem('voxara_backend_analysis');
                } catch {
                    setError('Could not read the latest backend analysis result.');
                } finally {
                    cleanupSession();
                    setLoading(false);
                }
                return;
            }

            try {
                const history = await getHistory();
                if (history?.length) {
                    setAnalysis(mapBackendResult(history[0]));
                } else {
                    setError('No voice analysis result was found. Please record again.');
                }
            } catch {
                setError('Could not load analysis history from the backend.');
            } finally {
                cleanupSession();
                setLoading(false);
            }
        };

        loadAnalysis();
    }, []);

    const cleanupSession = () => {
        localStorage.removeItem('voxara_pre_recording_id');
        localStorage.removeItem('voxara_post_recording_id');
        localStorage.removeItem('voxara_activity_type');
        localStorage.removeItem('voxara_diary_answers');
        localStorage.removeItem('voxara_recording_phase');
    };

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center max-w-lg mx-auto px-8" style={{ background: '#FDF8F3' }}>
                <div className="w-12 h-12 border-4 rounded-full animate-spin mb-6" style={{ borderColor: '#F0DDD0', borderTopColor: '#C8704A' }} />
                <CustomEmoji name="sparkle" size={32} />
                <p className="text-voxara-dark font-semibold mt-4 text-lg">Loading backend analysis...</p>
                <p className="text-voxara-muted text-sm mt-1">Reading the model result</p>
            </div>
        );
    }

    if (error || !analysis) {
        return (
            <div className="min-h-screen max-w-lg mx-auto px-7 pt-10" style={{ background: '#FDF8F3' }}>
                <StatusBar />
                <div className="bg-white border rounded-[20px] p-5 mt-8" style={{ borderColor: '#FBCFCC' }}>
                    <p className="text-lg font-medium text-voxara-dark mb-2">Analysis unavailable</p>
                    <p className="text-sm text-voxara-muted">{error}</p>
                    <button onClick={() => navigate('/recording')} className="w-full mt-5 py-4 rounded-[18px] text-white font-medium" style={{ background: '#C8704A' }}>
                        Record Again
                    </button>
                </div>
            </div>
        );
    }

    const mood = moodMap[analysis.mood] || moodMap.Unavailable;
    const isHighRisk = analysis.risk_level === 'High';

    return (
        <div className="min-h-screen pb-12 max-w-lg mx-auto" style={{ background: '#FDF8F3' }}>
            <StatusBar />

            <div className="px-7 pt-6">
                <motion.h1 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                    className="text-[26px] font-medium text-voxara-dark mb-5">
                    Voice Model Analysis
                </motion.h1>

                <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring' }}
                    className="flex flex-col items-center mb-5">
                    <div className="relative w-36 h-36">
                        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                            <circle cx="60" cy="60" r="50" fill="none" stroke="#F0DDD0" strokeWidth="8" />
                            <motion.circle cx="60" cy="60" r="50" fill="none"
                                stroke={analysis.risk_level === 'Low' ? '#3D8B40' : analysis.risk_level === 'Moderate' ? '#C8704A' : '#D94F3D'}
                                strokeWidth="8" strokeLinecap="round"
                                strokeDasharray={`${(analysis.risk_score / 100) * 314} 314`}
                                initial={{ strokeDasharray: '0 314' }}
                                animate={{ strokeDasharray: `${(analysis.risk_score / 100) * 314} 314` }}
                                transition={{ duration: 1.2, ease: 'easeOut' }}
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-4xl font-medium text-voxara-dark">{analysis.risk_score}</span>
                            <span className="text-xs font-medium" style={{ color: analysis.risk_level === 'Low' ? '#3D8B40' : analysis.risk_level === 'Moderate' ? '#C8704A' : '#D94F3D' }}>
                                {analysis.risk_level} Risk
                            </span>
                        </div>
                    </div>
                    <p className="text-sm text-voxara-muted mt-2">{analysis.prediction_label} - {analysis.disease_type}</p>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                    className="bg-white rounded-[20px] p-4 mb-3 flex items-center gap-3 border" style={{ borderColor: '#F0DDD0' }}>
                    <CustomEmoji name={mood.emoji} size={32} />
                    <div>
                        <p className="text-sm font-medium text-voxara-dark">{mood.label}</p>
                        {analysis.mood_score != null && <p className="text-xs text-voxara-muted">Mood score: {Number(analysis.mood_score).toFixed(1)} / 10</p>}
                    </div>
                </motion.div>

                {isHighRisk && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
                        className="rounded-[20px] p-4 mb-3 flex items-center gap-3 border"
                        style={{ background: '#FDECEA', borderColor: '#FBCFCC' }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#D94F3D" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
                        <p className="text-sm font-medium text-[#D94F3D]">Elevated model risk detected. Share this report with a clinician.</p>
                    </motion.div>
                )}

                <div className="grid grid-cols-2 gap-3 mb-5">
                    {analysis.cards.map((card, i) => (
                        <motion.div key={card.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.06 }}
                            className="bg-white rounded-[20px] p-4 border" style={{ borderColor: '#F0DDD0' }}>
                            <div className="flex items-center justify-between mb-2 gap-2">
                                <span className="text-xs font-medium text-voxara-muted">{card.label}</span>
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                    style={{
                                        background: card.status === 'Measured' ? '#E8F5EA' : '#F5EDE8',
                                        color: card.status === 'Measured' ? '#2D6A30' : '#8A6650'
                                    }}>
                                    {card.status}
                                </span>
                            </div>
                            <p className="text-2xl font-medium text-voxara-dark mb-1">{card.value}</p>
                            {card.unit && <p className="text-xs text-voxara-muted">{card.unit}</p>}
                        </motion.div>
                    ))}
                </div>

                {analysis.transcribed_text && (
                    <div className="bg-white border rounded-[20px] p-4 mb-4" style={{ borderColor: '#F0DDD0' }}>
                        <p className="text-xs font-medium text-voxara-muted mb-1">Transcript</p>
                        <p className="text-sm text-voxara-dark">{analysis.transcribed_text}</p>
                    </div>
                )}

                {analysis.next_instructions && (
                    <div className="bg-white border rounded-[20px] p-4 mb-4" style={{ borderColor: '#F0DDD0' }}>
                        <p className="text-xs font-medium text-voxara-muted mb-1">AI next step</p>
                        <p className="text-sm text-voxara-dark">{analysis.next_instructions}</p>
                    </div>
                )}

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
                    className="rounded-[20px] p-4 mb-5 flex items-center gap-3" style={{ background: '#C8704A' }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                        <path d="M12 2C9 6 6 8 7 12c0 3 2 5 5 5s5-2 5-5c0-2-1-3.5-2-4.5-0.5 1.5-1.5 2.5-3 3 1-2.5 0-5.5 0-10.5z" fill="white" />
                    </svg>
                    <p className="text-white font-medium">+{analysis.points_earned} points earned today</p>
                </motion.div>

                <motion.button initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}
                    onClick={() => navigate('/dashboard')}
                    className="w-full py-5 rounded-[20px] text-white font-medium text-[17px] mb-3"
                    style={{ background: '#C8704A' }}>
                    View Full Dashboard
                </motion.button>
                <motion.button initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}
                    onClick={() => navigate('/home')}
                    className="w-full py-3 rounded-[20px] font-medium text-sm text-voxara-primary">
                    Back to Home
                </motion.button>
            </div>
        </div>
    );
}
