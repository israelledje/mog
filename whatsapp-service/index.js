const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');

const app = express();
app.use(express.json());

let qrCodeData = null;
let isConnected = false;

// Initialize WhatsApp client
const client = new Client({
    authStrategy: new LocalAuth({ dataPath: '/app/session' }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ]
    }
});

client.on('qr', (qr) => {
    console.log('QR Code Received');
    qrCodeData = qr;
});

client.on('ready', () => {
    console.log('WhatsApp Client is ready!');
    isConnected = true;
    qrCodeData = null; // Clear QR code as it's no longer needed
});

client.on('authenticated', () => {
    console.log('WhatsApp Authenticated');
});

client.on('auth_failure', msg => {
    console.error('WhatsApp Authentication failure', msg);
    isConnected = false;
});

client.on('disconnected', (reason) => {
    console.log('WhatsApp Client was logged out', reason);
    isConnected = false;
    client.initialize(); // Re-initialize to get a new QR code
});

client.initialize();

// API Endpoints
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', isConnected });
});

app.get('/qr', async (req, res) => {
    if (isConnected) {
        return res.json({ status: 'connected', qr: null });
    }
    if (!qrCodeData) {
        return res.json({ status: 'loading', qr: null });
    }
    try {
        const url = await qrcode.toDataURL(qrCodeData);
        res.json({ status: 'disconnected', qr: url });
    } catch (err) {
        res.status(500).json({ error: 'Failed to generate QR code' });
    }
});

app.get('/status', (req, res) => {
    res.json({ isConnected });
});

app.post('/send', async (req, res) => {
    if (!isConnected) {
        return res.status(503).json({ success: false, error: 'WhatsApp is not connected' });
    }
    
    const { to, message } = req.body;
    if (!to || !message) {
        return res.status(400).json({ success: false, error: 'Missing "to" or "message"' });
    }

    try {
        // WhatsApp numbers require the @c.us suffix
        const formattedNumber = to.replace('+', '').replace(/\s+/g, '') + '@c.us';
        const response = await client.sendMessage(formattedNumber, message);
        res.json({ success: true, messageId: response.id.id });
    } catch (err) {
        console.error('Failed to send message:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/logout', async (req, res) => {
    if (isConnected) {
        await client.logout();
        isConnected = false;
        qrCodeData = null;
        res.json({ success: true });
    } else {
        res.json({ success: false, error: 'Not connected' });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`WhatsApp Service running on port ${PORT}`);
});
