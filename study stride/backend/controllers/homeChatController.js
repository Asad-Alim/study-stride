const Topic = require('../models/Topic');
const { embedText } = require('../services/embeddingService');
const { searchByUser } = require('../services/vectorSearchService');
const { retrieveRelevantChunks } = require('../services/retrievalService');
const gemini = require('../services/geminiService');

const askHomeChat = async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) return res.status(400).json({ message: 'question is required' });

    const queryEmbedding = await embedText(question, 'RETRIEVAL_QUERY');
    const results = await retrieveRelevantChunks(searchByUser, req.user.id, queryEmbedding, question);
    
    if (results.length === 0) {
      return res.json({ answer: "You don't have any indexed material yet to answer this from.", sources: [] });
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