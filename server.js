import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { connectDB } from './config/db.js';
import { initWhatsApp, logout, handleSocketConnect } from './utils/whatsapp.js';
import templateRoutes from './routes/templates.js';
import contactRoutes from './routes/contacts.js';
import messageRoutes from './routes/messages.js';

const app = express();
const httpServer = createServer(app);

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Socket.IO configuration with CORS
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check Route
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'WhatsApp Automation Backend is running' });
});

// API Routes
app.use('/api/templates', templateRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/messages', messageRoutes);

// Logout endpoint
app.post('/api/logout', async (req, res) => {
  try {
    await logout();
    res.json({ success: true, message: 'Logged out' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('🔌 Socket connected:', socket.id);
  handleSocketConnect(socket);
  socket.on('disconnect', () => {
    console.log('🔌 Socket disconnected:', socket.id);
  });
});

// Start Server & Connect MongoDB
async function start() {
  try {
    httpServer.listen(PORT, () => {
      console.log(`\n🚀 Backend Server running at http://localhost:${PORT}`);
      console.log(`📡 Ready for frontend requests from ${CLIENT_URL}\n`);
    });

    initWhatsApp(io);
    console.log('📱 WhatsApp client initializing...');

    await connectDB();
  } catch (err) {
    console.error('❌ Server startup error:', err);
    process.exit(1);
  }
}

start();
