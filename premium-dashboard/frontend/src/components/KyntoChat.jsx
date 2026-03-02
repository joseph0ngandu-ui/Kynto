import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Bot, User, Loader2 } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://homeserver.taildbc5d3.ts.net';

const KyntoChat = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { role: 'assistant', content: 'Kynto online. What do you need?' }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    const sendMessage = async (e) => {
        e.preventDefault();
        const trimmed = input.trim();
        if (!trimmed || loading) return;

        const userMsg = { role: 'user', content: trimmed };
        const updatedMessages = [...messages, userMsg];
        setMessages(updatedMessages);
        setInput('');
        setLoading(true);

        try {
            const token = localStorage.getItem('dashboard_token') || sessionStorage.getItem('dashboard_token');

            // Build history for the API (exclude the system greeting)
            const history = updatedMessages.slice(1).map(m => ({
                role: m.role,
                content: m.content
            }));

            const res = await fetch(`${API_BASE_URL}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ message: trimmed, history })
            });

            const data = await res.json();
            const agentResponse = data.response || data.error || 'No response from agent.';
            setMessages(prev => [...prev, { role: 'assistant', content: agentResponse }]);
        } catch (err) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Connection to Kynto Core failed. Is the agent running?'
            }]);
        } finally {
            setLoading(false);
        }
    };

    // Simple markdown-ish rendering for code blocks and bold
    const renderContent = (text) => {
        // Split by code blocks
        const parts = text.split(/(```[\s\S]*?```)/g);
        return parts.map((part, i) => {
            if (part.startsWith('```') && part.endsWith('```')) {
                const code = part.slice(3, -3).replace(/^\w+\n/, ''); // strip lang identifier
                return (
                    <pre key={i} style={{
                        background: 'rgba(0,0,0,0.4)',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        overflowX: 'auto',
                        margin: '8px 0',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word'
                    }}>
                        <code>{code.trim()}</code>
                    </pre>
                );
            }
            // Convert *bold* to <strong> and `inline code`
            const formatted = part
                .replace(/\*([^*]+)\*/g, '<strong>$1</strong>')
                .replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,0.1);padding:2px 5px;border-radius:3px;font-size:12px">$1</code>');
            return <span key={i} dangerouslySetInnerHTML={{ __html: formatted }} />;
        });
    };

    return (
        <>
            {/* Floating Chat Bubble */}
            <AnimatePresence>
                {!isOpen && (
                    <motion.button
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setIsOpen(true)}
                        style={{
                            position: 'fixed',
                            bottom: '24px',
                            right: '24px',
                            width: '56px',
                            height: '56px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                            border: 'none',
                            color: 'white',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 4px 20px rgba(59, 130, 246, 0.4)',
                            zIndex: 1000
                        }}
                    >
                        <MessageCircle size={24} />
                    </motion.button>
                )}
            </AnimatePresence>

            {/* Chat Panel */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        transition={{ duration: 0.25 }}
                        style={{
                            position: 'fixed',
                            bottom: '24px',
                            right: '24px',
                            width: 'min(420px, calc(100vw - 48px))',
                            height: 'min(600px, calc(100vh - 100px))',
                            background: 'rgba(15, 15, 18, 0.97)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '20px',
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                            zIndex: 1000,
                            backdropFilter: 'blur(20px)',
                            boxShadow: '0 8px 40px rgba(0,0,0,0.6)'
                        }}
                    >
                        {/* Header */}
                        <div style={{
                            padding: '16px 20px',
                            borderBottom: '1px solid rgba(255,255,255,0.06)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: 'rgba(255,255,255,0.02)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Bot size={20} color="#3b82f6" />
                                <div>
                                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'white' }}>Kynto Agent</div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Infrastructure AI</div>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                style={{
                                    background: 'rgba(255,255,255,0.05)',
                                    border: 'none',
                                    color: 'var(--text-muted)',
                                    cursor: 'pointer',
                                    padding: '6px',
                                    borderRadius: '8px',
                                    display: 'flex'
                                }}
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Messages */}
                        <div
                            ref={scrollRef}
                            style={{
                                flex: 1,
                                overflowY: 'auto',
                                padding: '16px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '12px'
                            }}
                        >
                            {messages.map((msg, idx) => (
                                <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.2 }}
                                    style={{
                                        display: 'flex',
                                        gap: '8px',
                                        alignItems: 'flex-start',
                                        flexDirection: msg.role === 'user' ? 'row-reverse' : 'row'
                                    }}
                                >
                                    <div style={{
                                        width: '28px',
                                        height: '28px',
                                        borderRadius: '50%',
                                        background: msg.role === 'user'
                                            ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                                            : 'linear-gradient(135deg, #3b82f6, #06b6d4)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0
                                    }}>
                                        {msg.role === 'user'
                                            ? <User size={14} color="white" />
                                            : <Bot size={14} color="white" />
                                        }
                                    </div>
                                    <div style={{
                                        background: msg.role === 'user'
                                            ? 'rgba(99, 102, 241, 0.15)'
                                            : 'rgba(255,255,255,0.04)',
                                        border: `1px solid ${msg.role === 'user' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255,255,255,0.06)'}`,
                                        padding: '10px 14px',
                                        borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                                        maxWidth: '85%',
                                        fontSize: '13px',
                                        lineHeight: '1.5',
                                        color: 'rgba(255,255,255,0.9)',
                                        wordBreak: 'break-word'
                                    }}>
                                        {renderContent(msg.content)}
                                    </div>
                                </motion.div>
                            ))}

                            {loading && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    style={{ display: 'flex', gap: '8px', alignItems: 'center' }}
                                >
                                    <div style={{
                                        width: '28px', height: '28px', borderRadius: '50%',
                                        background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        <Bot size={14} color="white" />
                                    </div>
                                    <div style={{
                                        background: 'rgba(255,255,255,0.04)',
                                        border: '1px solid rgba(255,255,255,0.06)',
                                        padding: '10px 14px',
                                        borderRadius: '16px 16px 16px 4px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        fontSize: '13px',
                                        color: 'var(--text-muted)'
                                    }}>
                                        <motion.div
                                            animate={{ rotate: 360 }}
                                            transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                                        >
                                            <Loader2 size={14} />
                                        </motion.div>
                                        Processing...
                                    </div>
                                </motion.div>
                            )}
                        </div>

                        {/* Input */}
                        <form
                            onSubmit={sendMessage}
                            style={{
                                padding: '12px 16px',
                                borderTop: '1px solid rgba(255,255,255,0.06)',
                                display: 'flex',
                                gap: '8px',
                                background: 'rgba(255,255,255,0.02)'
                            }}
                        >
                            <input
                                ref={inputRef}
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Message Kynto..."
                                disabled={loading}
                                style={{
                                    flex: 1,
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    padding: '10px 14px',
                                    borderRadius: '12px',
                                    color: 'white',
                                    outline: 'none',
                                    fontSize: '14px'
                                }}
                            />
                            <button
                                type="submit"
                                disabled={loading || !input.trim()}
                                style={{
                                    background: input.trim() ? 'linear-gradient(135deg, #3b82f6, #6366f1)' : 'rgba(255,255,255,0.05)',
                                    border: 'none',
                                    borderRadius: '12px',
                                    width: '42px',
                                    height: '42px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: input.trim() ? 'pointer' : 'default',
                                    color: 'white',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <Send size={16} />
                            </button>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default KyntoChat;
