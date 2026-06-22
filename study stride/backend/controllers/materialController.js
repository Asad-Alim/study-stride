const Material = require('../models/Material');
const Topic = require('../models/Topic');
const { extractText } = require('../services/fileService');
const path = require('path');

// Rebuilds Topic.combinedText from every Material linked to it, each clearly
// labelled so Gemini can tell which upload a passage came from (helps it
// merge the same concept if it appears in more than one file).
const rebuildCombinedText = async (topicId) => {
  const materials = await Material.find({ topicId }).sort({ createdAt: 1 });
  const combinedText = materials
    .map((m, i) => `\n\n===== Source ${i + 1}: ${m.title} =====\n\n${m.extractedText}`)
    .join('');
  await Topic.findByIdAndUpdate(topicId, {
    combinedText,
    materials: materials.map(m => m._id),
  });
  return combinedText;
};

// Upload one or more files into a topic. If topicId is not provided, a new
// topic is created using topicTitle (or the first file's name as fallback).
const uploadMaterial = async (req, res) => {
  try {
    const files = req.files && req.files.length > 0 ? req.files : (req.file ? [req.file] : []);
    if (files.length === 0) return res.status(400).json({ message: 'No file uploaded' });

    let topic;
    if (req.body.topicId) {
      topic = await Topic.findOne({ _id: req.body.topicId, userId: req.user.id });
      if (!topic) return res.status(404).json({ message: 'Topic not found' });
    } else {
      topic = await Topic.create({
        userId: req.user.id,
        title: req.body.topicTitle || req.body.title || files[0].originalname,
        subject: req.body.subject || '',
      });
    }

    const createdMaterials = [];
    for (const file of files) {
      const ext = path.extname(file.originalname).replace('.', '').toLowerCase();
      const text = await extractText(file.path, ext);
      const material = await Material.create({
        userId: req.user.id,
        topicId: topic._id,
        title: req.body.title || file.originalname,
        fileType: ext,
        filePath: file.path,
        extractedText: text,
      });
      createdMaterials.push(material);
    }

    await rebuildCombinedText(topic._id);
    const updatedTopic = await Topic.findById(topic._id);

    res.status(201).json({ topic: updatedTopic, materials: createdMaterials });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getMaterials = async (req, res) => {
  try {
    const materials = await Material.find({ userId: req.user.id }).sort({ createdAt: -1 }).select('-extractedText');
    res.json(materials);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getMaterial = async (req, res) => {
  try {
    const material = await Material.findOne({ _id: req.params.id, userId: req.user.id });
    if (!material) return res.status(404).json({ message: 'Material not found' });
    res.json(material);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteMaterial = async (req, res) => {
  try {
    const material = await Material.findOne({ _id: req.params.id, userId: req.user.id });
    if (!material) return res.status(404).json({ message: 'Material not found' });
    const topicId = material.topicId;
    await Material.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    await rebuildCombinedText(topicId);
    res.json({ message: 'Material deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { uploadMaterial, getMaterials, getMaterial, deleteMaterial, rebuildCombinedText };