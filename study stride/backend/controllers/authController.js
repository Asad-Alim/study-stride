const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { COOKIE_NAME } = require('../middleware/authMiddleware');

const buildUserResponse = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  age: user.age,
  gender: user.gender,
  declaredLevel: user.declaredLevel,
  photo: user.photo,
  classEnrolledAt: user.classEnrolledAt,
  lastUpgradePromptYear: user.lastUpgradePromptYear,
  theme: user.theme,
});

const signToken = (user) =>
  jwt.sign(
    { id: user._id, name: user.name, declaredLevel: user.declaredLevel, tokenVersion: user.tokenVersion },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // matches JWT expiresIn: '7d'

const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  maxAge: COOKIE_MAX_AGE_MS,
});

const setAuthCookie = (res, token) => {
  res.cookie(COOKIE_NAME, token, cookieOptions());
};

const register = async (req, res) => {
  try {
    const { name, email, password, age, gender, declaredLevel, photo, classEnrolledAt } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ message: 'All fields required' });

    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ message: 'Email already registered' });

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await User.create({
      name, email, passwordHash,
      age: age || '', gender: gender || '', declaredLevel: declaredLevel || '',
      photo: photo || null,
      classEnrolledAt: classEnrolledAt || null,
    });
    const token = signToken(user);
    setAuthCookie(res, token);

    res.status(201).json({ user: buildUserResponse(user) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(401).json({ message: 'Invalid credentials' });

    const token = signToken(user);
    setAuthCookie(res, token);
    res.json({ user: buildUserResponse(user) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const logout = async (req, res) => {
  res.clearCookie(COOKIE_NAME, { ...cookieOptions(), maxAge: undefined });
  res.json({ message: 'Logged out' });
};

const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-passwordHash');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(buildUserResponse(user));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateProfileHandler = async (req, res) => {
  try {
    const allowed = ['name', 'age', 'gender', 'declaredLevel', 'photo', 'classEnrolledAt', 'lastUpgradePromptYear', 'theme'];
    const forbidden = ['password', 'passwordHash', 'email', '_id', 'id'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        if (forbidden.includes(key)) continue; // safety double-check
        updates[key] = req.body[key];
      }
    }
    if (Object.keys(updates).length === 0)
      return res.status(400).json({ message: 'No valid fields to update' });

    const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true, runValidators: true });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(buildUserResponse(user));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Change password while logged in (requires knowing the current password).
// On success bumps tokenVersion, which invalidates every other outstanding
// session — the request making the change gets a fresh cookie so it stays
// logged in.
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ message: 'currentPassword and newPassword are required' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const match = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!match) return res.status(401).json({ message: 'Current password is incorrect' });

    const salt = await bcrypt.genSalt(12);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    user.tokenVersion += 1;
    await user.save();

    const token = signToken(user);
    setAuthCookie(res, token);

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Invalidate every session except the one making this request.
const logoutOthers = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.tokenVersion += 1;
    await user.save();

    const token = signToken(user);
    setAuthCookie(res, token);

    res.json({ message: 'Logged out from all other devices' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { register, login, logout, getMe, updateProfileHandler, changePassword, logoutOthers };