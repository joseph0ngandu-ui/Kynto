import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MessageCircle, X, Send, Bot, User, Loader2, Maximize2 } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const KyntoChat = ({ onExpand }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { role: 'assistant', content: 'Kynto online. What do you need?' }
    ]);
    const [input, setInput] = useState('');
    const [polling, setPolling] = useState(false);
    const scrollRef = useRef(null);
    const inputRef = useRef(null);
    const pollRef = useRef(null);
    const convIdRef = useRef(null);

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

    // Cleanup polling on unmount
    useEffect(() => {
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, []);

    const getToken = () => localStorage.getItem('dashboard_token') || sessionStorage.getItem('dashboard_token');

    const pollForResult = (taskId) => {
        setPolling(true);
        pollRef.current = setInterval(async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/api/chat/status/${taskId}`, {
                    headers: { 'Authorization': `Bearer ${getToken()}` },
                    signal: AbortSignal.timeout(5000)
                });
                const data = await res.json();

                if (data.status === 'done') {
                    clearInterval(pollRef.current);
                    pollRef.current = null;
                    setPolling(false);
                    setMessages(prev => [...prev, { role: 'assistant', content: data.response || 'Task complete.' }]);
                }
            } catch (err) {
                if (err.name !== 'TimeoutError' && err.name !== 'AbortError') {
                    // Only kill polling on hard errors, let timeouts retry
                    console.error('Polling error:', err);
                    clearInterval(pollRef.current);
                    pollRef.current = null;
                    setPolling(false);
                    setMessages(prev => [...prev, { role: 'assistant', content: 'Lost connection while waiting for agent response.' }]);
                }
                // Timeout/Abort errors will simply be ignored and the next interval will try again
            }
        }, 3000); // Poll every 3 seconds
    };

    const getOrCreateConv = async () => {
        if (convIdRef.current) return convIdRef.current;
        const res = await fetch(`${API_BASE_URL}/api/conversations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
            body: JSON.stringify({ title: 'Quick Chat' })
        });
        const data = await res.json();
        convIdRef.current = data.id;
        return data.id;
    };

    const sendMessage = async (e) => {
        e.preventDefault();
        const trimmed = input.trim();
        if (!trimmed || polling) return;

        setMessages(prev => [...prev, { role: 'user', content: trimmed }]);
        setInput('');

        let convId;
        try { convId = await getOrCreateConv(); }
        catch (err) {
            setMessages(prev => [...prev, { role: 'assistant', content: 'Failed to connect to Kynto.' }]);
            return;
        }

        try {
            const res = await fetch(`${API_BASE_URL}/api/conversations/${convId}/message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
                body: JSON.stringify({ message: trimmed })
            });
            const data = await res.json();

            if (data.status === 'done' && data.response) {
                setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
            } else if (data.taskId) {
                pollForResult(data.taskId);
            } else {
                setMessages(prev => [...prev, { role: 'assistant', content: data.error || 'No response from agent.' }]);
            }
        } catch (err) {
            setMessages(prev => [...prev, { role: 'assistant', content: 'Connection to Kynto Core failed.' }]);
        }
    };

    // Simple markdown rendering for code blocks and bold
    const renderContent = (text) => {
        if (!text) return null;
        return (
            <div className="markdown-content">
                <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                        table: ({ node, ...props }) => (
                            <div style={{ overflowX: 'auto', margin: '8px 0', borderRadius: '8px' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }} {...props} />
                            </div>
                        ),
                        th: ({ node, ...props }) => (
                            <th style={{ border: '1px solid rgba(255,255,255,0.1)', padding: '6px 10px', background: 'rgba(255,255,255,0.05)', textAlign: 'left' }} {...props} />
                        ),
                        td: ({ node, ...props }) => (
                            <td style={{ border: '1px solid rgba(255,255,255,0.1)', padding: '6px 10px', textAlign: 'left' }} {...props} />
                        ),
                        code: ({ node, inline, children, ...props }) => {
                            if (inline) {
                                return <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 4px', borderRadius: '4px', fontSize: '11px', fontFamily: 'monospace' }} {...props}>{children}</code>;
                            }
                            return (
                                <pre style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px', overflowX: 'auto', margin: '8px 0' }}>
                                    <code style={{ fontSize: '11px', fontFamily: 'monospace', color: '#ccc' }} {...props}>{children}</code>
                                </pre>
                            );
                        },
                        ul: ({ node, ...props }) => <ul style={{ margin: '8px 0', paddingLeft: '20px' }} {...props} />,
                        ol: ({ node, ...props }) => <ol style={{ margin: '8px 0', paddingLeft: '20px' }} {...props} />,
                        li: ({ node, ...props }) => <li style={{ margin: '4px 0' }} {...props} />
                    }}
                >
                    {text}
                </ReactMarkdown>
            </div>
        );
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
                                    <div style={{ fontSize: '11px', color: polling ? '#22c55e' : 'var(--text-muted)' }}>
                                        {polling ? 'Working on it...' : 'Infrastructure AI'}
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <button
                                    onClick={onExpand}
                                    style={{
                                        background: 'rgba(255,255,255,0.05)',
                                        border: 'none',
                                        color: 'var(--text-muted)',
                                        cursor: 'pointer',
                                        padding: '6px',
                                        borderRadius: '8px',
                                        display: 'flex'
                                    }}
                                    title="Full-page chat"
                                >
                                    <Maximize2 size={16} />
                                </button>
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
                                            : msg.isAck ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255,255,255,0.04)',
                                        border: `1px solid ${msg.role === 'user' ? 'rgba(99, 102, 241, 0.2)' : msg.isAck ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255,255,255,0.06)'}`,
                                        padding: '10px 14px',
                                        borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                                        maxWidth: '85%',
                                        fontSize: '13px',
                                        lineHeight: '1.5',
                                        color: msg.isAck ? 'rgba(34, 197, 94, 0.9)' : 'rgba(255,255,255,0.9)',
                                        wordBreak: 'break-word',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}>
                                        {msg.isAck && polling && (
                                            <motion.div
                                                animate={{ rotate: 360 }}
                                                transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                                                style={{ flexShrink: 0 }}
                                            >
                                                <Loader2 size={14} />
                                            </motion.div>
                                        )}
                                        <div>{renderContent(msg.content)}</div>
                                    </div>
                                </motion.div>
                            ))}
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
                                placeholder={polling ? 'Agent is working...' : 'Message Kynto...'}
                                disabled={polling}
                                style={{
                                    flex: 1,
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    padding: '10px 14px',
                                    borderRadius: '12px',
                                    color: 'white',
                                    outline: 'none',
                                    fontSize: '14px',
                                    opacity: polling ? 0.5 : 1
                                }}
                            />
                            <button
                                type="submit"
                                disabled={polling || !input.trim()}
                                style={{
                                    background: input.trim() && !polling ? 'linear-gradient(135deg, #3b82f6, #6366f1)' : 'rgba(255,255,255,0.05)',
                                    border: 'none',
                                    borderRadius: '12px',
                                    width: '42px',
                                    height: '42px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: input.trim() && !polling ? 'pointer' : 'default',
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
