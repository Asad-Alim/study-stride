const Flashcard = require('../models/Flashcard');
const Topic = require('../models/Topic');
const gemini = require('../services/geminiService');

// :materialId route param is actually a Topic id now (kept name for
// frontend compatibility — a "topic" is the chapter that can hold multiple
// uploaded files).
const generateFlashcards = async (req, res) => {
  try {
    const { materialId: topicId } = req.params;
    const existing = await Flashcard.find({ materialId: topicId, userId: req.user.id });
    if (existing.length > 0) return res.json(existing);

    const topic = await Topic.findOne({ _id: topicId, userId: req.user.id });
    if (!topic) return res.status(404).json({ message: 'Topic not found' });

    const generated = await gemini.generateFlashcards(topic.combinedText);
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

module.exports = { generateFlashcards, getFlashcards };