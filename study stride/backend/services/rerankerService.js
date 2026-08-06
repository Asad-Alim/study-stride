const RERANK_URL = 'https://api.cohere.com/v2/rerank';

// candidates: [{ text, ...anything else the caller wants preserved }]
// Returns the same objects, reordered and trimmed to topN, each with
// a `relevanceScore` attached from Cohere's response.
const rerankChunks = async (query, candidates, topN) => {
  if (candidates.length === 0) return [];

  const res = await fetch(RERANK_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.COHERE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'rerank-v3.5',
      query,
      documents: candidates.map(c => c.text),
      top_n: topN,
    }),
  });

  if (!res.ok) {
    throw new Error(`Cohere rerank failed: ${res.status}`);
  }

  const data = await res.json();
  // data.results: [{ index, relevance_score }], already sorted best-first
  return data.results.map(r => ({ ...candidates[r.index], relevanceScore: r.relevance_score }));
};

module.exports = { rerankChunks };