import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Activity, Server, Database, Box, Cpu, HardDrive,
    RefreshCw, TrendingUp, Shield, Clock, Terminal, Info, X,
    Play, Square, RotateCcw, LayoutDashboard, MessageSquare,
    Settings, LogOut, ChevronRight
} from 'lucide-react';
import Login from './components/Login';
import NeuralLogo from './components/NeuralLogo';
import KyntoChat from './components/KyntoChat';
import ChatPage from './components/ChatPage';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://homeserver.taildbc5d3.ts.net';

const StatCard = ({ icon: Icon, title, value, label, progress, color, delay = 0 }) => (
    <motion.div
        className="glass-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay, duration: 0.5 }}
    >
        <div className="card-header">
            <div className="icon-box" style={{ background: color + '11', padding: '10px', borderRadius: '12px' }}>
                <Icon size={20} color={color} />
            </div>
            <div className="header-text-group">
                <h3>{title}</h3>
            </div>
        </div>
        <div className="card-value">{value}</div>
        <div className="card-label">{label}</div>
        <div className="progress-bar">
            <motion.div
                className="progress-fill"
                style={{ background: color }}
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
            />
        </div>
    </motion.div>
);

const ContainerCard = ({ container, idx, onLogs, onAction }) => (
    <motion.div
        className="container-card"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: idx * 0.05 }}
        style={{ cursor: 'default' }}
    >
        <div className="container-header">
            <div className="container-title">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h4 style={{ margin: 0, fontSize: '15px' }}>{container.name}</h4>
                    <div className={`status-pulse ${container.state === 'running' ? 'status-running' : 'status-stopped'}`} />
                </div>
            </div>
            <div className="uptime-group">
                <span>{container.uptime}</span>
            </div>
        </div>

        <div className="container-stats">
            <div className="mini-stat">
                <div className="mini-label">CPU {container.cpuPercent}%</div>
                <div className="mini-progress"><div style={{ width: `${container.cpuPercent}%`, background: 'var(--accent)', height: '100%' }}></div></div>
            </div>
            <div className="mini-stat">
                <div className="mini-label">Memory {container.memUsage}MB</div>
                <div className="mini-progress"><div style={{ width: `${container.memPercent}%`, background: 'var(--success)', height: '100%' }}></div></div>
            </div>
        </div>

        <div className="container-actions">
            <button className="action-btn" onClick={() => onLogs(container)} title="View Logs"><Terminal size={14} /></button>
            <div className="action-divider" />
            {container.state !== 'running' ? (
                <button className="action-btn success" onClick={() => onAction(container.id, 'start')} title="Start"><Play size={14} /></button>
            ) : (
                <>
                    <button className="action-btn danger" onClick={() => onAction(container.id, 'stop')} title="Stop"><Square size={14} /></button>
                    <button className="action-btn" onClick={() => onAction(container.id, 'restart')} title="Restart"><RotateCcw size={14} /></button>
                </>
            )}
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
        <NeuralLogo size={120} />
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

const Sidebar = ({ currentView, onViewChange, onLogout, collapsed, setCollapsed }) => (
    <div className={`side-nav ${collapsed ? 'collapsed' : ''}`}>
        <div className="nav-brand">
            <div className="brand-content" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <NeuralLogo size={32} />
                {!collapsed && <span className="brand-text">KYNTO</span>}
            </div>
            {!collapsed && (
                <button
                    className="collapse-btn"
                    onClick={() => setCollapsed(true)}
                    title="Collapse Sidebar"
                >
                    <ChevronRight size={16} style={{ transform: 'rotate(180deg)' }} />
                </button>
            )}
        </div>

        {collapsed && (
            <button
                className="expand-btn-standalone"
                onClick={() => setCollapsed(false)}
                title="Expand Sidebar"
            >
                <ChevronRight size={16} />
            </button>
        )}

        <nav className="nav-links">
            <button
                className={`nav-link ${currentView === 'dashboard' ? 'active' : ''}`}
                onClick={() => onViewChange('dashboard')}
                title="Dashboard"
            >
                <LayoutDashboard size={20} />
                {!collapsed && <span>Dashboard</span>}
            </button>
            <button
                className={`nav-link ${currentView === 'chat' ? 'active' : ''}`}
                onClick={() => onViewChange('chat')}
                title="Kynto Chat"
            >
                <MessageSquare size={20} />
                {!collapsed && <span>Kynto Chat</span>}
            </button>
            <button
                className={`nav-link ${currentView === 'logs' ? 'active' : ''}`}
                onClick={() => onViewChange('logs')}
                title="Audit Logs"
            >
                <Activity size={20} />
                {!collapsed && <span>Audit Logs</span>}
            </button>
        </nav>

        <div className="nav-spacer" />

        <div className="nav-footer">
            <button
                className={`nav-link ${currentView === 'settings' ? 'active' : ''}`}
                onClick={() => onViewChange('settings')}
                title="Settings"
            >
                <Settings size={20} />
                {!collapsed && <span>Settings</span>}
            </button>
            <button className="nav-link logout" onClick={onLogout} title="Sign Out">
                <LogOut size={20} />
                {!collapsed && <span>Sign Out</span>}
            </button>
        </div>
    </div>
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
                    signal: AbortSignal.timeout(5000)
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
                signal: AbortSignal.timeout(5000)
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
            setError(`CONNECTION_FAILURE: Unable to reach kernel at ${API_BASE_URL}`);
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
        <div className="dashboard-content">
            <header className="page-header">
                <h2>Infrastructure</h2>
                <p>System health, memory pools, and active intelligence containers.</p>
            </header>

            <main className="dashboard-grid">
                <StatCard
                    icon={Activity}
                    title="CPU"
                    value={`${data.system.cpu.load.toFixed(1)}%`}
                    label="System Load"
                    progress={data.system.cpu.load}
                    color="#ff3333"
                    delay={0}
                />
                <StatCard
                    icon={Database}
                    title="Memory"
                    value={`${(data.system.memory.used / (1024 ** 3)).toFixed(1)}GB`}
                    label="Memory Pool"
                    progress={(data.system.memory.used / data.system.memory.total) * 100}
                    color="#00ff80"
                    delay={0.1}
                />
                <StatCard
                    icon={Server}
                    title="Mesh"
                    value={data.system.docker.running}
                    label={`${data.system.docker.total} Active`}
                    progress={(data.system.docker.running / data.system.docker.total) * 100}
                    color="#0080ff"
                    delay={0.2}
                />
                <StatCard
                    icon={HardDrive}
                    title="Storage"
                    value={`${data.system.disk[0]?.use}%`}
                    label="Disk Array"
                    progress={data.system.disk[0]?.use}
                    color="#888"
                    delay={0.3}
                />
            </main>

            <div className="dashboard-row full-width">
                <section className="containers-section">
                    <div className="section-title-row">
                        <h2><Box size={18} /> Applications</h2>
                    </div>
                    <div className="container-grid">
                        <AnimatePresence mode="popLayout">
                            {data.docker.map((c, i) => (
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
            </div>

            <AnimatePresence>
                {selectedContainer && (
                    <LogOverlay
                        container={selectedContainer}
                        onClose={() => setSelectedContainer(null)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

const SettingsView = () => (
    <div className="settings-view">
        <header className="page-header">
            <h2>Preferences</h2>
            <p>Configure your intelligence nexus parameters</p>
        </header>

        <div className="settings-grid">
            <div className="settings-group">
                <h3>General</h3>
                <div className="setting-item glass-item">
                    <div className="setting-info">
                        <span className="setting-name">Dark Mode Persistence</span>
                        <span className="setting-desc">Preserve high-contrast themes strictly</span>
                    </div>
                    <div className="custom-toggle active"><div className="knob" /></div>
                </div>
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
                <div className="setting-item glass-item">
                    <div className="setting-info">
                        <span className="setting-name">Transcription Cache</span>
                        <span className="setting-desc">Store recent audio logs locally for faster access</span>
                    </div>
                    <div className="custom-toggle active"><div className="knob" /></div>
                </div>
            </div>
        </div>
    </div>
);

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

            <div className="content-area">
                <header className="main-header">
                    <div className="header-left">
                        <button className="mobile-menu-btn" onClick={() => setMobileNavOpen(!mobileNavOpen)}>
                            <div className={`hamburger ${mobileNavOpen ? 'open' : ''}`} />
                        </button>
                        <div className="view-title">
                            {currentView === 'dashboard' ? 'Infrastructure' : currentView === 'chat' ? 'Intelligence' : currentView === 'logs' ? 'Audit Logs' : 'Settings'}
                        </div>
                    </div>
                    <div className="live-status">
                        <div className="live-badge">
                            <div className="pulse-dot" />
                            LIVE
                        </div>
                    </div>
                </header>

                <div className="main-content">
                    {currentView === 'dashboard' && <AppContent token={token} onLogout={handleLogout} />}
                    {currentView === 'chat' && <ChatPage onBack={() => setCurrentView('dashboard')} />}
                    {currentView === 'logs' && <LogsView token={token} onLogout={handleLogout} />}
                    {currentView === 'settings' && <SettingsView />}
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
                                <NeuralLogo size={32} />
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

            <style jsx>{`
                .app-shell {
                    display: flex;
                    height: 100vh;
                    width: 100vw;
                    background: #000;
                    overflow: hidden;
                    color: #fff;
                }

                .side-nav.collapsed {
                    width: 72px;
                }

                .nav-brand {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 0 12px 32px;
                    height: 64px;
                    justify-content: space-between;
                }

                .side-nav.collapsed .nav-brand {
                    justify-content: center;
                    padding: 0 0 32px 0;
                }
                
                .side-nav.collapsed .brand-content {
                    margin-left: -5px; /* Offset to center visually */
                }

                .brand-text {
                    font-size: 16px;
                    font-weight: 800;
                    letter-spacing: 0.1em;
                    white-space: nowrap;
                }

                .nav-links {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .nav-link {
                    background: none;
                    border: none;
                    color: rgba(255,255,255,0.4);
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    padding: 12px;
                    border-radius: 12px;
                    cursor: pointer;
                    font-size: 14px;
                    transition: all 0.2s;
                    text-align: left;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .nav-link:hover {
                    color: #fff;
                    background: rgba(255,255,255,0.03);
                }

                .nav-link.active {
                    color: #fff;
                    background: #111;
                    border: 1px solid rgba(255,255,255,0.05);
                }

                .nav-spacer { flex: 1; }

                .nav-footer {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    position: relative;
                }

                .collapse-btn {
                    width: 28px;
                    height: 28px;
                    background: #111;
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    color: rgba(255,255,255,0.6);
                    transition: all 0.2s;
                    margin-left: auto;
                }

                .collapse-btn:hover {
                    color: #fff;
                    background: #222;
                    border-color: rgba(255,255,255,0.2);
                }
                
                .expand-btn-standalone {
                    width: 48px;
                    height: 48px;
                    background: #111;
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    color: rgba(255,255,255,0.6);
                    transition: all 0.2s;
                    margin: 0 auto 32px auto;
                }

                .expand-btn-standalone:hover {
                    color: #fff;
                    background: #222;
                    border-color: rgba(255,255,255,0.2);
                }

                .side-nav.collapsed .collapse-btn {
                    transform: rotate(180deg);
                    margin: 0 auto;
                }

                .content-area {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    min-width: 0;
                    height: 100vh;
                }

                .main-header {
                    height: 64px;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 0 24px;
                    background: rgba(0,0,0,0.8);
                    backdrop-filter: blur(20px);
                    flex-shrink: 0;
                }

                .header-left { display: flex; align-items: center; gap: 16px; }

                .view-title {
                    font-size: 13px;
                    font-weight: 700;
                    letter-spacing: 0.05em;
                    color: rgba(255,255,255,0.4);
                    text-transform: uppercase;
                }

                .main-content {
                    flex: 1;
                    overflow-y: auto;
                    background: radial-gradient(circle at 50% 50%, #080808 0%, #000 100%);
                }

                .dashboard-content {
                    padding: 32px;
                    max-width: 1400px;
                    margin: 0 auto;
                    width: 100%;
                }

                .dashboard-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
                    gap: 16px;
                    margin-bottom: 32px;
                }

                .dashboard-row {
                    display: grid;
                    grid-template-columns: 1fr 320px;
                    gap: 24px;
                }
                
                .dashboard-row.full-width {
                    grid-template-columns: 1fr;
                }

                .dashboard-sidebar {
                    display: flex;
                    flex-direction: column;
                    gap: 24px;
                }
                    display: flex;
                    flex-direction: column;
                    gap: 24px;
                }

                .voice-feed {
                    background: #050505;
                    border: 1px solid rgba(255,255,255,0.03);
                    border-radius: 16px;
                    padding: 20px;
                    height: 400px;
                    display: flex;
                    flex-direction: column;
                }
                
                .voice-feed.full-page {
                    height: calc(100vh - 200px);
                }
                
                .logs-view-page {
                    padding: 32px;
                    max-width: 1400px;
                    margin: 0 auto;
                    width: 100%;
                }

                .feed-header {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-size: 11px;
                    font-weight: 700;
                    color: rgba(255,255,255,0.4);
                    margin-bottom: 20px;
                    letter-spacing: 0.1em;
                }

                .feed-content {
                    flex: 1;
                    overflow-y: auto;
                    font-family: 'JetBrains Mono', monospace;
                    font-size: 11px;
                }

                .log-entry { margin-bottom: 12px; line-height: 1.4; }
                .log-entry .timestamp { color: rgba(255,255,255,0.2); margin-right: 8px; }
                .log-entry .source { color: #ff3333; margin-right: 8px; font-weight: 600; }
                .log-entry .message { color: rgba(255,255,255,0.8); }
                .log-entry.success .source { color: #00ff80; }
                .log-entry.muted .message { color: rgba(255,255,255,0.3); }
                
                .settings-view { padding: 32px; max-width: 800px; margin: 0 auto; width: 100%; }
                
                .page-header { margin-bottom: 32px; }
                .page-header h2 { font-size: 24px; font-weight: 800; margin-bottom: 8px; }
                .page-header p { color: rgba(255,255,255,0.4); font-size: 14px; }

                .settings-group { margin-bottom: 40px; }
                .settings-group h3 { font-size: 13px; font-weight: 700; color: rgba(255,255,255,0.3); text-transform: uppercase; margin-bottom: 20px; letter-spacing: 0.1em; }
                
                .glass-item {
                    background: rgba(255, 255, 255, 0.02);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    border-radius: 12px;
                    padding: 20px 24px;
                    margin-bottom: 12px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    transition: all 0.2s;
                }
                .glass-item:hover {
                    background: rgba(255, 255, 255, 0.04);
                    border-color: rgba(255, 255, 255, 0.1);
                }
                .setting-info { display: flex; flex-direction: column; gap: 4px; }
                .setting-name { font-weight: 600; font-size: 14px; color: #fff; }
                .setting-desc { font-size: 12px; color: rgba(255,255,255,0.4); }

                .custom-toggle {
                    width: 44px;
                    height: 24px;
                    background: #ff3333;
                    border-radius: 12px;
                    position: relative;
                    cursor: pointer;
                    transition: background 0.3s;
                    flex-shrink: 0;
                }
                .custom-toggle.active { background: #00ff80; }
                .custom-toggle .knob {
                    position: absolute;
                    top: 2px;
                    left: 2px;
                    width: 20px;
                    height: 20px;
                    background: #000;
                    border-radius: 50%;
                    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .custom-toggle.active .knob {
                    transform: translateX(20px);
                }

                .mobile-menu-btn { display: none; background: none; border: none; cursor: pointer; padding: 10px; }
                .hamburger { width: 20px; height: 1px; background: #fff; position: relative; transition: all 0.3s; }
                .hamburger::before, .hamburger::after { content: ''; width: 20px; height: 1px; background: #fff; position: absolute; left: 0; transition: all 0.3s; }
                .hamburger::before { top: -6px; }
                .hamburger::after { top: 6px; }
                
                .mobile-nav-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    background: rgba(0,0,0,0.9);
                    backdrop-filter: blur(10px);
                    z-index: 2000;
                }

                .mobile-nav-content {
                    width: 280px;
                    height: 100%;
                    background: #050505;
                    padding: 24px;
                    display: flex;
                    flex-direction: column;
                }

                .mobile-nav-header { display: flex; align-items: center; gap: 12px; margin-bottom: 48px; }
                .mobile-links { display: flex; flex-direction: column; gap: 24px; }
                .mobile-links button { background: none; border: none; color: #fff; font-size: 18px; font-weight: 700; text-align: left; cursor: pointer; }

                @media (max-width: 1024px) {
                    .side-nav { display: none; }
                    .mobile-menu-btn { display: block; }
                    .dashboard-row { grid-template-columns: 1fr; }
                    .dashboard-sidebar { display: none; }
                    .dashboard-content { padding: 24px 16px; }
                }

                .live-badge {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    background: rgba(0, 255, 128, 0.05);
                    color: #00ff80;
                    padding: 4px 10px;
                    border-radius: 4px;
                    font-size: 10px;
                    font-weight: 900;
                    border: 1px solid rgba(0, 255, 128, 0.1);
                }

                .pulse-dot {
                    width: 4px;
                    height: 4px;
                    background: #00ff80;
                    border-radius: 50%;
                    box-shadow: 0 0 8px #00ff80;
                }
            `}</style>
        </div>
    );
};

export default App;
