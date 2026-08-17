import { Router } from 'express';
import multer from 'multer';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';
import { getStatus, sendBulkMessages, getTodayMessageCount } from '../utils/whatsapp.js';
import { Template } from '../models/Template.js';
import { ContactList } from '../models/ContactList.js';
import { MessageHistory } from '../models/MessageHistory.js';
import { v4 as uuidv4 } from 'uuid';

const __dirname = dirname(fileURLToPath(import.meta.url));
const uploadsDir = join(__dirname, '..', 'uploads');

if (!existsSync(uploadsDir)) {
  mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = file.originalname.split('.').pop();
    cb(null, `${uuidv4()}.${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 16 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'application/pdf',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not supported. Allowed: JPG, PNG, GIF, WebP, MP4, PDF, DOC'));
    }
  }
});

const router = Router();

// GET WhatsApp connection status
router.get('/status', (req, res) => {
  const status = getStatus();
  res.json({ success: true, data: status });
});

// GET message history
router.get('/history', async (req, res) => {
  try {
    const history = await MessageHistory.find().sort({ sentAt: -1 });
    res.json({
      success: true,
      data: history.map(h => ({
        id: h._id.toString(),
        templateName: h.templateName,
        contactListName: h.contactListName,
        totalNumbers: h.totalNumbers,
        message: h.message,
        sentAt: h.sentAt,
        completedAt: h.completedAt,
        results: h.results
      }))
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET today's message count
router.get('/today-count', async (req, res) => {
  try {
    const count = await getTodayMessageCount();
    res.json({ success: true, data: { count, limit: 200 } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST send bulk messages (supports optional image upload)
router.post('/send', upload.single('image'), async (req, res) => {
  try {
    let numbers = req.body.numbers;
    const message = req.body.message;
    const templateId = req.body.templateId;
    let variables = req.body.variables;
    const contactListId = req.body.contactListId;
    const minDelay = req.body.minDelay ? parseInt(req.body.minDelay) : undefined;
    const maxDelay = req.body.maxDelay ? parseInt(req.body.maxDelay) : undefined;

    if (typeof numbers === 'string') {
      try { numbers = JSON.parse(numbers); } catch (e) { numbers = []; }
    }
    if (typeof variables === 'string') {
      try { variables = JSON.parse(variables); } catch (e) { variables = {}; }
    }

    const mediaPath = req.file ? req.file.path : null;

    let finalMessage = message || '';
    let templateName = 'Custom Message';
    let contactListName = 'Manual Entry';

    if (templateId) {
      const template = await Template.findById(templateId);
      if (!template) {
        return res.status(404).json({ success: false, error: 'Template not found' });
      }
      templateName = template.name;
      finalMessage = template.content;

      if (variables && typeof variables === 'object') {
        for (const [key, value] of Object.entries(variables)) {
          finalMessage = finalMessage.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
        }
      }
    }

    if (!finalMessage && !mediaPath) {
      return res.status(400).json({ success: false, error: 'Message content or image is required' });
    }

    let targetNumbers = numbers || [];

    if (contactListId) {
      const contactList = await ContactList.findById(contactListId);
      if (!contactList) {
        return res.status(404).json({ success: false, error: 'Contact list not found' });
      }
      contactListName = contactList.name;
      targetNumbers = contactList.numbers;
    }

    if (!targetNumbers || targetNumbers.length === 0) {
      return res.status(400).json({ success: false, error: 'No numbers provided' });
    }

    const status = getStatus();
    if (status.status !== 'connected') {
      return res.status(400).json({ success: false, error: 'WhatsApp is not connected' });
    }

    // Create MongoDB message record
    const record = new MessageHistory({
      templateName,
      contactListName,
      totalNumbers: targetNumbers.length,
      message: finalMessage || '(Image only)',
      sentAt: new Date()
    });
    await record.save();

    const sessionId = record._id.toString();

    // Respond immediately
    res.json({
      success: true,
      data: {
        sessionId,
        totalNumbers: targetNumbers.length,
        message: 'Sending started'
      }
    });

    // Process sending in background
    const results = await sendBulkMessages(targetNumbers, finalMessage, {
      minDelay: minDelay || 3000,
      maxDelay: maxDelay || 7000,
      sessionId,
      mediaPath
    });

    // Update MongoDB record with final results
    record.results = results;
    record.completedAt = new Date();
    await record.save();

  } catch (err) {
    console.error('Send error:', err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
});

export default router;
