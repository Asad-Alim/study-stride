const Notes = require('../models/Notes');
const Topic = require('../models/Topic');
const Chunk = require('../models/Chunk');
const gemini = require('../services/geminiService');
const { getPendingQueue, takeBatch, advancePagesProcessed } = require('../services/queueService');
const { embedText } = require('../services/embeddingService');
const { searchByTopic } = require('../services/vectorSearchService');
const { retrieveRelevantChunks } = require('../services/retrievalService');

const generateNotes = async (req, res) => {
  try {
    const { materialId: topicId } = req.params;

    const page = parseInt(req.params.page) || 1;
    const existing = await Notes.findOne({ materialId: topicId, pageNumber: page, userId: req.user.id });
    // ... and pass `pageNumber: page` to Notes.create(...)
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
      pageNumber: page,
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
    const page = parseInt(req.params.page) || 1;
    const notes = await Notes.findOne({ materialId: topicId, pageNumber: page, userId: req.user.id });
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
    const currentSection = notes.sections[sectionIndex];
    if (!currentSection) return res.status(400).json({ message: 'Invalid sectionIndex' });

    const topic = await Topic.findById(notes.materialId);
    if (!topic) return res.status(404).json({ message: 'Topic not found' });

    // RAG: ground the edit in the actual source material (design doc item 17)
    // — query = the note's current content + the student's edit request,
    // same retrieval pipeline sections/chat already use. Falls back to
    // combinedText if nothing is indexed yet.
    let sourceContent = topic.combinedText;
    const chunkCount = await Chunk.countDocuments({ topicId: topic._id });
    if (chunkCount > 0) {
      const queryEmbedding = await embedText(`${currentSection.content}\n\n${feedback}`, 'RETRIEVAL_QUERY');
      const results = await retrieveRelevantChunks(searchByTopic, topic._id, queryEmbedding, feedback);
      if (results.length > 0) {
        sourceContent = results.map(r => r.text).join('\n\n---\n\n');
      }
    }

    const newSection = await gemini.regenerateSection(currentSection.content, sourceContent, currentSection.heading, feedback);

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

// Pulls one batch off the topic's notes-specific pending queue — an
// independent progress counter from learning sections (Material.notesPagesProcessed),
// so a topic can be ahead on notes and behind on sections or vice versa.
// Only advances the queue pointer if generation + save succeed (design doc item 10).
const generateNextNotesBatch = async (req, res) => {
  try {
    const { topicId } = req.params;
    const topic = await Topic.findOne({ _id: topicId, userId: req.user.id });
    if (!topic) return res.status(404).json({ message: 'Topic not found' });

    const queue = await getPendingQueue(topic._id, 'notesPagesProcessed');
    if (queue.length === 0) return res.status(400).json({ message: 'Nothing left to generate' });

    const batch = takeBatch(queue, { maxChars: 15000, maxPages: 15 });
    const alreadyTaught = topic.conceptIndex.map(c => c.oneLiner);

    let generated;
    try {
      generated = await gemini.generateNotes(batch.labeledText, alreadyTaught);
    } catch (err) {
      console.error('generateNextNotesBatch Gemini error:', err);
      return res.status(503).json({ code: 'GEMINI_UNAVAILABLE', message: 'AI generation is temporarily unavailable. Please try again.' });
    }

    const nextPageNumber = (await Notes.countDocuments({ materialId: topic._id, userId: req.user.id })) + 1;
    const notes = await Notes.create({
      materialId: topic._id,
      userId: req.user.id,
      pageNumber: nextPageNumber,
      sections: generated.sections,
      status: 'draft',
    });

    // Only advance the queue pointer now that generation + persistence succeeded.
    await advancePagesProcessed(batch, 'notesPagesProcessed');

    res.status(201).json(notes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Progress info for the notes queue. Powers the "generate the rest" entry
// point (item 11) and the new-material heads-up popup (item 12/13) — the
// popup itself must not show these numbers, but the underlying hasMore/
// pagesRemaining check is what decides whether to show it at all.
const notesQueueStatus = async (req, res) => {
  try {
    const { topicId } = req.params;
    const topic = await Topic.findOne({ _id: topicId, userId: req.user.id });
    if (!topic) return res.status(404).json({ message: 'Topic not found' });
    const queue = await getPendingQueue(topic._id, 'notesPagesProcessed');
    res.json({ hasMore: queue.length > 0, pagesRemaining: queue.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { generateNotes, getNotes, getAllNotes, generateAndGetNotes, updateSection, regenerateSection, approveNotes, generateNextNotesBatch, notesQueueStatus };