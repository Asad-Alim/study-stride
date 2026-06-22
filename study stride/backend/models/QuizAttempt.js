const mongoose = require('mongoose');

const quizAttemptSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
  answers: [mongoose.Schema.Types.Mixed],
  score: Number,
  total: Number,
  submittedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('QuizAttempt', quizAttemptSchema);