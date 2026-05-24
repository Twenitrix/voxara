import { Outlet, useLocation } from 'react-router-dom';
import BottomNav from './BottomNav';

const hideNavRoutes = ['/', '/register', '/chatbot', '/recording', '/activity-challenge', '/analysis-result'];

export default function AppLayout() {
    const location = useLocation();
    const showNav = !hideNavRoutes.includes(location.pathname);

    return (
        <div className="min-h-screen max-w-lg mx-auto relative" style={{ background: '#FDF8F3' }}>
            <Outlet />
            {showNav && <BottomNav />}
        </div>
    );
}