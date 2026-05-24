import React, { createContext, useState, useContext, useEffect } from 'react';
import { getProfile } from '@/lib/backendApi';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoadingAuth, setIsLoadingAuth] = useState(true);
    const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
    const [authError, setAuthError] = useState(null);

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        let timeoutId;
        try {
            setIsLoadingAuth(true);
            setAuthError(null);

            const token = localStorage.getItem('voxara_jwt');
            if (!token) {
                setIsAuthenticated(false);
                return;
            }

            const timeout = new Promise((_, reject) => {
                timeoutId = setTimeout(() => reject(new Error('Auth check timed out')), 5000);
            });
            const me = await Promise.race([getProfile(), timeout]);
            setUser(me);
            setIsAuthenticated(true);

            // Store name for other pages to use
            if (me?.name) {
                localStorage.setItem('voxara_patient_name', me.name);
            }
        } catch (error) {
            console.warn('Auth check failed:', error?.message);

            setIsAuthenticated(false);
            if (error?.status === 401 || error?.status === 403 || error?.message?.includes('not authenticated')) {
                localStorage.removeItem('voxara_jwt');
            } else if (error?.message?.includes('not registered')) {
                setAuthError({
                    type: 'not_registered',
                    message: 'User is not registered in this app.',
                });
            } else {
                setAuthError({
                    type: 'unknown',
                    message: error?.message || 'An unexpected error occurred',
                });
            }
        } finally {
            if (timeoutId) clearTimeout(timeoutId);
            setIsLoadingAuth(false);
        }
    };

    const logout = () => {
        setUser(null);
        setIsAuthenticated(false);
        localStorage.removeItem('voxara_patient_name');
        localStorage.removeItem('voxara_jwt');
        window.location.href = '/';
    };

    const navigateToLogin = () => {
        window.location.href = '/login';
    };

    const setAuthUser = (userData) => {
        setUser(userData);
        setIsAuthenticated(true);
    };

    return (
        <AuthContext.Provider value={{
            user,
            isAuthenticated,
            isLoadingAuth,
            isLoadingPublicSettings,
            authError,
            logout,
            navigateToLogin,
            checkAuth,
            setAuthUser,
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
