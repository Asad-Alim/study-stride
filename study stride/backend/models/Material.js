const mongoose = require('mongoose');

// One uploaded file (PDF/DOCX/TXT). Multiple Materials can belong to the
// same Topic — that's how a topic supports multiple uploads.
// totalPages / pagesUnderstood / Chunk fields removed: chunking is no
// longer used, full extractedText goes to Gemini instead.
const materialSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  topicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', required: true },
  title: { type: String, required: true },
  fileType: { type: String, enum: ['pdf', 'docx', 'txt'], required: true },
  filePath: { type: String, required: true },       // Cloudinary secure URL
  cloudinaryPublicId: { type: String, default: '' }, // for deletion via Cloudinary API
  extractedText: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model('Material', materialSchema);