const { chunkText } = require('./chunkingService');
const { embedBatch } = require('./embeddingService');
const { searchByTopic } = require('./vectorSearchService');
const gemini = require('./geminiService');

const RECALL_THRESHOLD = 0.75; // low bar on purpose — recall filter, not the verdict (§7.1)

// Stage 1: embedding recall against existing Chunks for the topic.
// Stage 2: cheap Gemini classification only for candidate pairs that clear Stage 1.
// Only CONTRADICTION needs to be surfaced explicitly into the generation prompt —
// the alreadyTaught one-liners already cover DUPLICATE/EXTENSION/DISTINCT_SUBTOPIC.
const runDedup = async (topic, batch) => {
  const pieces = chunkText(batch.labeledText);
  if (pieces.length === 0) return { contradictions: [] };

  const embeddings = await embedBatch(pieces.map(p => p.text), 'RETRIEVAL_QUERY');

  const contradictions = [];
  for (let i = 0; i < pieces.length; i++) {
    const candidates = await searchByTopic(topic._id, embeddings[i], 5);
    const relevant = candidates.filter(c => c.score >= RECALL_THRESHOLD);
    for (const candidate of relevant) {
      const verdict = await gemini.classifyPassagePair(candidate.text, pieces[i].text);
      if (verdict === 'CONTRADICTION') {
        contradictions.push({ existing: candidate.text, incoming: pieces[i].text });
      }
    }
  }
  return { contradictions };
};

module.exports = { runDedup };