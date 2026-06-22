const ConceptSection = require('../models/ConceptSection');
const Topic = require('../models/Topic');
const gemini = require('../services/geminiService');

// :materialId param is actually a Topic id. combinedText already has every
// uploaded file's text merged, so Gemini sees all of it in one call and
// splits it into coherent concept sections — fixing the "topic split across
// two PDFs" and "concept split across page 1 and page 9" problems.
const generateSections = async (req, res) => {
  try {
    const { materialId: topicId } = req.params;
    const existing = await ConceptSection.find({ materialId: topicId, userId: req.user.id });
    if (existing.length > 0) return res.json(existing);

    const topic = await Topic.findOne({ _id: topicId, userId: req.user.id });
    if (!topic) return res.status(404).json({ message: 'Topic not found' });
    if (!topic.combinedText || !topic.combinedText.trim()) {
      return res.status(400).json({ message: 'This topic has no uploaded material yet' });
    }

    const generated = await gemini.splitIntoConceptSections(topic.combinedText);
    const sections = await ConceptSection.insertMany(
      generated.sections.map((s, i) => ({
        materialId: topicId,
        userId: req.user.id,
        sectionIndex: i,
        heading: s.heading,
        rawContent: s.content,
        readingTime: s.readingTime || 3,
        difficulty: s.difficulty || 'intermediate',
      }))
    );
    res.status(201).json(sections);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getSections = async (req, res) => {
  try {
    const sections = await ConceptSection.find({ materialId: req.params.materialId, userId: req.user.id }).sort({ sectionIndex: 1 }).select('-chatHistory -generatedNotes.versions');
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

    const topic = await Topic.findById(section.materialId);
    const answer = await gemini.chatWithSection(
      section.rawContent,
      section.chatHistory,
      message,
      topic?.declaredLevel
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

    const topic = await Topic.findById(section.materialId);
    const generated = await gemini.generateNotesFromChat(
      section.rawContent,
      section.chatHistory,
      topic?.declaredLevel
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

    const currentSection = section.generatedNotes.sections[sectionIndex];
    // FIX: previously no check here — an invalid sectionIndex crashed
    // with an unhandled exception instead of returning a clean error.
    if (!currentSection) return res.status(400).json({ message: 'Invalid sectionIndex' });

    const regenerated = await gemini.regenerateSection(section.rawContent, currentSection.heading, feedback);

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

const lockSection = async (req, res) => {
  try {
    const section = await ConceptSection.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { status: 'locked' },
      { new: true }
    );
    // FIX: was returning `null` with a 200 status when not found.
    if (!section) return res.status(404).json({ message: 'Section not found' });
    res.json(section);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const lockAll = async (req, res) => {
  try {
    await ConceptSection.updateMany(
      { materialId: req.params.materialId, userId: req.user.id, status: 'section_complete' },
      { status: 'locked' }
    );
    res.json({ message: 'All completed sections locked' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { generateSections, getSections, getSection, chat, completeSection, editSection, lockSection, lockAll };