const { RELEVANCE_THRESHOLD, CANDIDATE_POOL_SIZE, FINAL_CHUNK_COUNT } = require('./retrievalConfig');
const { rerankChunks } = require('./rerankerService');

// searchFn: either searchByTopic or searchByUser (same signature: (scopeId, queryEmbedding, k))
const retrieveRelevantChunks = async (searchFn, scopeId, queryEmbedding, queryText) => {
  const candidates = await searchFn(scopeId, queryEmbedding, CANDIDATE_POOL_SIZE);
  const aboveThreshold = candidates.filter(c => c.score >= RELEVANCE_THRESHOLD);

  if (aboveThreshold.length === 0) return []; // caller falls back to rawContent / "nothing indexed" message

  try {
    return await rerankChunks(queryText, aboveThreshold, FINAL_CHUNK_COUNT);
  } catch (err) {
    console.error('Rerank failed, falling back to threshold-filtered order:', err);
    return aboveThreshold.slice(0, FINAL_CHUNK_COUNT); // still sorted by vector score
  }
};

module.exports = { retrieveRelevantChunks };