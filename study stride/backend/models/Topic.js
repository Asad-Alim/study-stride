const mongoose = require('mongoose');

// A Topic groups multiple uploaded Materials (PDF/DOCX/TXT) into one logical
// chapter/subject. Bulk AI generation (notes, sections, flashcards, quiz,
// summary, etc.) reads from `combinedText`, which is every linked Material's
// extracted text concatenated together — this lets one topic span 2-3 PDFs
// without a concept getting split across files for those calls. Single-answer
// grounded tasks (chat, quiz evaluation, notes editing) instead retrieve
// relevant Chunks via RAG rather than reading combinedText directly.


const topicSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  subject: { type: String, default: '' },
  materials: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Material' }],
  combinedText: { type: String, default: '' },
  conceptIndex: [{
    tag: String,
    oneLiner: String,
    introducedByMaterialId: { type: mongoose.Schema.Types.ObjectId, ref: 'Material' },
    introducedBySectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'ConceptSection' },
  }],
  // strictMode=true: Gemini must generate/answer only from the uploaded material and
  // flag anything it can't ground in the source instead of quietly filling gaps.
  // strictMode=false: Gemini may supplement with its own knowledge.
  strictMode: { type: Boolean, default: true },
  isComplete: { type: Boolean, default: false },
  learningSections: [{
    heading: String,
    content: String,
    readingTime: Number,
    difficulty: String,
  }],
}, { timestamps: true });

module.exports = mongoose.model('Topic', topicSchema);