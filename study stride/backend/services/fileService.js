const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

// Takes a Buffer (from multer memoryStorage), not a file path
const extractTextFromBuffer = async (buffer, ext) => {
  if (ext === 'pdf') {
    const data = await pdfParse(buffer);
    return data.text;
  }
  if (ext === 'docx') {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
  if (ext === 'txt') {
    return buffer.toString('utf-8');
  }
  throw new Error(`Unsupported file type: ${ext}`);
};

module.exports = { extractTextFromBuffer };