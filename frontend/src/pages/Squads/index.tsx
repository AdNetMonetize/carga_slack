import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { squadsService, type Squad } from '@/services/squads';
import { Modal } from '@/components/ui/Modal';
import './Squads.css';

interface OutletContext {
    refreshKey: number;
}

export function Squads() {
    const { user } = useAuth();
    const { refreshKey } = useOutletContext<OutletContext>();
    const [squads, setSquads] = useState<Squad[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSquad, setEditingSquad] = useState<Squad | null>(null);
    const [isViewing, setIsViewing] = useState(false);

    // Form state
    const [formName, setFormName] = useState('');
    const [formWebhook, setFormWebhook] = useState('');
    const [formError, setFormError] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Delete confirmation modal
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [squadToDelete, setSquadToDelete] = useState<Squad | null>(null);

    // Error modal
    const [errorModal, setErrorModal] = useState<{ open: boolean; message: string }>({
        open: false,
        message: ''
    });

    useEffect(() => {
        loadSquads();
    }, [refreshKey]);

    const loadSquads = async () => {
        setIsLoading(true);
        const data = await squadsService.getAll();
        setSquads(Array.isArray(data) ? data : []);
        setIsLoading(false);
    };

    const openNewModal = () => {
        setEditingSquad(null);
        setFormName('');
        setFormWebhook('');
        setFormError('');
        setIsViewing(false);
        setIsModalOpen(true);
    };

    const openEditModal = (squad: Squad) => {
        setEditingSquad(squad);
        setFormName(squad.name);
        setFormWebhook(squad.webhook_url || '');
        setFormError('');
        setIsViewing(false);
        setIsModalOpen(true);
    };

    const openViewModal = (squad: Squad) => {
        setEditingSquad(squad);
        setFormName(squad.name);
        setFormWebhook(squad.webhook_url || '');
        setFormError('');
        setIsViewing(true);
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError('');

        if (!formName.trim()) {
            setFormError('Nome é obrigatório');
            return;
        }

        setIsSaving(true);

        let result;
        if (editingSquad) {
            result = await squadsService.update(editingSquad.name, {
                new_name: formName.trim(),
                webhook_url: formWebhook.trim() || undefined,
            });
        } else {
            result = await squadsService.create({
                name: formName.trim(),
                webhook_url: formWebhook.trim() || undefined,
            });
        }

        if (result) {
            setIsModalOpen(false);
            loadSquads();
        } else {
            setFormError('Erro ao salvar squad. Tente novamente.');
        }

        setIsSaving(false);
    };

    const openDeleteModal = (squad: Squad) => {
        setSquadToDelete(squad);
        setDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!squadToDelete) return;

        setDeleteModalOpen(false);
        const success = await squadsService.delete(squadToDelete.name);

        console.log('Delete result:', success);

        if (success) {
            loadSquads();
        } else {
            setErrorModal({
                open: true,
                message: 'Não foi possível excluir o squad. Verifique se não há sites associados.'
            });
        }
        setSquadToDelete(null);
    };

    if (isLoading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Carregando squads...</p>
            </div>
        );
    }

    return (
        <section className="section active">
            <div className="card">
                <div className="card-header">
                    <h2>Gerenciamento de Squads</h2>
                    {user?.role === 'admin' && (
                        <button className="btn btn-primary btn-sm" onClick={openNewModal}>
                            Novo Squad
                        </button>
                    )}
                </div>
                <div className="card-body">
                    {squads.length === 0 ? (
                        <p className="empty-message">Nenhum squad cadastrado ainda.</p>
                    ) : (
                        <div className="table-responsive">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Nome</th>
                                        <th>Sites</th>
                                        <th>Webhook</th>
                                        <th>Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {squads.map((squad) => (
                                        <tr key={squad.name}>
                                            <td>
                                                <strong>{squad.name}</strong>
                                            </td>
                                            <td>
                                                <span className="badge badge-primary">
                                                    {squad.sites_count || 0} {squad.sites_count === 1 ? 'site' : 'sites'}
                                                </span>
                                            </td>
                                            <td>
                                                {squad.webhook_url ? (
                                                    <span className="badge badge-success">Configurado</span>
                                                ) : (
                                                    <span className="badge badge-secondary">Não configurado</span>
                                                )}
                                            </td>
                                            <td>
                                                <div className="table-actions">
                                                    <button
                                                        className="btn btn-sm btn-secondary"
                                                        onClick={() => openViewModal(squad)}
                                                        title="Visualizar"
                                                    >
                                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                                            <circle cx="12" cy="12" r="3"></circle>
                                                        </svg>
                                                    </button>
                                                    {user?.role === 'admin' && (
                                                        <>
                                                            <button
                                                                className="btn btn-sm btn-secondary"
                                                                onClick={() => openEditModal(squad)}
                                                                title="Editar"
                                                            >
                                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                                </svg>
                                                            </button>
                                                            <button
                                                                className="btn btn-sm btn-danger"
                                                                onClick={() => openDeleteModal(squad)}
                                                                title="Excluir"
                                                            >
                                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                                                                    <polyline points="3 6 5 6 21 6"></polyline>
                                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                                </svg>
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={isViewing ? 'Detalhes do Squad' : (editingSquad ? 'Editar Squad' : 'Novo Squad')}
            >
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="squadName">Nome *</label>
                        <input
                            type="text"
                            id="squadName"
                            className="form-input"
                            value={formName}
                            onChange={(e) => setFormName(e.target.value)}
                            placeholder="Nome do squad"
                            required
                            disabled={isViewing}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="squadWebhook">Webhook URL do Slack</label>
                        <input
                            type="url"
                            id="squadWebhook"
                            className="form-input"
                            value={formWebhook}
                            onChange={(e) => setFormWebhook(e.target.value)}
                            placeholder="https://hooks.slack.com/services/..."
                            disabled={isViewing}
                        />
                        <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                            URL do webhook do Slack para envio de notificações
                        </small>
                    </div>

                    {formError && (
                        <div className="error-message" style={{ display: 'block', marginBottom: '1rem' }}>
                            {formError}
                        </div>
                    )}

                    <div className="modal-actions">
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => setIsModalOpen(false)}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={isSaving || isViewing}
                            style={{ display: isViewing ? 'none' : 'block' }}
                        >
                            {isSaving ? 'Salvando...' : (editingSquad ? 'Atualizar' : 'Criar')}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                title="Confirmar Exclusão"
            >
                <p style={{ marginBottom: 'var(--space-xl)' }}>
                    Tem certeza que deseja excluir o squad <strong>"{squadToDelete?.name}"</strong>?
                </p>
                <div className="modal-actions">
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setDeleteModalOpen(false)}
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        className="btn btn-danger"
                        onClick={confirmDelete}
                    >
                        Excluir
                    </button>
                </div>
            </Modal>

            {/* Error Modal */}
            <Modal
                isOpen={errorModal.open}
                onClose={() => setErrorModal({ open: false, message: '' })}
                title="Erro"
            >
                <p style={{ marginBottom: 'var(--space-xl)' }}>
                    {errorModal.message}
                </p>
                <div className="modal-actions">
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => setErrorModal({ open: false, message: '' })}
                    >
                        OK
                    </button>
                </div>
            </Modal>
        </section>
    );
}
