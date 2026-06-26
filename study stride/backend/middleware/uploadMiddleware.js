const multer = require('multer');
const path = require('path');

// memoryStorage: files stay in RAM buffer, not saved to disk
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.docx', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only PDF, DOCX, and TXT files are allowed'));
  },
  limits: { fileSize: 20 * 1024 * 1024 },
});

module.exports = upload;