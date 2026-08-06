const express = require('express');
const router = express.Router();
const { askHomeChat } = require('../controllers/homeChatController');
const { protect } = require('../middleware/authMiddleware');

router.post('/ask', protect, askHomeChat);

module.exports = router;