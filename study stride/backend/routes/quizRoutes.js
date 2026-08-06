const express = require('express');
const router = express.Router();
const { generateQuiz, getQuiz, submitAttempt, evaluateAnswer, checkStale } = require('../controllers/quizController');
const { protect } = require('../middleware/authMiddleware');
const { generationLimiter } = require('../middleware/rateLimitMiddleware');
const gemini = require('../services/geminiService');

router.post('/attempt', protect, submitAttempt);
router.post('/evaluate', protect, evaluateAnswer);

// NEW: generate a mini quiz from just one section's content (between-section popup)
router.post('/section-quiz', protect, generationLimiter, async (req, res) => {
  try {
    const { sectionContent, sectionHeading, declaredLevel } = req.body;
    if (!sectionContent) return res.status(400).json({ message: 'sectionContent required' });
    const quiz = await gemini.generateSectionQuiz(sectionContent, sectionHeading, declaredLevel);
    res.json(quiz);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:materialId/generate', protect, generationLimiter, generateQuiz);
router.get('/:materialId/stale-check', protect, checkStale);
router.get('/:materialId', protect, getQuiz);

module.exports = router;