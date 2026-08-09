const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

// Target size for a synthetic "page" when the source format doesn't have a
// native page concept (DOCX/TXT). Chosen to sit comfortably under
// queueService.js's 15,000-char batch cap, so several synthetic pages can
// still combine into one batch without any single page threatening the cap
// on its own.
const PAGE_CHAR_TARGET = 3000;

// Splits text into ~PAGE_CHAR_TARGET-char "pages" on paragraph boundaries
// where possible, so DOCX/TXT flow through the same page-based queue safety
// net PDF pages already do (queueService.js's takeBatch). Without this, a
// large DOCX/TXT became a single oversized "page" that bypassed the cap
// entirely — takeBatch's "always take at least one page" fallback let it
// through regardless of size, and none of generateBatchSections/generateNotes
// truncate their input, so it went to Gemini uncapped.
const splitIntoPages = (text) => {
  const paragraphs = text.split(/\n\s*\n/);
  const pages = [];
  let current = '';

  for (const para of paragraphs) {
    if (current && (current.length + para.length) > PAGE_CHAR_TARGET) {
      pages.push(current.trim());
      current = '';
    }
    current += (current ? '\n\n' : '') + para;

    // A single paragraph longer than the target on its own — hard-split it
    // rather than letting one page balloon indefinitely (e.g. a DOCX with
    // no paragraph breaks at all).
    while (current.length > PAGE_CHAR_TARGET * 2) {
      pages.push(current.slice(0, PAGE_CHAR_TARGET).trim());
      current = current.slice(PAGE_CHAR_TARGET);
    }
  }
  if (current.trim()) pages.push(current.trim());
  if (pages.length === 0) pages.push(text.trim());

  return pages.map((pageText, i) => ({ pageNumber: i + 1, text: pageText, charCount: pageText.length }));
};

// Takes a Buffer (from multer memoryStorage), not a file path.
// Returns { fullText, pages } — pages is [{ pageNumber, text, charCount }].
const extractTextFromBuffer = async (buffer, ext) => {
  if (ext === 'pdf') {
    const pages = [];
    await pdfParse(buffer, {
      pagerender: (pageData) => pageData.getTextContent().then(tc => {
        const text = tc.items.map(i => i.str).join(' ');
        pages.push(text);
        return text;
      }),
    });
    return {
      fullText: pages.join('\n\n'),
      pages: pages.map((text, i) => ({ pageNumber: i + 1, text, charCount: text.length })),
    };
  }
  if (ext === 'docx') {
    const result = await mammoth.extractRawText({ buffer });
    return { fullText: result.value, pages: splitIntoPages(result.value) };
  }
  if (ext === 'txt') {
    const text = buffer.toString('utf-8');
    return { fullText: text, pages: splitIntoPages(text) };
  }
  throw new Error(`Unsupported file type: ${ext}`);
};

module.exports = { extractTextFromBuffer };