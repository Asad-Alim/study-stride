const express = require('express');
const router = express.Router();
const { register, login, logout, getMe, updateProfileHandler, changePassword, logoutOthers } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

const { authLimiter } = require('../middleware/rateLimitMiddleware');


router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfileHandler); // NEW — was missing, frontend already calls this
router.put('/change-password', protect, changePassword);
router.post('/logout-others', protect, logoutOthers);

module.exports = router;