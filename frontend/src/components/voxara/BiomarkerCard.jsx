import { motion } from 'framer-motion';

const statusColors = {
    Normal: { bg: 'bg-emerald-50', text: 'text-emerald-700', bar: 'bg-emerald-500' },
    Elevated: { bg: 'bg-amber-50', text: 'text-amber-700', bar: 'bg-amber-500' },
    High: { bg: 'bg-red-50', text: 'text-red-700', bar: 'bg-red-500' },
};

export default function BiomarkerCard({ label, score, status, icon, delay = 0 }) {
    const colors = statusColors[status] || statusColors.Normal;

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, duration: 0.4 }}
            className="bg-white rounded-2xl p-4 shadow-sm border border-border/50"
        >
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <span className="text-lg">{icon}</span>
                    <span className="text-xs font-medium text-muted-foreground">{label}</span>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
                    {status}
                </span>
            </div>
            <div className="flex items-end justify-between">
                <span className="text-2xl font-bold text-foreground">{score}</span>
                <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                        className={`h-full rounded-full ${colors.bar}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(score, 100)}%` }}
                        transition={{ delay: delay + 0.2, duration: 0.6, ease: 'easeOut' }}
                    />
                </div>
            </div>
        </motion.div>
    );
}