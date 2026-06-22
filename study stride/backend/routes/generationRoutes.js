const express = require('express');
const router = express.Router();
const { getSummary, getRevision, getCheatSheet } = require('../controllers/generationController');
const { protect } = require('../middleware/authMiddleware');

router.get('/:materialId/summary', protect, getSummary);
router.get('/:materialId/revision', protect, getRevision);
router.get('/:materialId/cheatsheet', protect, getCheatSheet);

module.exports = router;