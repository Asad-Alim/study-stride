const express = require('express');
const router = express.Router();
const { generateSections, getSections, getSection, chat, completeSection, editSection, lockSection, lockAll } = require('../controllers/sectionController');
const { protect } = require('../middleware/authMiddleware');

router.post('/material/:materialId/generate', protect, generateSections);
router.get('/material/:materialId', protect, getSections);
router.get('/:id', protect, getSection);
router.post('/:id/chat', protect, chat);
router.post('/:id/complete', protect, completeSection);
router.post('/:id/edit', protect, editSection);
router.post('/:id/lock', protect, lockSection);
router.post('/material/:materialId/lock-all', protect, lockAll);

module.exports = router;