const mongoose = require('mongoose');

const evaluationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  materialId: { type: mongoose.Schema.Types.ObjectId, ref: 'Material', required: true },
  question: String,
  studentAnswer: String,
  score: Number,
  outOf: Number,
  feedback: String,
  missingPoints: [String],
}, { timestamps: true });

module.exports = mongoose.model('Evaluation', evaluationSchema);