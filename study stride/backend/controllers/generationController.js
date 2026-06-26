const GeneratedContent = require('../models/GeneratedContent');
const Topic = require('../models/Topic');
const gemini = require('../services/geminiService');

const getOrGenerate = async (topicId, userId, type, generatorFn) => {
  const existing = await GeneratedContent.findOne({ materialId: topicId, userId, type });
  if (existing) return existing;

  const topic = await Topic.findById(topicId);
  if (!topic) throw new Error('Topic not found');
  if (!topic.combinedText || !topic.combinedText.trim()) {
    throw new Error('No study material found for this topic. Please upload a file first.');
  }

  const content = await generatorFn(topic.combinedText);
  return await GeneratedContent.create({ materialId: topicId, userId, type, content });
};

const getSummary = async (req, res) => {
  try {
    const result = await getOrGenerate(req.params.materialId, req.user.id, 'summary', gemini.generateSummary);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getRevision = async (req, res) => {
  try {
    const result = await getOrGenerate(req.params.materialId, req.user.id, 'revision', gemini.generateRevisionSheet);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getCheatSheet = async (req, res) => {
  try {
    const result = await getOrGenerate(req.params.materialId, req.user.id, 'cheatsheet', gemini.generateCheatSheet);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getSummary, getRevision, getCheatSheet };