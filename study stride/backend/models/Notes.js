const mongoose = require('mongoose');

const sectionSchema = new mongoose.Schema({
  heading: String,
  content: String,
  importance: { type: String, enum: ['critical', 'important', 'general'], default: 'general' },
});

const notesSchema = new mongoose.Schema({
  materialId: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  pageNumber: { type: Number, required: true },
  sections: [sectionSchema],
  // FIX: route /:materialId/save wrote to `content` but this field never
  // existed in the schema, so Mongoose silently dropped it on save —
  // combined notes from Learning Mode were never actually being persisted.
  content: { type: String, default: '' },
  status: { type: String, enum: ['draft', 'approved'], default: 'draft' },
}, { timestamps: true });

module.exports = mongoose.model('Notes', notesSchema);