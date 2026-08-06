const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'ai'], required: true },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

const noteVersionSchema = new mongoose.Schema({
  sections: [{ heading: String, content: String, importance: String }],
  savedAt: { type: Date, default: Date.now },
});

const conceptSectionSchema = new mongoose.Schema({
  materialId: { type: mongoose.Schema.Types.ObjectId, ref: 'Material', required: true }, // now the real material (was overloaded to store topicId)
  topicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', required: true },
  sourceMaterialIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Material' }],
  conceptTags: [{ tag: String, oneLiner: String }],
  assumedPriorConcepts: [String],
  assumptionsStale: { type: Boolean, default: false },
  staleReason: { type: String, default: '' },
  orphanedConcepts: [{ tag: String, oneLiner: String }], // the specific deleted concepts THIS section assumed
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sectionIndex: { type: Number, required: true },
  heading: { type: String, required: true },
  rawContent: { type: String, required: true },
  readingTime: { type: Number, default: 3 },
  difficulty: { type: String, enum: ['beginner', 'intermediate', 'advanced'], default: 'intermediate' },
  chatHistory: [chatMessageSchema],
  generatedNotes: {
    sections: [{ heading: String, content: String, importance: String }],
    versions: [noteVersionSchema],
  },
  status: {
    type: String,
    enum: ['not_started', 'in_progress', 'section_complete', 'locked'],
    default: 'not_started',
  },
}, { timestamps: true });

module.exports = mongoose.model('ConceptSection', conceptSectionSchema);