import api from './api';
import type { ApiResponse } from '@/types';

export interface Squad {
    name: string;
    sites: string[];
    sites_count: number;
    webhook_url?: string;
}

export interface CreateSquadRequest {
    name: string;
    webhook_url?: string;
}

export interface UpdateSquadRequest {
    new_name: string;
    webhook_url?: string;
}

export const squadsService = {
    async getAll(): Promise<Squad[]> {
        try {
            const response = await api.get<ApiResponse<{ squads: Squad[], total: number }>>('/squads');
            return response.data.data?.squads || [];
        } catch (error) {
            console.error('Failed to fetch squads:', error);
            return [];
        }
    },

    async create(data: CreateSquadRequest): Promise<Squad | null> {
        try {
            const response = await api.post<ApiResponse<Squad>>('/squads', data);
            // Se a API retornar success: true, consideramos sucesso mesmo sem data
            return response.data.success ? ({} as Squad) : null;
        } catch (error) {
            console.error('Failed to create squad:', error);
            return null;
        }
    },

    async update(name: string, data: UpdateSquadRequest): Promise<Squad | null> {
        try {
            const response = await api.put<ApiResponse<Squad>>(`/squads/${encodeURIComponent(name)}`, data);
            // Se a API retornar success: true, consideramos sucesso mesmo sem data
            return response.data.success ? ({} as Squad) : null;
        } catch (error) {
            console.error('Failed to update squad:', error);
            return null;
        }
    },

    async delete(name: string): Promise<boolean> {
        try {
            const response = await api.delete<ApiResponse>(`/squads/${encodeURIComponent(name)}`);
            return response.data.success;
        } catch (error) {
            console.error('Failed to delete squad:', error);
            return false;
        }
    }
};
