const express = require('express');
const router = express.Router();
const { getSections, getSection, chat, completeSection, editSection, updateNoteBlock, regenerateStaleSection, lockSection, lockAll } = require('../controllers/sectionController');
const { protect } = require('../middleware/authMiddleware');

router.get('/material/:materialId', protect, getSections);
router.get('/:id', protect, getSection);
router.post('/:id/chat', protect, chat);
router.post('/:id/complete', protect, completeSection);
router.post('/:id/edit', protect, editSection);
router.post('/:id/update-note', protect, updateNoteBlock);
router.post('/:id/regenerate-stale', protect, regenerateStaleSection);
router.post('/:id/lock', protect, lockSection);
router.post('/material/:materialId/lock-all', protect, lockAll);

module.exports = router;