const Notes = require('../models/Notes');
const Topic = require('../models/Topic');
const gemini = require('../services/geminiService');

const generateNotes = async (req, res) => {
  try {
    const { materialId: topicId } = req.params;

    const existing = await Notes.findOne({ materialId: topicId, pageNumber: 1, userId: req.user.id });
    if (existing) return res.json(existing);

    const topic = await Topic.findOne({ _id: topicId, userId: req.user.id });
    if (!topic) return res.status(404).json({ message: 'Topic not found' });
    if (!topic.combinedText || !topic.combinedText.trim()) {
      return res.status(400).json({ message: 'This topic has no uploaded material yet' });
    }

    const generated = await gemini.generateNotes(topic.combinedText);
    const notes = await Notes.create({
      materialId: topicId,
      userId: req.user.id,
      pageNumber: 1,
      sections: generated.sections,
      status: 'draft',
    });

    res.status(201).json(notes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getNotes = async (req, res) => {
  try {
    const { materialId: topicId } = req.params;
    const notes = await Notes.findOne({ materialId: topicId, pageNumber: 1, userId: req.user.id });
    if (!notes) return res.status(404).json({ message: 'Notes not found' });
    res.json(notes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getAllNotes = async (req, res) => {
  try {
    const notes = await Notes.find({ materialId: req.params.materialId, userId: req.user.id }).sort({ pageNumber: 1 });
    res.json(notes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateSection = async (req, res) => {
  try {
    const { notesId, sectionIndex } = req.params;
    const { heading, content, importance } = req.body;

    const notes = await Notes.findOne({ _id: notesId, userId: req.user.id });
    if (!notes) return res.status(404).json({ message: 'Notes not found' });
    if (!notes.sections[sectionIndex]) return res.status(400).json({ message: 'Invalid sectionIndex' });

    notes.sections[sectionIndex] = { heading, content, importance };
    await notes.save();
    res.json(notes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const regenerateSection = async (req, res) => {
  try {
    const { notesId, sectionIndex } = req.params;
    const { feedback } = req.body;

    const notes = await Notes.findOne({ _id: notesId, userId: req.user.id });
    if (!notes) return res.status(404).json({ message: 'Notes not found' });
    if (!notes.sections[sectionIndex]) return res.status(400).json({ message: 'Invalid sectionIndex' });

    const topic = await Topic.findById(notes.materialId);
    if (!topic) return res.status(404).json({ message: 'Topic not found' });

    const newSection = await gemini.regenerateSection(topic.combinedText, notes.sections[sectionIndex].heading, feedback);

    notes.sections[sectionIndex] = newSection;
    await notes.save();
    res.json(notes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const approveNotes = async (req, res) => {
  try {
    const notes = await Notes.findOneAndUpdate(
      { _id: req.params.notesId, userId: req.user.id },
      { status: 'approved' },
      { new: true }
    );
    if (!notes) return res.status(404).json({ message: 'Notes not found' });
    res.json(notes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const generateAndGetNotes = async (req, res) => {
  try {
    const { materialId: topicId } = req.params;

    // If notes already exist, return them
    const existing = await Notes.findOne({ materialId: topicId, userId: req.user.id });
    if (existing) return res.json([existing]);

    const topic = await Topic.findOne({ _id: topicId, userId: req.user.id });
    if (!topic) return res.status(404).json({ message: 'Topic not found' });
    if (!topic.combinedText || !topic.combinedText.trim()) {
      return res.status(400).json({ message: 'This topic has no uploaded material yet' });
    }

    const generated = await gemini.generateNotes(topic.combinedText);
    const notes = await Notes.create({
      materialId: topicId,
      userId: req.user.id,
      pageNumber: 1,
      sections: generated.sections,
      status: 'draft',
    });

    res.status(201).json([notes]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { generateNotes, getNotes, getAllNotes, generateAndGetNotes, updateSection, regenerateSection, approveNotes };