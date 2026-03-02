const express = require('express');
const cors = require('cors');
const si = require('systeminformation');
const Docker = require('dockerode');
const jwt = require('jsonwebtoken');

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

const app = express();
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || 'admin';
const JWT_SECRET = process.env.JWT_SECRET || 'kynto-kernel-secure-9912';
const OTP_SECRET = process.env.OTP_SECRET || 'kynto-otp-secure-9912';

const authDb = require('./authDb');

// In-memory OTP store
const otpStore = new Map();

// PNA (Private Network Access) Support - MUST BE BEFORE CORS
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Access-Control-Allow-Private-Network');
        return res.sendStatus(204);
    }
    next();
});

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Access-Control-Allow-Private-Network'],
    exposedHeaders: ['Access-Control-Allow-Private-Network']
}));
app.use(express.json());

// Auth Middleware (Industry Standard HMAC-SHA256)
const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'UNAUTHORIZED_ACCESS_DENIED' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ error: 'SESSION_EXPIRED_OR_INVALID' });
    }
};

// Check Initialization Status
app.get('/api/auth/status', (req, res) => {
    res.json({ initialized: authDb.isInitialized() });
});

// Configure NodeMailer for Google SMTP
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: 'homekynto.ai@gmail.com', pass: 'fdot pcbv wvjn ugjj' }
});

// Helper: Generate OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// 1. Request OTP (Setup or Reset)
app.post('/api/auth/request-otp', async (req, res) => {
    const { email } = req.body;
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
        return res.status(400).json({ error: 'INVALID_EMAIL' });
    }

    const isInit = authDb.isInitialized();

    // If initialized, verify it matches the registered email to prevent enumeration
    if (isInit) {
        const registeredEmail = authDb.getEmail();
        if (email.toLowerCase() !== registeredEmail.toLowerCase()) {
            console.warn(`[AUTH_WARN] OTP requested for unregistered email: ${email}`);
            // Return success anyway to avoid leaking whether email exists
            return res.json({ success: true, message: 'OTP sent if email matches records.' });
        }
    }

    const otp = generateOTP();
    otpStore.set(email.toLowerCase(), {
        otp,
        expiresAt: Date.now() + 10 * 60 * 1000, // 10 mins
        type: isInit ? 'reset' : 'setup'
    });

    const mailOptions = {
        from: 'homekynto.ai@gmail.com',
        to: email,
        subject: isInit ? 'Kynto Vault - Password Reset OTP' : 'Kynto Vault - Initial Setup OTP',
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f4f4f4;">
                <h2 style="color: #333;">Kynto Vault</h2>
                <p>Your one-time password (OTP) for ${isInit ? 'password reset' : 'account setup'} is:</p>
                <div style="background-color: #fff; padding: 20px; font-size: 24px; font-weight: bold; letter-spacing: 5px; text-align: center; border: 2px solid #007bff; border-radius: 8px; margin: 20px 0;">
                    ${otp}
                </div>
                <p style="font-size: 14px; color: #555;">This code will expire in 10 minutes.</p>
                <p style="font-size: 12px; color: #777; margin-top: 30px;">If you did not request this email, please secure your server immediately.</p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`[AUTH_INFO] OTP sent to ${email}`);
        res.json({ success: true, message: 'OTP sent successfully.' });
    } catch (error) {
        console.error('[AUTH_ERROR] Error sending email:', error);
        res.status(500).json({ error: 'FAILED_TO_SEND_EMAIL' });
    }
});

// 2. Verify OTP
app.post('/api/auth/verify-otp', (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: 'MISSING_FIELDS' });

    const emailKey = email.toLowerCase();
    const record = otpStore.get(emailKey);

    if (!record || record.otp !== otp || Date.now() > record.expiresAt) {
        return res.status(401).json({ error: 'INVALID_OR_EXPIRED_OTP' });
    }

    // OTP verified, create a temporary action token
    const actionToken = jwt.sign(
        { email: emailKey, type: record.type, action: 'set-password' },
        OTP_SECRET,
        { expiresIn: '15m' }
    );

    otpStore.delete(emailKey); // consume OTP
    res.json({ actionToken });
});

// 3. Set/Reset Password
app.post('/api/auth/set-password', async (req, res) => {
    const { actionToken, password } = req.body;
    if (!actionToken || !password || password.length < 8) {
        return res.status(400).json({ error: 'INVALID_INPUT_OR_PASSWORD_TOO_SHORT' });
    }

    try {
        const decoded = jwt.verify(actionToken, OTP_SECRET);

        if (decoded.action !== 'set-password') {
            return res.status(400).json({ error: 'INVALID_TOKEN_TYPE' });
        }

        const isInit = authDb.isInitialized();
        if (decoded.type === 'setup' && isInit) {
            return res.status(400).json({ error: 'SYSTEM_ALREADY_INITIALIZED' });
        }
        if (decoded.type === 'reset' && !isInit) {
            return res.status(400).json({ error: 'SYSTEM_NOT_INITIALIZED' });
        }

        await authDb.saveAccount(decoded.email, password);
        console.log(`[AUTH_INFO] Password ${decoded.type} successful for ${decoded.email}`);

        // Automatically log them in
        const token = jwt.sign({ sub: decoded.email, iat: Math.floor(Date.now() / 1000) }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, message: 'Password configured successfully.' });
    } catch (err) {
        res.status(401).json({ error: 'INVALID_OR_EXPIRED_ACTION_TOKEN' });
    }
});

// 4. Standard Login Entity
app.post('/api/auth/login', async (req, res) => {
    const { password } = req.body;

    if (!authDb.isInitialized()) {
        return res.status(400).json({ error: 'NOT_INITIALIZED_SETUP_REQUIRED' });
    }

    // DEBUG: Diagnose Chrome vs Safari discrepancy
    console.log(`[AUTH_DEBUG] Login Attempt from ${req.ip} | UA: ${req.headers['user-agent']?.substring(0, 50)}...`);

    const isValid = await authDb.verifyPassword(password);

    if (isValid) {
        const token = jwt.sign({ sub: authDb.getEmail(), iat: Math.floor(Date.now() / 1000) }, JWT_SECRET, { expiresIn: '24h' });
        return res.json({ token });
    }

    console.warn(`[AUTH_WARN] Login failed for password attempt (first 2 chars): ${password?.substring(0, 2)}...`);
    res.status(401).json({ error: 'CREDENTIAL_INVALID' });
});

// Mapping for Natural English Names
const NAME_MAP = {
    'kynto-gateway_service-1': 'Network Gateway',
    'kynto-kynto_core-1': 'Kynto Agent',
    'kynto-docker_mcp_bridge-1': 'System Controller',
    'premium-dashboard-dashboard-backend-1': 'Dashboard Data',
    'premium-dashboard-dashboard-frontend-1': 'Primary Portal',
    'tacticore-nginx': 'TactiCore Web Gateway',
    'cloudflared': 'Cloudflare Edge Tunnel'
};

const getFriendlyName = (name, image) => {
    if (NAME_MAP[name]) return NAME_MAP[name];
    return name
        .replace(/^[/-]/, '')
        .split(/[-_]/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
        .replace(/\d+$/, '')
        .trim();
};

const calculateCPUPercent = (stats) => {
    if (!stats || !stats.cpu_stats || !stats.precpu_stats) return 0;
    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
    const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
    if (systemDelta > 0.0 && cpuDelta > 0.0) {
        return (cpuDelta / systemDelta) * (stats.cpu_stats.online_cpus || 1) * 100.0;
    }
    return 0.0;
};

const formatUptime = (startedAt) => {
    const start = new Date(startedAt);
    const now = new Date();
    const diffMs = now - start;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffDay > 0) return `${diffDay}d ${diffHour % 24}h`;
    if (diffHour > 0) return `${diffHour}h ${diffMin % 60}m`;
    if (diffMin > 0) return `${diffMin}m`;
    return 'Just now';
};

app.get('/api/stats', verifyToken, async (req, res) => {
    try {
        const [cpu, mem, os, disk, load, dockerInfo] = await Promise.all([
            si.cpu(),
            si.mem(),
            si.osInfo(),
            si.fsSize(),
            si.currentLoad(),
            si.dockerInfo()
        ]);

        const containers = await docker.listContainers({ all: true });
        const dockerStatsPromises = containers.map(async (containerInfo) => {
            const container = docker.getContainer(containerInfo.Id);
            const [stats, details] = await Promise.all([
                container.stats({ stream: false }).catch(() => null),
                container.inspect().catch(() => null)
            ]);

            let cpuPercent = 0;
            let memUsage = 0;
            let memLimit = 0;
            let memPercent = 0;

            if (stats) {
                cpuPercent = calculateCPUPercent(stats);
                memUsage = stats.memory_stats.usage || 0;
                memLimit = stats.memory_stats.limit || 0;
                memPercent = memLimit > 0 ? (memUsage / memLimit) * 100 : 0;
            }

            const rawName = containerInfo.Names[0].replace('/', '');
            return {
                id: containerInfo.Id,
                name: getFriendlyName(rawName, containerInfo.Image),
                rawName: rawName,
                image: containerInfo.Image,
                status: containerInfo.Status,
                state: containerInfo.State,
                uptime: details ? formatUptime(details.State.StartedAt) : containerInfo.Status,
                cpuPercent: Math.round(cpuPercent * 10) / 10,
                memUsage: Math.round(memUsage / 1024 / 1024 * 10) / 10,
                memPercent: Math.round(memPercent * 10) / 10
            };
        });

        const dockerStats = await Promise.all(dockerStatsPromises);

        res.json({
            system: {
                cpu: { brand: cpu.brand, cores: cpu.cores, load: load.currentLoad },
                memory: { total: mem.total, used: mem.active, available: mem.available, buffcache: mem.buffcache, realUsed: mem.used },
                os: { distro: os.distro, hostname: os.hostname },
                disk: disk.map(d => ({ size: d.size, used: d.used, use: d.use, mount: d.mount })).filter(d => d.mount === '/'),
                docker: { running: dockerInfo.containersRunning, total: dockerInfo.containers, images: dockerInfo.images }
            },
            docker: dockerStats
        });
    } catch (error) {
        console.error('Error stats:', error);
        res.status(500).json({ error: error.message });
    }
});

// NEW: Lightweight Log Fetching
app.get('/api/containers/:id/logs', verifyToken, async (req, res) => {
    try {
        const container = docker.getContainer(req.params.id);
        const logs = await container.logs({
            stdout: true,
            stderr: true,
            tail: 200,
            follow: false,
            timestamps: true
        });

        // Docker logs are multiplexed: 8-byte header (1 byte stream type, 3 bytes null, 4 bytes payload length)
        // We need to parse this buffer to get clean text
        let offset = 0;
        let output = "";
        while (offset < logs.length) {
            const length = logs.readUInt32BE(offset + 4);
            output += logs.slice(offset + 8, offset + 8 + length).toString('utf8');
            offset += 8 + length;
        }

        res.json({ logs: output });
    } catch (error) {
        console.error('Error logs:', error);
        res.status(500).json({ error: error.message });
    }
});

// NEW: Container Control Actions
app.post('/api/containers/:id/action', verifyToken, async (req, res) => {
    try {
        const { action } = req.body;
        const container = docker.getContainer(req.params.id);

        if (!['start', 'stop', 'restart'].includes(action)) {
            return res.status(400).json({ error: 'Invalid action' });
        }

        console.log(`Executing ${action} on container ${req.params.id}`);
        await container[action]();
        res.json({ status: 'success', message: `Container ${action}ed successfully` });
    } catch (error) {
        console.error(`Error executing ${req.body.action}:`, error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(3001, '0.0.0.0', () => console.log('Backend on 3001'));
