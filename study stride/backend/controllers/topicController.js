const Topic = require('../models/Topic');
const Material = require('../models/Material');

const getTopics = async (req, res) => {
  try {
    const topics = await Topic.find({ userId: req.user.id }).sort({ createdAt: -1 }).select('-combinedText');
    res.json(topics);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getTopic = async (req, res) => {
  try {
    const topic = await Topic.findOne({ _id: req.params.id, userId: req.user.id }).select('-combinedText');
    if (!topic) return res.status(404).json({ message: 'Topic not found' });
    const materials = await Material.find({ topicId: topic._id }).select('-extractedText');
    res.json({ ...topic.toObject(), materialDetails: materials });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createTopic = async (req, res) => {
  try {
    const { title, subject } = req.body;
    if (!title) return res.status(400).json({ message: 'Title is required' });
    const topic = await Topic.create({ userId: req.user.id, title, subject: subject || '' });
    res.status(201).json(topic);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteTopic = async (req, res) => {
  try {
    const topic = await Topic.findOne({ _id: req.params.id, userId: req.user.id });
    if (!topic) return res.status(404).json({ message: 'Topic not found' });
    await Material.deleteMany({ topicId: topic._id });
    await Topic.findByIdAndDelete(topic._id);
    res.json({ message: 'Topic deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getTopics, getTopic, createTopic, deleteTopic };