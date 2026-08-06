# Study Stride
 
An AI-powered adaptive learning platform built on the MERN stack with Google Gemini AI integration.
 
## What It Does
 
Study Stride lets students upload their study material (PDF, DOCX, or TXT) and learn from it through an AI-powered interface. The platform adapts explanations to the student's education level and generates notes, flashcards, quizzes, summaries, and cheat sheets from their content. Files are stored on Cloudinary; text extraction and all AI generation happen server-side. All contextual chat (in-section chat, learning-mode Q&A, and the cross-topic "Ask Anything" assistant) is backed by a Retrieval-Augmented Generation (RAG) pipeline: uploaded material is embedded and indexed in MongoDB Atlas Vector Search, so answers are grounded in the specific chunks most relevant to the question instead of the entire document.
 
---
 
## Core Features
 
### Authentication & Profile
- User registration and login with JWT-based authentication (7-day tokens)
- Each user declares their education level on signup — this is embedded in the JWT and sent as context to Gemini so all responses are calibrated to their level
- Profile page: edit education level, age, gender, and upload a profile photo (stored as base64)
- Annual class-upgrade prompt: shown in March–April if the user has been enrolled for 10+ months and hasn't been prompted this year
### Topics & Materials
- Students create **topics** (e.g. "OSI Model") and upload one or multiple PDF/DOCX/TXT files under each topic
- Files are parsed server-side using `pdf-parse` (PDF) and `mammoth` (DOCX) and uploaded to **Cloudinary**
- All files in a topic are concatenated into `combinedText` — Gemini always sees the full topic, not individual files
- `TopicFiles` page: view all files in a topic, add more files, or delete individual files
- Deleting a file rebuilds `combinedText` and clears cached learning sections so AI regenerates with the updated content
### Learning Mode
- On entering, users choose between **Learn + Build Notes** (3-panel) or **Just Learn** (2-panel)
- **Strict / Non-strict toggle**: strict mode limits Gemini to the uploaded document only; non-strict allows it to fill gaps with its own knowledge
- Gemini splits the uploaded content into concept sections (cached on the topic after first generation)
- Toggling strict/non-strict mid-session forces a full section regeneration
- **3-panel layout** (Learn + Notes mode): Notes panel | Content panel | Chat panel — all three panels are resizable with drag handles and individually collapsible
- **2-panel layout** (Just Learn mode): Content panel | Chat panel — resizable and collapsible
- **Text selection menu**: highlight any text in the content panel to trigger Explain / Simplify / Give an example actions inline in the chat
- **Font size controls** in the top bar (A- / A+)
- **View Uploaded Notes drawer**: shows the list of uploaded files for reference while studying
- **Between-section mini quiz**: after each section, a 2–5 question MCQ quiz is auto-generated from that section's content specifically; can be skipped or disabled globally via toggle
- **End-of-chapter quiz prompt**: after the last section, user is asked if they want the full chapter quiz
- **Notes auto-generation** (Learn + Notes mode): notes are generated after each page using the section content + the student's chat questions from that session, then saved to the backend immediately
- **Notes panel** shows cumulative notes for all completed pages, with a new-notes banner on arrival; includes an AI edit box to update notes via natural language instruction
- **Notes review popup** between sections: review and edit current page notes before moving on
- **Final notes summary popup**: at the end of a chapter, review all notes and choose to save or discard
### Notes (standalone page)
- Auto-generates notes if none exist for a topic
- Displays all notes sections with colour-coded importance tags (critical / important / general)
- Each section can be manually edited inline or regenerated via AI with feedback
- Notes can be approved or kept as draft
### Flashcards
- AI-generated from the full topic's `combinedText`; cached so Gemini is not called again on repeat visits
- Grid layout with colour-coded cards; click any card to reveal its answer
- Progress bar tracks how many cards have been revealed; reset button available
- Completion banner shown when all cards are revealed
### Quiz (standalone page)
- On-demand quiz generation: 5 MCQs + 3 short + 2 long + 1 descriptive question
- **Regenerates fresh each time** — old quiz is deleted before generating a new one
- MCQ answers highlighted green/red on submit; unattempted questions show the correct answer
- Descriptive/long/short questions: AI evaluator scores the student's answer and returns score, feedback, and missing points
- Attempts are saved to MongoDB
### Study Kit (Generated Content)
- Three on-demand generation tabs: **Summary**, **Revision Sheet**, **Cheat Sheet**
- Each is generated once and cached in MongoDB so Gemini is not called again for the same content
- Summary: key concepts, important definitions, exam points
- Revision sheet: quick revision bullets, formula sheet, last-minute concepts
- Cheat sheet: keywords, formulae, memory tricks
### Retrieval-Augmented Generation (RAG)
- Every upload (`uploadMaterial` and `add-material`) triggers an async, non-blocking `reindexTopic` job so the API response isn't held up by embedding
- `reindexTopic` re-derives `ConceptSection`s from the topic's `combinedText` via Gemini, then splits each section into ~500-token chunks (`chunkingService.js`, paragraph-aware with 15% overlap) and embeds every chunk with Gemini's `gemini-embedding-001` model (`embeddingService.js`, batched, with the same exponential-backoff retry as `geminiService.js`)
- Chunks are stored in the `Chunk` collection with their embedding vector, and queried with MongoDB Atlas `$vectorSearch` (`vectorSearchService.js`) — filtered by `topicId` for in-topic chat, or by `userId` for cross-topic chat
- **Section chat & Learning Mode "ask"**: retrieval is scoped to the current topic (`searchByTopic`) and merged with the current page's content, so the AI can answer questions that reference other pages/sections of the same topic
- **Ask Anything** (`/chat`, `HomeChat.jsx`): a topic-agnostic chat that searches across *all* of a user's indexed material (`searchByUser`), and displays which topic/snippet each answer was grounded in as source chips
- Ingestion embeddings use `taskType: 'RETRIEVAL_DOCUMENT'`; query-time embeddings use `taskType: 'RETRIEVAL_QUERY'` (Gemini's recommended asymmetric embedding setup)
---
 
## Tech Stack
 
| Layer | Technology |
|---|---|
| Frontend | React 18, React Router v6, Tailwind CSS, Axios |
| Backend | Node.js, Express.js |
| Database | MongoDB with Mongoose |
| AI (generation) | Google Gemini API (`@google/generative-ai`) — model: `gemini-2.5-flash-lite` |
| AI (embeddings) | Google Gemini embeddings — model: `gemini-embedding-001` |
| Vector Search | MongoDB Atlas `$vectorSearch` (index: `chunk_vector_index` on `Chunk.embedding`) |
| File Storage | Cloudinary (raw upload via `streamifier`) |
| File Parsing | `pdf-parse` (PDF), `mammoth` (DOCX), native Buffer for TXT |
| Auth | `bcrypt` (password hashing), `jsonwebtoken` (JWT) |
| File Uploads | Multer (memory storage — no disk writes) |
| Dev Server | Nodemon |
 
---
 
## Project Structure
 
```
STUDY_STRIDE/
├── backend.env              # Backend secrets (not committed)
├── backend.env.example      # Template — copy this to backend.env
├── frontend.env             # Frontend env (not committed)
├── frontend.env.example     # Template — copy this to frontend.env
└── study stride/
    ├── backend/
    │   ├── config/
    │   │   └── db.js                  # MongoDB connection
    │   ├── controllers/
    │   │   ├── authController.js      # register, login, getMe, updateProfile
    │   │   ├── topicController.js     # CRUD for topics
    │   │   ├── materialController.js  # File upload, text extraction, Cloudinary, rebuildCombinedText
    │   │   ├── learningController.js  # Section splitting, chunk delivery, ask question
    │   │   ├── notesController.js     # Notes CRUD, section regeneration, save/approve
    │   │   ├── flashcardController.js # Flashcard generation and retrieval
    │   │   ├── quizController.js      # Quiz generation, attempt submission, answer evaluation
    │   │   ├── sectionController.js   # ConceptSection CRUD, RAG-backed section chat, complete/lock
    │   │   ├── generationController.js# Summary, revision sheet, cheat sheet (cached)
    │   │   └── homeChatController.js  # RAG chat across all of a user's topics ("Ask Anything")
    │   ├── middleware/
    │   │   ├── authMiddleware.js      # JWT verify → req.user
    │   │   ├── uploadMiddleware.js    # Multer memory storage, up to 10 files
    │   │   └── rateLimitMiddleware.js # authLimiter, uploadLimiter, apiLimiter (fixed-window) + generationLimiter (hand-rolled sliding-window counter for Gemini generation routes)
    │   ├── models/
    │   │   ├── User.js
    │   │   ├── Topic.js               # Groups multiple Materials; holds combinedText + learningSections cache
    │   │   ├── Material.js            # Single uploaded file with extractedText + Cloudinary refs
    │   │   ├── ConceptSection.js      # Section-level data: rawContent, chatHistory, generatedNotes, status
    │   │   ├── Notes.js               # Page-level notes with sections array
    │   │   ├── Flashcard.js
    │   │   ├── Quiz.js
    │   │   ├── QuizAttempt.js
    │   │   ├── GeneratedContent.js    # Cached summary/revision/cheatsheet
    │   │   ├── Evaluation.js          # AI answer evaluations
    │   │   └── Chunk.js               # RAG chunk: text + embedding vector, indexed by topicId/userId for $vectorSearch
    │   ├── routes/
    │   │   ├── authRoutes.js          # POST /register, POST /login, GET /me, PUT /profile
    │   │   ├── topicRoutes.js         # CRUD + POST /:id/add-material
    │   │   ├── materialRoutes.js      # POST / (upload), GET /, GET /:id, DELETE /:id
    │   │   ├── learningRoutes.js      # GET /:id/chunk/:page, POST /regenerate-sections, POST /ask
    │   │   ├── notesRoutes.js         # generate, get, update, regenerate, save, approve
    │   │   ├── flashcardRoutes.js     # POST /:id/generate, GET /:id
    │   │   ├── quizRoutes.js          # POST /:id/generate, GET /:id, POST /attempt, POST /evaluate, POST /section-quiz
    │   │   ├── sectionRoutes.js       # generate, get, chat, complete, edit, lock, lock-all
    │   │   ├── generationRoutes.js    # GET /:id/summary, /revision, /cheatsheet
    │   │   └── homeChatRoutes.js      # POST /ask — cross-topic RAG chat
    │   ├── services/
    │   │   ├── geminiService.js       # All Gemini text-generation calls with retry logic (exponential backoff on 429/503)
    │   │   ├── fileService.js         # extractTextFromBuffer (PDF/DOCX/TXT)
    │   │   ├── cloudinaryService.js   # uploadBuffer, deleteFile
    │   │   ├── chunkingService.js     # Splits a ConceptSection into ~500-token, paragraph-aware chunks (15% overlap) for embedding
    │   │   ├── embeddingService.js    # embedText/embedBatch via gemini-embedding-001, with retry logic
    │   │   ├── ragService.js          # reindexTopic — regenerates ConceptSections + Chunks + embeddings after every upload
    │   │   └── vectorSearchService.js # searchByTopic / searchByUser — MongoDB Atlas $vectorSearch queries
    │   └── server.js                  # Express app, routes, global error handler
    └── frontend/
        ├── public/
        └── src/
            ├── api/
            │   ├── axios.js           # Axios instance with baseURL + auth header; 401 → auto logout
            │   └── homeChat.js        # askHomeChat(question) → POST /api/home-chat/ask
            ├── components/
            │   ├── common/            # Button, Loader, ImportanceTag, ThemeToggle
            │   ├── flashcards/        # FlipCard
            │   ├── layout/            # AppLayout, Sidebar
            │   ├── learning/          # LeftPanel, RightPanel, ChatInput, TextSelectionMenu
            │   ├── notes/             # NoteSection, NoteEditor
            │   └── quiz/              # MCQQuestion, DescriptiveQuestion
            ├── context/
            │   ├── AuthContext.jsx    # login, register, logout, updateProfile, class-upgrade logic
            │   ├── MaterialContext.jsx# fetchMaterials, uploadMaterial, addFilesToTopic, deleteMaterial, deleteSingleFile
            │   └── ThemeContext.jsx   # dark/light theme
            ├── hooks/
            │   └── useTextSelection.js
            ├── pages/
            │   ├── Dashboard.jsx      # Topic grid with mode picker modal
            │   ├── Upload.jsx         # Multi-file upload with mode picker after upload
            │   ├── TopicFiles.jsx     # View/add/delete files in a topic
            │   ├── LearningMode.jsx   # Full learning interface (2 or 3 panel)
            │   ├── Notes.jsx          # Standalone notes viewer/editor
            │   ├── Flashcards.jsx     # Flashcard grid
            │   ├── Quiz.jsx           # Full quiz page with AI evaluation
            │   ├── GeneratedContent.jsx# Summary / Revision / Cheat Sheet tabs
            │   ├── HomeChat.jsx       # "Ask Anything" — RAG chat across all uploaded topics, with source chips
            │   ├── Profile.jsx        # Profile view/edit
            │   └── auth/              # Login.jsx, Register.jsx
            ├── App.jsx                # Route definitions
            └── main.jsx               # React entry point
```
 
---
 
## Setup
 
### Prerequisites
- Node.js v18+
- A **MongoDB Atlas** account (a plain/local MongoDB will *not* work for RAG — `$vectorSearch` is an Atlas-only aggregation stage)
- A Google Gemini API key (free tier: `gemini-2.5-flash-lite` — 20 req/day; `gemini-2.5-flash` — 1,500 req/day; embeddings via `gemini-embedding-001` use the same key)
- A Cloudinary account (free tier is sufficient)
- An **Atlas Vector Search index** named `chunk_vector_index` created on the `chunks` collection, indexing the `embedding` field as `knnVector` (dimension = your embedding model's output size, similarity = cosine), plus `topicId` and `userId` as filter fields. Without this index, `vectorSearchService.js` calls will fail and RAG-backed chat (section chat, learning "ask", Ask Anything) won't return results.
### 1. Environment files
 
**Backend** — copy and fill in:
```bash
cp backend.env.example backend.env
```
 
```
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=any_long_random_string
GEMINI_API_KEY=your_gemini_api_key
FRONTEND_URL=http://localhost:5173
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
```
 
**Frontend** — copy and fill in:
```bash
cp frontend.env.example frontend.env
```
 
```
VITE_API_URL=http://localhost:5000/api
```
 
### 2. Backend
 
```bash
cd "study stride/backend"
npm install
npm run dev
```
 
Runs on `http://localhost:5000`. Nodemon auto-reloads on file changes.
 
### 3. Frontend
 
```bash
cd "study stride/frontend"
npm install
npm run dev
```
 
Runs on `http://localhost:5173`.
 
---
 
## Gemini API Notes
 
The app uses `gemini-2.5-flash-lite` by default. The free tier limit is **20 requests/day** for this model. For development and testing, switch to `gemini-2.5-flash` (1,500 req/day free) by changing one line in `backend/services/geminiService.js`:
 
```js
return genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
```
 
The retry logic in `geminiService.js` handles 429 (rate limit) and 503 (overload) automatically with exponential backoff (2s → 4s → 8s, up to 3 retries). A hard daily quota (429 with "quota exceeded") will not recover until midnight Pacific time.
 
---
 
## Key Design Decisions
 
- **`combinedText` architecture**: All files in a topic are concatenated into a single field on the `Topic` model. Every AI call reads from this field, so Gemini always sees the entire topic — no chunking, no risk of a concept being split across files or pages.
- **Multer memory storage**: Files are never written to disk. The buffer goes directly to `pdf-parse`/`mammoth` for text extraction, then to Cloudinary for storage.
- **JWT-embedded `declaredLevel`**: The student's education level is in the JWT payload so controllers never need a DB round-trip to get it — it's on `req.user.declaredLevel`.
- **Section-level quiz vs full quiz**: Between sections, a mini quiz (2–5 questions) is generated from that section's content only. The full quiz (11 questions across all types) is generated from the whole topic and can be accessed from the Quiz standalone page.
- **Cached generation**: Summaries, revision sheets, cheat sheets, and flashcards are stored in MongoDB after first generation. The same Gemini call is never made twice for the same content.
- **Two different AI-context strategies, used deliberately**: bulk generation (notes, flashcards, quiz, summary/revision/cheatsheet) sends the *entire* `combinedText` to Gemini in one call, since these need whole-document coverage. Chat (section chat, learning-mode "ask", Ask Anything) instead retrieves only the top-k most relevant chunks via RAG, since chat context windows and latency matter more than exhaustive coverage there.
- **Async re-indexing**: `reindexTopic` is fired-and-forgotten (`.catch(console.error)`, not awaited) after every upload, so the upload request returns immediately rather than blocking on section-splitting + embedding. This means there's a short window after upload where RAG-backed chat is still serving results from the previous index.
- **Known trade-off**: `reindexTopic` deletes and regenerates *all* `ConceptSection`s for a topic on every new upload (since RAG chunking is keyed off freshly-generated sections). Because the Learning Mode section flow (`sectionController.js`) uses the same `ConceptSection` model for its chat history, generated notes, and completion/lock status, uploading an additional file to a topic a student has already started studying will reset that topic's in-progress section state. This is a deliberate simplicity-over-completeness call, not an oversight — a production fix would decouple RAG chunk indexing from the user-facing section/progress model.