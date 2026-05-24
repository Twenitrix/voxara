import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import StatusBar from '../components/voxara/StatusBar';
import CustomEmoji from '../components/voxara/CustomEmoji';

const activities = [
    { id: 'walk', label: 'Walk to next room and back', emoji: 'walk' },
    { id: 'stairs', label: 'Climb one flight of stairs', emoji: 'stairs' },
    { id: 'breathe', label: 'Take 10 deep breaths', emoji: 'breath' },
];

export default function ActivityChallenge() {
    const navigate = useNavigate();
    const [selected, setSelected] = useState(null);
    const [done, setDone] = useState(false);

    const handleDone = () => {
        setDone(true);
        localStorage.setItem('voxara_activity_type', selected);
        localStorage.setItem('voxara_recording_phase', 'post_activity');
        setTimeout(() => navigate('/recording'), 1500);
    };

    return (
        <div className="min-h-screen flex flex-col max-w-lg mx-auto" style={{ background: '#FDF8F3' }}>
            <StatusBar />

            <div className="flex-1 px-7 pt-4 pb-12">
                {!done ? (
                    <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.08 } } }}>

                        {/* Top bar */}
                        <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} className="flex items-center gap-3 mb-6">
                            <button onClick={() => navigate('/home')} className="w-[42px] h-[42px] rounded-[12px] bg-white border flex items-center justify-center" style={{ borderColor: '#F0DDD0' }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B4D38" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
                            </button>
                            <div className="flex-1 text-center">
                                <span className="text-xs font-medium text-voxara-muted tracking-widest">ACTIVITY</span>
                            </div>
                            <div className="w-[42px]" />
                        </motion.div>

                        {/* Heading */}
                        <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} className="mb-2">
                            <div className="inline-flex mb-3">
                                <span className="text-xs font-medium text-voxara-primary tracking-wider px-3 py-1 rounded-[10px] border" style={{ background: '#FDF0E8', borderColor: '#F0DDD0' }}>QUICK BREAK</span>
                            </div>
                            <h1 className="text-[26px] font-medium text-voxara-dark mb-2 leading-snug">Quick Activity Break</h1>
                            <p className="text-[15px] text-voxara-text leading-relaxed">Choose one activity, complete it, then we record your voice again to compare.</p>
                        </motion.div>

                        {/* Why it matters */}
                        <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                            className="rounded-[16px] p-3 border flex gap-2.5 items-start mb-5 mt-4"
                            style={{ background: '#FFF5EE', borderColor: '#F0DDD0' }}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="flex-shrink-0 mt-0.5">
                                <circle cx="12" cy="12" r="10" fill="#C8704A" opacity="0.15" />
                                <path d="M12 8v4M12 16h.01" stroke="#C8704A" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                            <p className="text-[13px] text-voxara-muted leading-relaxed">Activity affects your vocal biomarkers. We compare before &amp; after to track your health.</p>
                        </motion.div>

                        {/* Activity Cards */}
                        <div className="space-y-3 mb-6">
                            {activities.map((activity, i) => (
                                <motion.button
                                    key={activity.id}
                                    variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } }}
                                    onClick={() => setSelected(activity.id)}
                                    className={`w-full bg-white rounded-[20px] p-5 text-left flex items-center gap-4 transition-all border-2`}
                                    style={{ borderColor: selected === activity.id ? '#C8704A' : '#F0DDD0' }}
                                >
                                    <div className="w-14 h-14 rounded-[16px] border flex items-center justify-center flex-shrink-0"
                                        style={{ background: selected === activity.id ? '#FDF0E8' : '#F5F0EC', borderColor: selected === activity.id ? '#F0DDD0' : '#EDE0D4' }}
                                    >
                                        <CustomEmoji name={activity.emoji} size={28} />
                                    </div>
                                    <div className="flex-1 pr-6">
                                        <p className="text-[17px] font-medium text-voxara-dark mb-1">{activity.label}</p>
                                        <div className="flex items-center gap-1.5 mt-1">
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={selected === activity.id ? '#C8704A' : '#8A6650'} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                                            <span className="text-xs font-medium" style={{ color: selected === activity.id ? '#C8704A' : '#8A6650' }}>~2 minutes</span>
                                        </div>
                                    </div>
                                    {selected === activity.id && (
                                        <div className="w-[22px] h-[22px] rounded-full flex items-center justify-center" style={{ background: '#C8704A' }}>
                                            <svg width="12" height="12" viewBox="0 0 14 14"><path d="M2.5 7l3 3 6-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                        </div>
                                    )}
                                </motion.button>
                            ))}
                        </div>

                        <motion.button
                            variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } }}
                            onClick={handleDone}
                            disabled={!selected}
                            className="w-full py-5 rounded-[20px] text-white font-medium text-[17px] transition-all disabled:opacity-40"
                            style={{ background: '#C8704A' }}
                        >
                            I'm Ready — Start Activity
                        </motion.button>
                        <p className="text-center text-[13px] text-voxara-muted mt-2.5">You can skip this step if needed</p>
                    </motion.div>
                ) : (
                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                        className="flex-1 flex flex-col items-center justify-center text-center pt-24"
                    >
                        <div className="w-16 h-16 rounded-[20px] flex items-center justify-center mb-4" style={{ background: '#FDF0E8' }}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none"><path d="M4 12l6 6L20 6" stroke="#C8704A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </div>
                        <h2 className="text-2xl font-medium text-voxara-dark mb-2">Great job!</h2>
                        <p className="text-voxara-text">Preparing second recording...</p>
                        <div className="mt-6 w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: '#F0DDD0', borderTopColor: '#C8704A' }} />
                    </motion.div>
                )}
            </div>
        </div>
    );
}