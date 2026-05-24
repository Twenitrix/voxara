import { Link, useLocation } from 'react-router-dom';
import { Home, BarChart3, FileText, User } from 'lucide-react';

const navItems = [
    { path: '/home', icon: Home, label: 'Home' },
    { path: '/dashboard', icon: BarChart3, label: 'Dashboard' },
    { path: '/report', icon: FileText, label: 'Report' },
    { path: '/profile', icon: User, label: 'Profile' },
];

export default function BottomNav() {
    const location = useLocation();

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-[#FDF8F3]/95 backdrop-blur-xl border-t border-[#F0DDD0] safe-bottom z-50">
            <div className="max-w-lg mx-auto flex items-center justify-around h-16 px-2">
                {navItems.map(({ path, icon: Icon, label }) => {
                    const isActive = location.pathname === path;
                    return (
                        <Link
                            key={path}
                            to={path}
                            className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all duration-200 ${isActive ? 'text-voxara-primary' : 'text-voxara-text hover:text-voxara-dark'
                                }`}
                        >
                            <div className={`p-1.5 rounded-xl transition-all duration-200 ${isActive ? 'bg-voxara-primary/10' : ''}`}>
                                <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
                            </div>
                            <span className="text-[10px] font-medium">{label}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}