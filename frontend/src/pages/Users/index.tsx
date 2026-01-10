import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { usersService, type CreateUserRequest } from '@/services/users';
import { Modal } from '@/components/ui/Modal';
import type { User } from '@/types';
import './Users.css';

interface OutletContext {
    refreshKey: number;
}

export function Users() {
    const { refreshKey } = useOutletContext<OutletContext>();
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [createdPassword, setCreatedPassword] = useState('');
    const [currentStep, setCurrentStep] = useState(1);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState<User | null>(null);

    // Form state
    const [formUsername, setFormUsername] = useState('');
    const [formPassword, setFormPassword] = useState('');
    const [formRole, setFormRole] = useState<'admin' | 'viewer'>('viewer');
    const [formError, setFormError] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        loadUsers();
    }, [refreshKey]);

    const loadUsers = async () => {
        setIsLoading(true);
        const data = await usersService.getAll();
        setUsers(Array.isArray(data) ? data : []);
        setIsLoading(false);
    };

    const openNewModal = () => {
        setEditingUser(null);
        setFormUsername('');
        setFormPassword('');
        setFormRole('viewer');
        setFormError('');
        setCurrentStep(1);
        setIsModalOpen(true);
    };

    const openEditModal = (user: User) => {
        setEditingUser(user);
        setFormUsername(user.username);
        setFormPassword('');
        setFormRole(user.role);
        setFormError('');
        setCurrentStep(1);
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError('');

        if (!formUsername.trim()) {
            setFormError('Usuário é obrigatório');
            return;
        }

        if (formRole === 'viewer' && !formUsername.includes('@')) {
            // Opcional: validação básica de email se for viewer (ou sempre)
        }

        setIsSaving(true);

        let result;
        if (editingUser) {
            const updateData: Partial<CreateUserRequest> = {
                username: formUsername.trim(),
                role: formRole,
            };
            if (formPassword) {
                updateData.password = formPassword;
            }
            result = await usersService.update(editingUser.id, updateData);

            if (result) {
                setIsModalOpen(false);
                loadUsers();
            } else {
                setFormError('Erro ao atualizar usuário.');
            }
        } else {
            const createData: CreateUserRequest = {
                email: formUsername.trim(),
                username: formUsername.trim(),
                role: formRole,
                password: ''
            };
            result = await usersService.create(createData);

            if (result) {
                loadUsers(); // Reload in background
                if ((result as any).password) {
                    setCreatedPassword((result as any).password);
                    setCurrentStep(2); // Move to step 2 in the same modal
                } else {
                    setIsModalOpen(false);
                }
            } else {
                setFormError('Erro ao criar usuário.');
            }
        }

        setIsSaving(false);
    };

    const handleDelete = (user: User) => {
        setUserToDelete(user);
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (userToDelete) {
            const success = await usersService.delete(userToDelete.id);
            if (success) {
                loadUsers();
            }
        }
        setIsDeleteModalOpen(false);
        setUserToDelete(null);
    };

    if (isLoading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Carregando usuários...</p>
            </div>
        );
    }

    return (
        <section className="section active">
            <div className="card">
                <div className="card-header">
                    <h2>Gerenciamento de Usuários</h2>
                    <button className="btn btn-primary btn-sm" onClick={openNewModal}>
                        Novo Usuário
                    </button>
                </div>
                <div className="card-body">
                    {users.length === 0 ? (
                        <p className="empty-message">Nenhum usuário cadastrado ainda.</p>
                    ) : (
                        <div className="table-responsive">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Usuário</th>
                                        <th>Papel</th>
                                        <th>Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((user) => (
                                        <tr key={user.id}>
                                            <td>
                                                <div className="user-cell">
                                                    <div className="user-avatar-sm">
                                                        {user.username.charAt(0).toUpperCase()}
                                                    </div>
                                                    <span>{user.username}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`badge badge-${user.role === 'admin' ? 'primary' : 'secondary'}`}>
                                                    {user.role === 'admin' ? 'Administrador' : 'Visualizador'}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="table-actions">
                                                    <button
                                                        className="btn btn-sm btn-secondary"
                                                        onClick={() => openEditModal(user)}
                                                        title="Editar"
                                                    >
                                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                        </svg>
                                                    </button>
                                                    <button
                                                        className="btn btn-sm btn-danger"
                                                        onClick={() => handleDelete(user)}
                                                        title="Excluir"
                                                    >
                                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                                                            <polyline points="3 6 5 6 21 6"></polyline>
                                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                        </svg>
                                                    </button>
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
                title={
                    currentStep === 2
                        ? 'Usuário Criado com Sucesso'
                        : (editingUser ? 'Editar Usuário' : 'Novo Usuário')
                }
            >
                {currentStep === 1 ? (
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label htmlFor="userUsername">Email *</label>
                            <input
                                type="email"
                                id="userUsername"
                                className="form-input"
                                value={formUsername}
                                onChange={(e) => setFormUsername(e.target.value)}
                                placeholder="email@exemplo.com"
                                required
                            />
                        </div>

                        {editingUser && (
                            <div className="form-group">
                                <label htmlFor="userPassword">
                                    Nova Senha (deixe em branco para manter)
                                </label>
                                <input
                                    type="password"
                                    id="userPassword"
                                    className="form-input"
                                    value={formPassword}
                                    onChange={(e) => setFormPassword(e.target.value)}
                                    placeholder="Nova senha (opcional)"
                                />
                            </div>
                        )}

                        <div className="form-group">
                            <label htmlFor="userRole">Papel *</label>
                            <select
                                id="userRole"
                                className="form-input"
                                value={formRole}
                                onChange={(e) => setFormRole(e.target.value as 'admin' | 'viewer')}
                            >
                                <option value="viewer">Visualizador</option>
                                <option value="admin">Administrador</option>
                            </select>
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
                                disabled={isSaving}
                            >
                                {isSaving ? 'Salvando...' : (editingUser ? 'Atualizar' : 'Criar')}
                            </button>
                        </div>
                    </form>
                ) : (
                    <>
                        <div style={{ padding: '1rem 0', textAlign: 'center' }}>
                            <p style={{ marginBottom: '1rem' }}>O usuário foi criado e a senha gerada é:</p>
                            <div style={{
                                background: '#f5f5f5',
                                padding: '1rem',
                                borderRadius: '4px',
                                fontSize: '1.2rem',
                                fontWeight: 'bold',
                                fontFamily: 'monospace',
                                userSelect: 'all',
                                border: '1px solid #ddd'
                            }}>
                                {createdPassword}
                            </div>
                            <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#666' }}>
                                Copie esta senha e envie para o usuário. Ele precisará trocá-la no primeiro acesso.
                            </p>
                        </div>
                        <div className="modal-actions">
                            <button
                                className="btn btn-primary"
                                onClick={() => setIsModalOpen(false)}
                            >
                                Entendido
                            </button>
                        </div>
                    </>
                )}
            </Modal>

            <Modal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                title="Confirmar Exclusão"
            >
                <div style={{ padding: '1rem 0' }}>
                    <p>Tem certeza que deseja excluir o usuário <strong>"{userToDelete?.username}"</strong>?</p>
                    <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: 'var(--error)' }}>
                        Esta ação não poderá ser desfeita.
                    </p>
                </div>
                <div className="modal-actions">
                    <button
                        className="btn btn-secondary"
                        onClick={() => setIsDeleteModalOpen(false)}
                    >
                        Cancelar
                    </button>
                    <button
                        className="btn btn-danger"
                        onClick={confirmDelete}
                    >
                        Excluir
                    </button>
                </div>
            </Modal>
        </section>
    );
}
