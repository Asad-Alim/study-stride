const mongoose = require('mongoose');

// One uploaded file (PDF/DOCX/TXT). Multiple Materials can belong to the
// same Topic — that's how a topic supports multiple uploads.
// totalPages / pagesUnderstood / Chunk fields removed: chunking is no
// longer used, full extractedText goes to Gemini instead.
// extractedText itself was removed (Aug 2026) — it was a full duplicate of
// pages[].text joined together. Use joinedMaterialText(material) instead.
const materialSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  topicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', required: true },
  title: { type: String, required: true },
  fileType: { type: String, enum: ['pdf', 'docx', 'txt'], required: true },
  filePath: { type: String, required: true },       // Cloudinary secure URL
  cloudinaryPublicId: { type: String, default: '' }, // for deletion via Cloudinary API
  // extractedText: { type: String, required: true },
  pages: [{ pageNumber: Number, text: String, charCount: Number }],
  totalPages: { type: Number, default: 0 },
  totalChars: { type: Number, default: 0 },
  pagesProcessed: { type: Number, default: 0 }, // per-material progress counter for the shared topic queue
  notesPagesProcessed: { type: Number, default: 0 }, // independent progress counter for the notes queue (item 10)
  chunkingStatus: { type: String, enum: ['pending', 'in_progress', 'done', 'failed'], default: 'pending' },
}, { timestamps: true });

module.exports = mongoose.model('Material', materialSchema);