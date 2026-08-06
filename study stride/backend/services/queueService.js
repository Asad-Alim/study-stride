const Material = require('../models/Material');

// Builds the topic's implicit pending-page queue: walks Materials in upload
// order, taking each one's unprocessed pages in page order.
// progressField lets different consumers track independent progress through
// the same underlying pages (e.g. learning sections use 'pagesProcessed',
// notes generation uses 'notesPagesProcessed' — see design doc item 10).
const getPendingQueue = async (topicId, progressField = 'pagesProcessed') => {
  const materials = await Material.find({ topicId }).sort({ createdAt: 1 });
  const queue = [];
  for (const m of materials) {
    const processed = m[progressField] || 0;
    for (const p of m.pages.slice(processed)) {
      queue.push({ materialId: m._id, materialTitle: m.title, pageNumber: p.pageNumber, text: p.text, charCount: p.charCount });
    }
  }
  return queue;
};

// Pulls a batch off the front of the queue, up to maxChars or maxPages —
// whichever hits first. Always takes at least one page.
const takeBatch = (queue, { maxChars = 15000, maxPages = 15 } = {}) => {
  const pages = [];
  let chars = 0;
  for (const item of queue) {
    if (pages.length >= maxPages) break;
    if (pages.length > 0 && chars + item.charCount > maxChars) break;
    pages.push(item);
    chars += item.charCount;
  }
  if (pages.length === 0 && queue.length > 0) pages.push(queue[0]);

  const countByMaterial = {};
  pages.forEach(p => { countByMaterial[p.materialId] = (countByMaterial[p.materialId] || 0) + 1; });
  const primaryMaterialId = Object.entries(countByMaterial).sort((a, b) => b[1] - a[1])[0][0];
  const materialIdsInvolved = Object.keys(countByMaterial);

  const groupedBySource = [];
  for (const p of pages) {
    let group = groupedBySource.find(g => String(g.materialId) === String(p.materialId));
    if (!group) { group = { materialId: p.materialId, materialTitle: p.materialTitle, pages: [] }; groupedBySource.push(group); }
    group.pages.push(p);
  }
  const labeledText = groupedBySource
    .map(g => `\n\n===== Source: ${g.materialTitle} (pages ${g.pages[0].pageNumber}-${g.pages[g.pages.length - 1].pageNumber}) =====\n\n${g.pages.map(p => p.text).join('\n\n')}`)
    .join('');

  return { pages, materialIdsInvolved, primaryMaterialId, labeledText };
};

// Advances the given progress field for every material touched by this batch.
// Only call this AFTER generation succeeds (design doc §4.4 / item 10).
const advancePagesProcessed = async (batch, progressField = 'pagesProcessed') => {
  const countByMaterial = {};
  batch.pages.forEach(p => { countByMaterial[p.materialId] = (countByMaterial[p.materialId] || 0) + 1; });
  for (const [materialId, count] of Object.entries(countByMaterial)) {
    await Material.findByIdAndUpdate(materialId, { $inc: { [progressField]: count } });
  }
};

module.exports = { getPendingQueue, takeBatch, advancePagesProcessed };