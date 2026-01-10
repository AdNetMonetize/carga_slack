import api from './api';
import type { LoginRequest, LoginResponse, ChangePasswordRequest, ApiResponse, User } from '@/types';

const TOKEN_KEY = 'carga_slack_token';
const USER_KEY = 'carga_slack_user';

export const authService = {
    async login(credentials: LoginRequest): Promise<{ user: User; token: string } | null> {
        try {
            const response = await api.post<ApiResponse<LoginResponse>>('/auth/login', credentials);

            if (response.data.success && response.data.data) {
                const { token, user } = response.data.data;
                localStorage.setItem(TOKEN_KEY, JSON.stringify(token));
                localStorage.setItem(USER_KEY, JSON.stringify(user));
                return { user, token };
            }

            return null;
        } catch (error) {
            console.error('Login failed:', error);
            return null;
        }
    },

    async changePassword(newPassword: string): Promise<boolean> {
        try {
            const payload: ChangePasswordRequest = { new_password: newPassword };
            const response = await api.post<ApiResponse>('/auth/change-password', payload);

            if (response.data.success) {
                // Update local user to remove must_change_password flag
                const userRaw = localStorage.getItem(USER_KEY);
                if (userRaw) {
                    const user = JSON.parse(userRaw) as User;
                    user.must_change_password = false;
                    localStorage.setItem(USER_KEY, JSON.stringify(user));
                }
                return true;
            }

            return false;
        } catch (error) {
            console.error('Change password failed:', error);
            return false;
        }
    },

    async verifyToken(): Promise<boolean> {
        try {
            const response = await api.get<ApiResponse<{ valid: boolean }>>('/auth/verify');
            return response.data.success && response.data.data?.valid === true;
        } catch {
            return false;
        }
    },

    logout(): void {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        window.location.href = '/login';
    },

    getToken(): string | null {
        const tokenRaw = localStorage.getItem(TOKEN_KEY);
        if (!tokenRaw) return null;
        try {
            return JSON.parse(tokenRaw);
        } catch {
            return tokenRaw;
        }
    },

    getUser(): User | null {
        const userRaw = localStorage.getItem(USER_KEY);
        if (!userRaw) return null;
        try {
            return JSON.parse(userRaw);
        } catch {
            return null;
        }
    },

    isAuthenticated(): boolean {
        return !!this.getToken();
    },
};
