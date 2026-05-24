import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/AuthContext';

export default function Splash() {
    const navigate = useNavigate();
    const { isAuthenticated, isLoadingAuth } = useAuth();

    useEffect(() => {
        if (!isLoadingAuth) {
            const timer = setTimeout(() => {
                if (isAuthenticated) {
                    navigate('/home');
                } else {
                    navigate('/login');
                }
            }, 2000); // 2 seconds splash screen
            return () => clearTimeout(timer);
        }
    }, [isAuthenticated, isLoadingAuth, navigate]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: '#FDF8F3' }}>
            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="flex flex-col items-center"
            >
                <div className="w-24 h-24 rounded-3xl mb-6 shadow-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #3BAFA8, #288B85)' }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        <line x1="12" y1="19" x2="12" y2="22" />
                    </svg>
                </div>
                <motion.h1 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3, duration: 0.5 }}
                    className="text-4xl font-bold tracking-tight text-[#1F2937] mb-2"
                >
                    Voxara
                </motion.h1>
                <motion.p
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.5, duration: 0.5 }}
                    className="text-[#6B7280] text-lg font-medium tracking-wide"
                >
                    Your Voice Knows
                </motion.p>
            </motion.div>
        </div>
    );
}