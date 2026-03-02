const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.CHAT_DATA_DIR || '/app/data';
const DB_FILE = path.join(DATA_DIR, 'conversations.json');

const ensureDir = () => {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
};

const readDb = () => {
    ensureDir();
    if (!fs.existsSync(DB_FILE)) return { conversations: {} };
    try {
        return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch {
        return { conversations: {} };
    }
};

const writeDb = (data) => {
    try {
        ensureDir();
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
        console.log(`[DB] Successfully wrote to ${DB_FILE}`);
    } catch (err) {
        console.error(`[DB_ERROR] Failed to write to ${DB_FILE}:`, err.message);
        throw err;
    }
};

module.exports = {
    listConversations() {
        const db = readDb();
        return Object.entries(db.conversations)
            .map(([id, conv]) => ({
                id,
                title: conv.title,
                createdAt: conv.createdAt,
                updatedAt: conv.updatedAt,
                messageCount: conv.messages.length
            }))
            .sort((a, b) => b.updatedAt - a.updatedAt);
    },

    getConversation(id) {
        const db = readDb();
        return db.conversations[id] || null;
    },

    createConversation(id, title) {
        const db = readDb();
        db.conversations[id] = {
            title,
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        writeDb(db);
        return db.conversations[id];
    },

    addMessage(conversationId, role, content) {
        const db = readDb();
        const conv = db.conversations[conversationId];
        if (!conv) return null;

        conv.messages.push({ role, content, timestamp: Date.now() });
        conv.updatedAt = Date.now();

        // Auto-title from first user message
        if (!conv.title || conv.title === 'New Chat') {
            const firstUser = conv.messages.find(m => m.role === 'user');
            if (firstUser) {
                conv.title = firstUser.content.slice(0, 60) + (firstUser.content.length > 60 ? '...' : '');
            }
        }

        writeDb(db);
        return conv;
    },

    deleteConversation(id) {
        const db = readDb();
        if (!db.conversations[id]) return false;
        delete db.conversations[id];
        writeDb(db);
        return true;
    }
};
