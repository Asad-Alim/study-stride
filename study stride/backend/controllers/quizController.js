const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const Topic = require('../models/Topic');
const Evaluation = require('../models/Evaluation');
const gemini = require('../services/geminiService');

const generateQuiz = async (req, res) => {
  try {
    const { materialId: topicId } = req.params;
    const topic = await Topic.findOne({ _id: topicId, userId: req.user.id });
    if (!topic) return res.status(404).json({ message: 'Topic not found' });
    if (!topic.combinedText || !topic.combinedText.trim()) {
      return res.status(400).json({ message: 'No study material found for this topic. Please upload a file first.' });
    }
    const generated = await gemini.generateQuiz(topic.combinedText);

    // Delete old quiz so every generate call gives fresh questions
    await Quiz.findOneAndDelete({ materialId: topicId, userId: req.user.id });

    const quiz = await Quiz.create({ materialId: topicId, userId: req.user.id, questions: generated.questions });
    res.status(201).json(quiz);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findOne({ materialId: req.params.materialId, userId: req.user.id });
    if (!quiz) return res.status(404).json({ message: 'Quiz not found' });
    res.json(quiz);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const submitAttempt = async (req, res) => {
  try {
    const { quizId, answers, score, total } = req.body;
    const attempt = await QuizAttempt.create({ userId: req.user.id, quizId, answers, score, total });
    res.status(201).json(attempt);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const evaluateAnswer = async (req, res) => {
  try {
    const { question, studentAnswer, materialId: topicId } = req.body;
    const topic = await Topic.findOne({ _id: topicId, userId: req.user.id });
    if (!topic) return res.status(404).json({ message: 'Topic not found' });

    const result = await gemini.evaluateAnswer(question, studentAnswer, topic.combinedText);

    await Evaluation.create({
      userId: req.user.id,
      materialId: topicId,
      question,
      studentAnswer,
      ...result,
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { generateQuiz, getQuiz, submitAttempt, evaluateAnswer };