import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getProfile } from '@/lib/backendApi';
import { useAuth } from '@/lib/AuthContext';
import StatusBar from '../components/voxara/StatusBar';
import CustomEmoji from '../components/voxara/CustomEmoji';
import { Switch } from '@/components/ui/switch';
import { LogOut } from 'lucide-react';

const allBadges = [
    { id: 'first_recording', name: 'First Steps', emoji: 'mic', description: 'Complete your first recording', threshold: 1 },
    { id: 'streak_3', name: '3 Day Streak', emoji: 'fire', description: 'Record 3 days in a row', threshold: 3 },
    { id: 'streak_7', name: 'Week Warrior', emoji: 'trophy', description: 'Record 7 days in a row', threshold: 7 },
    { id: 'points_100', name: 'Century Club', emoji: 'sparkle', description: 'Earn 100 points', threshold: 100 },
    { id: 'streak_30', name: 'Monthly Master', emoji: 'muscle', description: 'Record 30 days in a row', threshold: 30 },
    { id: 'points_500', name: 'Gold Standard', emoji: 'trophy', description: 'Earn 500 points', threshold: 500 },
];

export default function Profile() {
    const navigate = useNavigate();
    const { logout: authLogout } = useAuth();
    const [patient, setPatient] = useState(null);
    const [loading, setLoading] = useState(true);
    const [medReminder, setMedReminder] = useState(false);
    const [reminderTime, setReminderTime] = useState('08:00');

    useEffect(() => {
        const load = async () => {
            try {
                const profile = await getProfile();
                setPatient(profile);
                // Load local settings
                setMedReminder(localStorage.getItem('voxara_med_reminder') === 'true');
                setReminderTime(localStorage.getItem('voxara_reminder_time') || '08:00');
            } catch (e) {
                console.error('Failed to load profile:', e);
                navigate('/');
            }
            setLoading(false);
        };
        load();
    }, [navigate]);

    const handleToggleReminder = (checked) => {
        setMedReminder(checked);
        localStorage.setItem('voxara_med_reminder', String(checked));
    };

    const handleTimeChange = (e) => {
        const time = e.target.value;
        setReminderTime(time);
        localStorage.setItem('voxara_reminder_time', time);
    };

    const handleLogout = () => {
        authLogout();
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-8 h-8 border-3 rounded-full animate-spin" style={{ borderColor: '#F0DDD0', borderTopColor: '#C8704A' }} />
            </div>
        );
    }

    const streak = patient?.currentStreak || 0;
    const points = patient?.totalPoints || 0;
    const earnedBadges = allBadges.filter(b => {
        if (b.id.startsWith('streak_')) return streak >= b.threshold;
        if (b.id.startsWith('points_')) return points >= b.threshold;
        if (b.id === 'first_recording') return streak > 0;
        return false;
    });

    return (
        <div className="min-h-screen pb-24 max-w-lg mx-auto" style={{ background: '#FDF8F3' }}>
            <StatusBar />

            <div className="px-7 pt-6">
                {/* Profile Header */}
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 rounded-[20px] flex items-center justify-center" style={{ background: '#C8704A' }}>
                        <span className="text-white text-2xl font-medium">{patient?.name?.charAt(0)?.toUpperCase() || 'V'}</span>
                    </div>
                    <div>
                        <h1 className="text-xl font-medium text-voxara-dark">{patient?.name}</h1>
                        <p className="text-sm text-voxara-muted">{patient?.condition}</p>
                    </div>
                </motion.div>

                {/* Stats */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-2 gap-3 mb-5">
                    <div className="rounded-[20px] p-4 text-center" style={{ background: '#C8704A' }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="mx-auto mb-1">
                            <path d="M12 2C9 6 6 8 7 12c0 3 2 5 5 5s5-2 5-5c0-2-1-3.5-2-4.5-0.5 1.5-1.5 2.5-3 3 1-2.5 0-5.5 0-10.5z" fill="white" />
                        </svg>
                        <p className="text-white text-2xl font-medium">{streak}</p>
                        <p className="text-white/70 text-xs">Day Streak</p>
                    </div>
                    <div className="rounded-[20px] p-4 text-center" style={{ background: '#C8704A' }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="mx-auto mb-1">
                            <path d="M12 2l2.5 8.5L23 13l-8.5 2.5L12 24l-2.5-8.5L1 13l8.5-2.5z" fill="white" />
                        </svg>
                        <p className="text-white text-2xl font-medium">{points}</p>
                        <p className="text-white/70 text-xs">Total Points</p>
                    </div>
                </motion.div>

                {/* Badges */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                    className="bg-white rounded-[20px] p-5 mb-4 border" style={{ borderColor: '#F0DDD0' }}>
                    <h2 className="text-sm font-medium text-voxara-dark mb-4">Badges</h2>
                    <div className="grid grid-cols-3 gap-3">
                        {allBadges.map(badge => {
                            const unlocked = earnedBadges.find(b => b.id === badge.id);
                            return (
                                <div key={badge.id}
                                    className={`flex flex-col items-center p-3 rounded-[16px] ${unlocked ? '' : 'opacity-35'}`}
                                    style={{ background: unlocked ? '#FDF0E8' : '#F5EDE8' }}>
                                    <CustomEmoji name={unlocked ? badge.emoji : 'lock'} size={28} />
                                    <span className="text-[10px] font-medium text-voxara-dark mt-1.5 text-center">{badge.name}</span>
                                </div>
                            );
                        })}
                    </div>
                </motion.div>

                {/* Settings */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                    className="bg-white rounded-[20px] p-5 mb-4 border space-y-4" style={{ borderColor: '#F0DDD0' }}>
                    <h2 className="text-sm font-medium text-voxara-dark">Settings</h2>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-voxara-dark">Medication Reminder</p>
                            <p className="text-xs text-voxara-muted">Get daily reminders</p>
                        </div>
                        <Switch checked={medReminder} onCheckedChange={handleToggleReminder} />
                    </div>
                    {medReminder && (
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-voxara-dark">Reminder Time</p>
                            <input type="time" value={reminderTime} onChange={handleTimeChange}
                                className="rounded-[12px] px-3 py-1.5 text-sm text-voxara-dark border" style={{ background: '#FDF0E8', borderColor: '#F0DDD0' }} />
                        </div>
                    )}
                </motion.div>

                {/* About */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                    className="bg-white rounded-[20px] p-5 mb-5 border" style={{ borderColor: '#F0DDD0' }}>
                    <h2 className="text-sm font-medium text-voxara-dark mb-2">About Voxara</h2>
                    <p className="text-xs text-voxara-muted leading-relaxed">Voxara is a voice-based health monitoring companion that uses AI to detect changes in your voice patterns. Track your progress, earn rewards, and share insights with your healthcare provider.</p>
                    <p className="text-xs text-voxara-muted mt-2">Version 1.0.0</p>
                </motion.div>

                {/* Logout */}
                <motion.button initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
                    onClick={handleLogout}
                    className="w-full py-3 rounded-[20px] border font-medium text-sm flex items-center justify-center gap-2 transition-colors"
                    style={{ borderColor: '#FBCFCC', color: '#D94F3D' }}>
                    <LogOut size={16} />
                    Log Out
                </motion.button>
            </div>
        </div>
    );
}