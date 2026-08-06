const TOKEN_CHAR_RATIO = 4;
const MAX_TOKENS = 500;
const OVERLAP_RATIO = 0.15;

const MAX_CHARS = MAX_TOKENS * TOKEN_CHAR_RATIO;
const OVERLAP_CHARS = Math.floor(MAX_CHARS * OVERLAP_RATIO);

// Generic paragraph-aware ~500-token chunker. Shared by section chunking,
// material-page chunking (ingestion), and dedup recall chunking.
const chunkText = (text) => {
  const trimmed = (text || '').trim();
  if (!trimmed) return [];

  if (trimmed.length <= MAX_CHARS) {
    return [{ order: 0, text: trimmed }];
  }

  const paragraphs = trimmed.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  const chunks = [];
  let current = '';

  for (const para of paragraphs) {
    if ((current + '\n\n' + para).length > MAX_CHARS && current.length > 0) {
      chunks.push(current.trim());
      const overlapStart = Math.max(0, current.length - OVERLAP_CHARS);
      current = current.slice(overlapStart) + '\n\n' + para;
    } else {
      current = current ? current + '\n\n' + para : para;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  return chunks.map((text, i) => ({ order: i, text }));
};

const chunkSection = (section) => chunkText(section.rawContent);

// Concatenates a Material's raw pages (in order) and chunks that — NOT
// ConceptSection.rawContent (Gemini's output). See design doc §5.
const chunkMaterialPages = (material) => {
  const combined = (material.pages || [])
    .slice()
    .sort((a, b) => a.pageNumber - b.pageNumber)
    .map(p => p.text)
    .join('\n\n');
  return chunkText(combined);
};

module.exports = { chunkText, chunkSection, chunkMaterialPages };