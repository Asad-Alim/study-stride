// PATH: backend/controllers/learningController.js
const Topic = require('../models/Topic');
const gemini = require('../services/geminiService');

// Split the topic's combined text into logical concept sections using Gemini.
// Each section = one "page" in the learning UI.
// strictMode: if false, Gemini is allowed to supplement with its own knowledge.
const getChunk = async (req, res) => {
  try {
    const topic = await Topic.findOne({ _id: req.params.materialId, userId: req.user.id });
    if (!topic) return res.status(404).json({ message: 'Topic not found' });
    if (!topic.combinedText || !topic.combinedText.trim()) {
      return res.status(400).json({ message: 'This topic has no uploaded material yet' });
    }

    const page = parseInt(req.params.page) || 1;

    // If sections are already cached on the topic, return the requested one
    if (topic.learningSections && topic.learningSections.length > 0) {
      const section = topic.learningSections[page - 1];
      if (!section) return res.status(404).json({ message: 'Page not found' });
      return res.json({
        content: section.content,
        heading: section.heading,
        pageNumber: page,
        totalPages: topic.learningSections.length,
      });
    }

    // First load — ask Gemini to split into sections
    const declaredLevel = req.query.level || 'General';
    const strictMode = req.query.strict !== 'false'; // default true
    const sections = await gemini.splitIntoLearningSections(topic.combinedText, declaredLevel, strictMode);

    // Cache sections on the topic
    await Topic.findByIdAndUpdate(topic._id, { learningSections: sections });

    const section = sections[page - 1] || sections[0];
    res.json({
      content: section.content,
      heading: section.heading,
      pageNumber: page,
      totalPages: sections.length,
    });
  } catch (err) {
    console.error('getChunk error:', err);
    res.status(500).json({ message: err.message });
  }
};

// Force regenerate sections (called when strict mode is toggled)
const regenerateSections = async (req, res) => {
  try {
    const { declaredLevel, strictMode } = req.body;
    const topic = await Topic.findOne({ _id: req.params.materialId, userId: req.user.id });
    if (!topic) return res.status(404).json({ message: 'Topic not found' });

    const sections = await gemini.splitIntoLearningSections(
      topic.combinedText,
      declaredLevel || 'General',
      strictMode !== false
    );
    await Topic.findByIdAndUpdate(topic._id, { learningSections: sections });
    res.json({ totalPages: sections.length, sections });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const askQuestion = async (req, res) => {
  try {
    const { pageContent, messages, question, declaredLevel, strictMode } = req.body;
    const answer = await gemini.chatWithSection(pageContent, messages, question, declaredLevel, strictMode);
    res.json({ answer });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getChunk, regenerateSections, askQuestion };