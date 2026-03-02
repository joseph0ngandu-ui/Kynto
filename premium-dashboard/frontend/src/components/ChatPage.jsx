import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    MessageSquare, Plus, Trash2, Send, Mic, Square,
    ChevronLeft, Bot, User, Loader2, ArrowLeft,
    MoreVertical, Download, Link as LinkIcon
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://homeserver.taildbc5d3.ts.net';

const RecordingVisualizer = ({ isRecording, stream }) => {
    const canvasRef = useRef(null);
    const requestRef = useRef();

    useEffect(() => {
        if (!isRecording || !stream) return;

        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            const width = canvas.width;
            const height = canvas.height;

            analyser.getByteFrequencyData(dataArray);

            ctx.clearRect(0, 0, width, height);
            const barWidth = (width / bufferLength) * 2.5;
            let barHeight;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                barHeight = (dataArray[i] / 255) * height;
                ctx.fillStyle = `rgb(255, 51, 51)`;
                ctx.fillRect(x, height - barHeight, barWidth, barHeight);
                x += barWidth + 1;
            }

            requestRef.current = requestAnimationFrame(draw);
        };

        draw();

        return () => {
            cancelAnimationFrame(requestRef.current);
            audioContext.close();
        };
    }, [isRecording, stream]);

    return (
        <canvas
            ref={canvasRef}
            width="100"
            height="30"
            style={{
                opacity: isRecording ? 1 : 0,
                transition: 'opacity 0.3s ease',
                marginRight: '12px'
            }}
        />
    );
};

const ChatPage = ({ onBack }) => {
    const [conversations, setConversations] = useState([]);
    const [currentConvId, setCurrentConvId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const [stream, setStream] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [polling, setPolling] = useState(false);

    const messagesEndRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const pollRef = useRef(null);

    const getToken = () => localStorage.getItem('dashboard_token') || sessionStorage.getItem('dashboard_token');

    useEffect(() => {
        fetchConversations();
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, []);

    useEffect(() => {
        if (currentConvId) {
            fetchConversationDetails(currentConvId);
        } else {
            setMessages([]);
        }
    }, [currentConvId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const fetchConversations = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/conversations`, {
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            const data = await res.json();
            setConversations(data || []);
        } catch (err) {
            console.error('Failed to fetch conversations', err);
        }
    };

    const fetchConversationDetails = async (id) => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/conversations/${id}`, {
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            const data = await res.json();
            setMessages(data.messages || []);
        } catch (err) {
            console.error('Failed to fetch conversation details', err);
        }
    };

    const createNewChat = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/conversations`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`
                },
                body: JSON.stringify({ title: 'New Chat' })
            });
            const data = await res.json();
            setConversations([data, ...conversations]);
            setCurrentConvId(data.id);
        } catch (err) {
            console.error('Failed to create new chat', err);
        }
    };

    const deleteConversation = async (e, id) => {
        e.stopPropagation();
        // Remove confirm() as per user request for "instant" feel

        // Optimistic update - No rollback to fulfill "at least hide it"
        setConversations(prev => (Array.isArray(prev) ? prev.filter(c => c.id !== id) : []));
        if (currentConvId === id) {
            setCurrentConvId(null);
            setMessages([]);
        }

        try {
            await fetch(`${API_BASE_URL}/api/conversations/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            // We don't rollback if it fails, ensuring it stays hidden in UI
        } catch (err) {
            console.error('Background deletion failed:', err);
        }
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
                    fetchConversations(); // Update titles
                }
            } catch (err) {
                clearInterval(pollRef.current);
                pollRef.current = null;
                setPolling(false);
            }
        }, 3000);
    };

    const handleSendMessage = async (e, directMsg = null, skipUserUpdate = false) => {
        e?.preventDefault();
        const msg = directMsg || input.trim();
        if (!msg || polling) return;

        let convId = currentConvId;
        if (!convId) {
            try {
                const res = await fetch(`${API_BASE_URL}/api/conversations`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${getToken()}`
                    },
                    body: JSON.stringify({ title: 'New Chat' })
                });
                const data = await res.json();
                convId = data.id;
                setCurrentConvId(convId);
                setConversations([data, ...conversations]);
            } catch (err) {
                return;
            }
        }

        if (!skipUserUpdate) {
            setMessages(prev => [...prev, { role: 'user', content: msg, id: Date.now() }]);
            setInput('');
        }

        try {
            const res = await fetch(`${API_BASE_URL}/api/conversations/${convId}/message`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`
                },
                body: JSON.stringify({ message: msg })
            });
            const data = await res.json();

            if (data.status === 'done' && data.response) {
                setMessages(prev => [...prev, { role: 'assistant', content: data.response, id: Date.now() }]);
                fetchConversations();
            } else if (data.taskId) {
                pollForResult(data.taskId);
            }
        } catch (err) {
            setMessages(prev => [...prev, { role: 'assistant', content: 'Failed to send message.', id: Date.now() }]);
        }
    };

    // Voice Recording Logic
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setStream(stream);
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                audioChunksRef.current.push(event.data);
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.readAsDataURL(audioBlob);
                reader.onloadend = async () => {
                    const base64Audio = reader.result.split(',')[1];
                    setIsLoading(true);

                    // 1. Add User Placeholder
                    const userMsgId = 'voice-' + Date.now();
                    setMessages(prev => [...prev, {
                        role: 'user',
                        content: '_Voice Note Recording..._',
                        id: userMsgId,
                        isProcessing: true
                    }]);

                    try {
                        const res = await fetch(`${API_BASE_URL}/api/chat/voice`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${getToken()}`
                            },
                            body: JSON.stringify({ audio: base64Audio })
                        });
                        const data = await res.json();

                        if (data.transcription) {
                            // 2. Update User message with real text
                            setMessages(prev => prev.map(m =>
                                m.id === userMsgId ? { ...m, content: data.transcription, isProcessing: false } : m
                            ));
                            // 3. Trigger AI send (skipping user update since we already added it)
                            handleSendMessage(null, data.transcription, true);
                        } else {
                            throw new Error('Transcription failed');
                        }
                    } catch (err) {
                        setMessages(prev => prev.filter(m => m.id !== userMsgId));
                        console.error('Transcription failed', err);
                    } finally {
                        setIsLoading(false);
                    }
                };
            };

            mediaRecorder.start();
            setIsRecording(true);
        } catch (err) {
            console.error('Microphone access denied', err);
        }
    };

    const stopRecording = () => {
        mediaRecorderRef.current?.stop();
        setIsRecording(false);
        stream?.getTracks().forEach(track => track.stop());
        setStream(null);
    };

    const renderContent = (text) => {
        if (!text) return null;
        const parts = text.split(/(```[\s\S]*?```)/g);
        return parts.map((part, i) => {
            if (part.startsWith('```') && part.endsWith('```')) {
                const code = part.slice(3, -3).replace(/^\w+\n/, '');
                return (
                    <pre key={i} className="code-block">
                        <code>{code.trim()}</code>
                    </pre>
                );
            }
            const formatted = part
                .replace(/\*([^*]+)\*/g, '<strong>$1</strong>')
                .replace(/_([^_]+)_/g, '<em>$1</em>')
                .replace(/\n/g, '<br/>')
                .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
            return <span key={i} dangerouslySetInnerHTML={{ __html: formatted }} />;
        });
    };

    return (
        <div className="chat-page">
            {/* Sidebar */}
            <div className="chat-sidebar">
                <div className="sidebar-header">
                    <button className="back-btn" onClick={onBack}>
                        <ArrowLeft size={18} />
                    </button>
                    <button className="new-chat-btn" onClick={createNewChat}>
                        <Plus size={18} />
                        <span>New Chat</span>
                    </button>
                </div>

                <div className="conversations-list">
                    {conversations.map(conv => (
                        <div
                            key={conv.id}
                            className={`conv-item ${currentConvId === conv.id ? 'active' : ''}`}
                            onClick={() => setCurrentConvId(conv.id)}
                        >
                            <MessageSquare size={16} />
                            <span className="conv-title">{conv.title}</span>
                            <button className="delete-conv-btn" onClick={(e) => deleteConversation(e, conv.id)}>
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                </div>

                <div className="sidebar-footer">
                    <div className="user-profile">
                        <div className="user-avatar">J</div>
                        <div className="user-info">
                            <span className="user-name">Joseph</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="chat-main">
                <div className="chat-content">
                    {messages.length === 0 && !currentConvId ? (
                        <div className="empty-state">
                            <Bot size={48} color="#ff3333" />
                            <h1>Kynto Kernel v7.2</h1>
                            <p>How can I assist with your infrastructure today?</p>
                            <div className="suggestions">
                                <button onClick={() => setInput("Check container health stats")}>Check health</button>
                                <button onClick={() => setInput("List all active projects")}>List projects</button>
                                <button onClick={() => setInput("Audit security logs")}>Security Audit</button>
                            </div>
                        </div>
                    ) : (
                        <div className="messages-flow">
                            {messages.map((msg, idx) => (
                                <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`message-row ${msg.role}`}
                                >
                                    <div className="message-icon">
                                        {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                                    </div>
                                    <div className="message-bubble">
                                        {renderContent(msg.content)}
                                        {msg.isProcessing && <Loader2 size={12} className="spin" style={{ marginLeft: '8px', display: 'inline-block', verticalAlign: 'middle', opacity: 0.5 }} />}
                                    </div>
                                </motion.div>
                            ))}
                            {polling && (
                                <div className="message-row assistant processing">
                                    <div className="message-icon"><Bot size={16} /></div>
                                    <div className="message-bubble">
                                        <Loader2 size={14} className="spin" />
                                        <span>Deep analysis in progress...</span>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                    )}
                </div>

                {/* Input Subsystem */}
                <div className="chat-input-container">
                    <form className="chat-input-form" onSubmit={handleSendMessage}>
                        <div className={`input-wrapper ${isRecording ? 'is-recording' : ''}`}>
                            <div className="input-left-actions">
                                <button
                                    type="button"
                                    className={`action-btn ${isRecording ? 'recording' : ''}`}
                                    onClick={isRecording ? stopRecording : startRecording}
                                    disabled={isLoading}
                                >
                                    {isRecording ? <Square size={18} fill="#ff3333" /> : <Mic size={18} />}
                                </button>
                            </div>

                            {isRecording ? (
                                <div className="recording-status">
                                    <RecordingVisualizer isRecording={isRecording} stream={stream} />
                                    <span className="recording-label">Recording...</span>
                                    {isLoading && <Loader2 size={14} className="spin" />}
                                </div>
                            ) : (
                                <textarea
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder="Message Kynto Kernel..."
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSendMessage();
                                        }
                                    }}
                                />
                            )}

                            {!isRecording && (
                                <div className="input-right-actions">
                                    <button
                                        type="submit"
                                        className="send-btn"
                                        disabled={!input.trim() || polling || isLoading}
                                    >
                                        {isLoading ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
                                    </button>
                                </div>
                            )}
                        </div>
                    </form>
                    <p className="input-disclaimer">Kynto can make mistakes. Verify critical actions.</p>
                </div>
            </div>

            <style jsx>{`
                .chat-page {
                    display: flex;
                    height: 100vh;
                    width: 100vw;
                    background: #000;
                    color: #f0f0f0;
                    overflow: hidden;
                    position: fixed;
                    inset: 0;
                    z-index: 1000;
                }

                .chat-sidebar {
                    width: 260px;
                    background: #050505;
                    border-right: 1px solid rgba(255,255,255,0.05);
                    display: flex;
                    flex-direction: column;
                }

                .sidebar-header {
                    padding: 20px;
                    display: flex;
                    gap: 12px;
                }

                .back-btn {
                    background: rgba(255,255,255,0.05);
                    border: none;
                    color: #888;
                    padding: 8px;
                    border-radius: 8px;
                    cursor: pointer;
                }

                .new-chat-btn {
                    flex: 1;
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.1);
                    color: #fff;
                    display: flex;
                    alignItems: center;
                    gap: 8px;
                    padding: 8px 12px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 13px;
                    transition: all 0.2s;
                }

                .new-chat-btn:hover {
                    background: rgba(255,255,255,0.1);
                }

                .conversations-list {
                    flex: 1;
                    overflow-y: auto;
                    padding: 10px;
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .conv-item {
                    padding: 10px 12px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    cursor: pointer;
                    color: #888;
                    transition: all 0.2s;
                    position: relative;
                }

                .conv-item:hover, .conv-item.active {
                    background: rgba(255,255,255,0.03);
                    color: #fff;
                }

                .conv-title {
                    font-size: 13px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    flex: 1;
                }

                .delete-conv-btn {
                    opacity: 0;
                    background: none;
                    border: none;
                    color: #555;
                    cursor: pointer;
                }

                .conv-item:hover .delete-conv-btn {
                    opacity: 1;
                }

                .delete-conv-btn:hover {
                    color: #ff3333;
                }

                .sidebar-footer {
                    padding: 20px;
                    border-top: 1px solid rgba(255,255,255,0.05);
                }

                .user-profile {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .user-avatar {
                    width: 32px;
                    height: 32px;
                    background: #ff3333;
                    border-radius: 6px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 800;
                    font-size: 14px;
                }

                .user-info {
                    display: flex;
                    flex-direction: column;
                }

                .user-name {
                    font-size: 13px;
                    font-weight: 600;
                }

                .user-status {
                    font-size: 11px;
                    color: #666;
                }

                .chat-main {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    background: #000;
                    position: relative;
                }

                .chat-content {
                    flex: 1;
                    overflow-y: auto;
                    padding: 40px 10%;
                }

                .empty-state {
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    text-align: center;
                }

                .empty-state h1 {
                    font-size: 24px;
                    font-weight: 800;
                    margin: 20px 0 10px;
                    letter-spacing: -0.5px;
                }

                .empty-state p {
                    color: #666;
                    font-size: 15px;
                    margin-bottom: 30px;
                }

                .suggestions {
                    display: flex;
                    gap: 10px;
                    flex-wrap: wrap;
                    justify-content: center;
                }

                .suggestions button {
                    background: rgba(255,255,255,0.03);
                    border: 1px solid rgba(255,255,255,0.05);
                    color: #888;
                    padding: 8px 16px;
                    border-radius: 20px;
                    font-size: 13px;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .suggestions button:hover {
                    background: rgba(255,255,255,0.08);
                    color: #fff;
                    border-color: #ff3333;
                }

                .messages-flow {
                    display: flex;
                    flex-direction: column;
                    gap: 24px;
                    max-width: 800px;
                    margin: 0 auto;
                }

                .message-row {
                    display: flex;
                    gap: 16px;
                    max-width: 85%;
                }

                .message-row.user {
                    align-self: flex-end;
                    flex-direction: row-reverse;
                }

                .message-icon {
                    width: 32px;
                    height: 32px;
                    border-radius: 8px;
                    background: rgba(255,255,255,0.05);
                    display: flex;
                    align-items: center;
                    justifyContent: center;
                    flex-shrink: 0;
                }

                .user .message-icon {
                    background: rgba(255, 51, 51, 0.1);
                    color: #ff3333;
                }

                .message-bubble {
                    padding: 12px 16px;
                    border-radius: 12px;
                    font-size: 14px;
                    line-height: 1.6;
                    background: rgba(255,255,255,0.03);
                    border: 1px solid rgba(255,255,255,0.05);
                }

                .user .message-bubble {
                    background: rgba(255, 51, 51, 0.05);
                    border-color: rgba(255, 51, 51, 0.1);
                }

                .assistant.processing .message-bubble {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    color: #888;
                }

                .spin {
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                .chat-input-container {
                    padding: 20px 10% 40px;
                    background: linear-gradient(to top, #000 70%, transparent);
                }

                .chat-input-form {
                    max-width: 800px;
                    margin: 0 auto;
                }

                .input-wrapper {
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 20px;
                    display: flex;
                    align-items: center;
                    padding: 8px 12px;
                    transition: all 0.3s ease;
                    gap: 12px;
                }

                .input-wrapper.is-recording {
                    border-color: #ff3333;
                    background: rgba(255, 51, 51, 0.05);
                }

                .recording-status {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    gap: 16px;
                }

                .recording-label {
                    color: #ff3333;
                    font-size: 14px;
                    font-weight: 500;
                    letter-spacing: 0.5px;
                }

                textarea {
                    flex: 1;
                    background: none;
                    border: none;
                    color: #fff;
                    resize: none;
                    height: 24px;
                    font-family: inherit;
                    font-size: 14px;
                    outline: none;
                    padding: 4px;
                    line-height: 1.4;
                }

                .input-left-actions, .input-right-actions {
                    display: flex;
                    align-items: center;
                }

                .action-btn {
                    background: none;
                    border: none;
                    color: #888;
                    cursor: pointer;
                    padding: 6px;
                    border-radius: 50%;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .action-btn:hover {
                    color: #fff;
                    background: rgba(255,255,255,0.05);
                }

                .action-btn.recording {
                    color: #ff3333;
                    background: rgba(255, 51, 51, 0.1);
                    animation: pulse 1.5s infinite;
                }

                @keyframes pulse {
                    0% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.1); opacity: 0.8; }
                    100% { transform: scale(1); opacity: 1; }
                }

                .send-btn {
                    background: #ff3333;
                    border: none;
                    color: #fff;
                    padding: 8px 16px;
                    border-radius: 8px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                }

                .send-btn:disabled {
                    background: #222;
                    color: #444;
                    cursor: default;
                }

                .input-disclaimer {
                    text-align: center;
                    font-size: 11px;
                    color: #444;
                    margin-top: 12px;
                }

                /* Mobile Optimization */
                @media (max-width: 768px) {
                    .chat-sidebar {
                        display: none; /* Add toggle for mobile */
                    }
                    .chat-content {
                        padding: 20px 20px;
                    }
                    .chat-input-container {
                        padding: 10px 10px 20px;
                    }
                }
            `}</style>
        </div>
    );
};

export default ChatPage;
