import { motion } from 'framer-motion';

// Animated waveform shown while user is speaking
export function LiveVoiceBubble() {
    return (
        <div className="flex items-center gap-[3px] px-4 py-3 rounded-[18px_18px_4px_18px] border"
            style={{ background: '#F5E4D4', borderColor: '#E8C8A8', height: 44 }}
        >
            {Array.from({ length: 7 }).map((_, i) => (
                <motion.div
                    key={i}
                    className="w-[3px] rounded-full"
                    style={{ background: '#C8704A' }}
                    animate={{ height: ['6px', `${10 + Math.random() * 18}px`, '6px'] }}
                    transition={{ duration: 0.5 + i * 0.07, repeat: Infinity, ease: 'easeInOut', delay: i * 0.06 }}
                />
            ))}
            <span className="text-[11px] font-medium text-voxara-primary ml-2">Speaking...</span>
        </div>
    );
}

// Collapsed text bubble after speaking
export function TextBubble({ text }) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-[78%] px-4 py-3 rounded-[18px_18px_4px_18px] border"
            style={{ background: '#F5E4D4', borderColor: '#E8C8A8' }}
        >
            <p className="text-sm leading-relaxed text-voxara-dark">{text}</p>
        </motion.div>
    );
}