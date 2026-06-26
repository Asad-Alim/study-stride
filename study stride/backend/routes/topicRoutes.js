const express = require('express');
const router = express.Router();
const { getTopics, getTopic, createTopic, deleteTopic } = require('../controllers/topicController');
const Material = require('../models/Material');
const Topic = require('../models/Topic');
const { extractTextFromBuffer } = require('../services/fileService');
const { uploadBuffer } = require('../services/cloudinaryService');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');
const path = require('path');

router.get('/', protect, getTopics);
router.get('/:id', protect, getTopic);
router.post('/', protect, createTopic);
router.delete('/:id', protect, deleteTopic);

// Append new file(s) to an existing topic — resets sections so they regenerate
router.post('/:id/add-material', protect, upload.array('files', 10), async (req, res) => {
  try {
    const topic = await Topic.findOne({ _id: req.params.id, userId: req.user.id });
    if (!topic) return res.status(404).json({ message: 'Topic not found' });

    const files = req.files || [];
    if (files.length === 0) return res.status(400).json({ message: 'No files uploaded' });

    for (const file of files) {
      const ext = path.extname(file.originalname).replace('.', '').toLowerCase();
      const text = await extractTextFromBuffer(file.buffer, ext);
      const cloudResult = await uploadBuffer(file.buffer, file.originalname);
      await Material.create({
        userId: req.user.id,
        topicId: topic._id,
        title: file.originalname,
        fileType: ext,
        filePath: cloudResult.secure_url,
        cloudinaryPublicId: cloudResult.public_id,
        extractedText: text,
      });
    }

    // Rebuild combinedText from ALL materials
    const allMaterials = await Material.find({ topicId: topic._id }).sort({ createdAt: 1 });
    const combinedText = allMaterials
      .map((m, i) => `\n\n===== Source ${i + 1}: ${m.title} =====\n\n${m.extractedText}`)
      .join('');

    await Topic.findByIdAndUpdate(topic._id, {
      combinedText,
      learningSections: [], // force regeneration with new content
      materials: allMaterials.map(m => m._id),
    });

    res.json({ message: 'Material added successfully', totalMaterials: allMaterials.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;