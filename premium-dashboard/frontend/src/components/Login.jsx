import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, Lock, ArrowRight, Eye, EyeOff } from 'lucide-react';
import NeuralLogo from './NeuralLogo';

const Login = ({ onLogin }) => {
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(localStorage.getItem('dashboard_remember') === 'true');
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
                if (rememberMe) {
                    localStorage.setItem('dashboard_token', token);
                    localStorage.setItem('dashboard_remember', 'true');
                } else {
                    sessionStorage.setItem('dashboard_token', token);
                    localStorage.removeItem('dashboard_remember');
                }
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
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                style={{ width: '90%', maxWidth: '400px', padding: '40px', textAlign: 'center' }}
            >
                <div style={{ margin: '0 auto 20px', display: 'flex', justifyContent: 'center' }}>
                    <NeuralLogo size={80} loop={true} />
                </div>

                <h2 style={{ marginBottom: '8px', letterSpacing: '0.1em' }}>VAULT ACCESS</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '30px', fontSize: '14px' }}>Secure kernel authentication required</p>

                <form onSubmit={handleSubmit}>
                    <div style={{ position: 'relative', marginBottom: '15px' }}>
                        <Lock size={16} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            type={showPassword ? "text" : "password"}
                            placeholder="Enter Master Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            style={{
                                width: '100%',
                                background: 'rgba(255,255,255,0.05)',
                                border: error ? '1px solid var(--danger)' : '1px solid rgba(255,255,255,0.1)',
                                padding: '14px 45px 14px 45px',
                                borderRadius: '12px',
                                color: 'white',
                                outline: 'none',
                                transition: 'all 0.3s ease',
                                fontSize: '16px'
                            }}
                            autoFocus
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            style={{
                                position: 'absolute',
                                right: '16px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                padding: 0
                            }}
                        >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '25px', cursor: 'pointer' }} onClick={() => setRememberMe(!rememberMe)}>
                        <div style={{
                            width: '18px',
                            height: '18px',
                            borderRadius: '4px',
                            border: '1px solid rgba(255,255,255,0.2)',
                            background: rememberMe ? 'var(--accent)' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s'
                        }}>
                            {rememberMe && <ArrowRight size={12} color="white" style={{ transform: 'rotate(-45deg)' }} />}
                        </div>
                        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Remember access for 24h</span>
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
