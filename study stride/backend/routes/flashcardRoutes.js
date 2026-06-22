const express = require('express');
const router = express.Router();
const { generateFlashcards, getFlashcards } = require('../controllers/flashcardController');
const { protect } = require('../middleware/authMiddleware');

router.post('/:materialId/generate', protect, generateFlashcards);
router.get('/:materialId', protect, getFlashcards);

module.exports = router;