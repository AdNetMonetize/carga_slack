import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { dashboardService } from '@/services/dashboard';
import { sitesService } from '@/services/sites';
import type { Site, ProcessingLog } from '@/types';
import { Modal } from '@/components';
import './Dashboard.css';

interface OutletContext {
    refreshKey: number;
}

export default function Dashboard() {
    const { user } = useAuth();
    const { refreshKey } = useOutletContext<OutletContext>();
    const [sites, setSites] = useState<Site[]>([]);
    const [logs, setLogs] = useState<ProcessingLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [selectedLog, setSelectedLog] = useState<ProcessingLog | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    // Modal States
    const [confirmModalOpen, setConfirmModalOpen] = useState(false);
    const [infoModal, setInfoModal] = useState<{ open: boolean; title: string; message: string; type: 'success' | 'error' | 'info' }>({
        open: false,
        title: '',
        message: '',
        type: 'info'
    });

    useEffect(() => {
        loadData();
    }, [refreshKey]);

    const loadData = async () => {
        setIsLoading(true);

        const [sitesData, logsData] = await Promise.all([
            sitesService.getAll(),
            dashboardService.getLogs(),
        ]);

        setSites(Array.isArray(sitesData) ? sitesData : []);
        setLogs(Array.isArray(logsData) ? logsData : []);
        setIsLoading(false);
    };

    const handleManualProcessingClick = () => {
        setConfirmModalOpen(true);
    };

    const confirmManualProcessing = async () => {
        setConfirmModalOpen(false);
        setIsProcessing(true);
        const success = await dashboardService.triggerManualProcessing();

        setIsProcessing(false);
        if (success) {
            setInfoModal({
                open: true,
                title: 'Processamento Iniciado',
                message: 'O processamento foi iniciado em segundo plano. Os logs serão atualizados automaticamente conforme o progresso.',
                type: 'success'
            });
            // Refresh logs immediately to show any initial "Starting" log if backend adds one, or just to be ready
            loadData();
        } else {
            setInfoModal({
                open: true,
                title: 'Erro',
                message: 'Não foi possível iniciar o processamento. Verifique se o servidor backend está rodando e tente novamente.',
                type: 'error'
            });
        }
    };

    if (isLoading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Carregando dados...</p>
            </div>
        );
    }

    // Backend doesn't return status yet, assume all returned are active
    const activeSites = sites.filter(s => s.status === 'active' || !s.status).length;
    const totalSites = sites.length;

    return (
        <section className="section active">
            <div className="dashboard-header-actions" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
                {user?.role === 'admin' && (
                    <button
                        className="btn btn-primary"
                        onClick={handleManualProcessingClick}
                        disabled={isProcessing}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        {isProcessing ? 'Iniciando...' : 'Executar Processamento'}
                        {!isProcessing && (
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                                <polygon points="5 3 19 12 5 21 5 3"></polygon>
                            </svg>
                        )}
                    </button>
                )}
            </div>

            {/* Stats Cards */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon btc">
                        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
                        </svg>
                    </div>
                    <div className="stat-info">
                        <h3>Sites Ativos</h3>
                        <p className="stat-value">{activeSites} <span style={{ fontSize: '0.6em', color: '#888' }}>/ {totalSites}</span></p>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon eth">
                        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                    </div>
                    <div className="stat-info">
                        <h3>Atividades Recentes</h3>
                        <p className="stat-value">{logs.length}</p>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon ltc">
                        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
                            <line x1="4" y1="22" x2="4" y2="15"></line>
                        </svg>
                    </div>
                    <div className="stat-info">
                        <h3>Squads</h3>
                        <p className="stat-value">{new Set(sites.map(s => s.squad_name || 'Sem Squad')).size}</p>
                    </div>
                </div>
            </div>

            {/* Recent Activity Logs Table */}
            <div className="card">
                <div className="card-header">
                    <h2>Atividades Recentes</h2>
                </div>
                <div className="card-body">
                    {logs.length === 0 ? (
                        <p className="empty-message">Nenhuma atividade registrada ainda.</p>
                    ) : (
                        <div className="table-responsive">
                            <table className="table activity-logs-table">
                                <thead>
                                    <tr>
                                        <th>Data/Hora</th>
                                        <th>Site</th>
                                        <th>Status</th>
                                        <th>Mensagem</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.map((log) => (
                                        <tr
                                            key={log.id}
                                            onClick={() => setSelectedLog(log)}
                                            style={{ cursor: 'pointer', transition: 'background-color 0.2s' }}
                                            className="log-row"
                                        >
                                            <td>{new Date(log.created_at).toLocaleString('pt-BR')}</td>
                                            <td>{log.site_name}</td>
                                            <td>
                                                <span className={`badge badge-${log.status === 'success' ? 'success' : log.status === 'error' ? 'danger' : 'info'}`}>
                                                    {log.status === 'success' ? 'Sucesso' : log.status === 'error' ? 'Erro' : 'Info'}
                                                </span>
                                            </td>
                                            <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {log.message}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Log Details Modal */}
            {selectedLog && (
                <Modal
                    isOpen={!!selectedLog}
                    onClose={() => setSelectedLog(null)}
                    title="Detalhes da Atividade"
                >
                    <div className="modal-body custom-scroll">
                        <div style={{ marginBottom: '15px' }}>
                            <strong>Data:</strong> {new Date(selectedLog.created_at).toLocaleString('pt-BR')}
                        </div>
                        <div style={{ marginBottom: '15px' }}>
                            <strong>Site:</strong> {selectedLog.site_name}
                        </div>
                        <div style={{ marginBottom: '15px' }}>
                            <strong>Status:</strong>{' '}
                            <span className={`badge badge-${selectedLog.status === 'success' ? 'success' : selectedLog.status === 'error' ? 'danger' : 'info'}`}>
                                {selectedLog.status === 'success' ? 'Sucesso' : selectedLog.status === 'error' ? 'Erro' : 'Info'}
                            </span>
                        </div>
                        <div style={{ marginTop: '20px' }}>
                            <strong>Mensagem:</strong>
                            <pre style={{
                                marginTop: '10px',
                                padding: '10px',
                                background: '#f5f5f5',
                                borderRadius: '4px',
                                whiteSpace: 'pre-wrap',
                                wordWrap: 'break-word',
                                fontSize: '0.9em',
                                color: '#333',
                                maxHeight: '300px',
                                overflowY: 'auto'
                            }}>
                                {selectedLog.message}
                            </pre>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Confirmation Modal */}
            <Modal
                isOpen={confirmModalOpen}
                onClose={() => setConfirmModalOpen(false)}
                title="Confirmar Processamento"
            >
                <div style={{ padding: '20px 0' }}>
                    <p>Deseja iniciar o processamento manual de todos os sites?</p>
                    <p style={{ marginTop: '10px', color: '#666', fontSize: '0.9em' }}>
                        Isso pode levar alguns minutos dependendo da quantidade de dados nas planilhas.
                    </p>
                </div>
                <div className="modal-actions">
                    <button className="btn btn-secondary" onClick={() => setConfirmModalOpen(false)}>Cancelar</button>
                    <button className="btn btn-primary" onClick={confirmManualProcessing}>Confirmar</button>
                </div>
            </Modal>

            {/* Info Modal */}
            <Modal
                isOpen={infoModal.open}
                onClose={() => setInfoModal(prev => ({ ...prev, open: false }))}
                title={infoModal.title}
            >
                <div style={{ padding: '20px 0' }}>
                    <p>{infoModal.message}</p>
                </div>
                <div className="modal-actions">
                    <button
                        className={`btn btn-${infoModal.type === 'error' ? 'danger' : 'primary'}`}
                        onClick={() => setInfoModal(prev => ({ ...prev, open: false }))}
                    >
                        OK
                    </button>
                </div>
            </Modal>
        </section>
    );
}
