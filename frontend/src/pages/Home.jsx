import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getProfile, getHistory } from '@/lib/backendApi';
import { useAuth } from '@/lib/AuthContext';
import StatusBar from '../components/voxara/StatusBar';
import MicButton from '../components/voxara/MicButton';

export default function Home() {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    const [patient, setPatient] = useState(null);
    const [lastAnalysis, setLastAnalysis] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            if (!isAuthenticated) {
                navigate('/');
                return;
            }
            try {
                const profile = await getProfile();
                setPatient(profile);

                const history = await getHistory();
                if (history.length > 0) {
                    // Map backend RecordingResponse to display format
                    const latest = history[0];
                    setLastAnalysis({
                        risk_score: Math.round(latest.riskScore || 0),
                        risk_level: latest.predictionLabel === 'High Risk' ? 'High' : latest.predictionLabel === 'Low Risk' ? 'Low' : 'Moderate',
                    });
                }
            } catch (e) {
                console.error('Failed to load home data:', e);
            }
            setLoading(false);
        };
        load();
    }, [navigate, isAuthenticated]);

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 17) return 'Good Afternoon';
        return 'Good Evening';
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-8 h-8 border-3 rounded-full animate-spin" style={{ borderColor: '#F0DDD0', borderTopColor: '#C8704A' }} />
            </div>
        );
    }

    const name = (patient?.name || localStorage.getItem('voxara_patient_name') || 'there').split(' ')[0];
    const streak = patient?.currentStreak || 0;

    return (
        <div className="min-h-screen pb-24 max-w-lg mx-auto" style={{ background: '#FDF8F3' }}>
            <StatusBar />

            <div className="px-7 pt-4">
                {/* Greeting */}
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
                    <p className="text-sm font-medium text-voxara-text mb-1">
                        {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </p>
                    <h1 className="text-[28px] font-medium text-voxara-dark leading-tight mb-1">
                        {getGreeting()}, {name}
                    </h1>
                    <p className="text-base text-voxara-text">Let's check in with your voice today</p>
                </motion.div>

                {/* Streak Card */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                    className="rounded-[22px] p-5 mb-3 flex items-center gap-4"
                    style={{ background: '#C8704A' }}
                >
                    <div className="rounded-[15px] flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.2)', width: 52, height: 52 }}>
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                            <path d="M12 2C9 6 6 8 7 12c0 3 2 5 5 5s5-2 5-5c0-2-1-3.5-2-4.5-0.5 1.5-1.5 2.5-3 3 1-2.5 0-5.5 0-10.5z" fill="white" />
                        </svg>
                    </div>
                    <div className="flex-1">
                        <p className="text-xl font-medium text-white mb-0.5">Day {streak} streak</p>
                        <p className="text-sm text-white/80">+{streak > 0 ? 20 : 0} points earned today</p>
                    </div>
                    <div className="rounded-[14px] px-4 py-2.5 text-center" style={{ background: 'rgba(255,255,255,0.22)' }}>
                        <p className="text-[22px] font-medium text-white leading-none">{streak}</p>
                        <p className="text-[11px] text-white/75 mt-0.5 tracking-wider">DAYS</p>
                    </div>
                </motion.div>

                {/* Today's Status */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                    className="bg-white rounded-[22px] p-5 mb-7 flex items-center gap-4 border"
                    style={{ borderColor: '#F0DDD0' }}
                >
                    <div className="w-[50px] h-[50px] rounded-[14px] flex items-center justify-center flex-shrink-0 border" style={{ background: '#FDF0E8', borderColor: '#F0DDD0' }}>
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                            <path d="M12 21c-5.63-5.5-11-10.3-11-14.4 0-3.8 3.1-5.2 5.3-5.2 1.3 0 4.2.5 5.7 4.5 1.6-4 4.5-4.5 5.7-4.5 2.5 0 5.3 1.6 5.3 5.2C23 10.7 17.6 15.5 12 21z" fill="#FDDAC8" stroke="#C8704A" strokeWidth="1.5" />
                        </svg>
                    </div>
                    <div className="flex-1">
                        <p className="text-xs font-medium text-voxara-muted mb-1 tracking-wide">Today's health score</p>
                        {lastAnalysis ? (
                            <div className="flex items-baseline gap-2">
                                <span className="text-[32px] font-medium text-voxara-dark leading-none">{lastAnalysis.risk_score}</span>
                                <span className="text-sm text-voxara-muted">/ 100</span>
                            </div>
                        ) : (
                            <p className="text-base font-medium text-voxara-dark">Not recorded yet</p>
                        )}
                    </div>
                    {lastAnalysis && (
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="rounded-[12px] px-3.5 py-2 flex items-center gap-1.5 border"
                            style={{ background: lastAnalysis.risk_level === 'Low' ? '#E8F5EA' : lastAnalysis.risk_level === 'Moderate' ? '#FFF5EE' : '#FDECEA', borderColor: lastAnalysis.risk_level === 'Low' ? '#C3E6C8' : '#F0DDD0' }}
                        >
                            <div className="w-2 h-2 rounded-full" style={{ background: lastAnalysis.risk_level === 'Low' ? '#3D8B40' : lastAnalysis.risk_level === 'Moderate' ? '#C8704A' : '#D94F3D' }} />
                            <span className="text-sm font-medium" style={{ color: lastAnalysis.risk_level === 'Low' ? '#2D6A30' : lastAnalysis.risk_level === 'Moderate' ? '#C8704A' : '#D94F3D' }}>
                                {lastAnalysis.risk_level}
                            </span>
                        </button>
                    )}
                </motion.div>

                {/* Actions */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3, type: 'spring' }}
                    className="flex flex-col gap-4 mb-4"
                >
                    <button 
                        onClick={() => navigate('/chatbot')}
                        className="w-full bg-voxara-primary text-white rounded-[20px] p-4 flex items-center gap-4 shadow-lg shadow-voxara-primary/20 active:scale-[0.98] transition-all"
                    >
                        <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </div>
                        <div className="text-left">
                            <p className="text-lg font-semibold leading-tight">Chat with AI Companion</p>
                            <p className="text-sm text-white/80">Get personalized activities</p>
                        </div>
                    </button>

                    <button 
                        onClick={() => {
                            localStorage.setItem('voxara_recording_phase', 'standard');
                            navigate('/recording');
                        }}
                        className="w-full bg-white border rounded-[20px] p-4 flex items-center gap-4 active:scale-[0.98] transition-all"
                        style={{ borderColor: '#F0DDD0' }}
                    >
                        <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: '#FDF0E8' }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                <rect x="9" y="2" width="6" height="11" rx="3" fill="#C8704A" />
                                <path d="M5 11c0 3.866 3.134 7 7 7s7-3.134 7-7" stroke="#C8704A" strokeWidth="2" strokeLinecap="round" />
                                <line x1="12" y1="18" x2="12" y2="22" stroke="#C8704A" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                        </div>
                        <div className="text-left">
                            <p className="text-lg font-semibold text-voxara-dark leading-tight">Quick Voice Log</p>
                            <p className="text-sm text-voxara-muted">Record directly without chat</p>
                        </div>
                    </button>
                </motion.div>

                {/* Weekly Tracker */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                    className="mt-6 bg-white rounded-[22px] p-5 border mb-6"
                    style={{ borderColor: '#F0DDD0' }}
                >
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-base font-medium text-voxara-dark">This week</p>
                        <button onClick={() => navigate('/dashboard')} className="text-sm font-medium text-voxara-primary">See all</button>
                    </div>
                    <PreviousRecordingsList />
                </motion.div>
            </div>
        </div>
    );
}

function PreviousRecordingsList() {
    const [recordings, setRecordings] = useState([]);

    useEffect(() => {
        const load = async () => {
            try {
                const data = await getHistory();
                setRecordings(data.slice(0, 7));
            } catch {
                // silently fail
            }
        };
        load();
    }, []);

    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const today = new Date().getDay(); // 0=Sun
    const todayIdx = today === 0 ? 6 : today - 1;

    return (
        <div>
            <div className="flex justify-between mb-4">
                {days.map((d, i) => {
                    const done = i < recordings.length;
                    const isToday = i === todayIdx;
                    const score = done && recordings[i] ? Math.round(recordings[i].riskScore || 0) : null;
                    return (
                        <div key={d} className="flex flex-col items-center gap-1.5">
                            <div className="w-9 h-9 rounded-full flex items-center justify-center border-2"
                                style={{
                                    background: done ? '#C8704A' : isToday ? 'transparent' : '#F5EDE8',
                                    borderColor: done ? '#C8704A' : isToday ? '#C8704A' : 'transparent'
                                }}
                            >
                                {done ? (
                                    <svg width="16" height="16" viewBox="0 0 14 14"><path d="M2.5 7l3 3 6-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                ) : (
                                    <div className="w-2 h-2 rounded-full" style={{ background: isToday ? '#C8704A' : '#C4A898' }} />
                                )}
                            </div>
                            <p className="text-xs font-medium" style={{ color: isToday ? '#C8704A' : done ? '#2E1F14' : '#A0856A' }}>{d}</p>
                            <p className="text-[11px] text-voxara-muted">{score !== null ? score : '—'}</p>
                        </div>
                    );
                })}
            </div>

            {recordings.length > 0 && (
                <div className="rounded-[14px] p-3" style={{ background: '#FDF0E8' }}>
                    <p className="text-[11px] font-medium text-voxara-muted mb-2 tracking-wider">SCORE TREND</p>
                    <div className="flex items-end gap-2" style={{ height: 48 }}>
                        {days.map((d, i) => {
                            const val = recordings[i]?.riskScore || null;
                            return (
                                <div key={d} className="flex-1 flex items-end justify-center" style={{ height: '100%' }}>
                                    <div className="w-full rounded-t-[4px]" style={{
                                        height: val ? Math.round(val / 100 * 48) : 6,
                                        background: val ? '#C8704A' : '#E8D0C0',
                                        opacity: val ? 1 : 0.4
                                    }} />
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}