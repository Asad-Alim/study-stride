const Topic = require('../models/Topic');
const Material = require('../models/Material');
const Chunk = require('../models/Chunk');
const ConceptSection = require('../models/ConceptSection');
const Flashcard = require('../models/Flashcard');
const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const Evaluation = require('../models/Evaluation');
const GeneratedContent = require('../models/GeneratedContent');
const { deleteFile } = require('../services/cloudinaryService');

const getTopics = async (req, res) => {
  try {
    const topics = await Topic.find({ userId: req.user.id }).sort({ createdAt: -1 }).select('-combinedText');
    res.json(topics);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getTopic = async (req, res) => {
  try {
    const topic = await Topic.findOne({ _id: req.params.id, userId: req.user.id }).select('-combinedText');
    if (!topic) return res.status(404).json({ message: 'Topic not found' });
    const materials = await Material.find({ topicId: topic._id });
    res.json({ ...topic.toObject(), materialDetails: materials });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createTopic = async (req, res) => {
  try {
    const { title, subject } = req.body;
    if (!title) return res.status(400).json({ message: 'Title is required' });
    const topic = await Topic.create({ userId: req.user.id, title, subject: subject || '' });
    res.status(201).json(topic);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteTopic = async (req, res) => {
  try {
    const topic = await Topic.findOne({ _id: req.params.id, userId: req.user.id });
    if (!topic) return res.status(404).json({ message: 'Topic not found' });

    const materials = await Material.find({ topicId: topic._id });
    const materialIds = materials.map(m => m._id);
    const quizzes = await Quiz.find({ materialId: { $in: materialIds } });
    const quizIds = quizzes.map(q => q._id);

    // 1. Cloudinary files first — log failures instead of losing track of
    // orphaned remote files, but don't let one failure block DB cleanup.
    for (const material of materials) {
      if (material.cloudinaryPublicId) {
        try {
          await deleteFile(material.cloudinaryPublicId);
        } catch (err) {
          console.error(`Cascade delete: failed to delete Cloudinary file ${material.cloudinaryPublicId} for material ${material._id}:`, err.message);
        }
      }
    }

    // 2. DB documents, in dependency order.
    await QuizAttempt.deleteMany({ quizId: { $in: quizIds } });
    await Quiz.deleteMany({ materialId: { $in: materialIds } });
    await Evaluation.deleteMany({ materialId: { $in: materialIds } });
    await GeneratedContent.deleteMany({ materialId: { $in: materialIds } });
    await Flashcard.deleteMany({ materialId: { $in: materialIds } });
    await ConceptSection.deleteMany({ topicId: topic._id });
    await Chunk.deleteMany({ topicId: topic._id });
    await Material.deleteMany({ topicId: topic._id });

    // 3. The topic itself.
    await Topic.findByIdAndDelete(topic._id);

    res.json({ message: 'Topic deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const { getPendingQueue } = require('../services/queueService');

const queueStatus = async (req, res) => {
  try {
    // FIX: route param is `topicId` (see routes/topicRoutes.js), not `id` —
    // this was reading undefined and causing every queue-status call to 404.
    const topic = await Topic.findOne({ _id: req.params.topicId, userId: req.user.id });
    if (!topic) return res.status(404).json({ message: 'Topic not found' });
    const queue = await getPendingQueue(topic._id);
    res.json({ hasMore: queue.length > 0, pagesRemaining: queue.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Toggle strict mode for a topic. Read at generation/chat time by
// sectionController — no need to pass it on every request.
const updateStrictMode = async (req, res) => {
  try {
    const { strictMode } = req.body;
    if (typeof strictMode !== 'boolean') return res.status(400).json({ message: 'strictMode must be a boolean' });
    const topic = await Topic.findOneAndUpdate(
      { _id: req.params.topicId, userId: req.user.id },
      { strictMode },
      { new: true }
    );
    if (!topic) return res.status(404).json({ message: 'Topic not found' });
    res.json({ strictMode: topic.strictMode });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getTopics, getTopic, createTopic, deleteTopic, queueStatus, updateStrictMode };