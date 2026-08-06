const mongoose = require('mongoose');

// One ~500-token chunk of raw source text, embedded for vector search.
// Built from Material.pages at ingestion time (design doc §5) — NOT from
// ConceptSection.rawContent. sectionId is legacy/optional, kept only for
// backward compatibility with older chunks that predate the redesign.
const chunkSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  topicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', required: true },
  materialId: { type: mongoose.Schema.Types.ObjectId, ref: 'Material', required: true },
  sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'ConceptSection' },
  order: { type: Number, default: 0 },
  sourceFile: { type: String, default: '' },
  text: { type: String, required: true },
  embedding: { type: [Number], required: true },
}, { timestamps: true });

module.exports = mongoose.model('Chunk', chunkSchema);