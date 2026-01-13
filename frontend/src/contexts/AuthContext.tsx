import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { authService } from '@/services/auth';
import type { User } from '@/types';

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (username: string, password: string, remember?: boolean) => Promise<boolean>;
    logout: () => void;
    changePassword: (newPassword: string) => Promise<boolean>;
    updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {

        const storedUser = authService.getUser();
        if (storedUser && authService.isAuthenticated()) {
            setUser(storedUser);
        }
        setIsLoading(false);
    }, []);

    const login = async (username: string, password: string, remember = false): Promise<boolean> => {
        const result = await authService.login({ username, password, remember });
        if (result) {
            setUser(result.user);
            return true;
        }
        return false;
    };

    const logout = () => {
        setUser(null);
        authService.logout();
    };

    const changePassword = async (newPassword: string): Promise<boolean> => {
        const success = await authService.changePassword(newPassword);
        if (success && user) {
            setUser({ ...user, must_change_password: false });
        }
        return success;
    };

    const updateUser = (updatedUser: User) => {
        setUser(updatedUser);
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                isAuthenticated: !!user && authService.isAuthenticated(),
                isLoading,
                login,
                logout,
                changePassword,
                updateUser,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
