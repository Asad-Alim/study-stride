// PATH: backend/routes/learningRoutes.js
const express = require('express');
const router = express.Router();
const { getChunk, regenerateSections, askQuestion } = require('../controllers/learningController');
const { protect } = require('../middleware/authMiddleware');

router.get('/:materialId/chunk/:page', protect, getChunk);
router.post('/:materialId/regenerate-sections', protect, regenerateSections);
router.post('/ask', protect, askQuestion);

module.exports = router;