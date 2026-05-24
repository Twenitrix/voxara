import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import StatusBar from '../components/voxara/StatusBar';
import { ChevronDown } from 'lucide-react';
import { registerAccount, loginAccount } from '@/lib/backendApi';

const conditions = ["Stuttering / Speech Impediment", "Parkinson's", "COPD", "Asthma", "Pneumonia", "Bronchitis"];

export default function Register() {
    const navigate = useNavigate();
    const [form, setForm] = useState({ full_name: '', condition: '', age: '', gender: '', email: '', password: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showConditions, setShowConditions] = useState(false);

    const handleSubmit = async () => {
        if (!form.full_name || !form.condition || !form.email || !form.password) return;
        setLoading(true);
        setError('');

        try {
            // Register with Spring Boot backend
            await registerAccount({
                name: form.full_name,
                email: form.email,
                password: form.password,
                condition: form.condition,
                age: form.age ? parseInt(form.age) : undefined,
                gender: form.gender || undefined,
            });

            // Auto-login to get JWT
            const loginData = await loginAccount({
                email: form.email,
                password: form.password,
            });

            // Store patient name for display
            localStorage.setItem('voxara_patient_name', loginData.name || form.full_name);
            setLoading(false);
            navigate('/home');
        } catch (e) {
            setError(e.message || 'Registration failed. Please try again.');
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
                className="flex-1 px-6 pt-8 pb-12"
                initial="hidden"
                animate="show"
                variants={{ show: { transition: { staggerChildren: 0.1 } } }}
            >
                <motion.div variants={item} className="mb-2">
                    <span className="text-voxara-teal text-sm font-medium tracking-wide uppercase">Step 1 of 1</span>
                </motion.div>

                <motion.h1 variants={item} className="text-3xl font-bold text-foreground mb-1">
                    Welcome to Voxara
                </motion.h1>
                <motion.p variants={item} className="text-muted-foreground mb-8">
                    Tell us a bit about yourself to get started
                </motion.p>

                {error && (
                    <motion.div variants={item} className="mb-4 p-3 rounded-xl text-sm" style={{ background: '#FDECEA', color: '#D94F3D' }}>
                        {error}
                    </motion.div>
                )}

                {/* Full Name */}
                <motion.div variants={item} className="mb-5">
                    <label className="text-sm font-medium text-foreground mb-2 block">Full Name</label>
                    <input
                        type="text"
                        value={form.full_name}
                        onChange={e => setForm(prev => ({ ...prev, full_name: e.target.value }))}
                        placeholder="Enter your full name"
                        className="w-full px-4 py-3.5 rounded-xl bg-white border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-voxara-teal/30 focus:border-voxara-teal transition-all"
                    />
                </motion.div>

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
                <motion.div variants={item} className="mb-5">
                    <label className="text-sm font-medium text-foreground mb-2 block">Password</label>
                    <input
                        type="password"
                        value={form.password}
                        onChange={e => setForm(prev => ({ ...prev, password: e.target.value }))}
                        placeholder="Min 6 characters"
                        className="w-full px-4 py-3.5 rounded-xl bg-white border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-voxara-teal/30 focus:border-voxara-teal transition-all"
                    />
                </motion.div>

                {/* Condition Selector */}
                <motion.div variants={item} className="mb-5 relative">
                    <label className="text-sm font-medium text-foreground mb-2 block">Select your condition</label>
                    <button
                        onClick={() => setShowConditions(!showConditions)}
                        className="w-full px-4 py-3.5 rounded-xl bg-white border border-border text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-voxara-teal/30 focus:border-voxara-teal transition-all"
                    >
                        <span className={form.condition ? 'text-foreground' : 'text-muted-foreground/50'}>
                            {form.condition || 'Choose a condition'}
                        </span>
                        <ChevronDown size={18} className={`text-muted-foreground transition-transform ${showConditions ? 'rotate-180' : ''}`} />
                    </button>

                    {showConditions && (
                        <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-border shadow-lg z-20 overflow-hidden"
                        >
                            {conditions.map(c => (
                                <button
                                    key={c}
                                    onClick={() => { setForm(prev => ({ ...prev, condition: c })); setShowConditions(false); }}
                                    className={`w-full px-4 py-3 text-left text-sm hover:bg-voxara-teal/5 transition-colors ${form.condition === c ? 'bg-voxara-teal/10 text-voxara-teal font-medium' : 'text-foreground'
                                        }`}
                                >
                                    {c}
                                </button>
                            ))}
                        </motion.div>
                    )}
                </motion.div>

                {/* Age */}
                <motion.div variants={item} className="mb-5">
                    <label className="text-sm font-medium text-foreground mb-2 block">
                        Age <span className="text-muted-foreground font-normal">(optional)</span>
                    </label>
                    <input
                        type="number"
                        value={form.age}
                        onChange={e => setForm(prev => ({ ...prev, age: e.target.value }))}
                        placeholder="Enter your age"
                        className="w-full px-4 py-3.5 rounded-xl bg-white border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-voxara-teal/30 focus:border-voxara-teal transition-all"
                    />
                </motion.div>

                {/* Gender Toggle */}
                <motion.div variants={item} className="mb-8">
                    <label className="text-sm font-medium text-foreground mb-3 block">
                        Gender <span className="text-muted-foreground font-normal">(optional)</span>
                    </label>
                    <div className="flex gap-3">
                        {['Male', 'Female'].map(g => (
                            <button
                                key={g}
                                onClick={() => setForm(prev => ({ ...prev, gender: prev.gender === g ? '' : g }))}
                                className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${form.gender === g
                                        ? 'bg-voxara-teal text-white shadow-md'
                                        : 'bg-white border border-border text-foreground hover:border-voxara-teal/30'
                                    }`}
                            >
                                {g}
                            </button>
                        ))}
                    </div>
                </motion.div>

                {/* Submit */}
                <motion.div variants={item}>
                    <button
                        onClick={handleSubmit}
                        disabled={!form.full_name || !form.condition || !form.email || !form.password || loading}
                        className="w-full py-4 rounded-2xl bg-voxara-teal text-white font-semibold text-lg shadow-lg shadow-voxara-teal/20 disabled:opacity-40 disabled:shadow-none active:scale-[0.98] transition-all"
                    >
                        {loading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
                        ) : (
                            'Register'
                        )}
                    </button>
                </motion.div>

                {/* Login link */}
                <motion.div variants={item} className="mt-4 text-center">
                    <button onClick={() => navigate('/login')} className="text-sm text-voxara-muted">
                        Already have an account? <span className="text-voxara-teal font-medium">Log in</span>
                    </button>
                </motion.div>
            </motion.div>
        </div>
    );
}
