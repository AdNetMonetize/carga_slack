import { useState, useCallback } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import './DashboardLayout.css';

export function DashboardLayout() {
    const { isAuthenticated, isLoading, user } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleMenuToggle = () => {
        setSidebarOpen(!sidebarOpen);
    };

    const handleRefresh = useCallback(() => {
        console.log('Refresh button clicked! Current refreshKey:', refreshKey);
        setIsRefreshing(true);
        setRefreshKey((prev) => {
            console.log('Setting refreshKey from', prev, 'to', prev + 1);
            return prev + 1;
        });

        // Reset refreshing state after a short delay
        setTimeout(() => {
            setIsRefreshing(false);
        }, 2000);
    }, [refreshKey]);

    const handleCloseSidebar = () => {
        setSidebarOpen(false);
    };

    if (isLoading) {
        return (
            <div className="loading-screen">
                <div className="loading-spinner"></div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    // Force password change redirect
    if (user?.must_change_password) {
        return <Navigate to="/login" replace />;
    }

    return (
        <div className="dashboard-page">
            <Sidebar isOpen={sidebarOpen} onClose={handleCloseSidebar} />

            {sidebarOpen && <div className="sidebar-overlay" onClick={handleCloseSidebar} />}

            <main className="main-content">
                <Header onMenuToggle={handleMenuToggle} onRefresh={handleRefresh} isRefreshing={isRefreshing} />
                <div className="content-wrapper">
                    <Outlet context={{ refreshKey }} />
                </div>
            </main>
        </div>
    );
}
