import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Activity, Server, Database, Box, Cpu, HardDrive,
    RefreshCw, TrendingUp, Shield, Clock, Terminal, Info, X,
    Play, Square, RotateCcw
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

const AppContent = ({ onExpandChat }) => {
    const [token, setToken] = useState(localStorage.getItem('dashboard_token') || sessionStorage.getItem('dashboard_token'));
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedContainer, setSelectedContainer] = useState(null);

    const fetchData = async () => {
        const currentToken = localStorage.getItem('dashboard_token') || sessionStorage.getItem('dashboard_token');
        if (!currentToken) {
            setToken(null);
            setLoading(false);
            return;
        }
        try {
            const res = await fetch(`${API_BASE_URL}/api/stats`, {
                headers: { 'Authorization': `Bearer ${currentToken}` }
            });
            if (res.status === 401) {
                localStorage.removeItem('dashboard_token');
                setToken(null);
                setLoading(false);
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
        if (token) {
            fetchData();
            const interval = setInterval(fetchData, 5000);
            return () => clearInterval(interval);
        } else {
            setLoading(false);
        }
    }, [token]);

    if (loading && !data) return <LoaderOverlay />;
    if (!token) return <Login onLoginSuccess={(t) => { setToken(t); fetchData(); }} />;
    if (!data) return <LoaderOverlay />;

    return (
        <div className="app-container">
            <header className="main-header">
                <div className="brand-stack">
                    <NeuralLogo />
                    <div>
                        <h1>TactiCore Dashboard</h1>
                        <p>Infrastructure AI System</p>
                    </div>
                </div>
                <div className="live-status">
                    <div className="live-badge">
                        <div className="pulse-dot" />
                        SYSTEM_OPERATIONAL
                    </div>
                </div>
            </header>

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
                    label={`${(data.system.memory.available / (1024 ** 3)).toFixed(1)}GB available`}
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
                    label="Capacity"
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
                    <AnimatePresence>
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

            <footer className="footer">
                <div className="footer-left">Kynto Vault v7.2</div>
                <div className="footer-right"><TrendingUp size={14} /> Secure Tunnel Active</div>
            </footer>

            <KyntoChat onExpand={onExpandChat} />
        </div>
    );
};

const App = () => {
    const [currentView, setCurrentView] = useState('dashboard');

    if (currentView === 'chat') {
        return <ChatPage onBack={() => setCurrentView('dashboard')} />;
    }

    return (
        <AppContent onExpandChat={() => setCurrentView('chat')} />
    );
};

export default App;
