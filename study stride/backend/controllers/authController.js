const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

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
    const token = jwt.sign({ id: user._id, name: user.name, declaredLevel: user.declaredLevel }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ token, user: buildUserResponse(user) });
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

    const token = jwt.sign({ id: user._id, name: user.name, declaredLevel: user.declaredLevel }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: buildUserResponse(user) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
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

// NEW — was missing entirely; AuthContext's updateProfile/upgradeClass call
// PUT /auth/profile in real (non-mock) mode and had nowhere to land.
// File: STUDY_STRIDE/study stride/backend/controllers/authController.js
// Replace the updateProfileHandler function (lines ~68–81):

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

module.exports = { register, login, getMe, updateProfileHandler };