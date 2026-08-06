const Chunk = require('../models/Chunk');
const { chunkMaterialPages } = require('./chunkingService');
const { embedBatch } = require('./embeddingService');

// Chunks + embeds ONE Material's raw page text. Fire-and-forget per Material —
// does NOT touch ConceptSections and does NOT delete anything topic-wide.
// Decoupled from concept-section generation pacing (design doc §5.2).
const ingestMaterial = async (material) => {
  material.chunkingStatus = 'in_progress';
  await material.save();
  try {
    const pieces = chunkMaterialPages(material);
    if (pieces.length > 0) {
      const embeddings = await embedBatch(pieces.map(p => p.text), 'RETRIEVAL_DOCUMENT');
      const chunks = pieces.map((p, i) => ({
        userId: material.userId,
        topicId: material.topicId,
        materialId: material._id,
        order: p.order,
        sourceFile: material.title,
        text: p.text,
        embedding: embeddings[i],
      }));
      await Chunk.insertMany(chunks);
    }
    material.chunkingStatus = 'done';
  } catch (err) {
    material.chunkingStatus = 'failed';
    console.error('ingestMaterial error:', err);
  }
  await material.save();
};

module.exports = { ingestMaterial };