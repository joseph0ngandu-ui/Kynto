import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Activity, Server, Database, Box, Cpu, HardDrive,
    RefreshCw, TrendingUp, Shield, Clock, Terminal, Info, X
} from 'lucide-react';

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

const ContainerCard = ({ container, idx, onLogs }) => (
    <motion.div
        className="container-card"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: idx * 0.05 }}
        onClick={() => onLogs(container)}
        style={{ cursor: 'pointer' }}
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
    </motion.div>
);

const LogOverlay = ({ container, onClose }) => {
    const [logs, setLogs] = useState('FETCHING_LOGS...');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const res = await fetch(`https://homeserver.taildbc5d3.ts.net/api/containers/${container.id}/logs`);
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
        <motion.div
            className="log-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            <motion.div
                className="log-window"
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
            >
                <div className="log-header">
                    <div className="log-title">
                        <Terminal size={16} />
                        <span>{container.name} // Debug Console</span>
                    </div>
                    <button className="close-btn" onClick={onClose}><X size={20} /></button>
                </div>
                <div className="log-content">
                    {loading ? (
                        <div className="log-spinner">SYNCING_STREAMS...</div>
                    ) : (
                        <pre>{logs}</pre>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
};

const NeuralLogo = ({ size = 64 }) => {
    const draw = {
        hidden: { pathLength: 0, opacity: 0 },
        visible: (i) => ({
            pathLength: 1,
            opacity: 1,
            transition: {
                pathLength: { delay: i * 0.15, duration: 1.2, ease: "easeInOut" },
                opacity: { delay: i * 0.15, duration: 0.1 }
            }
        })
    };

    return (
        <motion.svg
            width={size} height={size} viewBox="0 0 100 100" fill="none"
            initial="hidden" animate="visible"
        >
            <motion.path
                d="M 50 10 L 85 30 L 85 70 L 50 90 L 15 70 L 15 30 Z"
                stroke="var(--accent)"
                strokeWidth="2"
                variants={draw}
                custom={0}
            />
            <motion.path
                d="M 50 25 L 72 38 L 72 62 L 50 75 L 28 62 L 28 38 Z"
                stroke="var(--text)"
                strokeWidth="1"
                variants={draw}
                custom={1}
            />
            {[0, 120, 240].map((angle, i) => {
                const r1 = 30, r2 = 45;
                const rad = (angle * Math.PI) / 180;
                return (
                    <motion.line
                        key={angle}
                        x1={50 + r1 * Math.cos(rad)} y1={50 + r1 * Math.sin(rad)}
                        x2={50 + r2 * Math.cos(rad)} y2={50 + r2 * Math.sin(rad)}
                        stroke="var(--accent)"
                        strokeWidth="1"
                        variants={draw}
                        custom={2 + i * 0.1}
                    />
                );
            })}
        </motion.svg>
    );
};

const App = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedContainer, setSelectedContainer] = useState(null);

    const fetchData = async () => {
        try {
            const res = await fetch(`https://homeserver.taildbc5d3.ts.net/api/stats`);
            if (!res.ok) throw new Error('Refusal');
            const json = await res.json();
            setData(json);
            setLoading(false);
            setError(null);
        } catch (err) {
            setError('OFFLINE');
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 4000);
        return () => clearInterval(interval);
    }, []);

    if (loading) return (
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

    const memUsedGB = (data.system.memory.used / 1024 / 1024 / 1024).toFixed(1);
    const memTotalGB = (data.system.memory.total / 1024 / 1024 / 1024).toFixed(0);
    const memPercent = (data.system.memory.used / data.system.memory.total) * 100;

    return (
        <div className="app-container">
            <header className="main-header">
                <div className="brand-stack">
                    <NeuralLogo size={50} />
                    <div>
                        <h1>Sal's Server Dashboard</h1>
                        <p>{data.system.os.distro}</p>
                    </div>
                </div>
                <div className="live-status">
                    {error ? <span className="err-badge">{error}</span> : <div className="live-badge"><div className="dot"></div> System Online</div>}
                </div>
            </header>

            <main className="dashboard-grid">
                <StatCard
                    icon={Cpu}
                    title="CPU"
                    value={`${Math.round(data.system.cpu.load)}%`}
                    label="Processor Utilization"
                    progress={data.system.cpu.load}
                    color="var(--text)"
                    delay={0.1}
                />
                <StatCard
                    icon={Server}
                    title="Memory"
                    value={`${memUsedGB}GB`}
                    label={`of ${memTotalGB}GB Total Allocation`}
                    progress={memPercent}
                    color="var(--accent)"
                    delay={0.2}
                />
                <StatCard
                    icon={Database}
                    title="Storage"
                    value={`${Math.round(data.system.disk[0]?.use)}%`}
                    label="Primary Partition Load"
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
        </div>
    );
};

export default App;
