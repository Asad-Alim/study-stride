const jwt = require('jsonwebtoken');
const User = require('../models/User');

const COOKIE_NAME = 'token';

const protect = async (req, res, next) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // tokenVersion check: lets us invalidate previously-issued tokens on
    // demand (password change, logout-others) without a session table.
    const user = await User.findById(decoded.id).select('tokenVersion');
    if (!user || user.tokenVersion !== decoded.tokenVersion) {
      return res.status(401).json({ message: 'Token invalid or expired' });
    }

    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ message: 'Token invalid or expired' });
  }
};

module.exports = { protect, COOKIE_NAME };