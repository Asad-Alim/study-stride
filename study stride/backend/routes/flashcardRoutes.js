const express = require('express');
const router = express.Router();
const { generateFlashcards, getFlashcards, checkStale } = require('../controllers/flashcardController');
const { protect } = require('../middleware/authMiddleware');
const { generationLimiter } = require('../middleware/rateLimitMiddleware');

router.post('/:materialId/generate', protect, generationLimiter, generateFlashcards);
router.get('/:materialId/stale-check', protect, checkStale);
router.get('/:materialId', protect, getFlashcards);

module.exports = router;