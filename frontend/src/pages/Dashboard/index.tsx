import { useEffect, useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { dashboardService } from '@/services/dashboard';
import { sitesService } from '@/services/sites';
import type { Site, ProcessingLog } from '@/types';
import { Modal } from '@/components';
import {
    Building2,
    Clock,
    Play,
    Trophy,
    BarChart3,
    Users,
    Wallet,
    DollarSign,
    TrendingUp,
    PieChart
} from 'lucide-react'; 
import './Dashboard.css';

interface OutletContext {
    refreshKey: number;
}

interface ParsedSiteData {
    siteName: string;
    squadName: string;
    investimento: string;
    receita: string;
    roas: string;
    mc: string;
    //receitaNum: number;
    mcNum: number; //linha nova
    
}


const SQUAD_PALETTE = [
    '#8e44ad', // Roxo
    '#2980b9', // Azul Forte
    '#27ae60', // Verde
    '#d35400', // Laranja Escuro
    '#16a085', // Turquesa
    '#c0392b', // Vermelho
    '#f39c12', // Amarelo/Laranja
    '#2c3e50', // Azul Escuro
    '#7f8c8d', // Cinza
    '#e84393', // Rosa
    '#00cec9', // Ciano
    '#6c5ce7', // Roxo Azulado
];



export default function Dashboard() {
    const { user } = useAuth();
    const { refreshKey } = useOutletContext<OutletContext>();
    const [sites, setSites] = useState<Site[]>([]);
    const [logs, setLogs] = useState<ProcessingLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [selectedLog, setSelectedLog] = useState<ProcessingLog | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);


    const [sortColumn, setSortColumn] = useState<'created_at' | 'site_name' | 'status' | 'squad' | 'inv' | 'rec' | 'roas' | 'mc'>('created_at');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');


    const [confirmModalOpen, setConfirmModalOpen] = useState(false);
    const [infoModal, setInfoModal] = useState<{ open: boolean; title: string; message: string; type: 'success' | 'error' | 'info' }>({
        open: false,
        title: '',
        message: '',
        type: 'info'
    });


    const squadColorMap = useMemo(() => {
        const uniqueSquads = Array.from(new Set(sites.map(s => s.squad_name || 'Sem Squad'))).sort();
        const map: Record<string, string> = {};

        uniqueSquads.forEach((squad, index) => {
            map[squad] = SQUAD_PALETTE[index % SQUAD_PALETTE.length];
        });

        return map;
    }, [sites]);

    const getSquadColor = (squadName: string) => squadColorMap[squadName] || '#95a5a6';

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


    const top3Faturamento = useMemo(() => {
        const siteDataMap = new Map<string, ParsedSiteData>();

        logs.forEach(log => {

            if (log.site_name.startsWith('[SQUAD]')) return;


            const match = log.message.match(/Inv:\s*([^|]+)\|\s*Rec:\s*([^|]+)\|\s*ROAS:\s*([^|]+)\|\s*MC:\s*(.+)/);
            if (match) {
                const siteName = log.site_name;
                const inv = match[1].trim();
                const rec = match[2].trim();
                const roas = match[3].trim();
                const mc = match[4].trim();
                
                //const recNum = parseFloat(rec.replace(/[R$\s.]/g, '').replace(',', '.')) || 0;
                const mcNum = parseFloat(mc.replace(/[R$\s.]/g, '').replace(',', '.')) || 0; //COM MC 
                


                const site = sites.find(s => s.name === siteName);
                const squadName = site?.squad_name || 'Sem Squad';


                if (!siteDataMap.has(siteName)) {
                    siteDataMap.set(siteName, {
                        siteName,
                        squadName,
                        investimento: inv,
                        receita: rec,
                        roas,
                        mc,
                        //receitaNum: recNum
                        mcNum: mcNum // COM MC 
                    });
                }
            }
        });


        return Array.from(siteDataMap.values())
            //.sort((a, b) => b.receitaNum - a.receitaNum) 
            .sort((a, b) => b.mcNum - a.mcNum) //COM MC
            .slice(0, 3);
    }, [logs, sites]);


    const squadsResumo = useMemo(() => {
        interface SquadData {
            squadName: string;
            totalInv: number;
            totalRec: number;
            sitesCount: number;
        }
        const squadMap = new Map<string, SquadData>();

        logs.forEach(log => {

            if (log.site_name.startsWith('[SQUAD]')) return;

            const match = log.message.match(/Inv:\s*([^|]+)\|\s*Rec:\s*([^|]+)\|\s*ROAS:\s*([^|]+)\|\s*MC:\s*(.+)/);
            if (match) {
                const siteName = log.site_name;
                const site = sites.find(s => s.name === siteName);
                const squadName = site?.squad_name || 'Sem Squad';

                const invNum = parseFloat(match[1].replace(/[R$\s.]/g, '').replace(',', '.')) || 0;
                const recNum = parseFloat(match[2].replace(/[R$\s.]/g, '').replace(',', '.')) || 0;


                const existingSquad = squadMap.get(squadName);
                if (!existingSquad) {
                    squadMap.set(squadName, {
                        squadName,
                        totalInv: invNum,
                        totalRec: recNum,
                        sitesCount: 1
                    });
                } else {

                    const siteKey = `${squadName}-${siteName}`;
                    if (!squadMap.has(siteKey)) {
                        squadMap.set(siteKey, { squadName: siteKey, totalInv: 0, totalRec: 0, sitesCount: 0 }); // Marker
                        existingSquad.totalInv += invNum;
                        existingSquad.totalRec += recNum;
                        existingSquad.sitesCount += 1;
                    }
                }
            }
        });


        const result = Array.from(squadMap.values())
            .filter(s => !s.squadName.includes('-'))
            .map(s => ({
                ...s,
                roas: s.totalInv > 0 ? (s.totalRec / s.totalInv).toFixed(2) : '0.00',
                mc: (s.totalRec - s.totalInv).toFixed(2)
            }))
            .sort((a, b) => b.totalRec - a.totalRec);

        return result;
    }, [logs, sites]);




    const totalSquads = useMemo(() => {
        const totalInv = squadsResumo.reduce((acc, curr) => acc + curr.totalInv, 0);
        const totalRec = squadsResumo.reduce((acc, curr) => acc + curr.totalRec, 0);
        const totalSites = squadsResumo.reduce((acc, curr) => acc + curr.sitesCount, 0);
        const roas = totalInv > 0 ? (totalRec / totalInv).toFixed(2) : '0.00';
        const mc = totalRec - totalInv;

        return {
            totalInv,
            totalRec,
            totalSites,
            roas,
            mc: mc.toFixed(2)
        };
    }, [squadsResumo]);


    const parseLogValues = (log: ProcessingLog) => {
        const match = log.message.match(/Inv:\s*([^|]+)\|\s*Rec:\s*([^|]+)\|\s*ROAS:\s*([^|]+)\|\s*MC:\s*(.+)/);
        const parseNum = (val: string) => parseFloat(val.replace(/[R$\s.]/g, '').replace(',', '.')) || 0;
        return {
            inv: match ? parseNum(match[1]) : 0,
            rec: match ? parseNum(match[2]) : 0,
            roas: match ? parseNum(match[3]) : 0,
            mc: match ? parseNum(match[4]) : 0
        };
    };


    const sortedLogs = useMemo(() => {
        return [...logs].sort((a, b) => {
            let valA: number | string, valB: number | string;

            if (sortColumn === 'created_at') {
                valA = new Date(a.created_at).getTime();
                valB = new Date(b.created_at).getTime();
            } else if (sortColumn === 'site_name') {
                valA = a.site_name.toLowerCase();
                valB = b.site_name.toLowerCase();
            } else if (sortColumn === 'status') {
                valA = a.status;
                valB = b.status;
            } else if (sortColumn === 'squad') {
                const siteA = sites.find(s => s.name === a.site_name);
                const siteB = sites.find(s => s.name === b.site_name);
                valA = (siteA?.squad_name || '').toLowerCase();
                valB = (siteB?.squad_name || '').toLowerCase();
            } else {
                const valsA = parseLogValues(a);
                const valsB = parseLogValues(b);
                valA = valsA[sortColumn as 'inv' | 'rec' | 'roas' | 'mc'];
                valB = valsB[sortColumn as 'inv' | 'rec' | 'roas' | 'mc'];
            }

            if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }, [logs, sites, sortColumn, sortDirection]);

    const handleSort = (column: typeof sortColumn) => {
        if (sortColumn === column) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
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
                        {!isProcessing && <Play size={16} />}
                    </button>
                )}
            </div>

            {/* Stats Cards */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon btc">
                        <Building2 size={24} />
                    </div>
                    <div className="stat-info">
                        <h3>Sites Ativos</h3>
                        <p className="stat-value">{activeSites} <span style={{ fontSize: '0.6em', color: '#888' }}>/ {totalSites}</span></p>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon eth">
                        <Clock size={24} />
                    </div>
                    <div className="stat-info">
                        <h3>Atividades Recentes</h3>
                        <p className="stat-value">{logs.length}</p>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon ltc">
                        <Users size={24} />
                    </div>
                    <div className="stat-info">
                        <h3>Squads</h3>
                        <p className="stat-value">{new Set(sites.map(s => s.squad_name || 'Sem Squad')).size}</p>
                    </div>
                </div>
            </div>

            {/* Top 3 Faturamento e Resumo Squads */}
            {(top3Faturamento.length > 0 || squadsResumo.length > 0) && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px', marginTop: '20px' }}>
                    {/* Resumo das Squads */}
                    {squadsResumo.length > 0 && (
                        <div className="card">
                            <div className="card-header">
                                <h2><BarChart3 size={20} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '8px' }} />Resumo das Squads</h2>
                            </div>
                            <div className="card-body">
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {squadsResumo.map((squad) => (
                                        <div key={squad.squadName} style={{
                                            background: 'var(--bg-secondary)',
                                            borderRadius: '12px',
                                            padding: '14px 16px',
                                            border: '1px solid var(--border-color)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '16px'
                                        }}>
                                            <span style={{
                                                background: getSquadColor(squad.squadName),
                                                color: '#fff',
                                                padding: '6px 12px',
                                                borderRadius: '8px',
                                                fontSize: '0.85em',
                                                fontWeight: 600,
                                                minWidth: '100px',
                                                textAlign: 'center'
                                            }}>
                                                {squad.squadName}
                                            </span>
                                            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', fontSize: '0.85em' }}>
                                                <div>
                                                    <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8em' }}>
                                                        <Wallet size={12} /> Investimento
                                                    </span>
                                                    <strong>R$ {squad.totalInv.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                                                </div>
                                                <div>
                                                    <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8em' }}>
                                                        <DollarSign size={12} /> Receita
                                                    </span>
                                                    <strong style={{ color: '#27ae60' }}>R$ {squad.totalRec.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                                                </div>
                                                <div>
                                                    <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8em' }}>
                                                        <TrendingUp size={12} /> ROAS
                                                    </span>
                                                    <strong>{squad.roas}</strong>
                                                </div>
                                                <div>
                                                    <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8em' }}>
                                                        <PieChart size={12} /> MC
                                                    </span>
                                                    <strong style={{ color: parseFloat(squad.mc) >= 0 ? '#27ae60' : '#e74c3c' }}>
                                                        R$ {parseFloat(squad.mc).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </strong>
                                                </div>
                                            </div>
                                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8em' }}>
                                                {squad.sitesCount} site{squad.sitesCount !== 1 ? 's' : ''}
                                            </span>
                                        </div>
                                    ))}

                                    {/* Linha de Total Geral */}
                                    <div style={{
                                        marginTop: '16px',
                                        background: 'linear-gradient(90deg, rgba(39, 174, 96, 0.1) 0%, rgba(39, 174, 96, 0.05) 100%)',
                                        borderRadius: '12px',
                                        padding: '14px 16px',
                                        border: '1px solid rgba(39, 174, 96, 0.3)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '16px'
                                    }}>
                                        <span style={{
                                            background: '#27ae60',
                                            color: '#fff',
                                            padding: '6px 12px',
                                            borderRadius: '8px',
                                            fontSize: '0.85em',
                                            fontWeight: 700,
                                            minWidth: '100px',
                                            textAlign: 'center',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '6px'
                                        }}>
                                            <Trophy size={14} /> TOTAL
                                        </span>
                                        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', fontSize: '0.9em' }}>
                                            <div>
                                                <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8em' }}>
                                                    <Wallet size={12} /> Investimento
                                                </span>
                                                <strong>R$ {totalSquads.totalInv.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                                            </div>
                                            <div>
                                                <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8em' }}>
                                                    <DollarSign size={12} /> Receita
                                                </span>
                                                <strong style={{ color: '#27ae60' }}>R$ {totalSquads.totalRec.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                                            </div>
                                            <div>
                                                <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8em' }}>
                                                    <TrendingUp size={12} /> ROAS
                                                </span>
                                                <strong>{totalSquads.roas}</strong>
                                            </div>
                                            <div>
                                                <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8em' }}>
                                                    <PieChart size={12} /> MC
                                                </span>
                                                <strong style={{ color: parseFloat(totalSquads.mc) >= 0 ? '#27ae60' : '#e74c3c' }}>
                                                    R$ {parseFloat(totalSquads.mc).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </strong>
                                            </div>
                                        </div>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8em', fontWeight: 600 }}>
                                            {totalSquads.totalSites} sites
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Top 3 Faturamento */}
                    {top3Faturamento.length > 0 && (
                        <div className="card">
                            <div className="card-header">
                                <h2><Trophy size={20} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '8px', color: '#f39c12' }} />Top 3 Faturamento</h2>
                            </div>
                            <div className="card-body">
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {top3Faturamento.map((data, index) => (
                                        <div key={data.siteName} style={{
                                            background: 'var(--bg-secondary)',
                                            borderRadius: '12px',
                                            padding: '14px 16px',
                                            border: '1px solid var(--border-color)',
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ fontSize: '1.3em' }}>{index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}</span>
                                                    <span style={{ fontWeight: 600 }}>{data.siteName}</span>
                                                </div>
                                                <span style={{
                                                    background: getSquadColor(data.squadName),
                                                    color: '#fff',
                                                    padding: '4px 10px',
                                                    borderRadius: '12px',
                                                    fontSize: '0.75em',
                                                    fontWeight: 500
                                                }}>
                                                    {data.squadName}
                                                </span>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', fontSize: '0.85em' }}>
                                                <div>
                                                    <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <Wallet size={12} /> Inv
                                                    </span>
                                                    {data.investimento}
                                                </div>
                                                <div>
                                                    <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <DollarSign size={12} /> Rec
                                                    </span>
                                                    <strong style={{ color: '#27ae60' }}>{data.receita}</strong>
                                                </div>
                                                <div>
                                                    <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <TrendingUp size={12} /> ROAS
                                                    </span>
                                                    {data.roas}
                                                </div>
                                                <div>
                                                    <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <PieChart size={12} /> MC
                                                    </span>
                                                    {data.mc}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Recent Activity Logs Table */}
            <div className="card" style={{ marginTop: '20px' }}>
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
                                        <th onClick={() => handleSort('created_at')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                            Data {sortColumn === 'created_at' && (sortDirection === 'asc' ? '↑' : '↓')}
                                        </th>
                                        <th onClick={() => handleSort('squad')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                            Squad {sortColumn === 'squad' && (sortDirection === 'asc' ? '↑' : '↓')}
                                        </th>
                                        <th onClick={() => handleSort('site_name')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                            Site {sortColumn === 'site_name' && (sortDirection === 'asc' ? '↑' : '↓')}
                                        </th>
                                        <th onClick={() => handleSort('inv')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                            Investimento {sortColumn === 'inv' && (sortDirection === 'asc' ? '↑' : '↓')}
                                        </th>
                                        <th onClick={() => handleSort('rec')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                            Receita {sortColumn === 'rec' && (sortDirection === 'asc' ? '↑' : '↓')}
                                        </th>
                                        <th onClick={() => handleSort('roas')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                            ROAS {sortColumn === 'roas' && (sortDirection === 'asc' ? '↑' : '↓')}
                                        </th>
                                        <th onClick={() => handleSort('mc')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                            MC {sortColumn === 'mc' && (sortDirection === 'asc' ? '↑' : '↓')}
                                        </th>
                                        <th onClick={() => handleSort('status')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                                            Status {sortColumn === 'status' && (sortDirection === 'asc' ? '↑' : '↓')}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedLogs.map((log) => {
                                        const site = sites.find(s => s.name === log.site_name);
                                        const squadName = site?.squad_name || (log.site_name.startsWith('[SQUAD]') ? log.site_name.replace('[SQUAD] ', '') : '');


                                        const match = log.message.match(/Inv:\s*([^|]+)\|\s*Rec:\s*([^|]+)\|\s*ROAS:\s*([^|]+)\|\s*MC:\s*(.+)/);
                                        const inv = match ? match[1].trim() : '-';
                                        const rec = match ? match[2].trim() : '-';
                                        const roas = match ? match[3].trim() : '-';
                                        const mc = match ? match[4].trim() : '-';


                                        const isSquadSummary = log.site_name.startsWith('[SQUAD]');
                                        const summaryMatch = log.message.match(/ROAS\s*([^,]+),\s*MC\s*(.+)/);

                                        return (
                                            <tr
                                                key={log.id}
                                                onClick={() => setSelectedLog(log)}
                                                style={{
                                                    cursor: 'pointer',
                                                    transition: 'background-color 0.2s',
                                                    background: isSquadSummary ? 'var(--bg-tertiary)' : undefined,
                                                    fontWeight: isSquadSummary ? 600 : undefined
                                                }}
                                                className="log-row"
                                            >
                                                <td style={{ whiteSpace: 'nowrap' }}>{new Date(log.created_at).toLocaleString('pt-BR')}</td>
                                                <td>
                                                    {squadName && (
                                                        <span style={{
                                                            background: getSquadColor(squadName),
                                                            color: '#fff',
                                                            padding: '3px 8px',
                                                            borderRadius: '10px',
                                                            fontSize: '0.75em',
                                                            fontWeight: 500,
                                                            whiteSpace: 'nowrap'
                                                        }}>
                                                            {squadName}
                                                        </span>
                                                    )}
                                                </td>
                                                <td>{isSquadSummary ? '📊 Resumo' : log.site_name}</td>
                                                <td>{isSquadSummary ? '-' : inv}</td>
                                                <td style={{ color: '#27ae60', fontWeight: 500 }}>{isSquadSummary ? '-' : rec}</td>
                                                <td>{isSquadSummary && summaryMatch ? summaryMatch[1].trim() : roas}</td>
                                                <td>{isSquadSummary && summaryMatch ? summaryMatch[2].trim() : mc}</td>
                                                <td>
                                                    <span className={`badge badge-${log.status === 'success' ? 'success' : log.status === 'error' ? 'danger' : 'info'}`}>
                                                        {log.status === 'success' ? 'Sucesso' : log.status === 'error' ? 'Erro' : 'Info'}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
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
