import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getHistory } from '@/lib/backendApi';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import StatusBar from '../components/voxara/StatusBar';
import CustomEmoji from '../components/voxara/CustomEmoji';

export default function Dashboard() {
    const [recordings, setRecordings] = useState([]);
    const [timeRange, setTimeRange] = useState('7');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const data = await getHistory();
                const limit = timeRange === '7' ? 7 : 30;
                setRecordings(data.slice(0, limit).reverse());
            } catch (e) {
                console.error('Failed to load history:', e);
            }
            setLoading(false);
        };
        load();
    }, [timeRange]);

    const chartData = recordings.map(r => ({
        date: new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        score: Math.round(r.riskScore || 0),
    }));

    const avgScore = recordings.length > 0
        ? Math.round(recordings.reduce((sum, r) => sum + (r.riskScore || 0), 0) / recordings.length)
        : 0;

    const trend = recordings.length >= 2
        ? recordings[recordings.length - 1].riskScore <= recordings[0].riskScore ? 'Improving' : 'Worsening'
        : 'Not enough data';

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-8 h-8 border-3 rounded-full animate-spin" style={{ borderColor: '#F0DDD0', borderTopColor: '#C8704A' }} />
            </div>
        );
    }

    return (
        <div className="min-h-screen pb-24 max-w-lg mx-auto" style={{ background: '#FDF8F3' }}>
            <StatusBar />

            <div className="px-7 pt-6">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-1">
                    <h1 className="text-[26px] font-medium text-voxara-dark">Weekly Summary</h1>
                </motion.div>
                <p className="text-voxara-text text-sm mb-5">Your health overview for the past {timeRange} days</p>

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="rounded-[20px] p-4 border mb-4 flex items-center justify-between"
                    style={{ background: '#FFF5EE', borderColor: '#F0DDD0', borderWidth: 1.5 }}>
                    <div>
                        <p className="text-xs font-medium text-voxara-muted mb-1 tracking-widest">OVERALL STATUS</p>
                        <p className="text-[22px] font-medium text-voxara-primary">
                            {recordings.length === 0 ? 'No data' : trend === 'Improving' ? 'Stable' : 'Moderate'}
                        </p>
                    </div>
                    <div className="w-[54px] h-[54px] rounded-full border-2 flex items-center justify-center" style={{ background: '#FDF0E8', borderColor: '#F0DDD0' }}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                            <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" stroke="#C8704A" strokeWidth="1.8" />
                            <path d="M8 12l3 3 5-5" stroke="#C8704A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                </motion.div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                        className="bg-white rounded-[20px] p-5 border" style={{ borderColor: '#F0DDD0' }}>
                        <div className="w-11 h-11 rounded-[13px] border flex items-center justify-center mb-3" style={{ background: '#FDF0E8', borderColor: '#F0DDD0' }}>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C8704A" strokeWidth="1.8" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
                        </div>
                        <p className="text-xs font-medium text-voxara-muted mb-1">Avg Risk Score</p>
                        <p className="text-[32px] font-medium text-voxara-dark leading-none">{avgScore}</p>
                        <div className="mt-2.5 h-[5px] rounded-full" style={{ background: '#F0DDD0' }}>
                            <div className="h-full rounded-full" style={{ width: `${avgScore}%`, background: '#C8704A' }} />
                        </div>
                        <p className="text-[11px] text-voxara-muted mt-1">of 100</p>
                    </motion.div>

                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                        className="bg-white rounded-[20px] p-5 border" style={{ borderColor: '#F0DDD0' }}>
                        <div className="w-11 h-11 rounded-[13px] border flex items-center justify-center mb-3" style={{ background: '#FDECEA', borderColor: '#FBCFCC' }}>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#D94F3D" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                        </div>
                        <p className="text-xs font-medium text-voxara-muted mb-1">Sessions</p>
                        <p className="text-[32px] font-medium text-voxara-dark leading-none">{recordings.length}</p>
                        <div className="mt-2.5 flex gap-1.5 flex-wrap">
                            {Array.from({ length: 7 }).map((_, i) => (
                                <div key={i} className="h-[5px] rounded-full" style={{ width: 18, background: i < recordings.length ? '#C8704A' : '#F0DDD0' }} />
                            ))}
                        </div>
                        <p className="text-[11px] text-voxara-muted mt-1">{recordings.length} of 7 days</p>
                    </motion.div>
                </div>

                <div className="flex rounded-[14px] p-1 mb-4 border" style={{ background: '#F5EDE8', borderColor: '#F0DDD0' }}>
                    {['7', '30'].map(range => (
                        <button key={range} onClick={() => setTimeRange(range)}
                            className={`flex-1 py-2 rounded-[10px] text-sm font-medium transition-all ${timeRange === range ? 'bg-white text-voxara-dark shadow-sm' : 'text-voxara-muted'}`}>
                            {range} Days
                        </button>
                    ))}
                </div>

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                    className="bg-white rounded-[20px] p-5 mb-4 border" style={{ borderColor: '#F0DDD0' }}>
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-sm font-medium text-voxara-dark">Score trend</p>
                        <div className="rounded-[8px] px-2.5 py-1" style={{ background: '#FDF0E8' }}>
                            <p className="text-xs font-medium text-voxara-primary">This week</p>
                        </div>
                    </div>
                    {chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={180}>
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#F0DDD0" />
                                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#8A6650' }} />
                                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#8A6650' }} />
                                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #F0DDD0', background: '#FFF5EE' }} labelStyle={{ fontWeight: 600, color: '#2E1F14' }} />
                                <Line type="monotone" dataKey="score" stroke="#C8704A" strokeWidth={2.5} dot={{ fill: '#C8704A', r: 4 }} activeDot={{ r: 6, fill: '#2E1F14' }} />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-44 flex items-center justify-center text-voxara-muted text-sm">No data yet. Complete your first session!</div>
                    )}
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                    className="bg-white rounded-[20px] p-5 mb-4 border" style={{ borderColor: '#F0DDD0' }}>
                    <p className="text-sm font-medium text-voxara-dark mb-3">Mood Trend</p>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                        {recordings.slice(-7).map((r) => (
                            <div key={r.id} className="flex flex-col items-center gap-1 min-w-[40px]">
                                <CustomEmoji name={r.moodScore > 6 ? 'smile' : r.moodScore < 4 ? 'sad' : 'neutral'} size={24} />
                                <span className="text-[10px] text-voxara-muted">{new Date(r.date).toLocaleDateString('en-US', { weekday: 'short' })}</span>
                            </div>
                        ))}
                    </div>
                </motion.div>
            </div>
        </div>
    );
}