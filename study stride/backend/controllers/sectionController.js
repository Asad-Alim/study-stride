const ConceptSection = require('../models/ConceptSection');
const Chunk = require('../models/Chunk');
const { embedText } = require('../services/embeddingService');
const { searchByTopic } = require('../services/vectorSearchService');
const { retrieveRelevantChunks } = require('../services/retrievalService');

const Topic = require('../models/Topic');
const gemini = require('../services/geminiService');
const { getPendingQueue, takeBatch, advancePagesProcessed } = require('../services/queueService');
const { runDedup } = require('../services/dedupService');

// Replaces the old generateSections. Pulls one batch off the topic's shared
// pending-page queue, generates concept sections for it, and only advances
// the queue pointer if generation succeeds (design doc §4.3/§4.4).
const generateNextBatch = async (req, res) => {
  try {
    const { topicId } = req.params;
    const topic = await Topic.findOne({ _id: topicId, userId: req.user.id });
    if (!topic) return res.status(404).json({ message: 'Topic not found' });

    const queue = await getPendingQueue(topic._id);
    if (queue.length === 0) return res.status(400).json({ message: 'Nothing left to generate' });

    const batch = takeBatch(queue, { maxChars: 15000, maxPages: 15 });
    const alreadyTaught = topic.conceptIndex.map(c => c.oneLiner);
    const dedupNotes = await runDedup(topic, batch);
    const pagingContext = { pagesRemainingAfterThis: queue.length - batch.pages.length };

    let generated;
    try {
      generated = await gemini.generateBatchSections(batch.labeledText, alreadyTaught, dedupNotes, pagingContext, topic.strictMode);
    } catch (err) {
      console.error('generateNextBatch Gemini error:', err);
      return res.status(503).json({ code: 'GEMINI_UNAVAILABLE', message: 'AI generation is temporarily unavailable. Please try again.' });
    }

    const baseIndex = await ConceptSection.countDocuments({ topicId: topic._id });
    const sections = await ConceptSection.insertMany(
      generated.sections.map((s, i) => ({
        topicId: topic._id,
        materialId: batch.primaryMaterialId,
        sourceMaterialIds: batch.materialIdsInvolved,
        userId: req.user.id,
        sectionIndex: baseIndex + i,
        heading: s.heading,
        rawContent: s.content,
        conceptTags: s.conceptTags || [],
        assumedPriorConcepts: alreadyTaught,
        readingTime: s.readingTime || 3,
        difficulty: s.difficulty || 'intermediate',
      }))
    );

    topic.conceptIndex.push(...sections.flatMap(sec => (sec.conceptTags || []).map(t => ({
      tag: t.tag, oneLiner: t.oneLiner, introducedByMaterialId: sec.materialId, introducedBySectionId: sec._id,
    }))));
    await topic.save();

    // Only advance the queue pointer now that generation + persistence succeeded.
    await advancePagesProcessed(batch);

    res.status(201).json(sections);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Plain manual edit of one note block — no Gemini call. Separate from
// editSection, which regenerates via feedback.
const updateNoteBlock = async (req, res) => {
  try {
    const { index, section } = req.body;
    const doc = await ConceptSection.findOne({ _id: req.params.id, userId: req.user.id });
    if (!doc) return res.status(404).json({ message: 'Section not found' });
    if (!doc.generatedNotes?.sections?.[index]) return res.status(400).json({ message: 'Invalid note index' });

    doc.generatedNotes.sections[index] = { ...doc.generatedNotes.sections[index].toObject(), ...section };
    doc.markModified('generatedNotes');
    await doc.save();

    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getSections = async (req, res) => {
  try {
    const sections = await ConceptSection.find({ topicId: req.params.materialId, userId: req.user.id }).sort({ sectionIndex: 1 }).select('-chatHistory -generatedNotes.versions');
    res.json(sections);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getSection = async (req, res) => {
  try {
    const section = await ConceptSection.findOne({ _id: req.params.id, userId: req.user.id });
    if (!section) return res.status(404).json({ message: 'Section not found' });
    res.json(section);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const chat = async (req, res) => {
  try {
    const { message } = req.body;
    const section = await ConceptSection.findOne({ _id: req.params.id, userId: req.user.id });
    if (!section) return res.status(404).json({ message: 'Section not found' });

    // backend/controllers/sectionController.js, line 5 — DELETE this line:
    // const user = await User.findById(req.user.id);
    // const topic = await Topic.findById(section.materialId);

const chunkCount = await Chunk.countDocuments({ topicId: section.topicId });
     let contextContent = section.rawContent;
    if (chunkCount > 0) {
      const queryEmbedding = await embedText(message, 'RETRIEVAL_QUERY');
       const results = await retrieveRelevantChunks(searchByTopic, section.topicId, queryEmbedding, message);
       if (results.length > 0) {
        contextContent = results.map(r => r.text).join('\n\n---\n\n');
      }
    }

    // strictMode lives on the Topic, not the section — one small lookup here
    // keeps chat consistent with whatever the student has toggled for this topic.
    const topic = await Topic.findById(section.topicId).select('strictMode');

    const answer = await gemini.chatWithSection(
      contextContent,
      section.chatHistory,
      message,
      req.user.declaredLevel,   // already in token payload — no extra DB fetch needed
      topic ? topic.strictMode : true
    );

    section.chatHistory.push({ role: 'user', message });
    section.chatHistory.push({ role: 'ai', message: answer });
    if (section.status === 'not_started') section.status = 'in_progress';
    await section.save();

    res.json({ answer, chatHistory: section.chatHistory });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const completeSection = async (req, res) => {
  try {
    const section = await ConceptSection.findOne({ _id: req.params.id, userId: req.user.id });
    if (!section) return res.status(404).json({ message: 'Section not found' });

    const generated = await gemini.generateNotesFromChat(
      section.rawContent,
      section.chatHistory,
      req.user.declaredLevel
    );

    if (section.generatedNotes?.sections?.length > 0) {
      section.generatedNotes.versions = section.generatedNotes.versions || [];
      section.generatedNotes.versions.push({ sections: section.generatedNotes.sections });
    }

    section.generatedNotes = { sections: generated.sections, versions: section.generatedNotes?.versions || [] };
    section.status = 'section_complete';
    await section.save();

    res.json(section);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const editSection = async (req, res) => {
  try {
    const { feedback, sectionIndex } = req.body;
    const section = await ConceptSection.findOne({ _id: req.params.id, userId: req.user.id });
    if (!section) return res.status(404).json({ message: 'Section not found' });

    if (!section.generatedNotes?.sections) return res.status(400).json({ message: 'Section notes not generated yet' });
    const currentSection = section.generatedNotes.sections[sectionIndex];
    if (!currentSection) return res.status(400).json({ message: 'Invalid sectionIndex' });

    // Query = the block's current content + the student's instruction — same
    // pattern as chat retrieval, just a different query source.
    const queryEmbedding = await embedText(`${currentSection.content}\n\n${feedback}`, 'RETRIEVAL_QUERY');
    const chunks = await retrieveRelevantChunks(searchByTopic, section.topicId, queryEmbedding, feedback);
    const sourceChunks = chunks.length > 0 ? chunks.map(c => c.text).join('\n\n---\n\n') : null;

    const regenerated = await gemini.regenerateSection(
      currentSection.content,
      sourceChunks || section.rawContent, // fall back to existing behavior if nothing clears the threshold
      currentSection.heading,
      feedback
    );

  
    section.generatedNotes.versions = section.generatedNotes.versions || [];
    section.generatedNotes.versions.push({ sections: [...section.generatedNotes.sections] });
    section.generatedNotes.sections[sectionIndex] = regenerated;
    section.markModified('generatedNotes');
    await section.save();

    res.json(section);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


// One section, one Gemini call. No batch lookup, no page re-fetch.
const regenerateStaleSection = async (req, res) => {
  try {
    const section = await ConceptSection.findOne({ _id: req.params.id, userId: req.user.id });
    if (!section) return res.status(404).json({ message: 'Section not found' });
    if (!section.orphanedConcepts?.length) return res.status(400).json({ message: 'Nothing to regenerate' });

    const regenerated = await gemini.regenerateWithMissingPrerequisites(
      section.rawContent,
      section.heading,
      section.orphanedConcepts // [{tag, oneLiner}]
    );

    section.rawContent = regenerated.content;
    section.conceptTags = regenerated.conceptTags || section.conceptTags;
    section.assumptionsStale = false;
    section.staleReason = '';
    section.orphanedConcepts = [];
    await section.save();

    // Keep Topic.conceptIndex in sync: drop this section's old tags, add the new ones.
    const topic = await Topic.findById(section.topicId);
    topic.conceptIndex = topic.conceptIndex.filter(c => String(c.introducedBySectionId) !== String(section._id));
    topic.conceptIndex.push(...(section.conceptTags || []).map(t => ({
      tag: t.tag, oneLiner: t.oneLiner, introducedByMaterialId: section.materialId, introducedBySectionId: section._id,
    })));
    await topic.save();

    res.json(section);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const lockSection = async (req, res) => {
  try {
    const section = await ConceptSection.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { status: 'locked' },
      { new: true }
    );
    if (!section) return res.status(404).json({ message: 'Section not found' });
    res.json(section);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const lockAll = async (req, res) => {
  try {
     await ConceptSection.updateMany(
      { topicId: req.params.materialId, userId: req.user.id, status: 'section_complete' },
      { status: 'locked' }
    );
    res.json({ message: 'All completed sections locked' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { generateNextBatch, getSections, getSection, chat, completeSection, editSection, updateNoteBlock, regenerateStaleSection, lockSection, lockAll };