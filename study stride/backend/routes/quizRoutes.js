const express = require('express');
const router = express.Router();
const { generateQuiz, getQuiz, submitAttempt, evaluateAnswer } = require('../controllers/quizController');
const { protect } = require('../middleware/authMiddleware');

router.post('/attempt', protect, submitAttempt);
router.post('/evaluate', protect, evaluateAnswer);
router.post('/:materialId/generate', protect, generateQuiz);
router.get('/:materialId', protect, getQuiz);

module.exports = router;