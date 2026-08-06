const express = require('express');
const router = express.Router();
const { getSummary, getRevision, getCheatSheet } = require('../controllers/generationController');
const { protect } = require('../middleware/authMiddleware');

const { generationLimiter } = require('../middleware/rateLimitMiddleware');

router.get('/:materialId/summary', protect, generationLimiter, getSummary);
router.get('/:materialId/revision', protect, generationLimiter, getRevision);
router.get('/:materialId/cheatsheet', protect, generationLimiter, getCheatSheet);

module.exports = router;