const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const Topic = require('../models/Topic');
const Evaluation = require('../models/Evaluation');
const Material = require('../models/Material');
const Chunk = require('../models/Chunk');
const gemini = require('../services/geminiService');
const { getGenerationInput } = require('../services/inputSourceService');
const { embedText } = require('../services/embeddingService');
const { searchByTopic } = require('../services/vectorSearchService');
const { retrieveRelevantChunks } = require('../services/retrievalService');

const generateQuiz = async (req, res) => {
  try {
    const { materialId: topicId } = req.params;
    const topic = await Topic.findOne({ _id: topicId, userId: req.user.id });
    if (!topic) return res.status(404).json({ message: 'Topic not found' });
    if (!topic.combinedText || !topic.combinedText.trim()) {
      return res.status(400).json({ message: 'No study material found for this topic. Please upload a file first.' });
    }
    const inputText = await getGenerationInput(topic);
    const generated = await gemini.generateQuiz(inputText);

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

    // RAG: grade against the most relevant chunks instead of the full
    // document (design doc item 16) — same retrieval pipeline chat/sections
    // already use. Falls back to combinedText if nothing is indexed yet.
    let referenceContent = topic.combinedText;
    const chunkCount = await Chunk.countDocuments({ topicId: topic._id });
    if (chunkCount > 0) {
      const queryEmbedding = await embedText(`${question}\n\n${studentAnswer}`, 'RETRIEVAL_QUERY');
      const results = await retrieveRelevantChunks(searchByTopic, topic._id, queryEmbedding, question);
      if (results.length > 0) {
        referenceContent = results.map(r => r.text).join('\n\n---\n\n');
      }
    }

    const result = await gemini.evaluateAnswer(question, studentAnswer, referenceContent);

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

// Item 14: is there material added after the current quiz was generated?
// generateQuiz already deletes+regenerates on every call, so this is purely
// informational for the "regenerate?" prompt — no force flag needed here.
const checkStale = async (req, res) => {
  try {
    const { materialId: topicId } = req.params;
    const quiz = await Quiz.findOne({ materialId: topicId, userId: req.user.id });
    if (!quiz) return res.json({ stale: false }); // nothing generated yet

    const newerMaterial = await Material.countDocuments({ topicId, createdAt: { $gt: quiz.createdAt } });
    res.json({ stale: newerMaterial > 0 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { generateQuiz, getQuiz, submitAttempt, evaluateAnswer, checkStale };