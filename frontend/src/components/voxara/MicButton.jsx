import { motion } from 'framer-motion';

export default function MicButton({ onClick, size = 'large', isActive = false }) {
    const outerSize = size === 'large' ? 210 : 120;
    const middleSize = size === 'large' ? 174 : 100;
    const innerRing = size === 'large' ? 140 : 80;
    const btnSize = size === 'large' ? 108 : 64;
    const iconSize = size === 'large' ? 44 : 28;

    return (
        <div className="relative flex items-center justify-center" style={{ width: outerSize, height: outerSize }}>
            <div className="absolute rounded-full bg-[#F5E4D4]" style={{ width: outerSize, height: outerSize, opacity: 0.55 }} />
            <div className="absolute rounded-full bg-[#EDD0B8]" style={{ width: middleSize, height: middleSize, opacity: 0.65 }} />
            {isActive ? (
                <motion.div className="absolute rounded-full bg-voxara-primary" style={{ width: innerRing, height: innerRing }}
                    animate={{ scale: [1, 1.15, 1], opacity: [0.14, 0.25, 0.14] }}
                    transition={{ duration: 1.5, repeat: Infinity }} />
            ) : (
                <div className="absolute rounded-full bg-voxara-primary" style={{ width: innerRing, height: innerRing, opacity: 0.14 }} />
            )}
            <motion.button
                onClick={onClick}
                className="relative rounded-full flex items-center justify-center z-10"
                style={{ width: btnSize, height: btnSize, background: '#C8704A', boxShadow: '0 0 0 4px rgba(200,112,74,0.2)' }}
                whileTap={{ scale: 0.92 }}
                whileHover={{ scale: 1.05 }}
            >
                <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none">
                    <rect x="9" y="2" width="6" height="11" rx="3" fill="white" />
                    <path d="M5 11c0 3.866 3.134 7 7 7s7-3.134 7-7" stroke="white" strokeWidth="2" strokeLinecap="round" />
                    <line x1="12" y1="18" x2="12" y2="22" stroke="white" strokeWidth="2" strokeLinecap="round" />
                    <line x1="9" y1="22" x2="15" y2="22" stroke="white" strokeWidth="2" strokeLinecap="round" />
                </svg>
            </motion.button>
        </div>
    );
}