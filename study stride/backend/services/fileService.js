const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

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
    return { fullText: result.value, pages: [{ pageNumber: 1, text: result.value, charCount: result.value.length }] };
  }
  if (ext === 'txt') {
    const text = buffer.toString('utf-8');
    return { fullText: text, pages: [{ pageNumber: 1, text, charCount: text.length }] };
  }
  throw new Error(`Unsupported file type: ${ext}`);
};

module.exports = { extractTextFromBuffer };