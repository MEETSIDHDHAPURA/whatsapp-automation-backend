import { Router } from 'express';
import { ContactList } from '../models/ContactList.js';

const router = Router();

// GET all contact lists
router.get('/', async (req, res) => {
  try {
    const lists = await ContactList.find().sort({ createdAt: -1 });
    res.json({
      success: true,
      data: lists.map(l => ({
        id: l._id.toString(),
        name: l.name,
        numbers: l.numbers,
        createdAt: l.createdAt
      }))
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET single contact list
router.get('/:id', async (req, res) => {
  try {
    const list = await ContactList.findById(req.params.id);
    if (!list) {
      return res.status(404).json({ success: false, error: 'Contact list not found' });
    }
    res.json({
      success: true,
      data: {
        id: list._id.toString(),
        name: list.name,
        numbers: list.numbers,
        createdAt: list.createdAt
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST create contact list
router.post('/', async (req, res) => {
  try {
    const { name, numbers } = req.body;
    if (!name || !numbers || !Array.isArray(numbers) || numbers.length === 0) {
      return res.status(400).json({ success: false, error: 'Name and a non-empty numbers array are required' });
    }
    const list = new ContactList({ name, numbers });
    await list.save();

    res.status(201).json({
      success: true,
      data: {
        id: list._id.toString(),
        name: list.name,
        numbers: list.numbers,
        createdAt: list.createdAt
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT update contact list
router.put('/:id', async (req, res) => {
  try {
    const { name, numbers } = req.body;
    if (!name || !numbers || !Array.isArray(numbers)) {
      return res.status(400).json({ success: false, error: 'Name and numbers array are required' });
    }
    const list = await ContactList.findById(req.params.id);
    if (!list) {
      return res.status(404).json({ success: false, error: 'Contact list not found' });
    }
    list.name = name;
    list.numbers = numbers;
    await list.save();

    res.json({
      success: true,
      data: {
        id: list._id.toString(),
        name: list.name,
        numbers: list.numbers,
        createdAt: list.createdAt
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE contact list
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await ContactList.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Contact list not found' });
    }
    res.json({ success: true, message: 'Contact list deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
