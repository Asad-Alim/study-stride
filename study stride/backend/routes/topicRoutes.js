const express = require('express');
const router = express.Router();
const { getTopics, getTopic, createTopic, deleteTopic } = require('../controllers/topicController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getTopics);
router.get('/:id', protect, getTopic);
router.post('/', protect, createTopic);
router.delete('/:id', protect, deleteTopic);

module.exports = router;