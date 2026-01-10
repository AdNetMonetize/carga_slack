import { useLocation } from 'react-router-dom';
import './Header.css';

const pageTitles: Record<string, string> = {
    '/': 'Visão Geral',
    '/dashboard': 'Visão Geral',
    '/squads': 'Squads',
    '/sites': 'Sites',
    '/users': 'Usuários',
};

interface HeaderProps {
    onMenuToggle?: () => void;
    onRefresh?: () => void;
    isRefreshing?: boolean;
}

export function Header({ onMenuToggle, onRefresh, isRefreshing = false }: HeaderProps) {
    const location = useLocation();
    const title = pageTitles[location.pathname] || 'Dashboard';

    return (
        <header className="main-header">
            <button className="menu-toggle" onClick={onMenuToggle}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="3" y1="12" x2="21" y2="12"></line>
                    <line x1="3" y1="6" x2="21" y2="6"></line>
                    <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
            </button>
            <h1 className="page-title">{title}</h1>
            <div className="header-actions">
                <button
                    className="btn btn-secondary btn-sm btn-refresh"
                    onClick={onRefresh}
                    disabled={isRefreshing}
                >
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        style={{
                            animation: isRefreshing ? 'spin 0.8s linear infinite' : 'none'
                        }}
                    >
                        <path d="M23 4v6h-6"></path>
                        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                    </svg>
                    <span>{isRefreshing ? 'Atualizando...' : 'Atualizar'}</span>
                </button>
            </div>
        </header>
    );
}
