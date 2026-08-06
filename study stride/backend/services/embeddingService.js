const { GoogleGenerativeAI } = require('@google/generative-ai');

const getEmbeddingModel = () => {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
};

const embedWithRetry = async (fn, retries = 3) => {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status = err.status || err.statusCode || err.httpStatusCode;
      const isRetryable = status === 429 || status === 503 ||
        err.message?.includes('503') || err.message?.includes('429') ||
        err.message?.includes('high demand') || err.message?.includes('overloaded');
      if (!isRetryable || attempt === retries) { console.error('Embedding error:', err); throw err; }
      const delay = 2 ** attempt * 2000;
      console.log(`Embedding ${status || 'error'} — retrying in ${delay / 1000}s (attempt ${attempt + 1}/${retries})...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
};

// taskType: 'RETRIEVAL_DOCUMENT' (ingestion) or 'RETRIEVAL_QUERY' (search time)
const embedText = async (text, taskType = 'RETRIEVAL_DOCUMENT') => {
  const model = getEmbeddingModel();
  const result = await embedWithRetry(() =>
    model.embedContent({ content: { parts: [{ text }] }, taskType })
  );
  return result.embedding.values;
};

const embedBatch = async (texts, taskType = 'RETRIEVAL_DOCUMENT') => {
  const model = getEmbeddingModel();
  const requests = texts.map(text => ({
    content: { parts: [{ text }] },
    taskType,
  }));
  const result = await embedWithRetry(() => model.batchEmbedContents({ requests }));
  return result.embeddings.map(e => e.values);
};

module.exports = { embedText, embedBatch };