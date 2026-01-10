import axios, { type AxiosInstance, type AxiosError, type InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Storage keys
const TOKEN_KEY = 'carga_slack_token';
const USER_KEY = 'carga_slack_user';

// Create axios instance
const api: AxiosInstance = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor - add auth token
api.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        const tokenRaw = localStorage.getItem(TOKEN_KEY);
        if (tokenRaw) {
            try {
                const token = JSON.parse(tokenRaw);
                config.headers.Authorization = `Bearer ${token}`;
            } catch {
                // Token not in JSON format, use as-is
                config.headers.Authorization = `Bearer ${tokenRaw}`;
            }
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor - handle 401
api.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
        if (error.response?.status === 401) {
            // Clear auth and redirect to login
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_KEY);

            if (!window.location.pathname.includes('/login')) {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;
