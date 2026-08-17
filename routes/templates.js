import { Router } from 'express';
import { Template } from '../models/Template.js';

const router = Router();

// GET all templates
router.get('/', async (req, res) => {
  try {
    const templates = await Template.find().sort({ createdAt: -1 });
    res.json({
      success: true,
      data: templates.map(t => ({
        id: t._id.toString(),
        name: t.name,
        content: t.content,
        variables: t.variables,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt
      }))
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET single template
router.get('/:id', async (req, res) => {
  try {
    const template = await Template.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }
    res.json({
      success: true,
      data: {
        id: template._id.toString(),
        name: template.name,
        content: template.content,
        variables: template.variables,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST create template
router.post('/', async (req, res) => {
  try {
    const { name, content } = req.body;
    if (!name || !content) {
      return res.status(400).json({ success: false, error: 'Name and content are required' });
    }
    const template = new Template({ name, content });
    await template.save();

    res.status(201).json({
      success: true,
      data: {
        id: template._id.toString(),
        name: template.name,
        content: template.content,
        variables: template.variables,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT update template
router.put('/:id', async (req, res) => {
  try {
    const { name, content } = req.body;
    if (!name || !content) {
      return res.status(400).json({ success: false, error: 'Name and content are required' });
    }
    const template = await Template.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }
    template.name = name;
    template.content = content;
    await template.save();

    res.json({
      success: true,
      data: {
        id: template._id.toString(),
        name: template.name,
        content: template.content,
        variables: template.variables,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE template
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Template.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }
    res.json({ success: true, message: 'Template deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
