import api from './api';
import type { User, ApiResponse } from '@/types';

export interface CreateUserRequest {
    username?: string;
    email: string;
    password?: string;
    role: 'admin' | 'viewer';
}

export interface UpdateUserRequest {
    username?: string;
    password?: string;
    role?: 'admin' | 'viewer';
}

export const usersService = {
    async getAll(): Promise<User[]> {
        try {
            const response = await api.get<ApiResponse<{ users: User[]; total: number }>>('/users');
            return response.data.data?.users || [];
        } catch (error) {
            console.error('Failed to fetch users:', error);
            return [];
        }
    },

    async getById(id: number): Promise<User | null> {
        try {
            const response = await api.get<ApiResponse<User>>(`/users/${id}`);
            return response.data.data || null;
        } catch (error) {
            console.error('Failed to fetch user:', error);
            return null;
        }
    },

    async create(data: CreateUserRequest): Promise<User | null> {
        try {
            const response = await api.post<ApiResponse<User>>('/users', data);
            return response.data.data || null;
        } catch (error) {
            console.error('Failed to create user:', error);
            return null;
        }
    },

    async update(id: number, data: UpdateUserRequest): Promise<User | null> {
        try {
            const response = await api.put<ApiResponse<User>>(`/users/${id}`, data);
            return response.data.data || null;
        } catch (error) {
            console.error('Failed to update user:', error);
            return null;
        }
    },

    async delete(id: number): Promise<boolean> {
        try {
            const response = await api.delete<ApiResponse>(`/users/${id}`);
            return response.data.success;
        } catch (error) {
            console.error('Failed to delete user:', error);
            return false;
        }
    },
};
