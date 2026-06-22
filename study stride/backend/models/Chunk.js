const mongoose = require('mongoose');

const chunkSchema = new mongoose.Schema({
  materialId: { type: mongoose.Schema.Types.ObjectId, ref: 'Material', required: true },
  pageNumber: { type: Number, required: true },
  content: { type: String, required: true },
  understood: { type: Boolean, default: false },
});

module.exports = mongoose.model('Chunk', chunkSchema);