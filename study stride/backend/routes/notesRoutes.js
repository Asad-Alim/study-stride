const express = require('express');
const router = express.Router();
const { generateNotes, getNotes, getAllNotes, generateAndGetNotes, updateSection, regenerateSection, approveNotes, generateNextNotesBatch, notesQueueStatus } = require('../controllers/notesController');
const { protect } = require('../middleware/authMiddleware');
const Notes = require('../models/Notes');
const gemini = require('../services/geminiService');

// ── Static routes FIRST (before any /:param routes) ──────────────────────────

router.post('/generate-page', protect, async (req, res) => {
  try {
    const { pageContent, chatMessages, declaredLevel, strictMode } = req.body;
    const notes = await gemini.generateNotesFromLearning(pageContent, chatMessages || [], declaredLevel, strictMode !== false);
    res.json({ notes });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/update-with-ai', protect, async (req, res) => {
  try {
    const { currentNotes, instruction, pageContent, chatContext } = req.body;
    const notes = await gemini.updateNotesFromInstruction(currentNotes, instruction, pageContent, chatContext || '');
    res.json({ notes });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Parameterised routes after ────────────────────────────────────────────────

router.post('/:materialId/page/:page/generate', protect, generateNotes);
router.get('/:materialId/page/:page', protect, getNotes);
router.get('/:materialId/all', protect, getAllNotes);
router.put('/:notesId/section/:sectionIndex', protect, updateSection);
router.post('/:notesId/section/:sectionIndex/regenerate', protect, regenerateSection);
router.put('/:notesId/approve', protect, approveNotes);

// Queue-based notes generation (item 10/11) — independent progress from
// learning sections' generate-next-batch.
router.post('/:topicId/generate-next-batch', protect, generateNextNotesBatch);
router.get('/:topicId/queue-status', protect, notesQueueStatus);

// Save a single section's notes immediately after generation
router.post('/:materialId/save-section', protect, async (req, res) => {
  try {
    const { pageNumber, content, heading } = req.body;
    const topicId = req.params.materialId;

    let notes = await Notes.findOne({ materialId: topicId, userId: req.user.id, pageNumber });
    if (notes) {
      notes.content = content;
      notes.heading = heading;
      notes.status = 'draft';
      await notes.save();
    } else {
      notes = await Notes.create({
        materialId: topicId,
        userId: req.user.id,
        pageNumber,
        content,
        sections: [{ heading: heading || `Section ${pageNumber}`, content, importance: 'general' }],
        status: 'draft',
      });
    }
    res.json(notes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:materialId/save', protect, async (req, res) => {
  try {
    const { content, sections } = req.body;
    const existing = await Notes.findOne({ materialId: req.params.materialId, userId: req.user.id, pageNumber: 1 });
    if (existing) {
      if (content !== undefined) existing.content = content;
      if (sections !== undefined) existing.sections = sections;
      existing.status = 'approved';
      await existing.save();
      return res.json(existing);
    }
    const newNotes = await Notes.create({
      materialId: req.params.materialId,
      userId: req.user.id,
      pageNumber: 1,
      content: content || '',
      sections: sections || [],
      status: 'approved',
    });
    res.status(201).json(newNotes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:materialId/generate-and-get', protect, generateAndGetNotes);

module.exports = router;