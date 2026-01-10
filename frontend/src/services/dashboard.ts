import api from './api';
import type { DashboardStats, ApiResponse } from '@/types';

export const dashboardService = {
    async getStats(): Promise<DashboardStats | null> {
        try {
            const response = await api.get<ApiResponse<DashboardStats>>('/dashboard/stats');
            return response.data.data || null;
        } catch (error) {
            console.error('Failed to fetch dashboard stats:', error);
            return null;
        }
    },

    async getLogs(limit: number = 50): Promise<any[]> {
        try {
            const response = await api.get<ApiResponse<{ logs: any[] }>>(`/dashboard/logs?limit=${limit}`);
            return response.data.data?.logs || [];
        } catch (error) {
            console.error('Failed to fetch dashboard logs:', error);
            return [];
        }
    },

    async triggerManualProcessing(): Promise<boolean> {
        try {
            await api.post('/process/manual');
            return true;
        } catch (error) {
            console.error('Failed to trigger manual processing:', error);
            return false;
        }
    },
};
