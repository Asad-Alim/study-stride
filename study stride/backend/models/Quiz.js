const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  type: { type: String, enum: ['mcq', 'short', 'long', 'descriptive'], required: true },
  question: String,
  options: [String],
  correctAnswer: String,
  marks: Number,
});

const quizSchema = new mongoose.Schema({
  materialId: { type: mongoose.Schema.Types.ObjectId, ref: 'Material', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  questions: [questionSchema],
}, { timestamps: true });

module.exports = mongoose.model('Quiz', quizSchema);