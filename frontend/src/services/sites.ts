import api from './api';
import type { Site, CreateSiteRequest, UpdateSiteRequest, ApiResponse } from '@/types';

export interface SheetHeader {
    index: number;
    name: string;
}

export interface SheetInfo {
    id: number;
    name: string;
}

export interface SheetHeadersResponse {
    sheets: SheetInfo[];
    headers: SheetHeader[];
    total_columns: number;
}

export const sitesService = {
    async getAll(filters?: { name?: string; squad?: string }): Promise<Site[]> {
        try {
            const params = new URLSearchParams();
            if (filters?.name) params.append('name', filters.name);
            if (filters?.squad) params.append('squad', filters.squad);

            const response = await api.get<ApiResponse<{ sites: Site[], total: number }>>(`/sites?${params.toString()}`);
            return response.data.data?.sites || [];
        } catch (error) {
            console.error('Failed to fetch sites:', error);
            return [];
        }
    },

    async getById(id: number): Promise<Site | null> {
        try {
            const response = await api.get<ApiResponse<Site>>(`/sites/${id}`);
            return response.data.data || null;
        } catch (error) {
            console.error('Failed to fetch site:', error);
            return null;
        }
    },

    async getSheetHeaders(sheetUrl: string): Promise<SheetHeadersResponse | null> {
        try {
            const response = await api.post<ApiResponse<SheetHeadersResponse>>('/sheets/headers', { sheet_url: sheetUrl });
            if (response.data.success && response.data.data) {
                return response.data.data;
            }
            return null;
        } catch (error) {
            console.error('Failed to fetch sheet headers:', error);
            return null;
        }
    },

    async create(data: CreateSiteRequest): Promise<Site | null> {
        try {
            const response = await api.post<ApiResponse<Site>>('/sites', data);
            if (response.data.success) {
                return response.data.data || ({} as Site);
            }
            return null;
        } catch (error) {
            console.error('Failed to create site:', error);
            return null;
        }
    },

    async update(id: number, data: UpdateSiteRequest): Promise<Site | null> {
        try {
            const response = await api.put<ApiResponse<Site>>(`/sites/${id}`, data);
            if (response.data.success) {
                return response.data.data || ({} as Site);
            }
            return null;
        } catch (error) {
            console.error('Failed to update site:', error);
            return null;
        }
    },

    async delete(id: number): Promise<boolean> {
        try {
            const response = await api.delete<ApiResponse>(`/sites/${id}`);
            return response.data.success;
        } catch (error) {
            console.error('Failed to delete site:', error);
            return false;
        }
    },
};
