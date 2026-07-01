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
let isAuthenticated = false;
let initState = 'starting'; // starting | waiting_qr | authenticating | connected | error
let initError = null;
let client = null;
let initializing = false;
let readyWatchdog = null;

function markConnected(source = 'ready') {
    isConnected = true;
    isAuthenticated = true;
    initState = 'connected';
    initError = null;
    qrCodeData = null;
    if (readyWatchdog) {
        clearTimeout(readyWatchdog);
        readyWatchdog = null;
    }
    console.log(`WhatsApp Client is ready (${source})`);
}

async function waitForConnectedState(waClient) {
    for (let attempt = 0; attempt < 45; attempt++) {
        if (isConnected) return;

        try {
            const state = await waClient.getState();
            console.log(`WhatsApp state check ${attempt + 1}/45: ${state}`);
            if (state === 'CONNECTED') {
                markConnected('state');
                return;
            }
        } catch (err) {
            console.log(`WhatsApp state not available yet (${attempt + 1}/45)`);
        }

        await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    console.error('Timed out waiting for WhatsApp ready after authentication');
    initState = 'error';
    initError = 'Session authentifiée mais connexion non établie. Cliquez sur « Déconnecter » ou redémarrez le service.';
}

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

function normalizeWhatsAppDigits(to) {
    return String(to || '').replace(/[^\d]/g, '');
}

async function resolveWhatsAppChatId(waClient, to) {
    const digits = normalizeWhatsAppDigits(to);
    if (!digits) {
        return null;
    }

    const numberId = await waClient.getNumberId(`${digits}@c.us`);
    return numberId?._serialized || null;
}

let authWatchStarted = false;

function attachClientEvents(waClient) {
    waClient.removeAllListeners();

    waClient.on('qr', (qr) => {
        console.log('QR Code received');
        qrCodeData = qr;
        initState = 'waiting_qr';
        initError = null;
    });

    waClient.on('ready', () => {
        markConnected('ready');
    });

    waClient.on('authenticated', () => {
        console.log('WhatsApp authenticated');
        isAuthenticated = true;
        initState = 'authenticating';
        initError = null;
        if (!authWatchStarted) {
            authWatchStarted = true;
            waitForConnectedState(waClient).finally(() => {
                authWatchStarted = false;
            });
        }
    });

    waClient.on('loading_screen', (percent, message) => {
        console.log(`WhatsApp loading: ${percent}% ${message || ''}`.trim());
        if (!isConnected && isAuthenticated) {
            initState = 'authenticating';
        }
    });

    waClient.on('auth_failure', (msg) => {
        console.error('WhatsApp authentication failure:', msg);
        isConnected = false;
        isAuthenticated = false;
        initState = 'error';
        initError = String(msg || 'Authentication failed');
        qrCodeData = null;
    });

    waClient.on('disconnected', (reason) => {
        console.log('WhatsApp disconnected:', reason);
        isConnected = false;
        isAuthenticated = false;
        authWatchStarted = false;
        qrCodeData = null;
        initState = 'starting';
        setTimeout(() => initializeClient(true), 5000);
    });
}

async function initializeClient(force = false) {
    if (initializing && !force) return;
    if (isConnected) return;

    initializing = true;
    initState = 'starting';
    initError = null;
    qrCodeData = null;
    isAuthenticated = false;
    authWatchStarted = false;

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
    res.json({ status: 'healthy', isConnected, isAuthenticated, initState, initError });
});

app.get('/status', (req, res) => {
    res.json({ isConnected, isAuthenticated, initState, initError, hasQr: Boolean(qrCodeData) });
});

app.get('/qr', async (req, res) => {
    if (isConnected) {
        return res.json({ status: 'connected', qr: null, initState, initError, isAuthenticated });
    }

    if (initState === 'authenticating') {
        return res.json({ status: 'loading', qr: null, initState, initError, isAuthenticated, message: 'Finalisation de la connexion WhatsApp...' });
    }

    if (initState === 'error') {
        return res.json({ status: 'error', qr: null, initState, initError, isAuthenticated });
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
        return res.status(503).json({ success: false, error: 'WhatsApp is not connected', code: 'NOT_CONNECTED' });
    }

    const { to, message } = req.body;
    if (!to || !message) {
        return res.status(400).json({ success: false, error: 'Missing "to" or "message"' });
    }

    const digits = normalizeWhatsAppDigits(to);
    if (digits.length < 8 || digits.length > 15) {
        return res.status(400).json({ success: false, error: 'Invalid phone number', code: 'INVALID_NUMBER' });
    }

    try {
        const chatId = await resolveWhatsAppChatId(client, to);
        if (!chatId) {
            console.warn(`WhatsApp number not registered: +${digits}`);
            return res.status(404).json({
                success: false,
                error: 'Number not registered on WhatsApp',
                code: 'NOT_ON_WHATSAPP',
                to: `+${digits}`,
            });
        }

        console.log(`Sending WhatsApp message to ${chatId}`);
        const response = await client.sendMessage(chatId, message);
        const messageId = response?.id?.id || response?.id?._serialized || null;
        console.log(`WhatsApp message queued: ${messageId || 'unknown id'}`);
        res.json({ success: true, messageId, to: chatId });
    } catch (err) {
        console.error('Failed to send message:', err);
        res.status(500).json({ success: false, error: err.message, code: 'SEND_FAILED' });
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
    isAuthenticated = false;
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
    isAuthenticated = false;
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
