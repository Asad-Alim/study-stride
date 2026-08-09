const Topic = require('../models/Topic');
const Chunk = require('../models/Chunk');
const { embedText } = require('../services/embeddingService');
const { searchByUser } = require('../services/vectorSearchService');
const { retrieveRelevantChunks } = require('../services/retrievalService');
const gemini = require('../services/geminiService');

const askHomeChat = async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) return res.status(400).json({ message: 'question is required' });

    // True cold start — nothing indexed for this user at all. Only case where
    // we block outright: Study Stride is a study-material chatbot, not a
    // general-purpose one, so there's nothing to ground an answer in yet.
    const totalChunks = await Chunk.countDocuments({ userId: req.user.id });
    if (totalChunks === 0) {
      return res.json({
        answer: "You haven't uploaded any study material yet, so there's nothing for me to answer from. Add some material to a topic first, then come back and ask away.",
        sources: [],
      });
    }

    const queryEmbedding = await embedText(question, 'RETRIEVAL_QUERY');
    const results = await retrieveRelevantChunks(searchByUser, req.user.id, queryEmbedding, question);

    // Chunks exist somewhere for this user, just none relevant to this
    // specific question — still answer, but tell Gemini there's no
    // grounding so it doesn't pretend the answer came from the student's notes.
    if (results.length === 0) {
      const answer = await gemini.chatWithSection('', [], question, req.user.declaredLevel, false, true);
      return res.json({ answer, sources: [] });
    }

    const topicIds = [...new Set(results.map(r => String(r.topicId)))];
    const topics = await Topic.find({ _id: { $in: topicIds } }).select('title');
    const topicTitleMap = Object.fromEntries(topics.map(t => [String(t._id), t.title]));

    const context = results
      .map(r => `[From: ${topicTitleMap[String(r.topicId)] || 'Unknown topic'}]\n${r.text}`)
      .join('\n\n---\n\n');

    const answer = await gemini.chatWithSection(context, [], question, req.user.declaredLevel, false);

    const sources = results.map(r => ({
      topicTitle: topicTitleMap[String(r.topicId)] || 'Unknown topic',
      snippet: r.text.slice(0, 200),
    }));

    res.json({ answer, sources });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { askHomeChat };