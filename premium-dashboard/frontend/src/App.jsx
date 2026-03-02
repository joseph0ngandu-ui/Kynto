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

const Sidebar = ({ currentView, onViewChange, onLogout }) => (
    <div className="side-nav">
        <div className="nav-brand">
            <NeuralLogo size={32} />
            <span className="brand-text">KYNTO</span>
        </div>

        <nav className="nav-links">
            <button
                className={`nav-link ${currentView === 'dashboard' ? 'active' : ''}`}
                onClick={() => onViewChange('dashboard')}
            >
                <LayoutDashboard size={20} />
                <span>Dashboard</span>
            </button>
            <button
                className={`nav-link ${currentView === 'chat' ? 'active' : ''}`}
                onClick={() => onViewChange('chat')}
            >
                <MessageSquare size={20} />
                <span>Kynto Chat</span>
            </button>
        </nav>

        <div className="nav-spacer" />

        <div className="nav-footer">
            <button className="nav-link settings">
                <Settings size={20} />
                <span>Settings</span>
            </button>
            <button className="nav-link logout" onClick={onLogout}>
                <LogOut size={20} />
                <span>Sign Out</span>
            </button>
        </div>
    </div>
);

const AppContent = () => {
    const [token, setToken] = useState(localStorage.getItem('dashboard_token'));
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedContainer, setSelectedContainer] = useState(null);

    const fetchData = async () => {
        const currentToken = localStorage.getItem('dashboard_token');
        if (!currentToken) return;

        try {
            const res = await fetch(`${API_BASE_URL}/api/stats`, {
                headers: { 'Authorization': `Bearer ${currentToken}` }
            });
            if (res.status === 401) {
                localStorage.removeItem('dashboard_token');
                window.location.reload();
                return;
            }
            const json = await res.json();
            setData(json);
            setLoading(false);
        } catch (err) {
            setLoading(false);
        }
    };

    const handleAction = async (id, action) => {
        try {
            await fetch(`${API_BASE_URL}/api/containers/${id}/${action}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
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
    }, []);

    if (loading && !data) return <LoaderOverlay />;
    if (!data) return <LoaderOverlay />;

    return (
        <>
            <main className="dashboard-grid">
                <StatCard
                    icon={Activity}
                    title="CPU"
                    value={`${data.system.cpu.load.toFixed(1)}%`}
                    label="System Load"
                    progress={data.system.cpu.load}
                    color="var(--accent)"
                    delay={0}
                />
                <StatCard
                    icon={Database}
                    title="Memory"
                    value={`${(data.system.memory.used / (1024 ** 3)).toFixed(1)}GB`}
                    label="Memory Pool"
                    progress={(data.system.memory.used / data.system.memory.total) * 100}
                    color="var(--success)"
                    delay={0.1}
                />
                <StatCard
                    icon={Server}
                    title="Container Mesh"
                    value={data.system.docker.running}
                    label={`${data.system.docker.total} total instances`}
                    progress={(data.system.docker.running / data.system.docker.total) * 100}
                    color="var(--warning)"
                    delay={0.2}
                />
                <StatCard
                    icon={HardDrive}
                    title="Storage"
                    value={`${data.system.disk[0]?.use}%`}
                    label="NVMe Disk Array"
                    progress={data.system.disk[0]?.use}
                    color="var(--text)"
                    delay={0.3}
                />
            </main>

            <section className="containers-section">
                <div className="section-title-row">
                    <h2><Box size={20} /> System Applications</h2>
                    <div className="pill-group">
                        <span className="pill">{data.system.docker.running} Active</span>
                    </div>
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

            <AnimatePresence>
                {selectedContainer && (
                    <LogOverlay
                        container={selectedContainer}
                        onClose={() => setSelectedContainer(null)}
                    />
                )}
            </AnimatePresence>
        </>
    );
};

const App = () => {
    const [token, setToken] = useState(localStorage.getItem('dashboard_token'));
    const [currentView, setCurrentView] = useState(() => localStorage.getItem('kynto_view') || 'dashboard');

    useEffect(() => {
        localStorage.setItem('kynto_view', currentView);
    }, [currentView]);

    const handleLogout = () => {
        localStorage.removeItem('dashboard_token');
        setToken(null);
    };

    if (!token) {
        return <Login onLoginSuccess={(t) => setToken(t)} />;
    }

    return (
        <div className="app-shell">
            <Sidebar
                currentView={currentView}
                onViewChange={setCurrentView}
                onLogout={handleLogout}
            />

            <div className="content-area">
                <header className="main-header">
                    <div className="view-title">
                        {currentView === 'dashboard' ? 'Infrastructure Dashboard' : 'Kynto Intelligence Interface'}
                    </div>
                    <div className="live-status">
                        <div className="live-badge">
                            <div className="pulse-dot" />
                            SYSTEM_OPERATIONAL
                        </div>
                    </div>
                </header>

                <div className="view-container">
                    {currentView === 'dashboard' ? (
                        <AppContent />
                    ) : (
                        <ChatPage onBack={() => setCurrentView('dashboard')} />
                    )}
                </div>
            </div>

            <KyntoChat onExpand={() => setCurrentView('chat')} />

            <style jsx>{`
                .app-shell {
                    display: flex;
                    height: 100vh;
                    width: 100vw;
                    background: #000;
                    overflow: hidden;
                }

                .side-nav {
                    width: 240px;
                    background: #050505;
                    border-right: 1px solid rgba(255,255,255,0.05);
                    display: flex;
                    flex-direction: column;
                    padding: 24px 12px;
                    z-index: 100;
                }

                .nav-brand {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 0 12px 32px;
                }

                .brand-text {
                    font-size: 18px;
                    font-weight: 700;
                    letter-spacing: 0.1em;
                    color: #fff;
                }

                .nav-links {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .nav-link {
                    background: none;
                    border: none;
                    color: #888;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 12px;
                    border-radius: 12px;
                    cursor: pointer;
                    font-size: 14px;
                    transition: all 0.2s;
                    text-align: left;
                }

                .nav-link:hover {
                    background: rgba(255,255,255,0.05);
                    color: #fff;
                }

                .nav-link.active {
                    background: rgba(255, 51, 51, 0.1);
                    color: #fff;
                    box-shadow: inset 0 0 12px rgba(255, 51, 51, 0.05);
                }

                .nav-spacer {
                    flex: 1;
                }

                .nav-footer {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    padding-top: 24px;
                    border-top: 1px solid rgba(255,255,255,0.05);
                }

                .content-area {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    position: relative;
                }

                .main-header {
                    height: 72px;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 0 32px;
                    background: rgba(0,0,0,0.5);
                    backdrop-filter: blur(20px);
                }

                .view-title {
                    font-size: 14px;
                    font-weight: 600;
                    color: #fff;
                    letter-spacing: 0.05em;
                }

                .view-container {
                    flex: 1;
                    padding: 32px;
                    overflow-y: auto;
                }

                .live-badge {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    background: rgba(0, 255, 128, 0.1);
                    color: #00ff80;
                    padding: 6px 14px;
                    border-radius: 20px;
                    font-size: 11px;
                    font-weight: 700;
                    letter-spacing: 0.1em;
                    border: 1px solid rgba(0, 255, 128, 0.2);
                }

                .pulse-dot {
                    width: 6px;
                    height: 6px;
                    background: #00ff80;
                    border-radius: 50%;
                    animation: pulse-green 2s infinite;
                }

                @keyframes pulse-green {
                    0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(0, 255, 128, 0.7); }
                    70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(0, 255, 128, 0); }
                    100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(0, 255, 128, 0); }
                }

                @media (max-width: 1024px) {
                    .side-nav {
                        display: none;
                    }
                }
            `}</style>
        </div>
    );
};

export default App;
