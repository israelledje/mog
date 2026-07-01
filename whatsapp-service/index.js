const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

const sessionPath = '/app/session';
const CHROMIUM_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium';

function cleanLocks(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        try {
            const stat = fs.lstatSync(fullPath);
            if (stat.isDirectory()) {
                cleanLocks(fullPath);
            } else if (file === 'SingletonLock' || file === 'SingletonCookie' || file === 'SingletonSocket') {
                fs.unlinkSync(fullPath);
                console.log(`Removed stale lock file: ${fullPath}`);
            }
        } catch (e) {
            if (file === 'SingletonLock' || file === 'SingletonCookie' || file === 'SingletonSocket') {
                try { fs.unlinkSync(fullPath); } catch (err) {}
            }
        }
    }
}
cleanLocks(sessionPath);

let qrCodeData = null;
let isConnected = false;
let initState = 'starting'; // starting | waiting_qr | connected | error
let initError = null;
let client = null;
let initializing = false;

function buildClient() {
    return new Client({
        authStrategy: new LocalAuth({ dataPath: sessionPath }),
        webVersionCache: {
            type: 'remote',
            remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
        },
        puppeteer: {
            executablePath: CHROMIUM_PATH,
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--disable-gpu',
                '--disable-software-rasterizer',
                '--disable-extensions',
            ],
        },
    });
}

function attachClientEvents(waClient) {
    waClient.on('qr', (qr) => {
        console.log('QR Code received');
        qrCodeData = qr;
        initState = 'waiting_qr';
        initError = null;
    });

    waClient.on('ready', () => {
        console.log('WhatsApp Client is ready');
        isConnected = true;
        initState = 'connected';
        initError = null;
        qrCodeData = null;
    });

    waClient.on('authenticated', () => {
        console.log('WhatsApp authenticated');
    });

    waClient.on('auth_failure', (msg) => {
        console.error('WhatsApp authentication failure:', msg);
        isConnected = false;
        initState = 'error';
        initError = String(msg || 'Authentication failed');
        qrCodeData = null;
    });

    waClient.on('disconnected', (reason) => {
        console.log('WhatsApp disconnected:', reason);
        isConnected = false;
        qrCodeData = null;
        initState = 'starting';
        setTimeout(() => initializeClient(true), 3000);
    });
}

async function initializeClient(force = false) {
    if (initializing && !force) return;
    if (isConnected) return;

    initializing = true;
    initState = 'starting';
    initError = null;
    qrCodeData = null;

    try {
        if (client) {
            try {
                await client.destroy();
            } catch (e) {
                console.warn('Could not destroy previous client:', e.message);
            }
        }

        cleanLocks(sessionPath);
        client = buildClient();
        attachClientEvents(client);

        console.log(`Initializing WhatsApp client (Chromium: ${CHROMIUM_PATH})`);
        await client.initialize();
    } catch (err) {
        console.error('Failed to initialize WhatsApp client:', err);
        initState = 'error';
        initError = err.message || 'Initialization failed';
        qrCodeData = null;
    } finally {
        initializing = false;
    }
}

initializeClient();

app.get('/health', (req, res) => {
    res.json({ status: 'healthy', isConnected, initState, initError });
});

app.get('/status', (req, res) => {
    res.json({ isConnected, initState, initError, hasQr: Boolean(qrCodeData) });
});

app.get('/qr', async (req, res) => {
    if (isConnected) {
        return res.json({ status: 'connected', qr: null, initState, initError });
    }

    if (initState === 'error') {
        return res.json({ status: 'error', qr: null, initState, initError });
    }

    if (!qrCodeData) {
        if (initState === 'starting' && !initializing) {
            initializeClient();
        }
        return res.json({ status: 'loading', qr: null, initState, initError });
    }

    try {
        const url = await qrcode.toDataURL(qrCodeData);
        res.json({ status: 'disconnected', qr: url, initState, initError });
    } catch (err) {
        console.error('Failed to generate QR image:', err);
        res.status(500).json({ status: 'error', qr: null, initError: 'Failed to generate QR code image' });
    }
});

app.post('/send', async (req, res) => {
    if (!isConnected || !client) {
        return res.status(503).json({ success: false, error: 'WhatsApp is not connected' });
    }

    const { to, message } = req.body;
    if (!to || !message) {
        return res.status(400).json({ success: false, error: 'Missing "to" or "message"' });
    }

    try {
        const formattedNumber = to.replace('+', '').replace(/\s+/g) + '@c.us';
        const response = await client.sendMessage(formattedNumber, message);
        res.json({ success: true, messageId: response.id.id });
    } catch (err) {
        console.error('Failed to send message:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/logout', async (req, res) => {
    if (isConnected && client) {
        try {
            await client.logout();
        } catch (err) {
            console.warn('Logout error:', err.message);
        }
    }

    isConnected = false;
    qrCodeData = null;
    initState = 'starting';

    try {
        if (client) await client.destroy();
    } catch (err) {
        console.warn('Destroy after logout:', err.message);
    }

    client = null;
    setTimeout(() => initializeClient(true), 2000);
    res.json({ success: true });
});

app.post('/restart', async (req, res) => {
    isConnected = false;
    qrCodeData = null;
    initState = 'starting';
    initError = null;

    try {
        if (client) await client.destroy();
    } catch (err) {
        console.warn('Destroy on restart:', err.message);
    }

    client = null;
    await initializeClient(true);
    res.json({ success: true, initState, initError });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`WhatsApp Service running on port ${PORT}`);
});
