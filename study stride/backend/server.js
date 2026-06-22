const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('./config/db');

dotenv.config({ path: path.resolve(__dirname, '../../backend.env') });

connectDB();

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/topics', require('./routes/topicRoutes'));   // NEW — multi-upload topic grouping
app.use('/api/materials', require('./routes/materialRoutes'));
app.use('/api/learning', require('./routes/learningRoutes'));
app.use('/api/notes', require('./routes/notesRoutes'));
app.use('/api/flashcards', require('./routes/flashcardRoutes'));
app.use('/api/quiz', require('./routes/quizRoutes'));
app.use('/api/generate', require('./routes/generationRoutes'));
app.use('/api/sections', require('./routes/sectionRoutes'));  // V2
// Global error handler — must have 4 args for Express to treat it as error middleware
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ message: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Study Stride server running on port ${PORT}`));