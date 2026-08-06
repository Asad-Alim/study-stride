const express = require('express');
const router = express.Router();
const { uploadMaterial, getMaterials, getMaterial, deleteMaterial } = require('../controllers/materialController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

const { uploadLimiter } = require('../middleware/rateLimitMiddleware');


// FIX: was upload.single('file') — only ever accepted one file. Now accepts
// up to 10 files in one request under the field name 'files'.
// router.post('/', protect, upload.array('files', 10), uploadMaterial);

router.post('/', protect, uploadLimiter, upload.array('files', 10), uploadMaterial);
router.get('/', protect, getMaterials);
router.get('/:id', protect, getMaterial);
router.delete('/:id', protect, deleteMaterial);

module.exports = router;