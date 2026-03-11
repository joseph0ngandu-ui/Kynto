import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Activity, Server, Database, Box, Cpu, HardDrive,
    RefreshCw, TrendingUp, Shield, Clock, Terminal, Info, X,
    Play, Square, RotateCcw, LayoutDashboard, MessageSquare,
    Settings, LogOut, ChevronRight
} from 'lucide-react';
import Login from './components/Login';
import KyntoMark from './components/KyntoMark';
import KyntoChat from './components/KyntoChat';
import ChatPage from './components/ChatPage';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://homeserver.taildbc5d3.ts.net';

const StatCard = ({ icon: Icon, title, value, label, progress, color, delay = 0 }) => (
    <motion.div
        className="stat-card"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay, duration: 0.4 }}
    >
        <div className="stat-noise" />
        <div className="stat-top">
            <div className="stat-icon" style={{ background: color + '15' }}>
                <Icon size={14} color={color} />
            </div>
            <div className="stat-title">{title}</div>
        </div>
        <div className="stat-body">
            <div className="stat-left">
                <div className="stat-value">{value}</div>
                <div className="stat-label">{label}</div>
            </div>
            <div className="stat-gauge" style={{ width: 48, height: 48, position: 'relative' }}>
                <svg width="48" height="48" viewBox="0 0 48 48">
                    <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="4" />
                    <motion.circle
                        cx="24" cy="24" r="20" fill="none"
                        stroke={color} strokeWidth="4"
                        strokeDasharray="125.6"
                        initial={{ strokeDashoffset: 125.6 }}
                        animate={{ strokeDashoffset: 125.6 - (125.6 * Math.min(progress, 100)) / 100 }}
                        transition={{ delay: delay + 0.5, duration: 1.8, ease: [0.34, 1.56, 0.64, 1] }}
                        strokeLinecap="round"
                        transform="rotate(-90 24 24)"
                    />
                </svg>
            </div>
        </div>
    </motion.div>
);

const ContainerCard = ({ container, idx, onLogs, onAction }) => (
    <motion.div
        className="ccard-outer"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: idx * 0.05 }}
    >
        <div className="ccard">
            <div className="ccard-noise" />
            <div className="ccard-head">
                <div className="ccard-status">
                    <div className={`cdot ${container.state === 'running' ? 'cdot--on' : 'cdot--off'}`}>
                        <div className="cdot-core" />
                        {container.state === 'running' && (
                            <>
                                <div className="cdot-ring r1" />
                                <div className="cdot-ring r2" />
                            </>
                        )}
                    </div>
                    <span className="ccard-name">{container.name}</span>
                </div>
                <div className="ccard-uptime">{container.uptime}</div>
            </div>

            <div className="ccard-bars">
                <div className="cbar">
                    <span className="cbar-label">CPU</span>
                    <div className="cbar-track">
                        <motion.div
                            className="cbar-fill"
                            style={{ background: '#e63946', width: `${container.cpuPercent}%` }}
                            initial={{ width: 0 }}
                            animate={{ width: `${container.cpuPercent}%` }}
                        />
                    </div>
                    <span className="cbar-val">{container.cpuPercent}%</span>
                </div>
                <div className="cbar">
                    <span className="cbar-label">MEM</span>
                    <div className="cbar-track">
                        <motion.div
                            className="cbar-fill"
                            style={{ background: '#22c55e', width: `${container.memPercent}%` }}
                            initial={{ width: 0 }}
                            animate={{ width: `${container.memPercent}%` }}
                        />
                    </div>
                    <span className="cbar-val">{container.memUsage}MB</span>
                </div>
            </div>

            <div className="ccard-foot">
                <div className="ccard-acts">
                    <button className="ccard-btn ccard-btn--ghost" onClick={() => onLogs(container)} title="Logs">
                        <Terminal size={12} />
                    </button>
                    {container.state === 'running' ? (
                        <>
                            <button className="ccard-btn ccard-btn--red" onClick={() => onAction(container.id, 'stop')} title="Stop">
                                <Square size={12} fill="currentColor" />
                            </button>
                            <button className="ccard-btn ccard-btn--ghost" onClick={() => onAction(container.id, 'restart')} title="Restart">
                                <RotateCcw size={12} />
                            </button>
                        </>
                    ) : (
                        <button className="ccard-btn ccard-btn--green" onClick={() => onAction(container.id, 'start')} title="Start">
                            <Play size={12} fill="currentColor" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    </motion.div>
);

const LogOverlay = ({ container, onClose }) => {
    const [logs, setLogs] = useState('FETCHING_LOGS...');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLogs = async () => {
            const token = localStorage.getItem('dashboard_token');
            try {
                const res = await fetch(`${API_BASE_URL}/api/containers/${container.id}/logs`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                setLogs(data.logs || 'No log output found.');
            } catch (err) {
                setLogs('ERROR_FETCHING_LOGS');
            } finally {
                setLoading(false);
            }
        };
        fetchLogs();
    }, [container.id]);

    return (
        <motion.div className="log-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="log-window" initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}>
                <div className="log-header">
                    <div className="log-title"><Terminal size={16} /><span>{container.name} // Console</span></div>
                    <button className="close-btn" onClick={onClose}><X size={20} /></button>
                </div>
                <div className="log-content">
                    {loading ? <div className="log-spinner">SYNCING...</div> : <pre>{logs}</pre>}
                </div>
            </motion.div>
        </motion.div>
    );
};

const LoaderOverlay = () => (
    <div className="loader-overlay">
        <KyntoMark size={120} animated={true} />
        <div className="loader-text">
            <motion.h2
                initial={{ opacity: 0, letterSpacing: "1.2em" }}
                animate={{ opacity: 1, letterSpacing: "0.6em" }}
                transition={{ duration: 2, ease: [0.23, 1, 0.32, 1] }}
            >
                KYNTO
            </motion.h2>
        </div>
    </div>
);

const NAV_ITEMS = [
    { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
    { id: 'chat',      label: 'Kynto Chat', Icon: MessageSquare },
    { id: 'logs',      label: 'Audit Logs', Icon: Activity },
];

const SIDEBAR_W  = 220;
const COLLAPSED_W = 64;

const spring = { type: 'spring', stiffness: 320, damping: 28, mass: 0.6 };

const Sidebar = ({ currentView, onViewChange, onLogout, collapsed, setCollapsed }) => (
    <motion.div
        className="side-nav"
        animate={{ width: collapsed ? COLLAPSED_W : SIDEBAR_W }}
        transition={spring}
        style={{ overflow: 'visible', zIndex: 100 }}
    >
        {/* Absolute floating toggle tab */}
        <motion.button
            className="collapse-btn"
            onClick={() => setCollapsed(!collapsed)}
            animate={{ rotate: collapsed ? 0 : 180 }}
            transition={spring}
            title={collapsed ? 'Expand' : 'Collapse'}
        >
            <ChevronRight size={13} />
        </motion.button>

        {/* Brand row */}
        <div className="side-nav-head">
            <motion.div
                className="brand-content"
                animate={{ justifyContent: collapsed ? 'center' : 'flex-start' }}
                transition={spring}
            >
                <motion.div
                    animate={{ scale: collapsed ? 0.85 : 1 }}
                    transition={spring}
                    style={{ flexShrink: 0 }}
                >
                    <KyntoMark size={32} animated={true} />
                </motion.div>
                <AnimatePresence mode="wait">
                    {!collapsed && (
                        <motion.span
                            key="brand-label"
                            className="brand-text"
                            initial={{ opacity: 0, x: -8, width: 0 }}
                            animate={{ opacity: 1, x: 0, width: 'auto' }}
                            exit={{ opacity: 0, x: -8, width: 0 }}
                            transition={{ duration: 0.18, ease: 'easeOut' }}
                            style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}
                        >
                            KYNTO
                        </motion.span>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>

        {/* Main nav */}
        <nav className="nav-links">
            {NAV_ITEMS.map(({ id, label, Icon }) => (
                <motion.button
                    key={id}
                    className={`nav-link ${currentView === id ? 'active' : ''}`}
                    onClick={() => onViewChange(id)}
                    title={label}
                    animate={{ paddingLeft: collapsed ? 0 : 12, paddingRight: collapsed ? 0 : 12, justifyContent: collapsed ? 'center' : 'flex-start' }}
                    transition={spring}
                >
                    <motion.span
                        animate={{ scale: collapsed ? 1.1 : 1 }}
                        transition={spring}
                        style={{ flexShrink: 0, display: 'flex' }}
                    >
                        <Icon size={20} />
                    </motion.span>
                    <AnimatePresence mode="wait">
                        {!collapsed && (
                            <motion.span
                                key={`label-${id}`}
                                initial={{ opacity: 0, x: -6 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -6 }}
                                transition={{ duration: 0.15, ease: 'easeOut' }}
                                style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}
                            >
                                {label}
                            </motion.span>
                        )}
                    </AnimatePresence>
                </motion.button>
            ))}
        </nav>

        <div className="nav-spacer" />

        {/* Footer nav */}
        <div className="nav-footer">
            {[{ id: 'settings', label: 'Settings', Icon: Settings }].map(({ id, label, Icon }) => (
                <motion.button
                    key={id}
                    className={`nav-link ${currentView === id ? 'active' : ''}`}
                    onClick={() => onViewChange(id)}
                    title={label}
                    animate={{ paddingLeft: collapsed ? 0 : 12, paddingRight: collapsed ? 0 : 12, justifyContent: collapsed ? 'center' : 'flex-start' }}
                    transition={spring}
                >
                    <motion.span animate={{ scale: collapsed ? 1.1 : 1 }} transition={spring} style={{ display: 'flex' }}>
                        <Icon size={20} />
                    </motion.span>
                    <AnimatePresence mode="wait">
                        {!collapsed && (
                            <motion.span
                                key={`label-${id}`}
                                initial={{ opacity: 0, x: -6 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -6 }}
                                transition={{ duration: 0.15 }}
                                style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}
                            >
                                {label}
                            </motion.span>
                        )}
                    </AnimatePresence>
                </motion.button>
            ))}
            <motion.button
                className="nav-link logout"
                onClick={onLogout}
                title="Sign Out"
                animate={{ paddingLeft: collapsed ? 0 : 12, paddingRight: collapsed ? 0 : 12, justifyContent: collapsed ? 'center' : 'flex-start' }}
                transition={spring}
            >
                <motion.span animate={{ scale: collapsed ? 1.1 : 1 }} transition={spring} style={{ display: 'flex' }}>
                    <LogOut size={20} />
                </motion.span>
                <AnimatePresence mode="wait">
                    {!collapsed && (
                        <motion.span
                            key="logout-label"
                            initial={{ opacity: 0, x: -6 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -6 }}
                            transition={{ duration: 0.15 }}
                            style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}
                        >
                            Sign Out
                        </motion.span>
                    )}
                </AnimatePresence>
            </motion.button>
        </div>
    </motion.div>
);

const LogsView = ({ token, onLogout }) => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLogs = async () => {
            if (!token) return;
            try {
                const res = await fetch(`${API_BASE_URL}/api/audit-logs`, {
                    headers: { 'Authorization': `Bearer ${token}` },
                    signal: AbortSignal.timeout(12000)
                });
                if (res.status === 401) {
                    onLogout();
                    return;
                }
                const json = await res.json();
                setLogs(json);
                setLoading(false);
            } catch (err) {
                console.error('Logs fetch error:', err);
                setLoading(false);
            }
        };
        fetchLogs();
        const interval = setInterval(fetchLogs, 5000);
        return () => clearInterval(interval);
    }, [token, onLogout]);

    return (
        <div className="logs-view-page">
            <header className="page-header">
                <h2>Audit Logs</h2>
                <p>Real-time system telemetry and verification traces.</p>
            </header>
            <VoiceActivityFeed logs={logs} fullPage />
        </div>
    );
};

const VoiceActivityFeed = ({ logs, fullPage }) => (
    <div className={`voice-feed ${fullPage ? 'full-page' : ''}`}>
        <div className="feed-header">
            <Activity size={14} color="#00ff80" />
            <span>AUDIT_LOGS // REALTIME_FLOW</span>
        </div>
        <div className="feed-content">
            {logs && logs.length > 0 ? logs.map(log => (
                <div key={log.id} className={`log-entry ${log.type === 'success' ? 'success' : log.type === 'error' ? 'error' : log.type === 'muted' ? 'muted' : ''}`}>
                    <span className="timestamp">[{log.timestamp}]</span>
                    <span className="source">{log.source}:</span>
                    <span className="message">{log.message}</span>
                </div>
            )) : (
                <div className="log-entry muted">
                    <span className="message">Waiting for system telemetry...</span>
                </div>
            )}
        </div>
    </div>
);

const AppContent = ({ token, onLogout }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedContainer, setSelectedContainer] = useState(null);

    const fetchData = async () => {
        if (!token) return;

        try {
            const statsRes = await fetch(`${API_BASE_URL}/api/stats`, {
                headers: { 'Authorization': `Bearer ${token}` },
                signal: AbortSignal.timeout(12000)
            });

            if (statsRes.status === 401) {
                onLogout();
                return;
            }

            const statsJson = await statsRes.json();

            setData(statsJson);
            setError(null);
            setLoading(false);
        } catch (err) {
            console.error('Fetch error:', err);
            // Only set error if we don't already have data to prevent UI flickering on intermittent lag
            if (!data) {
                setError(`CONNECTION_FAILURE: Unable to reach kernel at ${API_BASE_URL}`);
            }
            setLoading(false);
        }
    };

    const handleAction = async (id, action) => {
        try {
            await fetch(`${API_BASE_URL}/api/containers/${id}/action`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ action })
            });
            fetchData();
        } catch (err) {
            console.error('Action failed', err);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, [token]);

    if (loading && !data && !error) return <LoaderOverlay />;

    if (error && !data) {
        return (
            <div className="loader-overlay" style={{ background: '#000', padding: '40px', textAlign: 'center' }}>
                <Shield size={48} color="#ff3333" style={{ marginBottom: '24px', opacity: 0.5 }} />
                <h2 style={{ color: '#fff', fontSize: '18px', letterSpacing: '0.1em', marginBottom: '12px' }}>KERNEL_OFFLINE</h2>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', maxWidth: '300px', lineHeight: 1.6 }}>
                    The dashboard cannot establish a secure link to the intelligence nexus.
                </p>
                <div style={{ marginTop: '24px', padding: '12px', background: 'rgba(255,51,51,0.05)', borderRadius: '8px', border: '1px solid rgba(255,51,51,0.1)' }}>
                    <code style={{ color: '#ff3333', fontSize: '11px' }}>{error}</code>
                </div>
                <button
                    onClick={() => { setError(null); setLoading(true); fetchData(); }}
                    style={{ marginTop: '32px', background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px 24px', borderRadius: '100px', cursor: 'pointer', fontSize: '12px' }}
                >
                    RETRY_CONNECTION
                </button>
            </div>
        );
    }

    if (!data) return <LoaderOverlay />;

    return (
        <div className="dash-root">
            <div className="dash-mesh" />

            <div className="dash-content">
                <header className="dash-hdr">
                    <div className="dash-hdr-left">
                        <h1 className="dash-title">Infrastructure</h1>
                        <p className="dash-sub">Intelligence nexus health and resource telemetry.</p>
                    </div>
                    <div className="live-status">
                        <div className="live-badge">
                            <div className="live-dot" />
                            LIVE_FLOW
                        </div>
                    </div>
                </header>

                <main className="stat-grid">
                    <StatCard
                        icon={Cpu}
                        title="CPU"
                        value={`${data.system.cpu.load.toFixed(1)}%`}
                        label="Compute Load"
                        progress={data.system.cpu.load}
                        color="#e63946"
                        delay={0}
                    />
                    <StatCard
                        icon={Database}
                        title="Memory"
                        value={`${(data.system.memory.used / (1024 ** 3)).toFixed(1)}GB`}
                        label="Allocated Pool"
                        progress={(data.system.memory.used / data.system.memory.total) * 100}
                        color="#22c55e"
                        delay={0.1}
                    />
                    <StatCard
                        icon={Server}
                        title="Mesh"
                        value={data.system.docker.running}
                        label={`${data.system.docker.total} Containers`}
                        progress={(data.system.docker.running / data.system.docker.total) * 100}
                        color="#3b82f6"
                        delay={0.2}
                    />
                    <StatCard
                        icon={HardDrive}
                        title="Storage"
                        value={`${data.system.disk[0]?.use}%`}
                        label="Disk Array"
                        progress={data.system.disk[0]?.use}
                        color="#f59e0b"
                        delay={0.3}
                    />
                </main>

                <section className="dash-section">
                    <div className="dash-sec-hdr">
                        <div className="dash-sec-title">
                            <Box size={16} color="#e63946" />
                            <span>Active Applications</span>
                        </div>
                        <div className="running-pill">
                            <div className="running-dot" />
                            <span>{data.docker.filter(c => c.state === 'running').length} RUNNING</span>
                        </div>
                    </div>
                    <div className="ccard-grid">
                        <AnimatePresence mode="popLayout">
                            {(Array.isArray(data.docker) ? data.docker : []).map((c, i) => (
                                <ContainerCard
                                    key={c.id}
                                    container={c}
                                    idx={i}
                                    onLogs={(cont) => setSelectedContainer(cont)}
                                    onAction={handleAction}
                                />
                            ))}
                        </AnimatePresence>
                    </div>
                </section>

                <AnimatePresence>
                    {selectedContainer && (
                        <LogOverlay
                            container={selectedContainer}
                            onClose={() => setSelectedContainer(null)}
                        />
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

const SettingsView = ({ token }) => {
    const [availableModels, setAvailableModels] = useState(null);
    const [provider, setProvider] = useState(() => localStorage.getItem('kynto_ai_provider') || 'groq');
    const [model, setModel] = useState(() => localStorage.getItem('kynto_ai_model') || 'llama3-70b-8192');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchModels = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/api/settings/models`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                setAvailableModels(data.models || { none: [{ id: 'none', name: 'No API Keys' }] });
                
                // Keep UI in sync with available options
                const providers = Object.keys(data.models || {});
                const savedProvider = localStorage.getItem('kynto_ai_provider');
                
                if (providers.length > 0 && !providers.includes(savedProvider)) {
                    setProvider(providers[0]);
                    setModel(data.models[providers[0]][0].id);
                }
            } catch (err) {
                console.error('Failed to fetch models', err);
                setAvailableModels({ error: [{ id: 'error', name: 'Failed to load models' }] });
            }
        };
        fetchModels();
    }, [token]);

    const handleSaveModel = async (newProvider, newModel) => {
        setProvider(newProvider);
        setModel(newModel);
        localStorage.setItem('kynto_ai_provider', newProvider);
        localStorage.setItem('kynto_ai_model', newModel);
        setSaving(true);
        try {
            await fetch(`${API_BASE_URL}/api/settings/model`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ provider: newProvider, model: newModel })
            });
        } catch (err) {
            console.error('Failed to sync model to backend', err);
        }
        setTimeout(() => setSaving(false), 500);
    };

    return (
        <div className="settings-view">
            <header className="page-header">
                <h2>Preferences</h2>
                <p>Configure your intelligence nexus parameters</p>
            </header>

            <div className="settings-grid">
                <div className="settings-group">
                    <h3>Intelligence Settings</h3>
                    <div className="setting-item glass-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '16px' }}>
                        <div className="setting-info" style={{ width: '100%' }}>
                            <span className="setting-name">Primary AI Model</span>
                            <span className="setting-desc">Select the neural engine for the intelligence section. If API limits are hit, the system will attempt to fallback automatically.</span>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
                            {!availableModels ? (
                                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Loading AI network topography...</span>
                            ) : (
                                <>
                                    <select 
                                        className="styled-select" 
                                        value={provider} 
                                        onChange={(e) => {
                                            const p = e.target.value;
                                            handleSaveModel(p, availableModels[p][0].id);
                                        }}
                                        disabled={availableModels.none || availableModels.error}
                                    >
                                        {Object.keys(availableModels).map(p => {
                                            const labels = { groq: 'Groq', anthropic: 'Anthropic', openai: 'OpenAI', gemini: 'Gemini', none: 'None' };
                                            return <option key={p} value={p}>{labels[p] || p}</option>;
                                        })}
                                    </select>

                                    <select 
                                        className="styled-select" 
                                        value={model} 
                                        onChange={(e) => handleSaveModel(provider, e.target.value)}
                                        disabled={availableModels.none || availableModels.error}
                                    >
                                        {(availableModels[provider] || availableModels[Object.keys(availableModels)[0]] || []).map(m => (
                                            <option key={m.id} value={m.id}>{m.name}</option>
                                        ))}
                                    </select>
                                </>
                            )}
                        </div>
                        {saving && <span style={{ fontSize: '11px', color: 'var(--green)', fontFamily: 'monospace' }}>Syncing to backend...</span>}
                    </div>
                </div>

                <div className="settings-group">
                    <h3>General</h3>
                    <div className="setting-item glass-item">
                        <div className="setting-info">
                            <span className="setting-name">Hardware Acceleration</span>
                            <span className="setting-desc">Utilize GPU for rendering heavy animations</span>
                        </div>
                        <div className="custom-toggle active"><div className="knob" /></div>
                    </div>
                </div>

                <div className="settings-group">
                    <h3>Voice Inference</h3>
                    <div className="setting-item glass-item">
                        <div className="setting-info">
                            <span className="setting-name">Automatic Captions</span>
                            <span className="setting-desc">Generate subtitles for neural audio responses</span>
                        </div>
                        <div className="custom-toggle active"><div className="knob" /></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const App = () => {
    const [token, setToken] = useState(() => localStorage.getItem('dashboard_token') || sessionStorage.getItem('dashboard_token'));
    const [currentView, setCurrentView] = useState(() => localStorage.getItem('kynto_view') || 'dashboard');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('kynto_sidebar_collapsed') === 'true');
    const [mobileNavOpen, setMobileNavOpen] = useState(false);

    useEffect(() => {
        localStorage.setItem('kynto_view', currentView);
    }, [currentView]);

    useEffect(() => {
        localStorage.setItem('kynto_sidebar_collapsed', sidebarCollapsed);
    }, [sidebarCollapsed]);

    const handleLogout = () => {
        localStorage.removeItem('dashboard_token');
        sessionStorage.removeItem('dashboard_token');
        setToken(null);
    };

    if (!token) {
        return <Login onLogin={(t) => setToken(t)} />;
    }

    return (
        <div className="app-shell">
            <Sidebar
                currentView={currentView}
                onViewChange={(v) => { setCurrentView(v); setMobileNavOpen(false); }}
                onLogout={handleLogout}
                collapsed={sidebarCollapsed}
                setCollapsed={setSidebarCollapsed}
            />

            <div className={`content-area ${sidebarCollapsed ? 'collapsed' : ''}`}>
                <header className="main-header">
                    <div className="header-left">
                        <button className="mobile-menu-btn" onClick={() => setMobileNavOpen(!mobileNavOpen)}>
                            <div className={`hamburger ${mobileNavOpen ? 'open' : ''}`} />
                        </button>
                        <div className="header-id">
                            <KyntoMark size={20} animated={true} />
                            <div className="view-title">
                                {currentView === 'dashboard' ? 'INFRASTRUCTURE' : currentView === 'chat' ? 'INTELLIGENCE' : currentView === 'logs' ? 'AUDIT_LOGS' : 'SETTINGS'}
                            </div>
                        </div>
                    </div>
                </header>

                <div className="main-content">
                    {currentView === 'dashboard' && <AppContent token={token} onLogout={handleLogout} />}
                    {currentView === 'chat' && <ChatPage onNavigate={setCurrentView} onLogout={handleLogout} />}
                    {currentView === 'logs' && <LogsView token={token} onLogout={handleLogout} />}
                    {currentView === 'settings' && <SettingsView token={token} />}
                </div>
            </div>

            {/* Mobile Nav Overlay */}
            <AnimatePresence>
                {mobileNavOpen && (
                    <motion.div
                        className="mobile-nav-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div
                            className="mobile-nav-content"
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        >
                            <div className="mobile-nav-header">
                                <KyntoMark size={32} animated={true} />
                                <span className="brand-text">KYNTO</span>
                                <button className="close-mobile-nav" onClick={() => setMobileNavOpen(false)}><X size={20} /></button>
                            </div>
                            <nav className="mobile-links">
                                <button onClick={() => { setCurrentView('dashboard'); setMobileNavOpen(false); }}>Dashboard</button>
                                <button onClick={() => { setCurrentView('chat'); setMobileNavOpen(false); }}>Kynto Chat</button>
                                <button onClick={() => { setCurrentView('settings'); setMobileNavOpen(false); }}>Settings</button>
                                <button onClick={handleLogout} style={{ color: '#ff4444' }}>Sign Out</button>
                            </nav>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <KyntoChat onExpand={() => setCurrentView('chat')} />

        </div>
    );
};

export default App;
