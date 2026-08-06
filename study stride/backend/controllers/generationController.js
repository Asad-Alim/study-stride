const GeneratedContent = require('../models/GeneratedContent');
const Topic = require('../models/Topic');
const Material = require('../models/Material');
const gemini = require('../services/geminiService');

// True if any Material under this topic was created after `since`.
const topicHasNewMaterialSince = async (topicId, since) => {
  if (!since) return false;
  const count = await Material.countDocuments({ topicId, createdAt: { $gt: since } });
  return count > 0;
};

const getOrGenerate = async (topicId, userId, type, generatorFn, force = false) => {
  if (force) {
    await GeneratedContent.deleteOne({ materialId: topicId, userId, type });
  } else {
    const existing = await GeneratedContent.findOne({ materialId: topicId, userId, type });
    if (existing) return existing;
  }

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
    const result = await getOrGenerate(req.params.materialId, req.user.id, 'summary', gemini.generateSummary, req.query.force === 'true');
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getRevision = async (req, res) => {
  try {
    const result = await getOrGenerate(req.params.materialId, req.user.id, 'revision', gemini.generateRevisionSheet, req.query.force === 'true');
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getCheatSheet = async (req, res) => {
  try {
    const result = await getOrGenerate(req.params.materialId, req.user.id, 'cheatsheet', gemini.generateCheatSheet, req.query.force === 'true');
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Item 14: has new material been added since each cached artifact was
// generated? Frontend uses this to decide whether to show the "new material
// added — regenerate?" popup. Booleans only, no page counts.
const checkStale = async (req, res) => {
  try {
    const topicId = req.params.materialId;
    const types = ['summary', 'revision', 'cheatsheet'];
    const existingByType = await GeneratedContent.find({ materialId: topicId, userId: req.user.id, type: { $in: types } });

    const result = {};
    for (const type of types) {
      const doc = existingByType.find(d => d.type === type);
      result[type] = doc ? await topicHasNewMaterialSince(topicId, doc.updatedAt) : false; // nothing generated yet — nothing to be stale
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getSummary, getRevision, getCheatSheet, checkStale, topicHasNewMaterialSince };