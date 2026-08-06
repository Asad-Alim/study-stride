const Notes = require('../models/Notes');

// Above this many characters of raw combinedText, sending the whole thing to
// Gemini in one call stops being practical. Below it, behavior is unchanged.
// Note: this also fixes a real bug — generateSummary/generateFlashcards/etc.
// in geminiService.js each independently .slice(0, 40000) the text they're
// given, so anything past ~40k chars of combinedText was already being
// silently dropped. Using the same number here means large topics now get
// the condensed (but complete) learningSections/notes text instead.
const RAW_TEXT_THRESHOLD = 40000;

const joinSections = (sections) =>
  sections.map(s => `## ${s.heading}\n\n${s.content}`).join('\n\n');

// Picks the best available input for summary/flashcards/quiz/cheatsheet
// generation. Below the threshold: raw combinedText, same as before. Above
// it: use whichever of learningSections / notes is more complete — both are
// themselves a Gemini-condensed version of the full document, so either one
// fits in a single call without losing later pages of the source the way a
// hard 40k-char slice of the raw text would.
const getGenerationInput = async (topic) => {
  const combinedText = topic.combinedText || '';
  if (combinedText.length <= RAW_TEXT_THRESHOLD) {
    return combinedText;
  }

  const sectionsText = (topic.learningSections && topic.learningSections.length > 0)
    ? joinSections(topic.learningSections)
    : '';

  const notesDocs = await Notes.find({ materialId: topic._id }).sort({ pageNumber: 1 });
  const notesText = notesDocs.length > 0
    ? notesDocs.flatMap(n => n.sections || []).map(s => `## ${s.heading}\n\n${s.content}`).join('\n\n')
    : '';

  if (sectionsText.length === 0 && notesText.length === 0) {
    // Neither condensed form exists yet — fall back to raw text (still
    // gets sliced to 40k inside each geminiService function, same as before).
    return combinedText;
  }

  return sectionsText.length >= notesText.length ? sectionsText : notesText;
};

module.exports = { getGenerationInput, RAW_TEXT_THRESHOLD };