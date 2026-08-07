const Material = require('../models/Material');
const Chunk = require('../models/Chunk');
const ConceptSection = require('../models/ConceptSection');

const Topic = require('../models/Topic');
const { extractTextFromBuffer } = require('../services/fileService');
const path = require('path');

const { uploadBuffer, deleteFile } = require('../services/cloudinaryService');
const { ingestMaterial } = require('../services/ragService');

// extractedText was removed from the Material model (it was a full
// duplicate of pages[].text). This reconstructs the same joined string
// on demand from pages.
const joinedMaterialText = (material) =>
  (material.pages || []).map(p => p.text).join('\n\n');

// Rebuilds Topic.combinedText from every Material linked to it, each clearly
// labelled so Gemini can tell which upload a passage came from (helps it
// merge the same concept if it appears in more than one file).
const rebuildCombinedText = async (topicId) => {
  const materials = await Material.find({ topicId }).sort({ createdAt: 1 });
  const combinedText = materials
    .map((m, i) => `\n\n===== Source ${i + 1}: ${m.title} =====\n\n${joinedMaterialText(m)}`)
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

      const { pages } = await extractTextFromBuffer(file.buffer, ext);

      const cloudResult = await uploadBuffer(file.buffer, file.originalname);

      const material = await Material.create({
        userId: req.user.id,
        topicId: topic._id,
        title: req.body.title || file.originalname,
        fileType: ext,
        filePath: cloudResult.secure_url,
        cloudinaryPublicId: cloudResult.public_id,
        pages,
        totalPages: pages.length,
        totalChars: pages.reduce((sum, p) => sum + p.charCount, 0),
        pagesProcessed: 0,
      });
      createdMaterials.push(material);

      // Chunk + embed immediately, decoupled from concept-section generation
      // pacing (design doc §5.2). Does NOT touch ConceptSections.
      ingestMaterial(material).catch(err => console.error('ingestMaterial error:', err));
    }

    // combinedText still backs other features (flashcards/quiz/notes/legacy
    // learning mode) — keep it in sync. It is NOT the generation input for
    // concept sections anymore, and existing ConceptSections/queue progress
    // are left completely untouched (this is the core "no nuke" fix).
    await rebuildCombinedText(topic._id);
    const updatedTopic = await Topic.findById(topic._id);

    res.status(201).json({ topic: updatedTopic, materials: createdMaterials });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getMaterials = async (req, res) => {
  try {
    const materials = await Material.find({ userId: req.user.id }).sort({ createdAt: -1 });
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

    if (material.cloudinaryPublicId) {
      await deleteFile(material.cloudinaryPublicId).catch(console.error);
    }

    const topic = await Topic.findById(material.topicId);
    if (!topic) {
      // Orphaned material (its topic was already deleted some other way) —
      // still finish deleting the material itself rather than 500ing.
      await Chunk.deleteMany({ materialId: material._id });
      await Material.findByIdAndDelete(material._id);
      return res.json({ message: 'Material deleted' });
    }

   // Which concept tags were introduced ONLY by this material? Keep the full
    // {tag, oneLiner} objects — before conceptIndex gets filtered below —
    // since Gemini needs the oneLiner text, not just the tag, to regenerate.
    const orphanedConceptObjs = topic.conceptIndex.filter(
      c => String(c.introducedByMaterialId) === String(material._id)
    );

    // Flag sections elsewhere that assumed those tags were already taught,
    // and record exactly which concepts each individual section needs to relearn.
    if (orphanedConceptObjs.length) {
      const staleSections = await ConceptSection.find({
        topicId: topic._id,
        assumedPriorConcepts: { $in: orphanedConceptObjs.map(c => c.tag) },
      });

      for (const section of staleSections) {
        const relevantOrphans = orphanedConceptObjs.filter(c => section.assumedPriorConcepts.includes(c.tag));
        section.assumptionsStale = true;
        section.staleReason = `Assumes background material from "${material.title}", which was deleted.`;
        section.orphanedConcepts = relevantOrphans.map(c => ({ tag: c.tag, oneLiner: c.oneLiner }));
        await section.save();
      }
    }

    // Delete Chunks that belong purely to this material.
    await Chunk.deleteMany({ materialId: material._id });

    // Delete ConceptSections generated PURELY from this material's pages.
    await ConceptSection.deleteMany({ topicId: topic._id, sourceMaterialIds: [material._id] });

    // Cross-material sections can't be cleanly split — flag instead of
    // deleting or silently leaving stale content.
    await ConceptSection.updateMany(
      { topicId: topic._id, sourceMaterialIds: material._id, 'sourceMaterialIds.1': { $exists: true } },
      { assumptionsStale: true, staleReason: `Was generated partly from "${material.title}", which was deleted. Consider regenerating.` }
    );

    topic.conceptIndex = topic.conceptIndex.filter(c => String(c.introducedByMaterialId) !== String(material._id));
    await topic.save();

    await Material.findByIdAndDelete(material._id);

    // combinedText still backs other features — keep it in sync.
    await rebuildCombinedText(topic._id);

    res.json({ message: 'Material deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


module.exports = { uploadMaterial, getMaterials, getMaterial, deleteMaterial, rebuildCombinedText, joinedMaterialText };