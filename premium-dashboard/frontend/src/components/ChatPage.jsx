import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
    Plus, Trash2, Send, Mic, Square,
    User, SquarePen, ChevronRight
} from 'lucide-react';
import KyntoMark from './KyntoMark';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// ── Helpers ──────────────────────────────────────────────────────────────────

const getToken = () =>
    localStorage.getItem('dashboard_token') || sessionStorage.getItem('dashboard_token');

const relativeTime = (dateStr) => {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}d ago`;
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

const groupConversations = (convs) => {
    const now = new Date();
    const today = [], yesterday = [], older = [];
    convs.forEach(c => {
        const d = new Date(c.updated_at || c.created_at || 0);
        const diffDays = Math.floor((now - d) / 86400000);
        if (diffDays < 1) today.push(c);
        else if (diffDays < 2) yesterday.push(c);
        else older.push(c);
    });
    return { today, yesterday, older };
};

// ── Markdown renderer ─────────────────────────────────────────────────────────

const MsgMarkdown = ({ text }) => (
    <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
            table: ({ node, ...props }) => (
                <div className="cp-table-wrap"><table {...props} /></div>
            ),
            code: ({ node, inline, className, children, ...props }) =>
                inline ? (
                    <code className="cp-inline-code" {...props}>{children}</code>
                ) : (
                    <pre className="cp-code-block">
                        <code {...props}>{children}</code>
                    </pre>
                ),
            a: ({ node, ...props }) => <a target="_blank" rel="noopener noreferrer" {...props} />,
        }}
    >
        {text}
    </ReactMarkdown>
);

// ── Typing dots ───────────────────────────────────────────────────────────────

const TypingDots = () => (
    <div className="cp-typing">
        <span /><span /><span />
    </div>
);

// ── Message group ─────────────────────────────────────────────────────────────

const MessageGroup = ({ role, messages }) => (
    <div className={`cp-group cp-group--${role}`}>
        <div className="cp-avatar">
            {role === 'user' ? <User size={14} /> : <KyntoMark size={18} animated={true} />}
        </div>
        <div className="cp-bubbles">
            {messages.map((msg, i) => (
                <div key={i} className="cp-bubble">
                    {msg.isProcessing ? (
                        <TypingDots />
                    ) : (
                        <MsgMarkdown text={msg.content || ''} />
                    )}
                </div>
            ))}
        </div>
    </div>
);

// ── Sidebar section label ─────────────────────────────────────────────────────

const SectionLabel = ({ label }) => (
    <div className="cp-section-label">{label}</div>
);

// ── Main component ────────────────────────────────────────────────────────────

const ChatPage = ({ onNavigate, onLogout }) => {
    const [conversations, setConversations] = useState([]);
    const [currentConvId, setCurrentConvId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const [stream, setStream] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [polling, setPolling] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);

    const messagesEndRef = useRef(null);
    const textareaRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const pollRef = useRef(null);

    useEffect(() => {
        fetchConversations();
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, []);

    useEffect(() => {
        if (currentConvId) fetchConversationDetails(currentConvId);
        else setMessages([]);
    }, [currentConvId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px';
        }
    }, [input]);

    const fetchConversations = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/conversations`, {
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            setConversations((await res.json()) || []);
        } catch { /* silent */ }
    };

    const fetchConversationDetails = async (id) => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/conversations/${id}`, {
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            const data = await res.json();
            setMessages(data.messages || []);
        } catch { /* silent */ }
    };

    const createNewChat = () => {
        if (messages.length === 0) { setCurrentConvId(null); return; }
        setCurrentConvId(null);
        setMessages([]);
    };

    const deleteConversation = async (e, id) => {
        e.stopPropagation();
        setConversations(prev => prev.filter(c => c.id !== id));
        if (currentConvId === id) { setCurrentConvId(null); setMessages([]); }
        try {
            await fetch(`${API_BASE_URL}/api/conversations/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
        } catch { /* silent */ }
    };

    const pollForResult = (taskId) => {
        setPolling(true);
        pollRef.current = setInterval(async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/api/chat/status/${taskId}`, {
                    headers: { 'Authorization': `Bearer ${getToken()}` }
                });
                const data = await res.json();
                if (data.status === 'done') {
                    clearInterval(pollRef.current);
                    pollRef.current = null;
                    setPolling(false);
                    setMessages(prev => [...prev, { role: 'assistant', content: data.response || 'Task complete.' }]);
                    fetchConversations();
                }
            } catch {
                clearInterval(pollRef.current);
                pollRef.current = null;
                setPolling(false);
            }
        }, 3000);
    };

    const ensureConversation = async () => {
        if (currentConvId) return currentConvId;
        const res = await fetch(`${API_BASE_URL}/api/conversations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
            body: JSON.stringify({ title: 'New Chat' })
        });
        const data = await res.json();
        setCurrentConvId(data.id);
        setConversations(prev => [data, ...prev]);
        return data.id;
    };

    const handleSendMessage = async (e, directMsg = null, skipUserUpdate = false) => {
        e?.preventDefault();
        const msg = directMsg || input.trim();
        if (!msg || polling) return;

        let convId;
        try { convId = await ensureConversation(); }
        catch { return; }

        if (!skipUserUpdate) {
            setMessages(prev => [...prev, { role: 'user', content: msg, id: Date.now() }]);
            setInput('');
        }

        try {
            const res = await fetch(`${API_BASE_URL}/api/conversations/${convId}/message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
                body: JSON.stringify({ message: msg })
            });
            const data = await res.json();
            if (data.status === 'done' && data.response) {
                setMessages(prev => [...prev, { role: 'assistant', content: data.response, id: Date.now() }]);
                fetchConversations();
            } else if (data.taskId) {
                pollForResult(data.taskId);
            }
        } catch {
            setMessages(prev => [...prev, { role: 'assistant', content: 'Failed to reach Kynto Core.', id: Date.now() }]);
        }
    };

    const startRecording = async () => {
        try {
            const s = await navigator.mediaDevices.getUserMedia({ audio: true });
            setStream(s);
            const mr = new MediaRecorder(s);
            mediaRecorderRef.current = mr;
            audioChunksRef.current = [];
            mr.ondataavailable = (ev) => audioChunksRef.current.push(ev.data);
            mr.onstop = async () => {
                const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.readAsDataURL(blob);
                reader.onloadend = async () => {
                    const b64 = reader.result.split(',')[1];
                    setIsLoading(true);
                    const uid = 'voice-' + Date.now();
                    setMessages(prev => [...prev, { role: 'user', content: null, id: uid, isProcessing: true }]);
                    try {
                        const res = await fetch(`${API_BASE_URL}/api/chat/voice`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
                            body: JSON.stringify({ audio: b64 })
                        });
                        const data = await res.json();
                        if (data.transcription) {
                            setMessages(prev => prev.map(m =>
                                m.id === uid ? { ...m, content: data.transcription, isProcessing: false } : m
                            ));
                            handleSendMessage(null, data.transcription, true);
                        } else throw new Error('no transcription');
                    } catch {
                        setMessages(prev => prev.filter(m => m.id !== uid));
                    } finally {
                        setIsLoading(false);
                    }
                };
            };
            mr.start();
            setIsRecording(true);
        } catch { /* mic denied */ }
    };

    const stopRecording = () => {
        mediaRecorderRef.current?.stop();
        setIsRecording(false);
        stream?.getTracks().forEach(t => t.stop());
        setStream(null);
    };

    // Group messages by consecutive role
    const groupedMessages = (() => {
        const groups = [];
        messages.forEach(msg => {
            const last = groups[groups.length - 1];
            if (last && last.role === msg.role) last.messages.push(msg);
            else groups.push({ role: msg.role, messages: [msg] });
        });
        return groups;
    })();

    const { today, yesterday, older } = groupConversations(conversations);

    const greeting = (() => {
        const h = new Date().getHours();
        if (h < 12) return 'Good morning';
        if (h < 18) return 'Good afternoon';
        return 'Good evening';
    })();

    const ConvList = ({ items }) => items.map(conv => (
        <div
            key={conv.id}
            className={`cp-conv-item${currentConvId === conv.id ? ' active' : ''}`}
            onClick={() => setCurrentConvId(conv.id)}
        >
            <span className="cp-conv-title">{conv.title || 'Untitled'}</span>
            <span className="cp-conv-time">{relativeTime(conv.updated_at || conv.created_at)}</span>
            <button className="cp-conv-delete" onClick={(e) => deleteConversation(e, conv.id)}>
                <Trash2 size={13} />
            </button>
        </div>
    ));

    return (
        <div className="cp-root">

            {/* Mobile backdrop — tap to close sidebar */}
            {sidebarOpen && (
                <div className="cp-sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
            )}

            {/* ── Sidebar ──────────────────────────────────────────── */}
            <aside className={`cp-sidebar${sidebarOpen ? '' : ' cp-sidebar--hidden'}`}>
                <div className="cp-sidebar-head">
                    <div className="cp-brand" onClick={() => onNavigate('dashboard')}
                        style={{ cursor: 'pointer' }} title="Go to Dashboard">
                        <KyntoMark size={22} animated={true} />
                        <span>Kynto</span>
                    </div>
                    <button className="cp-icon-btn" onClick={createNewChat} title="New chat">
                        <SquarePen size={16} />
                    </button>
                </div>

                <nav className="cp-conv-list">
                    {conversations.length === 0 && (
                        <p className="cp-conv-empty">No conversations yet</p>
                    )}
                    {today.length > 0 && <><SectionLabel label="Today" /><ConvList items={today} /></>}
                    {yesterday.length > 0 && <><SectionLabel label="Yesterday" /><ConvList items={yesterday} /></>}
                    {older.length > 0 && <><SectionLabel label="Earlier" /><ConvList items={older} /></>}
                </nav>

            </aside>

            {/* ── Main ─────────────────────────────────────────────── */}
            <main className="cp-main">

                {/* Sidebar toggle on mobile */}
                <button
                    className="cp-sidebar-toggle"
                    onClick={() => setSidebarOpen(v => !v)}
                    aria-label="Toggle sidebar"
                >
                    <SquarePen size={18} />
                </button>

                {/* Messages */}
                <div className="cp-messages">
                    {messages.length === 0 ? (
                        <div className="cp-empty">
                            <div className="cp-empty-logo">
                                <KyntoMark size={36} animated={true} />
                            </div>
                            <h1 className="cp-empty-title">{greeting}, Joseph</h1>
                            <p className="cp-empty-sub">What do you need from the infrastructure today?</p>
                            <div className="cp-suggestions">
                                {[
                                    { label: 'Container health', prompt: 'Check all container health stats' },
                                    { label: 'Recent logs', prompt: 'Show me the last 50 lines from kynto_core' },
                                    { label: 'Disk & resources', prompt: 'Get system info: disk space and Docker version' },
                                    { label: 'Restart a service', prompt: 'Restart the kynto_core container' },
                                ].map(s => (
                                    <button
                                        key={s.label}
                                        className="cp-suggestion"
                                        onClick={() => setInput(s.prompt)}
                                    >
                                        {s.label}
                                        <ChevronRight size={14} className="cp-suggestion-arrow" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="cp-flow">
                            {groupedMessages.map((group, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.18 }}
                                >
                                    <MessageGroup role={group.role} messages={group.messages} />
                                </motion.div>
                            ))}
                            {polling && (
                                <div className="cp-group cp-group--assistant">
                                    <div className="cp-avatar"><KyntoMark size={18} animated={true} /></div>
                                    <div className="cp-bubbles">
                                        <div className="cp-bubble cp-bubble--thinking">
                                            <TypingDots />
                                            <span>Analysing...</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                    )}
                </div>

                {/* Input */}
                <div className="cp-input-wrap">
                    <form className="cp-input-form" onSubmit={handleSendMessage}>
                        <div className={`cp-input-box${isRecording ? ' is-recording' : ''}`}>

                            {/* Mic button */}
                            <button
                                type="button"
                                className={`cp-input-btn cp-mic${isRecording ? ' active' : ''}`}
                                onClick={isRecording ? stopRecording : startRecording}
                                disabled={isLoading}
                                aria-label={isRecording ? 'Stop recording' : 'Record voice'}
                            >
                                {isRecording ? <Square size={16} fill="#e63946" /> : <Mic size={16} />}
                            </button>

                            {/* Textarea or recording state */}
                            {(isRecording || isLoading) ? (
                                <div className="cp-rec-status">
                                    <div className={`cp-rec-dot${isLoading ? ' transcribing' : ''}`} />
                                    <span>{isLoading ? 'Transcribing...' : 'Listening'}</span>
                                </div>
                            ) : (
                                <textarea
                                    ref={textareaRef}
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    placeholder="Message Kynto..."
                                    rows={1}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSendMessage();
                                        }
                                    }}
                                />
                            )}

                            {/* Send button */}
                            {!isRecording && (
                                <button
                                    type="submit"
                                    className="cp-send-btn"
                                    disabled={!input.trim() || polling || isLoading}
                                    aria-label="Send"
                                >
                                    <Send size={15} />
                                </button>
                            )}
                        </div>
                        <p className="cp-disclaimer">Kynto can make mistakes. Verify critical actions.</p>
                    </form>
                </div>
            </main>

            <style>{`
                /* ── Root ── */
                .cp-root {
                    display: flex;
                    height: 100dvh;
                    width: 100dvw;
                    background: #080808;
                    color: #e8e8e8;
                    overflow: hidden;
                    position: fixed;
                    inset: 0;
                    z-index: 100;
                    font-family: inherit;
                }

                /* ── Sidebar ── */
                .cp-sidebar {
                    width: 248px;
                    flex-shrink: 0;
                    background: #050505;
                    border-right: 1px solid rgba(255,255,255,0.045);
                    display: flex;
                    flex-direction: column;
                    transition: width 0.25s ease, opacity 0.2s;
                    overflow: hidden;
                }

                .cp-sidebar-head {
                    padding: 20px 16px 16px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    border-bottom: 1px solid rgba(255,255,255,0.04);
                }

                .cp-brand {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-size: 15px;
                    font-weight: 700;
                    letter-spacing: -0.3px;
                    color: #fff;
                }

                .cp-icon-btn {
                    background: none;
                    border: none;
                    color: #555;
                    cursor: pointer;
                    padding: 6px;
                    border-radius: 8px;
                    display: flex;
                    transition: color 0.2s, background 0.2s;
                }

                .cp-icon-btn:hover {
                    color: #ccc;
                    background: rgba(255,255,255,0.05);
                }

                .cp-conv-list {
                    flex: 1;
                    overflow-y: auto;
                    padding: 10px 8px;
                    scrollbar-width: thin;
                    scrollbar-color: rgba(255,255,255,0.08) transparent;
                }

                .cp-conv-empty {
                    font-size: 12px;
                    color: #444;
                    text-align: center;
                    margin-top: 24px;
                }

                .cp-section-label {
                    font-size: 11px;
                    color: #444;
                    font-weight: 600;
                    letter-spacing: 0.05em;
                    text-transform: uppercase;
                    padding: 14px 8px 6px;
                }

                .cp-conv-item {
                    padding: 9px 10px;
                    border-radius: 8px;
                    cursor: pointer;
                    position: relative;
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                    transition: background 0.15s;
                    margin-bottom: 1px;
                }

                .cp-conv-item:hover {
                    background: rgba(255,255,255,0.03);
                }

                .cp-conv-item.active {
                    background: rgba(255,255,255,0.05);
                }

                .cp-conv-title {
                    font-size: 13px;
                    color: #bbb;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    max-width: 190px;
                }

                .cp-conv-item.active .cp-conv-title {
                    color: #fff;
                }

                .cp-conv-time {
                    font-size: 11px;
                    color: #444;
                }

                .cp-conv-delete {
                    position: absolute;
                    right: 8px;
                    top: 50%;
                    transform: translateY(-50%);
                    opacity: 0;
                    background: none;
                    border: none;
                    color: #555;
                    cursor: pointer;
                    padding: 4px;
                    border-radius: 4px;
                    display: flex;
                    transition: opacity 0.15s, color 0.15s;
                }

                .cp-conv-item:hover .cp-conv-delete {
                    opacity: 1;
                }

                .cp-conv-delete:hover {
                    color: #e63946;
                }

                

                

                

                /* ── Main ── */
                .cp-main {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    background: #080808;
                    position: relative;
                    overflow: hidden;
                }

                .cp-sidebar-toggle {
                    display: none;
                    position: absolute;
                    top: 16px;
                    left: 16px;
                    z-index: 10;
                    background: rgba(255,255,255,0.05);
                    border: none;
                    color: #888;
                    padding: 8px;
                    border-radius: 8px;
                    cursor: pointer;
                }

                /* ── Messages ── */
                .cp-messages {
                    flex: 1;
                    overflow-y: auto;
                    scrollbar-width: thin;
                    scrollbar-color: rgba(255,255,255,0.06) transparent;
                }

                .cp-empty {
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 40px 24px;
                    text-align: center;
                }

                .cp-empty-logo {
                    width: 56px;
                    height: 56px;
                    background: rgba(230,57,70,0.08);
                    border: 1px solid rgba(230,57,70,0.15);
                    border-radius: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-bottom: 20px;
                }

                .cp-empty-title {
                    font-size: 22px;
                    font-weight: 700;
                    letter-spacing: -0.4px;
                    margin: 0 0 8px;
                    color: #fff;
                }

                .cp-empty-sub {
                    font-size: 14px;
                    color: #555;
                    margin: 0 0 32px;
                }

                .cp-suggestions {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 10px;
                    max-width: 480px;
                    width: 100%;
                }

                .cp-suggestion {
                    background: rgba(255,255,255,0.03);
                    border: 1px solid rgba(255,255,255,0.07);
                    color: #888;
                    padding: 12px 16px;
                    border-radius: 12px;
                    font-size: 13px;
                    cursor: pointer;
                    text-align: left;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 8px;
                    transition: all 0.2s;
                    font-family: inherit;
                }

                .cp-suggestion:hover {
                    background: rgba(255,255,255,0.06);
                    border-color: rgba(255,255,255,0.12);
                    color: #ddd;
                }

                .cp-suggestion-arrow {
                    opacity: 0;
                    transition: opacity 0.2s;
                    flex-shrink: 0;
                }

                .cp-suggestion:hover .cp-suggestion-arrow {
                    opacity: 1;
                }

                .cp-flow {
                    padding: 32px 0 16px;
                    max-width: 760px;
                    margin: 0 auto;
                    width: 100%;
                    padding-left: 24px;
                    padding-right: 24px;
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }

                /* ── Message groups ── */
                .cp-group {
                    display: flex;
                    gap: 14px;
                    align-items: flex-start;
                }

                .cp-group--user {
                    flex-direction: row-reverse;
                }

                .cp-avatar {
                    width: 30px;
                    height: 30px;
                    border-radius: 8px;
                    background: none;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                    color: #666;
                    margin-top: 2px;
                }

                .cp-group--user .cp-avatar {
                    background: rgba(230,57,70,0.1);
                    color: #e63946;
                }

                .cp-bubbles {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    max-width: min(85%, 620px);
                }

                .cp-group--user .cp-bubbles {
                    align-items: flex-end;
                }

                .cp-bubble {
                    font-size: 14px;
                    line-height: 1.65;
                    color: #d8d8d8;
                    padding: 0;
                }

                .cp-group--user .cp-bubble {
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.07);
                    border-radius: 16px 16px 4px 16px;
                    padding: 10px 14px;
                    color: #e8e8e8;
                }

                .cp-bubble--thinking {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    color: #555;
                    font-size: 13px;
                    padding: 10px 0;
                }

                /* ── Typing dots ── */
                .cp-typing {
                    display: flex;
                    gap: 4px;
                    align-items: center;
                }

                .cp-typing span {
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    background: rgba(255,255,255,0.3);
                    display: inline-block;
                    animation: cpDot 1.4s ease-in-out infinite;
                }

                .cp-typing span:nth-child(2) { animation-delay: 0.2s; }
                .cp-typing span:nth-child(3) { animation-delay: 0.4s; }

                @keyframes cpDot {
                    0%, 60%, 100% { transform: scale(1); opacity: 0.35; }
                    30% { transform: scale(1.35); opacity: 1; }
                }

                /* ── Markdown ── */
                .cp-bubble p { margin: 0 0 10px; }
                .cp-bubble p:last-child { margin-bottom: 0; }
                .cp-bubble h1, .cp-bubble h2, .cp-bubble h3 {
                    font-weight: 700;
                    letter-spacing: -0.3px;
                    margin: 14px 0 6px;
                    color: #fff;
                }
                .cp-bubble h1 { font-size: 17px; }
                .cp-bubble h2 { font-size: 15px; }
                .cp-bubble h3 { font-size: 14px; }
                .cp-bubble ul, .cp-bubble ol { margin: 8px 0; padding-left: 22px; }
                .cp-bubble li { margin: 4px 0; }
                .cp-bubble a { color: #e63946; text-decoration: underline; text-underline-offset: 3px; }
                .cp-bubble strong { color: #fff; font-weight: 600; }
                .cp-bubble blockquote {
                    border-left: 3px solid rgba(230,57,70,0.5);
                    padding: 6px 14px;
                    margin: 10px 0;
                    color: #888;
                    font-style: italic;
                }

                .cp-inline-code {
                    background: rgba(255,255,255,0.07);
                    color: #e63946;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-size: 12.5px;
                    font-family: 'JetBrains Mono', 'Fira Code', monospace;
                }

                .cp-code-block {
                    background: #050505;
                    border: 1px solid rgba(255,255,255,0.07);
                    border-radius: 10px;
                    padding: 14px 16px;
                    margin: 10px 0;
                    overflow-x: auto;
                    scrollbar-width: thin;
                }

                .cp-code-block code {
                    font-family: 'JetBrains Mono', 'Fira Code', monospace;
                    font-size: 12.5px;
                    line-height: 1.55;
                    color: #c8c8c8;
                }

                .cp-table-wrap {
                    overflow-x: auto;
                    border-radius: 8px;
                    border: 1px solid rgba(255,255,255,0.07);
                    margin: 12px 0;
                }

                .cp-table-wrap table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 13px;
                }

                .cp-table-wrap th, .cp-table-wrap td {
                    padding: 8px 14px;
                    border-bottom: 1px solid rgba(255,255,255,0.06);
                    text-align: left;
                }

                .cp-table-wrap th {
                    font-weight: 600;
                    color: #aaa;
                    background: rgba(255,255,255,0.02);
                    font-size: 12px;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                }

                .cp-table-wrap tr:last-child td { border-bottom: none; }

                /* ── Input ── */
                .cp-input-wrap {
                    padding: 12px 24px calc(28px + env(safe-area-inset-bottom));
                    background: linear-gradient(to top, #080808 60%, transparent);
                }

                .cp-input-form {
                    max-width: 760px;
                    margin: 0 auto;
                }

                .cp-input-box {
                    display: flex;
                    align-items: flex-end;
                    gap: 10px;
                    background: rgba(255,255,255,0.04);
                    border: 1px solid rgba(255,255,255,0.09);
                    border-radius: 16px;
                    padding: 10px 12px;
                    transition: border-color 0.25s;
                }

                .cp-input-box:focus-within {
                    border-color: rgba(255,255,255,0.16);
                }

                .cp-input-box.is-recording {
                    border-color: rgba(230,57,70,0.4);
                    background: rgba(230,57,70,0.03);
                }

                .cp-input-btn {
                    background: none;
                    border: none;
                    color: #555;
                    cursor: pointer;
                    padding: 6px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                    transition: color 0.2s, background 0.2s;
                    margin-bottom: 2px;
                }

                .cp-input-btn:hover {
                    color: #aaa;
                    background: rgba(255,255,255,0.06);
                }

                .cp-mic.active {
                    color: #e63946;
                    background: rgba(230,57,70,0.1);
                    animation: cpMicPulse 1.5s ease-in-out infinite;
                }

                @keyframes cpMicPulse {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(230,57,70,0.3); }
                    50% { box-shadow: 0 0 0 5px rgba(230,57,70,0); }
                }

                .cp-rec-status {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 6px 4px;
                    font-size: 13px;
                    color: rgba(255,255,255,0.6);
                    font-weight: 500;
                }

                .cp-rec-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: #e63946;
                    box-shadow: 0 0 8px rgba(230,57,70,0.7);
                    animation: cpRecPulse 1s ease-in-out infinite;
                    flex-shrink: 0;
                }

                .cp-rec-dot.transcribing {
                    background: rgba(255,255,255,0.4);
                    box-shadow: none;
                    animation: none;
                }

                @keyframes cpRecPulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.35; transform: scale(0.8); }
                }

                .cp-input-box textarea {
                    flex: 1;
                    background: none;
                    border: none;
                    color: #eee;
                    resize: none;
                    font-family: inherit;
                    font-size: 14px;
                    line-height: 1.55;
                    outline: none;
                    padding: 4px 0;
                    min-height: 24px;
                    max-height: 160px;
                    overflow-y: auto;
                    scrollbar-width: thin;
                }

                .cp-input-box textarea::placeholder { color: #444; }

                .cp-send-btn {
                    background: #e63946;
                    border: none;
                    color: #fff;
                    width: 34px;
                    height: 34px;
                    border-radius: 10px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                    transition: background 0.2s, opacity 0.2s;
                    margin-bottom: 2px;
                }

                .cp-send-btn:disabled {
                    background: rgba(255,255,255,0.07);
                    color: #444;
                    cursor: default;
                }

                .cp-send-btn:not(:disabled):hover {
                    background: #c0303b;
                }

                .cp-disclaimer {
                    text-align: center;
                    font-size: 11px;
                    color: #333;
                    margin: 10px 0 0;
                }

                /* Backdrop only on mobile */
                .cp-sidebar-backdrop { display: none; }

                /* ── Tablet (≤900px) ── */
                @media (max-width: 900px) {
                    .cp-sidebar { width: 200px; }
                    .cp-conv-title { max-width: 140px; }
                }

                /* ── Mobile / small tablet (≤700px) ── */
                @media (max-width: 700px) {
                    /* Sidebar becomes a fixed overlay */
                    .cp-sidebar {
                        position: fixed;
                        left: 0;
                        top: 0;
                        bottom: 0;
                        width: 280px !important;
                        z-index: 200;
                        transform: translateX(0);
                        transition: transform 0.28s cubic-bezier(0.4,0,0.2,1);
                        box-shadow: 8px 0 32px rgba(0,0,0,0.6);
                    }

                    .cp-sidebar--hidden {
                        transform: translateX(-100%);
                        box-shadow: none;
                    }

                    /* Real clickable backdrop */
                    .cp-sidebar-backdrop {
                        position: fixed;
                        inset: 0;
                        background: rgba(0,0,0,0.55);
                        backdrop-filter: blur(2px);
                        z-index: 199;
                    }

                    /* Show toggle button + backdrop */
                    .cp-sidebar-toggle { display: flex !important; }
                    .cp-sidebar-backdrop { display: block; }

                    /* Message flow */
                    .cp-flow {
                        padding-left: 14px;
                        padding-right: 14px;
                        padding-top: 60px;
                        gap: 16px;
                    }

                    /* Input */
                    .cp-input-wrap {
                        padding: 8px 12px calc(16px + env(safe-area-inset-bottom));
                    }

                    /* Suggestions single column */
                    .cp-suggestions {
                        grid-template-columns: 1fr;
                        max-width: 100%;
                    }

                    .cp-suggestion {
                        font-size: 12px;
                        padding: 10px 14px;
                    }

                    /* Empty state */
                    .cp-empty-title { font-size: 18px; }
                    .cp-empty-sub { font-size: 13px; }
                    .cp-empty { padding: 32px 16px; }

                    /* Bubbles */
                    .cp-bubbles { max-width: 90%; }
                    .cp-bubble { font-size: 13.5px; }
                    .cp-group { gap: 10px; }

                    /* Touch-friendly buttons */
                    .cp-icon-btn { padding: 8px; }
                    .cp-input-btn { padding: 8px; }
                }

                /* ── Small phones (≤400px) ── */
                @media (max-width: 400px) {
                    .cp-empty-title { font-size: 16px; }
                    .cp-flow { padding-left: 10px; padding-right: 10px; }
                    .cp-bubble { font-size: 13px; }
                    .cp-bubbles { max-width: 95%; }
                }
            `}</style>
        </div>
    );
};

export default ChatPage;
