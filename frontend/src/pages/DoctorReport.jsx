import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getProfile, getHistory } from '@/lib/backendApi';
import StatusBar from '../components/voxara/StatusBar';
import CustomEmoji from '../components/voxara/CustomEmoji';
import { Share2 } from 'lucide-react';

export default function DoctorReport() {
    const [recordings, setRecordings] = useState([]);
    const [patient, setPatient] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const [profile, history] = await Promise.all([
                    getProfile(),
                    getHistory(),
                ]);
                setPatient(profile);
                setRecordings(history.slice(0, 7));
            } catch (e) {
                console.error('Failed to load report data:', e);
            }
            setLoading(false);
        };
        load();
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-8 h-8 border-3 rounded-full animate-spin" style={{ borderColor: '#F0DDD0', borderTopColor: '#C8704A' }} />
            </div>
        );
    }

    const avgScore = recordings.length > 0
        ? Math.round(recordings.reduce((s, r) => s + (r.riskScore || 0), 0) / recordings.length)
        : 0;

    const alertCount = recordings.filter(r => (r.riskScore || 0) >= 70).length;
    const completedCount = recordings.length;
    const overallStatus = avgScore < 40 ? 'Stable' : avgScore < 60 ? 'Needs Monitoring' : 'Concerning';

    const handleShare = () => {
        if (navigator.share) {
            navigator.share({
                title: 'Voxara Weekly Report',
                text: `Weekly Report for ${patient?.name}\nAverage Risk Score: ${avgScore}\nRecordings: ${completedCount}\nStatus: ${overallStatus}`,
            });
        }
    };

    const cards = [
        { label: 'Average Risk Score', value: avgScore, emoji: 'sparkle' },
        { label: 'Total Alerts', value: alertCount, emoji: 'warning' },
        { label: 'Recordings Completed', value: completedCount, emoji: 'mic' },
        { label: 'Overall Status', value: overallStatus, emoji: overallStatus === 'Stable' ? 'check' : 'warning' },
    ];

    return (
        <div className="min-h-screen pb-24 max-w-lg mx-auto" style={{ background: '#FDF8F3' }}>
            <StatusBar />

            <div className="px-7 pt-6">
                <div className="mb-5">
                    <p className="text-xs font-medium text-voxara-muted mb-1 tracking-wide">
                        {new Date(Date.now() - 6 * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                    <motion.h1 initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[26px] font-medium text-voxara-dark mb-1">Weekly Summary</motion.h1>
                    <p className="text-sm text-voxara-text">{patient?.name} — {patient?.condition}</p>
                </div>

                {/* Overall status */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="rounded-[20px] p-4 border flex items-center justify-between mb-4"
                    style={{ background: '#FFF5EE', borderColor: '#F0DDD0', borderWidth: 1.5 }}>
                    <div>
                        <p className="text-xs font-medium text-voxara-muted mb-1 tracking-widest">OVERALL STATUS</p>
                        <p className="text-[22px] font-medium text-voxara-primary">{overallStatus}</p>
                    </div>
                    <div className="w-[54px] h-[54px] rounded-full border-2 flex items-center justify-center" style={{ background: '#FDF0E8', borderColor: '#F0DDD0' }}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                            <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" stroke="#C8704A" strokeWidth="1.8" />
                            <path d="M8 12l3 3 5-5" stroke="#C8704A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                </motion.div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 gap-3 mb-5">
                    {cards.map((card, i) => (
                        <motion.div key={card.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                            className="bg-white rounded-[20px] p-5 border" style={{ borderColor: '#F0DDD0' }}>
                            <div className="w-11 h-11 rounded-[13px] border flex items-center justify-center mb-3" style={{ background: '#FDF0E8', borderColor: '#F0DDD0' }}>
                                <CustomEmoji name={card.emoji} size={20} />
                            </div>
                            <p className="text-xs font-medium text-voxara-muted mb-1">{card.label}</p>
                            <p className="text-[28px] font-medium text-voxara-dark leading-none">{card.value}</p>
                        </motion.div>
                    ))}
                </div>

                {/* Daily Breakdown */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
                    className="bg-white rounded-[20px] p-5 mb-5 border" style={{ borderColor: '#F0DDD0' }}>
                    <p className="text-sm font-medium text-voxara-dark mb-4">Daily Breakdown</p>
                    <div className="space-y-3">
                        {recordings.map(r => {
                            const riskLevel = (r.riskScore || 0) < 40 ? 'Low' : (r.riskScore || 0) < 70 ? 'Moderate' : 'High';
                            return (
                                <div key={r.id} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: '#F0DDD0' }}>
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-2 h-2 rounded-full" style={{ background: riskLevel === 'Low' ? '#3D8B40' : riskLevel === 'Moderate' ? '#C8704A' : '#D94F3D' }} />
                                        <span className="text-sm text-voxara-dark">
                                            {new Date(r.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm font-medium text-voxara-dark">{Math.round(r.riskScore || 0)}</span>
                                        <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full"
                                            style={{
                                                background: riskLevel === 'Low' ? '#E8F5EA' : riskLevel === 'Moderate' ? '#FFF5EE' : '#FDECEA',
                                                color: riskLevel === 'Low' ? '#2D6A30' : riskLevel === 'Moderate' ? '#C8704A' : '#D94F3D'
                                            }}>
                                            {riskLevel}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </motion.div>

                {/* Share Button */}
                <motion.button initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
                    onClick={handleShare}
                    className="w-full py-5 rounded-[20px] text-white font-medium text-[17px] flex items-center justify-center gap-2"
                    style={{ background: '#C8704A' }}>
                    <Share2 size={18} />
                    Share with Doctor
                </motion.button>
            </div>
        </div>
    );
}