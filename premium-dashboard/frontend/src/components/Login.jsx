import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, Lock, ArrowRight } from 'lucide-react';

const Login = ({ onLogin }) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(false);

        try {
            const apiBase = import.meta.env.VITE_API_URL || 'https://homeserver.taildbc5d3.ts.net';
            const res = await fetch(`${apiBase}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });

            if (res.ok) {
                const { token } = await res.json();
                localStorage.setItem('dashboard_token', token);
                onLogin(token);
            } else {
                setError(true);
            }
        } catch (err) {
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="loader-overlay" style={{ background: 'radial-gradient(circle at center, #111 0%, #000 100%)' }}>
            <motion.div
                className="glass-card"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{ width: '100%', maxWidth: '400px', padding: '40px', textAlign: 'center' }}
            >
                <div className="icon-box" style={{ background: 'var(--accent)22', margin: '0 auto 20px', width: '64px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '20px' }}>
                    <Shield size={32} color="var(--accent)" />
                </div>

                <h2 style={{ marginBottom: '8px', letterSpacing: '0.1em' }}>VAULT ACCESS</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '30px', fontSize: '14px' }}>Secure kernel authentication required</p>

                <form onSubmit={handleSubmit}>
                    <div style={{ position: 'relative', marginBottom: '20px' }}>
                        <Lock size={16} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            type="password"
                            placeholder="Enter Master Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            style={{
                                width: '100%',
                                background: 'rgba(255,255,255,0.05)',
                                border: error ? '1px solid var(--danger)' : '1px solid rgba(255,255,255,0.1)',
                                padding: '14px 14px 14px 45px',
                                borderRadius: '12px',
                                color: 'white',
                                outline: 'none',
                                transition: 'all 0.3s ease',
                                fontSize: '16px'
                            }}
                            autoFocus
                        />
                    </div>

                    {error && (
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            style={{ color: 'var(--danger)', fontSize: '12px', marginBottom: '20px' }}
                        >
                            AUTHENTICATION_FAILED: Invalid Credentials
                        </motion.p>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="action-btn success"
                        style={{ width: '100%', justifyContent: 'center', padding: '14px' }}
                    >
                        {loading ? 'AUTHENTICATING...' : <><span style={{ marginRight: '8px' }}>IDENTITY_VERIFY</span> <ArrowRight size={16} /></>}
                    </button>
                </form>
            </motion.div>

            <div style={{ position: 'fixed', bottom: '40px', fontSize: '12px', color: 'rgba(255,255,255,0.2)', letterSpacing: '2px' }}>
                KYNTO SECURE SHIELD ACTIVE
            </div>
        </div>
    );
};

export default Login;
