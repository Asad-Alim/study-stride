// Cosine-similarity floor for a chunk to be considered "possibly relevant."
// Gemini embeddings: genuinely relevant matches typically score ~0.7-0.85,
// unrelated content ~0.3-0.5. 0.68 sits just under "clearly relevant" —
// tight enough to reject noise, loose enough not to starve real answers.
// Tune this constant directly if it proves too strict/loose in practice.
const RELEVANCE_THRESHOLD = 0.68;

// How many candidates to pull from vector search before filtering/reranking.
// Wide net — cheap step, no reason to be stingy here.
const CANDIDATE_POOL_SIZE = 20;

// Final number of chunks sent to Gemini as context, after rerank.
const FINAL_CHUNK_COUNT = 5;

module.exports = { RELEVANCE_THRESHOLD, CANDIDATE_POOL_SIZE, FINAL_CHUNK_COUNT };