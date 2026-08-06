const Flashcard = require('../models/Flashcard');
const Topic = require('../models/Topic');
const Material = require('../models/Material');
const gemini = require('../services/geminiService');
const { getGenerationInput } = require('../services/inputSourceService');

// :materialId route param is actually a Topic id now (kept name for
// frontend compatibility — a "topic" is the chapter that can hold multiple
// uploaded files).
const generateFlashcards = async (req, res) => {
  try {
    const { materialId: topicId } = req.params;
    const force = req.query.force === 'true';

    if (force) {
      await Flashcard.deleteMany({ materialId: topicId, userId: req.user.id });
    } else {
      const existing = await Flashcard.find({ materialId: topicId, userId: req.user.id });
      if (existing.length > 0) return res.json(existing);
    }

    const topic = await Topic.findOne({ _id: topicId, userId: req.user.id });
    if (!topic) return res.status(404).json({ message: 'Topic not found' });
    if (!topic.combinedText || !topic.combinedText.trim()) {
      return res.status(400).json({ message: 'No study material found for this topic. Please upload a file first.' });
    }

    const inputText = await getGenerationInput(topic);
    const generated = await gemini.generateFlashcards(inputText);
    const cards = await Flashcard.insertMany(
      generated.flashcards.map(f => ({ ...f, materialId: topicId, userId: req.user.id }))
    );

    res.status(201).json(cards);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getFlashcards = async (req, res) => {
  try {
    const cards = await Flashcard.find({ materialId: req.params.materialId, userId: req.user.id });
    res.json(cards);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Item 14: is there material added after this flashcard set was generated?
const checkStale = async (req, res) => {
  try {
    const { materialId: topicId } = req.params;
    const cards = await Flashcard.find({ materialId: topicId, userId: req.user.id }).sort({ createdAt: 1 }).limit(1);
    if (cards.length === 0) return res.json({ stale: false }); // nothing generated yet

    const newerMaterial = await Material.countDocuments({ topicId, createdAt: { $gt: cards[0].createdAt } });
    res.json({ stale: newerMaterial > 0 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { generateFlashcards, getFlashcards, checkStale };