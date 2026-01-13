import axios, { type AxiosInstance, type AxiosError, type InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';


const TOKEN_KEY = 'carga_slack_token';
const USER_KEY = 'carga_slack_user';


const api: AxiosInstance = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});


api.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        const tokenRaw = localStorage.getItem(TOKEN_KEY);
        if (tokenRaw) {
            try {
                const token = JSON.parse(tokenRaw);
                config.headers.Authorization = `Bearer ${token}`;
            } catch {

                config.headers.Authorization = `Bearer ${tokenRaw}`;
            }
        }
        return config;
    },
    (error) => Promise.reject(error)
);


api.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
        if (error.response?.status === 401) {

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
