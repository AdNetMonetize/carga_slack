// User types
export interface User {
    id: number;
    username: string;
    role: 'admin' | 'viewer';
    must_change_password?: boolean;
    created_at?: string;
    updated_at?: string;
}

// Auth types
export interface LoginRequest {
    username: string;
    password: string;
    remember?: boolean;
}

export interface LoginResponse {
    token: string;
    user: User;
}

export interface ChangePasswordRequest {
    new_password: string;
}

// API Response types
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    message?: string;
}

// Site types
export interface Site {
    id?: number; // Backend might not be sending ID yet, but it should
    name: string;
    sheet_url?: string;
    squad_name?: string;
    has_webhook?: boolean;
    status?: 'active' | 'inactive';
    // Column indices
    investimento_idx?: number;
    receita_idx?: number;
    roas_idx?: number;
    mc_idx?: number;

    created_at?: string;
    updated_at?: string;
}

export interface CreateSiteRequest {
    name: string;
    sheet_url?: string;
    squad_name?: string;
    status?: 'active' | 'inactive';
    investimento_idx?: number;
    receita_idx?: number;
    roas_idx?: number;
    mc_idx?: number;
}

export interface UpdateSiteRequest {
    name?: string;
    sheet_url?: string;
    squad_name?: string;
    status?: 'active' | 'inactive';
    investimento_idx?: number;
    receita_idx?: number;
    roas_idx?: number;
    mc_idx?: number;
}

// Dashboard types
export interface DashboardStats {
    total_sites: number;
    active_sites: number;
    total_users: number;
    recent_activity: ActivityItem[];
}

export interface ActivityItem {
    id: number;
    description: string;
    timestamp: string;
    type: 'site' | 'user' | 'system';
}

export interface ProcessingLog {
    id: number;
    site_name: string;
    status: 'success' | 'error' | 'info';
    message: string;
    created_at: string;
}
