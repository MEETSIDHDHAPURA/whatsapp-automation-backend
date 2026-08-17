import pkg from 'whatsapp-web.js';
const { Client, NoAuth, MessageMedia } = pkg;
import QRCode from 'qrcode';
import { MessageHistory } from '../models/MessageHistory.js';

import { existsSync } from 'fs';

let client = null;
let io = null;
let connectionStatus = 'disconnected';
let connectedPhone = null;
let latestQrCode = null;
let lastInitError = null;

const DAILY_LIMIT = 200;

function getChromePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  const possiblePaths = [
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
  ];
  for (const p of possiblePaths) {
    if (existsSync(p)) return p;
  }
  return undefined;
}

export async function getTodayMessageCount() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const records = await MessageHistory.find({
    sentAt: { $gte: startOfDay }
  });

  let count = 0;
  for (const record of records) {
    if (record.results && Array.isArray(record.results)) {
      count += record.results.filter(r => r.status === 'sent').length;
    }
  }
  return count;
}

export function initWhatsApp(socketIO) {
  io = socketIO;

  client = new Client({
    authStrategy: new NoAuth(),
    webVersionCache: {
      type: 'remote',
      remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
    },
    takeoverOnConflict: true,
    takeoverTimeoutMs: 0,
    puppeteer: {
      headless: true,
      executablePath: getChromePath(),
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-breakpad',
        '--disable-component-extensions-with-background-pages',
        '--disable-default-apps',
        '--disable-features=Translate,BackForwardCache,AcceptCHFrame,MediaRouter,OptimizationHints',
        '--disable-ipc-flooding-protection',
        '--disable-renderer-backgrounding',
        '--metrics-recording-only',
        '--mute-audio'
      ]
    }
  });

  client.on('qr', async (qr) => {
    console.log('🔲 QR code received');
    connectionStatus = 'waiting_qr';
    try {
      const qrDataUrl = await QRCode.toDataURL(qr, {
        width: 280,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' }
      });
      latestQrCode = qrDataUrl;
      io.emit('qr', qrDataUrl);
      io.emit('status', { status: 'waiting_qr', message: 'Scan QR code with your phone', qr: qrDataUrl });
    } catch (err) {
      console.error('QR generation error:', err);
    }
  });

  client.on('authenticated', () => {
    console.log('✅ Authenticated');
    connectionStatus = 'authenticated';
    latestQrCode = null;
    io.emit('status', { status: 'authenticated', message: 'Authenticated successfully' });
  });

  client.on('ready', async () => {
    console.log('✅ WhatsApp client is ready!');
    connectionStatus = 'connected';
    latestQrCode = null;
    try {
      const info = client.info;
      connectedPhone = info.wid.user;
      io.emit('status', {
        status: 'connected',
        message: 'WhatsApp connected',
        phone: connectedPhone
      });
    } catch (e) {
      io.emit('status', { status: 'connected', message: 'WhatsApp connected' });
    }
  });

  client.on('disconnected', (reason) => {
    console.log('❌ Disconnected:', reason);
    connectionStatus = 'disconnected';
    connectedPhone = null;
    latestQrCode = null;
    io.emit('status', { status: 'disconnected', message: `Disconnected: ${reason}` });
    setTimeout(() => {
      if (client) {
        try { client.destroy(); } catch (e) {}
        client = null;
      }
      initWhatsApp(io);
    }, 2000);
  });

  client.on('auth_failure', (msg) => {
    console.error('❌ Auth failure:', msg);
    connectionStatus = 'auth_failure';
    latestQrCode = null;
    io.emit('status', { status: 'auth_failure', message: 'Authentication failed. Generating new QR...' });
    setTimeout(() => {
      if (client) {
        try { client.destroy(); } catch (e) {}
        client = null;
      }
      initWhatsApp(io);
    }, 2000);
  });

  client.initialize().catch(err => {
    lastInitError = err.message || String(err);
    console.error('Client initialization error:', err);
    io.emit('status', { status: 'error', message: `Failed to initialize WhatsApp client: ${lastInitError}` });
  });

  return client;
}

export function getDebugInfo() {
  return {
    status: connectionStatus,
    phone: connectedPhone,
    hasQr: !!latestQrCode,
    lastError: lastInitError,
    detectedChromePath: getChromePath(),
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    memoryUsageMB: Math.round(process.memoryUsage().rss / 1024 / 1024)
  };
}

export async function reconnectWhatsApp() {
  if (client) {
    try {
      await client.destroy();
    } catch (e) {
      console.error('Destroy error:', e);
    }
    client = null;
  }
  connectionStatus = 'disconnected';
  connectedPhone = null;
  latestQrCode = null;
  if (io) {
    io.emit('status', { status: 'disconnected', message: 'Reconnecting WhatsApp...' });
  }
  return initWhatsApp(io);
}

export function handleSocketConnect(socket) {
  socket.emit('status', {
    status: connectionStatus,
    message: connectionStatus === 'waiting_qr' ? 'Scan QR code with your phone' : `Status: ${connectionStatus}`,
    phone: connectedPhone,
    qr: latestQrCode
  });
  if (connectionStatus === 'waiting_qr' && latestQrCode) {
    socket.emit('qr', latestQrCode);
  }
}

export function getStatus() {
  return {
    status: connectionStatus,
    phone: connectedPhone,
    qr: latestQrCode,
    error: lastInitError
  };
}

export async function sendMessage(number, message, mediaPath = null) {
  if (connectionStatus !== 'connected') {
    throw new Error('WhatsApp is not connected');
  }

  const chatId = `${number}@c.us`;
  try {
    if (mediaPath) {
      const media = MessageMedia.fromFilePath(mediaPath);
      await client.sendMessage(chatId, media, { caption: message });
    } else {
      await client.sendMessage(chatId, message);
    }
    return { number, status: 'sent', timestamp: new Date() };
  } catch (err) {
    return { number, status: 'failed', error: err.message, timestamp: new Date() };
  }
}

export async function sendBulkMessages(numbers, message, options = {}) {
  if (connectionStatus !== 'connected') {
    throw new Error('WhatsApp is not connected');
  }

  const minDelay = options.minDelay || 3000;
  const maxDelay = options.maxDelay || 7000;
  const sessionId = options.sessionId || 'bulk';

  // Check daily limit
  const todayCount = await getTodayMessageCount();
  if (todayCount >= DAILY_LIMIT) {
    io.emit('bulk_error', {
      sessionId,
      message: `Daily limit of ${DAILY_LIMIT} messages reached. Try again tomorrow.`
    });
    return [];
  }

  const remaining = DAILY_LIMIT - todayCount;
  const toSend = numbers.slice(0, remaining);

  if (toSend.length < numbers.length) {
    io.emit('bulk_warning', {
      sessionId,
      message: `Only sending to ${toSend.length} of ${numbers.length} numbers due to daily limit.`
    });
  }

  const results = [];
  const sentToday = new Set();

  for (let i = 0; i < toSend.length; i++) {
    const number = toSend[i];

    // Skip duplicates within session
    if (sentToday.has(number)) {
      const result = { number, status: 'skipped', reason: 'duplicate', timestamp: new Date() };
      results.push(result);
      io.emit('bulk_progress', {
        sessionId,
        current: i + 1,
        total: toSend.length,
        result
      });
      continue;
    }

    const result = await sendMessage(number, message, options.mediaPath || null);
    results.push(result);
    sentToday.add(number);

    io.emit('bulk_progress', {
      sessionId,
      current: i + 1,
      total: toSend.length,
      result
    });

    // Random delay between messages
    if (i < toSend.length - 1) {
      const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  io.emit('bulk_complete', {
    sessionId,
    total: toSend.length,
    sent: results.filter(r => r.status === 'sent').length,
    failed: results.filter(r => r.status === 'failed').length,
    skipped: results.filter(r => r.status === 'skipped').length
  });

  return results;
}

export async function logout() {
  if (client) {
    try {
      await client.logout();
      await client.destroy();
    } catch (e) {
      console.error('Logout error:', e);
    }
    client = null;
    connectionStatus = 'disconnected';
    connectedPhone = null;
    latestQrCode = null;
    io.emit('status', { status: 'disconnected', message: 'Logged out successfully' });

    setTimeout(() => {
      initWhatsApp(io);
    }, 1000);
  }
}
