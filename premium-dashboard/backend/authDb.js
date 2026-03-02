const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'auth.json');

const readDb = () => {
    if (!fs.existsSync(DB_PATH)) {
        return { email: null, passwordHash: null };
    }
    try {
        const data = fs.readFileSync(DB_PATH, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return { email: null, passwordHash: null };
    }
};

const writeDb = (data) => {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
};

const isInitialized = () => {
    const db = readDb();
    return !!db.email && !!db.passwordHash;
};

const saveAccount = async (email, plainPassword) => {
    const passwordHash = await bcrypt.hash(plainPassword, 10);
    writeDb({ email, passwordHash });
};

const verifyPassword = async (plainPassword) => {
    const db = readDb();
    if (!db.passwordHash) return false;
    return await bcrypt.compare(plainPassword, db.passwordHash);
};

const getEmail = () => {
    return readDb().email;
};

module.exports = {
    isInitialized,
    saveAccount,
    verifyPassword,
    getEmail
};
