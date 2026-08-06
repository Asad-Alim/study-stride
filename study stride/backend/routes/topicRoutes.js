const express = require('express');
const router = express.Router();
const { getTopics, getTopic, createTopic, deleteTopic, queueStatus, updateStrictMode } = require('../controllers/topicController');
const { generateNextBatch } = require('../controllers/sectionController');
const Material = require('../models/Material');
const Topic = require('../models/Topic');
const { ingestMaterial } = require('../services/ragService');

const { extractTextFromBuffer } = require('../services/fileService');
const { uploadBuffer } = require('../services/cloudinaryService');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');
const path = require('path');

router.get('/', protect, getTopics);
router.get('/:id', protect, getTopic);
router.post('/', protect, createTopic);
router.delete('/:id', protect, deleteTopic);

router.get('/:topicId/queue-status', protect, queueStatus);
router.patch('/:topicId/strict-mode', protect, updateStrictMode);
router.post('/:topicId/sections/generate-next', protect, generateNextBatch);

// Append new file(s) to an existing topic — additive: existing ConceptSections
// and queue progress are left untouched, new pages just join the pending queue.
router.post('/:id/add-material', protect, upload.array('files', 10), async (req, res) => {
  try {
    const topic = await Topic.findOne({ _id: req.params.id, userId: req.user.id });
    if (!topic) return res.status(404).json({ message: 'Topic not found' });

    const files = req.files || [];
    if (files.length === 0) return res.status(400).json({ message: 'No files uploaded' });

    for (const file of files) {
      const ext = path.extname(file.originalname).replace('.', '').toLowerCase();
      const { pages } = await extractTextFromBuffer(file.buffer, ext);
      const cloudResult = await uploadBuffer(file.buffer, file.originalname);
      const material = await Material.create({
        userId: req.user.id,
        topicId: topic._id,
        title: file.originalname,
        fileType: ext,
        filePath: cloudResult.secure_url,
        cloudinaryPublicId: cloudResult.public_id,
        pages,
        totalPages: pages.length,
        totalChars: pages.reduce((sum, p) => sum + p.charCount, 0),
        pagesProcessed: 0,
      });

      ingestMaterial(material).catch(err => console.error('ingestMaterial error:', err));
    }

    // combinedText still backs other features (flashcards/quiz/notes) — keep in sync.
    const allMaterials = await Material.find({ topicId: topic._id }).sort({ createdAt: 1 });
    const combinedText = allMaterials
      .map((m, i) => `\n\n===== Source ${i + 1}: ${m.title} =====\n\n${(m.pages || []).map(p => p.text).join('\n\n')}`)
      .join('');

    await Topic.findByIdAndUpdate(topic._id, {
      combinedText,
      materials: allMaterials.map(m => m._id),
    });

    res.json({ message: 'Material added successfully', totalMaterials: allMaterials.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;