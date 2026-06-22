const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

const extractText = async (filePath, fileType) => {
  const ext = fileType.toLowerCase();

  if (ext === 'pdf') {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (ext === 'docx') {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }

  if (ext === 'txt') {
    return fs.readFileSync(filePath, 'utf-8');
  }

  throw new Error('Unsupported file type');
};

module.exports = { extractText };