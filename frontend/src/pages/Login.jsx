import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import StatusBar from '../components/voxara/StatusBar';
import { loginAccount } from '@/lib/backendApi';

export default function Login() {
    const navigate = useNavigate();
    const [form, setForm] = useState({ email: '', password: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async () => {
        if (!form.email || !form.password) return;
        await loginWithCredentials(form.email, form.password);
    };

    const loginWithCredentials = async (email, password) => {
        setLoading(true);
        setError('');

        try {
            const loginData = await loginAccount({
                email,
                password,
            });

            // loginAccount already saves 'voxara_jwt'. We just need to save the name.
            if (loginData.name) {
                localStorage.setItem('voxara_patient_name', loginData.name);
            }
            
            // Need to hard reload or redirect so AuthContext picks up the new JWT
            window.location.href = '/home';
        } catch (e) {
            setError(e.message || 'Login failed. Please check your credentials.');
            setLoading(false);
        }
    };

    const item = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 },
    };

    return (
        <div className="min-h-screen bg-background flex flex-col max-w-lg mx-auto">
            <StatusBar />

            <motion.div
                className="flex-1 px-6 pt-12 pb-12"
                initial="hidden"
                animate="show"
                variants={{ show: { transition: { staggerChildren: 0.1 } } }}
            >
                <motion.div variants={item} className="mb-2">
                    <span className="text-voxara-teal text-sm font-medium tracking-wide uppercase">Welcome Back</span>
                </motion.div>

                <motion.h1 variants={item} className="text-3xl font-bold text-foreground mb-1">
                    Log in to Voxara
                </motion.h1>
                <motion.p variants={item} className="text-muted-foreground mb-10">
                    Continue your voice health diary
                </motion.p>

                {error && (
                    <motion.div variants={item} className="mb-6 p-3 rounded-xl text-sm" style={{ background: '#FDECEA', color: '#D94F3D' }}>
                        {error}
                    </motion.div>
                )}

                {/* Email */}
                <motion.div variants={item} className="mb-5">
                    <label className="text-sm font-medium text-foreground mb-2 block">Email</label>
                    <input
                        type="email"
                        value={form.email}
                        onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="Enter your email"
                        className="w-full px-4 py-3.5 rounded-xl bg-white border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-voxara-teal/30 focus:border-voxara-teal transition-all"
                    />
                </motion.div>

                {/* Password */}
                <motion.div variants={item} className="mb-8">
                    <label className="text-sm font-medium text-foreground mb-2 block">Password</label>
                    <input
                        type="password"
                        value={form.password}
                        onChange={e => setForm(prev => ({ ...prev, password: e.target.value }))}
                        placeholder="Enter your password"
                        className="w-full px-4 py-3.5 rounded-xl bg-white border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-voxara-teal/30 focus:border-voxara-teal transition-all"
                    />
                </motion.div>

                {/* Submit */}
                <motion.div variants={item} className="flex flex-col gap-3">
                    <button
                        onClick={handleSubmit}
                        disabled={!form.email || !form.password || loading}
                        className="w-full py-4 rounded-2xl bg-voxara-teal text-white font-semibold text-lg shadow-lg shadow-voxara-teal/20 disabled:opacity-40 disabled:shadow-none active:scale-[0.98] transition-all"
                    >
                        {loading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
                        ) : (
                            'Log in'
                        )}
                    </button>

                    <button
                        onClick={async () => {
                            const demo = { email: 'demo@voxara.com', password: 'password' };
                            setForm(demo);
                            await loginWithCredentials(demo.email, demo.password);
                        }}
                        type="button"
                        disabled={loading}
                        className="w-full py-3.5 rounded-2xl bg-voxara-dark/5 text-voxara-dark font-medium text-base hover:bg-voxara-dark/10 transition-all"
                    >
                        Use Demo Account
                    </button>
                </motion.div>

                {/* Register link */}
                <motion.div variants={item} className="mt-6 text-center">
                    <button onClick={() => navigate('/register')} className="text-sm text-voxara-muted">
                        Don't have an account? <span className="text-voxara-teal font-medium">Register here</span>
                    </button>
                </motion.div>
            </motion.div>
        </div>
    );
}
