import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, Lock, ArrowRight, Eye, EyeOff } from 'lucide-react';
import NeuralLogo from './NeuralLogo';

const Login = ({ onLogin }) => {
    // Shared State
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [successMsg, setSuccessMsg] = useState(null);
    const [view, setView] = useState('login'); // 'login', 'request-otp', 'verify-otp', 'set-password'
    const [initialized, setInitialized] = useState(true);

    // Form State
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(localStorage.getItem('dashboard_remember') === 'true');

    // OTP State
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [actionToken, setActionToken] = useState(null);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showNewPassword, setShowNewPassword] = useState(false);

    // Helpers
    const apiBase = import.meta.env.VITE_API_URL || 'https://homeserver.taildbc5d3.ts.net';

    useEffect(() => {
        const checkStatus = async () => {
            try {
                const res = await fetch(`${apiBase}/api/auth/status`);
                const data = await res.json();
                setInitialized(data.initialized);
            } catch (err) { }
        };
        checkStatus();
    }, []);

    const resetFormStatus = () => {
        setError(null);
        setSuccessMsg(null);
    };

    const handleLoginSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        resetFormStatus();

        try {
            const res = await fetch(`${apiBase}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });

            const data = await res.json();

            if (res.ok) {
                if (rememberMe) {
                    localStorage.setItem('dashboard_token', data.token);
                    localStorage.setItem('dashboard_remember', 'true');
                } else {
                    sessionStorage.setItem('dashboard_token', data.token);
                    localStorage.removeItem('dashboard_remember');
                }
                onLogin(data.token);
            } else {
                if (data.error === 'NOT_INITIALIZED_SETUP_REQUIRED') {
                    setError('System not initialized. Please proceed to First-Time Setup.');
                    setTimeout(() => setView('request-otp'), 2000);
                } else {
                    setError('AUTHENTICATION_FAILED: Invalid Credentials');
                }
            }
        } catch (err) {
            setError('NETWORK_ERROR: Unable to connect to authentication server');
        } finally {
            setLoading(false);
        }
    };

    const handleRequestOtp = async (e) => {
        e.preventDefault();
        setLoading(true);
        resetFormStatus();

        try {
            const res = await fetch(`${apiBase}/api/auth/request-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim() })
            });
            const data = await res.json();

            if (res.ok) {
                setSuccessMsg('OTP sent! Please check your inbox.');
                setTimeout(() => {
                    setView('verify-otp');
                    resetFormStatus();
                }, 1500);
            } else {
                setError(data.error || 'Failed to request OTP');
            }
        } catch (err) {
            setError('NETWORK_ERROR: Unable to request OTP');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        setLoading(true);
        resetFormStatus();

        try {
            const res = await fetch(`${apiBase}/api/auth/verify-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim(), otp: otp.trim() })
            });
            const data = await res.json();

            if (res.ok) {
                setActionToken(data.actionToken);
                setSuccessMsg('OTP Verified Successfully');
                setTimeout(() => {
                    setView('set-password');
                    resetFormStatus();
                }, 1000);
            } else {
                setError(data.error || 'Invalid or expired OTP');
            }
        } catch (err) {
            setError('NETWORK_ERROR: Verification failed');
        } finally {
            setLoading(false);
        }
    };

    const handleSetPassword = async (e) => {
        e.preventDefault();
        setLoading(true);
        resetFormStatus();

        if (newPassword !== confirmPassword) {
            setError('Passwords do not match');
            setLoading(false);
            return;
        }

        if (newPassword.length < 8) {
            setError('Password must be at least 8 characters');
            setLoading(false);
            return;
        }

        try {
            const res = await fetch(`${apiBase}/api/auth/set-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ actionToken, password: newPassword })
            });
            const data = await res.json();

            if (res.ok) {
                setSuccessMsg('Password configured safely!');
                setTimeout(() => {
                    onLogin(data.token);
                }, 1500);
            } else {
                setError(data.error || 'Failed to secure account');
            }
        } catch (err) {
            setError('NETWORK_ERROR: Initialization failed');
        } finally {
            setLoading(false);
        }
    };

    // Component Renders
    const renderLogin = () => (
        <form onSubmit={handleLoginSubmit}>
            <div style={{ position: 'relative', marginBottom: '15px' }}>
                <Lock size={16} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.2)' }} />
                <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{
                        width: '100%',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        padding: '14px 45px 14px 45px',
                        borderRadius: '12px',
                        color: 'white',
                        outline: 'none',
                        transition: 'all 0.3s ease',
                        fontSize: '15px'
                    }}
                    autoFocus
                />
                <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', cursor: 'pointer', padding: 0 }}
                >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '25px', cursor: 'pointer' }} onClick={() => setRememberMe(!rememberMe)}>
                <div style={{ width: '16px', height: '16px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', background: rememberMe ? '#ff3333' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
                    {rememberMe && <ArrowRight size={10} color="white" style={{ transform: 'rotate(-45deg)' }} />}
                </div>
                <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>Remember for 24h</span>
            </div>

            <button type="submit" disabled={loading} className="action-btn success" style={{ width: '100%', justifyContent: 'center', padding: '14px', background: '#111', border: '1px solid rgba(255,255,255,0.05)', color: '#fff' }}>
                {loading ? 'AUTHENTICATING...' : <><span style={{ fontWeight: 600, letterSpacing: '0.05em' }}>Sign In</span> <ArrowRight size={16} style={{ marginLeft: '8px' }} /></>}
            </button>

            <div style={{ marginTop: '24px', textAlign: 'center' }}>
                <button type="button" onClick={() => { setView('request-otp'); resetFormStatus(); }} style={{ background: 'none', border: 'none', color: '#ff3333', cursor: 'pointer', fontSize: '12px', opacity: 0.7, transition: 'opacity 0.2s' }}>
                    {initialized ? "Reset Password" : "First-Time Setup"}
                </button>
            </div>
        </form>
    );

    const renderRequestOtp = () => (
        <form onSubmit={handleRequestOtp}>
            <div style={{ position: 'relative', marginBottom: '20px' }}>
                <input
                    type="email"
                    placeholder="Admin Email Address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '14px 20px', borderRadius: '12px', color: 'white', outline: 'none', fontSize: '16px' }}
                    required
                />
            </div>
            <button type="submit" disabled={loading} className="action-btn success" style={{ width: '100%', justifyContent: 'center', padding: '14px' }}>
                {loading ? 'TRANSMITTING...' : 'REQUEST SECURE OTP'}
            </button>
            <div style={{ marginTop: '20px', fontSize: '13px' }}>
                <button type="button" onClick={() => { setView('login'); resetFormStatus(); }} style={{ background: 'none', border: 'none', color: '#ff3333', cursor: 'pointer', textDecoration: 'underline' }}>
                    Return to Login
                </button>
            </div>
        </form>
    );

    const renderVerifyOtp = () => (
        <form onSubmit={handleVerifyOtp}>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginBottom: '20px' }}>OTP sent to {email}</p>
            <div style={{ position: 'relative', marginBottom: '20px' }}>
                <input
                    type="text"
                    placeholder="Enter 6-Digit OTP"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    maxLength={6}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '14px 20px', borderRadius: '12px', color: 'white', outline: 'none', fontSize: '16px', textAlign: 'center', letterSpacing: '4px' }}
                    required
                />
            </div>
            <button type="submit" disabled={loading} className="action-btn success" style={{ width: '100%', justifyContent: 'center', padding: '14px' }}>
                {loading ? 'VERIFYING...' : 'VERIFY OTP'}
            </button>
            <div style={{ marginTop: '20px', fontSize: '13px', display: 'flex', justifyContent: 'space-between', padding: '0 10px' }}>
                <button type="button" onClick={() => { setView('request-otp'); resetFormStatus(); }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', textDecoration: 'underline' }}>
                    Resend Code
                </button>
                <button type="button" onClick={() => { setView('login'); resetFormStatus(); }} style={{ background: 'none', border: 'none', color: '#ff3333', cursor: 'pointer', textDecoration: 'underline' }}>
                    Cancel
                </button>
            </div>
        </form>
    );

    const renderSetPassword = () => (
        <form onSubmit={handleSetPassword}>
            <div style={{ position: 'relative', marginBottom: '15px' }}>
                <input
                    type={showNewPassword ? "text" : "password"}
                    placeholder="New Master Password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '14px 45px 14px 20px', borderRadius: '12px', color: 'white', outline: 'none', fontSize: '16px' }}
                    required
                />
                <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}>
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
            </div>
            <div style={{ position: 'relative', marginBottom: '25px' }}>
                <input
                    type={showNewPassword ? "text" : "password"}
                    placeholder="Confirm Master Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '14px 45px 14px 20px', borderRadius: '12px', color: 'white', outline: 'none', fontSize: '16px' }}
                    required
                />
            </div>
            <button type="submit" disabled={loading} className="action-btn success" style={{ width: '100%', justifyContent: 'center', padding: '14px' }}>
                {loading ? 'SECURING...' : 'SECURE VAULT'}
            </button>
        </form>
    );

    return (
        <div className="loader-overlay" style={{ background: '#000' }}>
            <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                style={{ width: '90%', maxWidth: '380px', padding: '48px 32px', textAlign: 'center' }}
            >
                <div style={{ margin: '0 auto 32px', display: 'flex', justifyContent: 'center' }}>
                    <NeuralLogo size={64} loop={true} />
                </div>

                <h2 style={{ marginBottom: '8px', fontSize: '24px', fontWeight: 700, letterSpacing: '0.05em', color: '#fff' }}>
                    {view === 'login' && (initialized ? "Vault" : "Setup")}
                    {view === 'request-otp' && "Recovery"}
                    {view === 'verify-otp' && "Security"}
                    {view === 'set-password' && "Secure Key"}
                </h2>

                <p style={{ color: 'rgba(255,255,255,0.4)', marginBottom: '32px', fontSize: '14px', lineHeight: 1.5 }}>
                    {view === 'login' && "Secure kernel authentication required"}
                    {view === 'request-otp' && "Enter admin email to receive OTP"}
                    {view === 'verify-otp' && "Enter the 6-digit verification code"}
                    {view === 'set-password' && "Configure your new master access key"}
                </p>

                {error && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ color: '#ff3333', fontSize: '12px', marginBottom: '24px', fontWeight: 500 }}>{error}</motion.p>}
                {successMsg && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ color: '#00ff80', fontSize: '12px', marginBottom: '24px', fontWeight: 500 }}>{successMsg}</motion.p>}

                {view === 'login' && renderLogin()}
                {view === 'request-otp' && renderRequestOtp()}
                {view === 'verify-otp' && renderVerifyOtp()}
                {view === 'set-password' && renderSetPassword()}
            </motion.div>

            <div style={{ position: 'fixed', bottom: '32px', fontSize: '10px', color: 'rgba(255,255,255,0.1)', letterSpacing: '0.2em', fontWeight: 600 }}>
                KYNTO SECURE SHIELD v2.4
            </div>
        </div>
    );
};

export default Login;
