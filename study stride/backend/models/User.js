const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  age: { type: String, default: '' },
  gender: { type: String, default: '' },
  declaredLevel: { type: String, default: '' },
  photo: { type: String, default: null },
  classEnrolledAt: { type: Date, default: null },
  lastUpgradePromptYear: { type: Number, default: null },
  theme: { type: String, enum: ['light', 'dark'], default: 'light' },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);