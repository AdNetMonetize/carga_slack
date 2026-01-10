import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { sitesService, type SheetHeader } from '@/services/sites';
import { squadsService, type Squad } from '@/services/squads';
import { Modal } from '@/components/ui/Modal';
import type { Site, CreateSiteRequest } from '@/types';
import './Sites.css';

interface OutletContext {
    refreshKey: number;
}

export function Sites() {
    const { user } = useAuth();
    const { refreshKey } = useOutletContext<OutletContext>();
    const [sites, setSites] = useState<Site[]>([]);
    const [squads, setSquads] = useState<Squad[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSite, setEditingSite] = useState<Site | null>(null);
    const [isViewing, setIsViewing] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [siteToDelete, setSiteToDelete] = useState<Site | null>(null);

    // Filter state
    const [filterName, setFilterName] = useState('');
    const [filterSquad, setFilterSquad] = useState('');

    // Form state - Step 1
    const [currentStep, setCurrentStep] = useState(1);
    const [formName, setFormName] = useState('');
    const [formSpreadsheet, setFormSpreadsheet] = useState('');
    const [formSquad, setFormSquad] = useState('');
    const [formStatus, setFormStatus] = useState<'active' | 'inactive'>('active');

    // Form state - Step 2 (Mapping)
    const [sheetHeaders, setSheetHeaders] = useState<SheetHeader[]>([]);
    const [loadingHeaders, setLoadingHeaders] = useState(false);
    const [mapping, setMapping] = useState({
        investimento: '',
        receita: '',
        roas: '',
        mc: ''
    });

    const [formError, setFormError] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        loadSquads();
    }, [refreshKey]);

    useEffect(() => {
        setIsLoading(true);
        const timer = setTimeout(() => {
            loadSites();
        }, 500);
        return () => clearTimeout(timer);
    }, [refreshKey, filterName, filterSquad]);

    const loadSquads = async () => {
        const data = await squadsService.getAll();
        setSquads(Array.isArray(data) ? data : []);
    };

    const loadSites = async () => {
        const data = await sitesService.getAll({
            name: filterName,
            squad: filterSquad
        });
        setSites(Array.isArray(data) ? data : []);
        setIsLoading(false);
    };

    const openNewModal = () => {
        setEditingSite(null);
        setIsViewing(false);
        resetForm();
        setIsModalOpen(true);
    };

    const openEditModal = async (summarySite: Site) => {
        setIsViewing(false);
        await loadSiteDetails(summarySite);
    };

    const openViewModal = async (summarySite: Site) => {
        setIsViewing(true);
        await loadSiteDetails(summarySite);
    };

    const loadSiteDetails = async (summarySite: Site) => {
        // Primeiro abre com os dados que já temos
        setEditingSite(summarySite);
        setFormName(summarySite.name);
        setFormSpreadsheet(summarySite.sheet_url || '');
        setFormSquad(summarySite.squad_name || '');
        setFormStatus(summarySite.status || 'active');
        setCurrentStep(1);
        setFormError('');
        setIsModalOpen(true);

        // Busca detalhes completos (incluindo índices) se tiver ID
        if (summarySite.id) {
            try {
                const fullSite = await sitesService.getById(summarySite.id);
                if (fullSite) {
                    setEditingSite(fullSite);
                    setFormSpreadsheet(fullSite.sheet_url || '');
                    setFormName(fullSite.name);
                }
            } catch (error) {
                console.error("Erro ao carregar detalhes do site", error);
            }
        }
    };

    const resetForm = () => {
        setFormName('');
        setFormSpreadsheet('');
        setFormSquad('');
        setFormStatus('active');
        setSheetHeaders([]);
        setMapping({
            investimento: '',
            receita: '',
            roas: '',
            mc: ''
        });
        setCurrentStep(1);
        setFormError('');
    };

    const handleFetchHeaders = async () => {
        if (!formSpreadsheet.trim()) {
            setFormError('Informe a URL da planilha');
            return;
        }

        setLoadingHeaders(true);
        setFormError('');

        const result = await sitesService.getSheetHeaders(formSpreadsheet.trim());

        if (result && result.headers.length > 0) {
            setSheetHeaders(result.headers);
            setCurrentStep(2);

            // Tenta pré-selecionar o mapeamento se estiver editando e tiver dados
            if (editingSite) {
                const findHeaderName = (idx?: number) => {
                    if (idx === undefined || idx === null) return '';
                    const header = result.headers.find(h => h.index === idx);
                    return header ? header.name : '';
                };

                // Só atualiza se encontrar headers correspondentes, senão mantém vazio
                // ou se os indices existem
                if (editingSite.investimento_idx !== undefined) {
                    setMapping({
                        investimento: findHeaderName(editingSite.investimento_idx),
                        receita: findHeaderName(editingSite.receita_idx),
                        roas: findHeaderName(editingSite.roas_idx),
                        mc: findHeaderName(editingSite.mc_idx)
                    });
                }
            }
        } else {
            setFormError('Não foi possível ler os cabeçalhos da planilha. Verifique a URL e as permissões.');
        }

        setLoadingHeaders(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError('');

        // Validações básicas
        if (!formName.trim()) {
            setFormError('Nome é obrigatório');
            return;
        }

        // Se estiver no passo 2, validar mapeamento
        if (currentStep === 2) {
            if (!mapping.investimento || !mapping.receita || !mapping.roas || !mapping.mc) {
                setFormError('Selecione todas as colunas correspondentes');
                return;
            }
        }

        setIsSaving(true);

        // Encontra os índices baseado nas seleções (que guardam o nome da coluna)
        // Se estiver no passo 1 (edição s/ remapear), assume 0 ou mantém original se backend suportar
        // Mas como estamos forçando mapeamento na criação, vamos focar nisso

        const getIndex = (headerName: string) => {
            const header = sheetHeaders.find(h => h.name === headerName);
            return header ? header.index : 0;
        };

        const data: CreateSiteRequest = {
            name: formName.trim(),
            sheet_url: formSpreadsheet.trim() || undefined,
            squad_name: formSquad.trim() || undefined,
            status: formStatus,
            // Adiciona índices mapeados
            investimento_idx: getIndex(mapping.investimento),
            receita_idx: getIndex(mapping.receita),
            roas_idx: getIndex(mapping.roas),
            mc_idx: getIndex(mapping.mc),
        };

        let result;
        if (editingSite && editingSite.id) {
            result = await sitesService.update(editingSite.id, data);
        } else if (editingSite) {
            setFormError('Erro: Site sem ID para edição.');
            setIsSaving(false);
            return;
        } else {
            result = await sitesService.create(data);
        }

        if (result) {
            setIsModalOpen(false);
            loadSites();
        } else {
            setFormError('Erro ao salvar site. Verifique os dados e tente novamente.');
        }

        setIsSaving(false);
    };

    const handleDelete = (site: Site) => {
        setSiteToDelete(site);
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (siteToDelete && siteToDelete.id) {
            const success = await sitesService.delete(siteToDelete.id);
            if (success) {
                loadSites();
            }
        }
        setIsDeleteModalOpen(false);
        setSiteToDelete(null);
    };

    const handleToggleStatus = async (site: Site) => {
        if (!site.id) return;
        const currentStatus = site.status || 'active';
        const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
        // Para toggle de status não precisamos mandar todos os dados, se o backend suportar PATCH seria ideal
        // Como o backend usa PUT e espera tudo, vamos mandar só o status se o backend aceitar partial update, 
        // mas o endpoint valida campos obrigatórios.
        // O ideal é carregar o site completo antes ou backend aceitar partial.
        // Assumindo que o update do backend valida campos required, isso pode falhar.
        // Vamos tentar mandar o objeto site mesclado.
        const result = await sitesService.update(site.id, {
            ...site,
            status: newStatus,
            // Garante campos required se o objeto site já os tiver
            investimento_idx: site.investimento_idx || 0,
            receita_idx: site.receita_idx || 0,
            roas_idx: site.roas_idx || 0,
            mc_idx: site.mc_idx || 0,
        });

        if (result) {
            loadSites();
        }
    };

    if (isLoading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Carregando sites...</p>
            </div>
        );
    }

    return (
        <section className="section active">
            <div className="card">
                <div className="card-header">
                    <div className="header-content">
                        <h2>Gerenciamento de Sites</h2>
                        <div className="filters">
                            <input
                                type="text"
                                placeholder="Buscar por nome..."
                                className="filter-input"
                                value={filterName}
                                onChange={(e) => setFilterName(e.target.value)}
                            />
                            <select
                                className="filter-input"
                                value={filterSquad}
                                onChange={(e) => setFilterSquad(e.target.value)}
                            >
                                <option value="">Todos os Squads</option>
                                {squads.map((squad) => (
                                    <option key={squad.name} value={squad.name}>
                                        {squad.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    {user?.role === 'admin' && (
                        <button className="btn btn-primary btn-sm" onClick={openNewModal}>
                            Novo Site
                        </button>
                    )}
                </div>
                <div className="card-body">
                    {sites.length === 0 ? (
                        <p className="empty-message">Nenhum site cadastrado ainda.</p>
                    ) : (
                        <div className="table-responsive">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Nome</th>
                                        <th>Planilha</th>
                                        <th>Squad</th>
                                        <th>Status</th>
                                        <th>Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sites.map((site) => (
                                        <tr key={site.id || site.name}>
                                            <td>{site.name}</td>
                                            <td>{site.sheet_url ? 'Configurada' : '-'}</td>
                                            <td>{site.squad_name || '-'}</td>
                                            <td>
                                                <span
                                                    className={`badge badge-${(site.status === 'active' || !site.status) ? 'success' : 'secondary'} ${user?.role === 'admin' ? 'badge-clickable' : ''}`}
                                                    onClick={() => user?.role === 'admin' && handleToggleStatus(site)}
                                                    title={user?.role === 'admin' ? "Clique para alternar status" : "Status"}
                                                    style={{ cursor: user?.role === 'admin' ? 'pointer' : 'default' }}
                                                >
                                                    {(site.status === 'active' || !site.status) ? 'Ativo' : 'Inativo'}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="table-actions">
                                                    <button
                                                        className="btn btn-sm btn-secondary"
                                                        onClick={() => openViewModal(site)}
                                                        title="Visualizar Detalhes"
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
                                                                onClick={() => openEditModal(site)}
                                                                title="Editar"
                                                            >
                                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                                </svg>
                                                            </button>
                                                            <button
                                                                className="btn btn-sm btn-danger"
                                                                onClick={() => handleDelete(site)}
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
                title={isViewing ? 'Detalhes do Site' : (editingSite ? 'Editar Site' : 'Novo Site')}
            >
                <form onSubmit={handleSubmit}>
                    {currentStep === 1 ? (
                        <>
                            <div className="form-group">
                                <label htmlFor="siteName">Nome *</label>
                                <input
                                    type="text"
                                    id="siteName"
                                    className="form-input"
                                    value={formName}
                                    onChange={(e) => setFormName(e.target.value)}
                                    placeholder="Nome do site"
                                    required
                                    disabled={isViewing}
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="siteSpreadsheet">URL da Planilha *</label>
                                <input
                                    type="url"
                                    id="siteSpreadsheet"
                                    className="form-input"
                                    value={formSpreadsheet}
                                    onChange={(e) => setFormSpreadsheet(e.target.value)}
                                    placeholder="https://docs.google.com/spreadsheets/d/..."
                                    required
                                    disabled={isViewing}
                                />
                                <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                                    A planilha deve estar compartilhada com o email de serviço do sistema.
                                </small>
                            </div>

                            <div className="form-group">
                                <label htmlFor="siteSquad">Squad</label>
                                <select
                                    id="siteSquad"
                                    className="form-input"
                                    value={formSquad}
                                    onChange={(e) => setFormSquad(e.target.value)}
                                    disabled={isViewing}
                                >
                                    <option value="">Selecione um Squad</option>
                                    {squads.map((squad) => (
                                        <option key={squad.name} value={squad.name}>
                                            {squad.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label htmlFor="siteStatus">Status</label>
                                <select
                                    id="siteStatus"
                                    className="form-input"
                                    value={formStatus}
                                    onChange={(e) => setFormStatus(e.target.value as 'active' | 'inactive')}
                                    disabled={isViewing}
                                >
                                    <option value="active">Ativo</option>
                                    <option value="inactive">Inativo</option>
                                </select>
                            </div>
                        </>
                    ) : (
                        <div className="mapping-step">
                            <p style={{ marginBottom: '1rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                Mapeie as colunas da sua planilha para as métricas do sistema:
                            </p>

                            <div className="form-group">
                                <label>Investimento (Ads Cost) *</label>
                                <select
                                    className="form-input"
                                    value={mapping.investimento}
                                    onChange={(e) => setMapping({ ...mapping, investimento: e.target.value })}
                                    required
                                >
                                    <option value="">Selecione a coluna...</option>
                                    {sheetHeaders.map((header) => (
                                        <option key={header.index} value={header.name}>
                                            {header.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Receita (Total Value) *</label>
                                <select
                                    className="form-input"
                                    value={mapping.receita}
                                    onChange={(e) => setMapping({ ...mapping, receita: e.target.value })}
                                    required
                                >
                                    <option value="">Selecione a coluna...</option>
                                    {sheetHeaders.map((header) => (
                                        <option key={header.index} value={header.name}>
                                            {header.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label>ROAS (Purchase ROAS) *</label>
                                <select
                                    className="form-input"
                                    value={mapping.roas}
                                    onChange={(e) => setMapping({ ...mapping, roas: e.target.value })}
                                    required
                                >
                                    <option value="">Selecione a coluna...</option>
                                    {sheetHeaders.map((header) => (
                                        <option key={header.index} value={header.name}>
                                            {header.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Margem de Contribuição (MC) *</label>
                                <select
                                    className="form-input"
                                    value={mapping.mc}
                                    onChange={(e) => setMapping({ ...mapping, mc: e.target.value })}
                                    required
                                >
                                    <option value="">Selecione a coluna...</option>
                                    {sheetHeaders.map((header) => (
                                        <option key={header.index} value={header.name}>
                                            {header.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

                    {formError && (
                        <div className="error-message" style={{ display: 'block', marginBottom: '1rem' }}>
                            {formError}
                        </div>
                    )}

                    <div className="modal-actions">
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => {
                                if (currentStep === 2) {
                                    setCurrentStep(1);
                                } else {
                                    setIsModalOpen(false);
                                }
                            }}
                        >
                            {currentStep === 2 ? 'Voltar' : 'Cancelar'}
                        </button>

                        {currentStep === 1 ? (
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={handleFetchHeaders}
                                disabled={loadingHeaders || isViewing}
                            >
                                {loadingHeaders ? 'Carregando...' : (isViewing ? 'Ver Mapeamento →' : 'Mapear Colunas →')}
                            </button>
                        ) : (
                            !isViewing && (
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={isSaving}
                                >
                                    {isSaving ? 'Salvando...' : 'Salvar Site'}
                                </button>
                            )
                        )}
                    </div>
                </form>
            </Modal>

            <Modal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                title="Confirmar Exclusão"
            >
                <div style={{ padding: '1rem 0' }}>
                    <p>Tem certeza que deseja excluir o site <strong>"{siteToDelete?.name}"</strong>?</p>
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
        </section >
    );
}
