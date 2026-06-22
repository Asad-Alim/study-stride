const mongoose = require('mongoose');

// A Topic groups multiple uploaded Materials (PDF/DOCX/TXT) into one logical
// chapter/subject. All AI generation (notes, sections, flashcards, quiz, etc.)
// reads from `combinedText`, which is every linked Material's extracted text
// concatenated together. This lets one topic span 2-3 PDFs, or have the same
// concept's content spread across page 1 and page 9 of one PDF, without it
// getting split apart by chunking.
const topicSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  subject: { type: String, default: '' },
  materials: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Material' }],
  combinedText: { type: String, default: '' },
  isComplete: { type: Boolean, default: false },
  learningSections: [{
    heading: String,
    content: String,
    readingTime: Number,
    difficulty: String,
  }],
}, { timestamps: true });

module.exports = mongoose.model('Topic', topicSchema);