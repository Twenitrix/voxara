import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from './components/UserNotRegisteredError';
import AppLayout from './components/voxara/AppLayout';
import Splash from './pages/Splash';
import Register from './pages/Register';
import Login from './pages/Login';
import Home from './pages/Home';
import Chatbot from './pages/Chatbot';
import Recording from './pages/Recording';
import ActivityChallenge from './pages/ActivityChallenge';
import AnalysisResult from './pages/AnalysisResult';
import Dashboard from './pages/Dashboard';
import DoctorReport from './pages/DoctorReport';
import Profile from './pages/Profile';

const AuthenticatedApp = () => {
    const { isLoadingAuth, authError, navigateToLogin } = useAuth();
    const location = useLocation();
    const publicPaths = ['/', '/login', '/register'];
    const isPublicPath = publicPaths.includes(location.pathname);

    if (isLoadingAuth && !isPublicPath) {
        return (
            <div className="fixed inset-0 flex items-center justify-center" style={{ background: '#FDF8F3' }}>
                <div className="w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor: '#F0DDD0', borderTopColor: '#C8704A' }}></div>
            </div>
        );
    }

    if (authError && !isPublicPath) {
        if (authError.type === 'not_registered') {
            return <UserNotRegisteredError />;
        }
        // For other auth errors, attempt login
        navigateToLogin();
        return null;
    }

    return (
        <Routes>
            <Route element={<AppLayout />}>
                <Route path="/" element={<Splash />} />
                <Route path="/register" element={<Register />} />
                <Route path="/login" element={<Login />} />
                <Route path="/home" element={<Home />} />
                <Route path="/chatbot" element={<Chatbot />} />
                <Route path="/recording" element={<Recording />} />
                <Route path="/activity-challenge" element={<ActivityChallenge />} />
                <Route path="/analysis-result" element={<AnalysisResult />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/report" element={<DoctorReport />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="*" element={<PageNotFound />} />
            </Route>
        </Routes>
    );
};


function App() {

    return (
        <AuthProvider>
            <QueryClientProvider client={queryClientInstance}>
                <Router>
                    <AuthenticatedApp />
                </Router>
                <Toaster />
            </QueryClientProvider>
        </AuthProvider>
    )
}

export default App
