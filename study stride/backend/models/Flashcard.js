const mongoose = require('mongoose');

const flashcardSchema = new mongoose.Schema({
  materialId: { type: mongoose.Schema.Types.ObjectId, ref: 'Material', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  question: { type: String, required: true },
  answer: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model('Flashcard', flashcardSchema);