const Chunk = require('../models/Chunk');

const searchByTopic = async (topicId, queryEmbedding, k = 5) => {
  return Chunk.aggregate([
    {
      $vectorSearch: {
        index: 'chunk_vector_index',
        path: 'embedding',
        queryVector: queryEmbedding,
        filter: { topicId: { $eq: topicId } },
        numCandidates: k * 20,
        limit: k,
      },
    },
    { $project: { text: 1, sourceFile: 1, topicId: 1, materialId: 1, sectionId: 1, order: 1, score: { $meta: 'vectorSearchScore' } } },
  ]);
};

const searchByUser = async (userId, queryEmbedding, k = 7) => {
  return Chunk.aggregate([
    {
      $vectorSearch: {
        index: 'chunk_vector_index',
        path: 'embedding',
        queryVector: queryEmbedding,
        filter: { userId: { $eq: userId } },
        numCandidates: k * 20,
        limit: k,
      },
    },
    { $project: { text: 1, sourceFile: 1, topicId: 1, materialId: 1, sectionId: 1, order: 1, score: { $meta: 'vectorSearchScore' } } },
  ]);
};

module.exports = { searchByTopic, searchByUser };