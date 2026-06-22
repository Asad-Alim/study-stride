# Study Stride
 
An AI-powered adaptive learning platform built on the MERN stack with Google Gemini AI integration.
 
## What It Does
 
Study Stride lets students upload their study material (PDF or DOCX) and learn from it through an AI-powered split-screen interface. The platform adapts explanations to the student's education level and generates notes, flashcards, and quizzes from their content.
 
### Core Features
 
**Authentication**
- User registration and login with JWT-based authentication
- Each user declares their education level on signup, which is sent as context to Gemini so responses are calibrated to their level
**Topics & Materials**
- Students create topics (e.g., "OSI Model") and upload one or multiple PDF/DOCX files under that topic
- Uploaded files are parsed server-side using `pdf-parse` and `mammoth` and the full text is sent to Gemini
**Learning Mode**
- Split-screen interface: left panel shows AI-generated section content, right panel is a chat window
- The uploaded document is broken into concept sections by Gemini (e.g., a 10-part topic gets 10 sections)
- Each section ends with an auto-generated quiz that the student can attempt or skip
- Two modes: **Strict** (Gemini answers only from the uploaded document) and **Non-strict** (Gemini fills in gaps using general knowledge appropriate to the student's level)
- Mid-session, students can open a sidebar to view their uploaded documents while studying
**Notes**
- Notes can be generated per section after the student completes it
- Q&A from the chat during a section is sent to Gemini alongside the section content when generating notes, so the notes cover what the student actually struggled with
- Notes are displayed in a scrollable single-page view
- Students can edit notes via a chat interface in the notes panel — Gemini applies the edit and updates the note inline
- On session end, students are prompted to save or discard notes
- If partially complete, the uploaded documents are retained so the student can resume later
**Flashcards**
- AI-generated flashcards with flip-card UI, created from saved notes
**Quizzes**
- On-demand quiz generation from saved notes
- Supports MCQ and descriptive question formats
- Generated fresh each time so questions vary across practice sessions
**Generated Content**
- One-time generation of summary, cheat sheet, and important formulas from saved notes
- Stored and retrieved from MongoDB so Gemini is not called again for the same content
**Profile**
- View and manage account details and education level
## Tech Stack
 
| Layer | Technology |
|---|---|
| Frontend | React 18, React Router, Tailwind CSS, Axios, react-resizable-panels |
| Backend | Node.js, Express.js |
| Database | MongoDB with Mongoose |
| AI | Google Gemini API (`@google/generative-ai`) |
| File Parsing | pdf-parse (PDF), mammoth (DOCX) |
| Auth | bcrypt, jsonwebtoken (JWT) |
| File Uploads | Multer |
 
## Project Structure
 
```
STUDY_STRIDE/
├── backend.env.example       # Backend environment variable template
├── frontend.env.example      # Frontend environment variable template
└── study stride/
    ├── backend/
    │   ├── config/           # MongoDB connection
    │   ├── controllers/      # Route logic (auth, topics, materials, learning, notes, flashcards, quiz, sections, generation)
    │   ├── middleware/       # JWT auth middleware, Multer upload middleware
    │   ├── models/           # Mongoose models (User, Topic, Material, ConceptSection, Notes, Flashcard, Quiz, QuizAttempt, GeneratedContent, Chunk, Evaluation)
    │   ├── routes/           # Express route definitions
    │   ├── services/         # Gemini API service, file parsing service, chunking service
    │   ├── uploads/          # Temporarily stored uploaded files
    │   └── server.js         # Express app entry point
    └── frontend/
        ├── public/
        └── src/
            ├── api/          # Axios instance with base URL and auth header
            ├── components/   # Reusable UI components (Button, Loader, FlipCard, AppLayout, Sidebar, learning panels, notes, quiz)
            ├── context/      # React context for Auth, Material, Theme
            ├── hooks/        # Custom hooks (useTextSelection)
            ├── pages/        # Page components (Dashboard, Upload, TopicFiles, LearningMode, Notes, Flashcards, Quiz, GeneratedContent, Profile, Login, Register)
            ├── App.jsx       # Route definitions
            └── main.jsx      # React entry point
```
 
## Setup
 
### Prerequisites
- Node.js
- A MongoDB Atlas account (or local MongoDB)
- A Google Gemini API key
### Backend
 
1. Copy the example file and fill in your values:
```bash
cp backend.env.example backend.env
```
 
Then open `backend.env` and fill in:
 
```
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
GEMINI_API_KEY=your_gemini_api_key
FRONTEND_URL=http://localhost:5173
```
 
2. Install dependencies and run:
```bash
cd "study stride/backend"
npm install
npm run dev
```
 
### Frontend
 
1. Copy the example file and fill in your values:
```bash
cp frontend.env.example frontend.env
```
 
Then open `frontend.env` and fill in:
 
```
VITE_API_URL=http://localhost:5000/api
```
 
2. Install dependencies and run:
```bash
cd "study stride/frontend"
npm install
npm run dev
```
 
The frontend runs on `http://localhost:5173` and the backend on `http://localhost:5000`.