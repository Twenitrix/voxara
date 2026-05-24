import { motion } from 'framer-motion';
import { ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function UserNotRegisteredError() {
    const navigate = useNavigate();

    const handleRegister = () => {
        navigate('/register');
    };

    const handleLogin = () => {
        // Clear any old bad state
        localStorage.removeItem('voxara_jwt');
        localStorage.removeItem('voxara_patient_name');
        window.location.href = '/login';
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#FDF8F3' }}>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-xl shadow-black/5"
            >
                <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-6">
                    <ShieldAlert size={32} className="text-red-500" />
                </div>

                <h2 className="text-2xl font-bold text-[#1F2937] mb-3">
                    Not Registered
                </h2>
                
                <p className="text-[#6B7280] mb-8 leading-relaxed">
                    We couldn't find an account associated with your credentials. Please register or try logging in with a different account.
                </p>

                <div className="flex flex-col gap-3">
                    <button
                        onClick={handleRegister}
                        className="w-full py-3.5 rounded-xl text-white font-medium bg-[#3BAFA8] hover:bg-[#288B85] transition-colors"
                    >
                        Create an account
                    </button>
                    
                    <button
                        onClick={handleLogin}
                        className="w-full py-3.5 rounded-xl text-[#6B7280] font-medium bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                        Try logging in again
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
