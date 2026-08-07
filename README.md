# Study Stride

An AI-powered adaptive learning platform built on the MERN stack with Google Gemini AI integration.

## What It Does

Study Stride lets students upload their study material (PDF, DOCX, or TXT) and learn from it through an AI-powered interface. The platform adapts explanations to the student's education level and generates notes, flashcards, quizzes, summaries, and cheat sheets from their content. Files are stored on Cloudinary; text extraction and all AI generation happen server-side. All contextual chat (in-section chat, learning-mode Q&A, quiz answer evaluation, notes editing, and the cross-topic "Ask Anything" assistant) is backed by a Retrieval-Augmented Generation (RAG) pipeline: uploaded material is embedded and indexed in MongoDB Atlas Vector Search, so answers are grounded in the specific chunks most relevant to the question instead of the entire document.

---

## Core Features

### Authentication & Profile
- Registration and login with JWT-based authentication, delivered as an **httpOnly cookie** rather than in the JSON response body (see [Auth design](#authentication-model) below)
- Each user declares their education level on signup — embedded in the JWT payload and sent as context to Gemini so all responses are calibrated to their level
- **Change password** while logged in (`PUT /auth/change-password`) — bumps a per-user token version, invalidating every other outstanding session, while the request making the change gets a fresh cookie so it stays logged in
- **Log out other devices** (`POST /auth/logout-others`) — invalidates every session except the current one, without requiring a password
- Profile page: edit education level, age, gender, upload a profile photo (stored as base64), change password, log out other devices, log out
- Annual class-upgrade prompt: shown in March–April if the user has been enrolled for 10+ months and hasn't been prompted this year

### Topics & Materials
- Students create **topics** (e.g. "OSI Model") and upload one or multiple PDF/DOCX/TXT files under each topic
- Files are parsed server-side using `pdf-parse` (PDF) and `mammoth` (DOCX) and uploaded to **Cloudinary**
- All files in a topic are concatenated into `Topic.combinedText` — most bulk-generation features read this instead of individual files
- `TopicFiles` page: view all files in a topic, add more files, or delete individual files
- Adding a file is **additive**: the new material's pages join the pending generation queue (see [Queue-based generation](#queue-based-generation) below) without disturbing any notes/sections already generated from earlier material — the page shows a one-time heads-up when this happens
- Deleting a file flags any notes/sections that assumed concepts it introduced as stale (`assumptionsStale`), rather than silently leaving outdated content or nuking everything downstream
- Deleting a topic **cascades**: Cloudinary files, `Chunk`s, `ConceptSection`s, `Flashcard`s, `Quiz`/`QuizAttempt`s, `Evaluation`s, and `GeneratedContent` are all cleaned up, not just the `Material`/`Topic` documents

### Learning Mode
- On entering, users choose between **Learn + Build Notes** (3-panel) or **Just Learn** (2-panel)
- **Strict / Non-strict toggle**: strict mode limits Gemini to the uploaded document only; non-strict allows it to fill gaps with its own knowledge
- Concept sections are generated **incrementally off a shared pending-page queue** (`getPendingQueue`/`takeBatch`/`advancePagesProcessed` in `queueService.js`), not all at once — see below
- **3-panel layout** (Learn + Notes mode): Notes panel | Content panel | Chat panel — all three panels are resizable with drag handles and individually collapsible
- **2-panel layout** (Just Learn mode): Content panel | Chat panel — resizable and collapsible
- **Text selection menu**: highlight any text in the content panel to trigger Explain / Simplify / Give an example actions inline in the chat
- **Between-section mini quiz**: after each section, a 2–5 question MCQ quiz is auto-generated from that section's content specifically
- **End-of-chapter quiz prompt**: after the last section, user is asked if they want the full chapter quiz

### Notes (standalone page)
- Auto-generates a first batch of notes if none exist for a topic
- **Queue-based continuation** (`generate-next-batch`/`queue-status`): notes have their own independent progress counter (`Material.notesPagesProcessed`), separate from learning sections' (`Material.pagesProcessed`) — a topic can be ahead on notes and behind on sections, or vice versa. When there's more material to turn into notes, the page shows a "Continue Notes only" / "Continue Notes + Learning" choice
- Each generated batch carries forward the topic's `conceptIndex` (one-liners of concepts already taught) so notes don't re-explain what's already covered
- Each section can be manually edited inline or **regenerated via AI with feedback**, grounded in the most relevant retrieved chunks of the source material rather than the whole document (RAG — see below)
- Notes can be approved or kept as draft

### Flashcards
- AI-generated from the topic's content; cached so Gemini is not called again on repeat visits
- **Staleness detection**: if material has been added to the topic since the cached set was generated, a banner offers to regenerate (`?force=true` bypasses the cache and replaces the set)
- Grid layout with colour-coded cards; click any card to reveal its answer; progress bar + reset

### Quiz (standalone page)
- On-demand quiz generation: 5 MCQs + 3 short + 2 long + 1 descriptive question
- **Regenerates fresh each time** — old quiz is deleted before generating a new one (so it never needs the staleness-check-plus-force pattern flashcards/summary/etc. use — it's always "fresh" on generate)
- A lightweight staleness check still exists purely to decide whether to *show* the "regenerate?" prompt in the first place
- MCQ answers highlighted green/red on submit; unattempted questions show the correct answer
- Descriptive/long/short questions: **AI evaluator grades against the most relevant retrieved chunks** of the source material (RAG-grounded, see below) instead of the entire document, and returns score, feedback, and missing points
- Attempts are saved to MongoDB

### Study Kit (Generated Content)
- Three on-demand generation tabs: **Summary**, **Revision Sheet**, **Cheat Sheet**
- Each is generated once and cached in MongoDB so Gemini is not called again for the same content
- **Staleness detection + regenerate**, same pattern as flashcards: compares the cached artifact's `updatedAt` against the topic's most recently added `Material`

### Retrieval-Augmented Generation (RAG)
- Every material upload triggers an async, non-blocking `ingestMaterial` job — chunks that one material's pages (`chunkingService.js`, paragraph-aware, ~500 tokens, 15% overlap) and embeds every chunk with Gemini's `gemini-embedding-001` model, independent of concept-section generation pacing
- Chunks are stored in the `Chunk` collection with their embedding vector, queried with MongoDB Atlas `$vectorSearch` — filtered by `topicId` for in-topic use, or by `userId` for cross-topic chat
- **Two different AI-context strategies, used deliberately**:
  - *Bulk generation* (summary/revision/cheatsheet/flashcards/quiz-questions/notes) sends condensed whole-topic content to Gemini in one call, since these need full-document coverage. For documents small enough (`combinedText.length <= 40,000` chars), that's the raw `combinedText`; above that threshold, `inputSourceService.js` swaps in the already-generated `learningSections` or `Notes` content instead — both are themselves Gemini-condensed representations of the *entire* document, so a single call still covers all of it rather than silently truncating at the 40k-char mark the way a raw slice would.
  - *Grounded single-answer tasks* (section chat, learning-mode "ask", quiz answer evaluation, notes editing, Ask Anything) instead retrieve only the top-k most relevant chunks via RAG, since these need precision and low latency more than exhaustive coverage.
- Ingestion embeddings use `taskType: 'RETRIEVAL_DOCUMENT'`; query-time embeddings use `taskType: 'RETRIEVAL_QUERY'` (Gemini's recommended asymmetric embedding setup)

---

## Authentication model

Auth was moved from **JWT-in-response-body + `localStorage` + `Authorization` header** to an **httpOnly cookie**, for one reason: a token sitting in `localStorage` is readable by any JS that runs on the page (including a successful XSS payload), and once read it's exfiltratable. An httpOnly cookie is invisible to page JavaScript entirely — `document.cookie` never shows it — so an XSS bug on this app can no longer walk off with a session token.

Practically, this means:
- `POST /auth/login` and `POST /auth/register` set a `Set-Cookie: token=...; HttpOnly; SameSite=Strict (prod) / Lax (dev); Secure (prod)` header instead of returning `{ token }` in the body
- The frontend Axios instance sends `withCredentials: true` on every request instead of attaching an `Authorization` header
- `authMiddleware.js` reads `req.cookies.token` (via `cookie-parser`) instead of the `Authorization` header
- CORS is configured with `credentials: true` and an explicit `origin` (required for cookies to be sent cross-origin at all)
- Since there's no longer a token the frontend can inspect to know "am I logged in", `AuthContext` always calls `GET /auth/me` on mount and treats a 401 as "not logged in", rather than gating that call on a `localStorage` check

**Token versioning** (`User.tokenVersion`) solves a problem httpOnly cookies introduce on their own: previously, a leaked/old token could be invalidated by just deleting it client-side. With `localStorage` gone, we need a *server-side* kill switch. Every issued JWT embeds the user's current `tokenVersion`; `authMiddleware.js` compares it against the DB on every request. Changing your password or clicking "log out other devices" increments `tokenVersion`, which instantly invalidates every previously-issued token — including ones an attacker might be holding — without needing a session table or token blocklist.

---

## Queue-based generation

Concept sections and notes are **not** generated in one shot from the whole topic. Instead, each `Material`'s pages sit in an implicit queue (`queueService.js`'s `getPendingQueue`), and a `generate-next-batch` endpoint pulls a batch (capped at ~15,000 chars / 15 pages), generates content for just that batch, and only advances the per-material progress counter (`Material.pagesProcessed` for sections, `Material.notesPagesProcessed` for notes — deliberately separate counters) **after** generation and persistence both succeed.

Why: a single Gemini call over an entire large document is slow, expensive, and risks losing earlier pages of context to the model's effective attention/output limits. Batching keeps each call small and fast, and because progress is tracked per-material rather than per-topic, adding a new file to a topic a student has already partially studied just adds that file's pages to the tail of the queue — it does not touch, re-generate, or invalidate anything already produced from the earlier files. This directly replaced an earlier design (`reindexTopic`) that deleted and regenerated *all* sections for a topic on every new upload — workable, but it meant uploading one more file to a topic you'd already started studying would silently wipe your progress. The queue design was built specifically to remove that trade-off.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, React Router v6, Tailwind CSS, Axios (`withCredentials: true`) |
| Backend | Node.js, Express.js |
| Database | MongoDB with Mongoose |
| AI (generation) | Google Gemini API (`@google/generative-ai`) |
| AI (embeddings) | Google Gemini embeddings — model: `gemini-embedding-001` |
| Vector Search | MongoDB Atlas `$vectorSearch` (index: `chunk_vector_index` on `Chunk.embedding`) |
| File Storage | Cloudinary (raw upload via `streamifier`) |
| File Parsing | `pdf-parse` (PDF), `mammoth` (DOCX), native Buffer for TXT |
| Auth | `bcrypt` (password hashing), `jsonwebtoken` (JWT), `cookie-parser` (httpOnly cookie auth) |
| File Uploads | Multer (memory storage — no disk writes) |
| Dev Server | Nodemon |

---

## Project Structure

STUDY_STRIDE/
├── backend.env # Backend secrets (not committed)
├── backend.env.example # Template — copy this to backend.env
├── frontend.env # Frontend env (not committed)
├── frontend.env.example # Template — copy this to frontend.env
└── study stride/
├── backend/
│ ├── config/
│ │ └── db.js # MongoDB connection
│ ├── controllers/
│ │ ├── authController.js # register, login, logout, getMe, updateProfile, changePassword, logoutOthers
│ │ ├── topicController.js # CRUD for topics, queueStatus, cascade delete
│ │ ├── materialController.js # File upload, text extraction, Cloudinary, rebuildCombinedText, stale-section flagging on delete
│ │ ├── learningController.js # Legacy chunk delivery, ask question
│ │ ├── notesController.js # Notes CRUD, queue-based generate-next-batch, RAG-grounded regenerateSection
│ │ ├── flashcardController.js # Generation (with force+staleness), retrieval
│ │ ├── quizController.js # Generation, attempt submission, RAG-grounded answer evaluation, staleness check
│ │ ├── sectionController.js # ConceptSection CRUD, queue-based generateNextBatch, RAG-backed section chat
│ │ ├── generationController.js # Summary/revision/cheatsheet (cached, with force+staleness), large-doc input swap
│ │ └── homeChatController.js # RAG chat across all of a user's topics ("Ask Anything")
│ ├── middleware/
│ │ ├── authMiddleware.js # Cookie-based JWT verify + tokenVersion check → req.user
│ │ ├── uploadMiddleware.js # Multer memory storage, up to 10 files
│ │ └── rateLimitMiddleware.js # authLimiter, uploadLimiter, apiLimiter (fixed-window) + generationLimiter (sliding-window)
│ ├── models/
│ │ ├── User.js # tokenVersion field for cookie/session invalidation
│ │ ├── Topic.js # combinedText, conceptIndex, learningSections cache
│ │ ├── Material.js # pagesProcessed / notesPagesProcessed — independent queue progress counters
│ │ ├── ConceptSection.js
│ │ ├── Notes.js
│ │ ├── Flashcard.js / Quiz.js / QuizAttempt.js / GeneratedContent.js / Evaluation.js
│ │ └── Chunk.js # RAG chunk: text + embedding vector
│ ├── routes/
│ │ ├── authRoutes.js # + PUT /change-password, POST /logout-others
│ │ ├── topicRoutes.js # + POST /:id/add-material (additive, queue-friendly)
│ │ ├── notesRoutes.js # + POST /:topicId/generate-next-batch, GET /:topicId/queue-status
│ │ ├── flashcardRoutes.js # + GET /:materialId/stale-check
│ │ ├── quizRoutes.js # + GET /:materialId/stale-check
│ │ ├── generationRoutes.js # + GET /:materialId/stale-check
│ │ └── sectionRoutes.js
│ ├── services/
│ │ ├── geminiService.js # All Gemini text-generation calls with retry logic
│ │ ├── queueService.js # getPendingQueue / takeBatch / advancePagesProcessed — shared queue mechanism
│ │ ├── inputSourceService.js # getGenerationInput — swaps raw text for condensed sections/notes above 40k chars
│ │ ├── embeddingService.js # embedText/embedBatch via gemini-embedding-001
│ │ ├── chunkingService.js # Paragraph-aware ~500-token chunker
│ │ ├── ragService.js # ingestMaterial — per-material chunk+embed, decoupled from section generation
│ │ ├── vectorSearchService.js # searchByTopic / searchByUser — Atlas $vectorSearch queries
│ │ ├── retrievalService.js # retrieveRelevantChunks — search + relevance filter + rerank
│ │ └── rerankerService.js
│ └── server.js # Express app, cookie-parser, routes, global error handler
└── frontend/
└── src/
├── api/
│ └── axios.js # withCredentials: true, 401 → redirect to /login
├── context/
│ └── AuthContext.jsx # login/register/logout, changePassword, logoutOthers
├── pages/
│ ├── Profile.jsx # + change-password form, log-out-other-devices
│ ├── Notes.jsx # + continue-generating queue UI (Notes only / Notes+Learning)
│ ├── TopicFiles.jsx # + new-material heads-up popup
│ ├── GeneratedContent.jsx # + staleness banner + regenerate
│ ├── Flashcards.jsx # + staleness banner + regenerate
│ └── Quiz.jsx # + staleness banner + regenerate
└── ...


---

## Setup

### Prerequisites
- Node.js v18+
- A **MongoDB Atlas** account (a plain/local MongoDB will *not* work for RAG — `$vectorSearch` is an Atlas-only aggregation stage)
- A Google Gemini API key
- A Cloudinary account (free tier is sufficient)
- An **Atlas Vector Search index** named `chunk_vector_index` on the `chunks` collection, indexing `embedding` as `knnVector` (cosine similarity), plus `topicId` and `userId` as filter fields

### 1. Environment files

**Backend** — copy and fill in:
```bash
cp backend.env.example backend.env
```

PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=any_long_random_string
GEMINI_API_KEY=your_gemini_api_key
FRONTEND_URL=http://localhost:5173
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
NODE_ENV=development

`NODE_ENV=production` on a real deployment is required for the auth cookie's `Secure` flag to be set correctly (cookies marked `Secure` are only sent over HTTPS).

**Frontend** — copy and fill in:
```bash
cp frontend.env.example frontend.env
```

VITE_API_URL=http://localhost:5000/api


### 2. Backend
```bash
cd "study stride/backend"
npm install
npm run dev
```
Runs on `http://localhost:5000`.

### 3. Frontend
```bash
cd "study stride/frontend"
npm install
npm run dev
```
Runs on `http://localhost:5173`.

### 4. Cross-origin cookies in production
If frontend and backend are on different domains/subdomains in production, `SameSite=Strict` (used when `NODE_ENV=production`) will silently block the cookie on cross-site requests. Either serve both from the same parent domain, or relax to `SameSite=None; Secure` in `authController.js`'s `cookieOptions()` if a genuinely cross-site deployment is required.

---

## Key Design Decisions

- **`combinedText` architecture**: All files in a topic are concatenated into one field on `Topic`. Bulk-generation calls read from this — no chunking, no risk of a concept being split across files or pages. Chat/grounded tasks use RAG chunks instead (see [RAG](#retrieval-augmented-generation-rag)).
- **Cookie-based auth over `localStorage`**: eliminates JS-readable session tokens as an XSS exfiltration target. See [Authentication model](#authentication-model).
- **`tokenVersion` for server-side session invalidation**: httpOnly cookies can't be deleted client-side by the app the way a `localStorage` token could, so a DB-backed version counter is the kill switch for password changes and "log out other devices".
- **Independent queue progress counters** (`pagesProcessed` vs `notesPagesProcessed`): notes and learning sections are generated from the same underlying pages but on separate schedules — a student might be three sections into Learning Mode but have only asked for one page of notes. Coupling their progress would force one feature's pacing onto the other.
- **Cascade delete is explicit, not relied on Mongo defaults**: MongoDB has no foreign keys or `ON DELETE CASCADE`. Deleting a `Topic` walks every dependent collection (`Material`, `Chunk`, `ConceptSection`, `Flashcard`, `Quiz`, `QuizAttempt`, `Evaluation`, `GeneratedContent`) plus Cloudinary files explicitly, in dependency order, rather than leaving orphaned documents that silently bloat the database and complicate future queries.
- **Staleness via timestamps, not a dedicated tracking table**: whether a cached summary/flashcard-set/quiz needs regenerating is answered by comparing the cached artifact's `updatedAt` against the newest `Material.createdAt` for that topic — both already exist via Mongoose `timestamps: true`, so no new schema was needed to support the "new material added — regenerate?" prompts.
- **Large-document input swap over raising a token limit**: rather than trying to fit an arbitrarily large `combinedText` into one Gemini call (or worse, silently truncating it at a fixed character count — which several `geminiService.js` functions already did via `.slice(0, 40000)`), documents past that same 40k-char threshold fall back to sending the already-generated `learningSections`/`Notes` instead. Both are Gemini's own condensed representation of the *entire* source, so the call still covers the whole document rather than losing everything past a fixed cutoff.
- **RAG for single-answer tasks, whole-document reads for bulk generation**: a chat answer or quiz grade only needs the few passages actually relevant to the question — retrieving broadly and stuffing everything into the prompt would dilute relevance and blow past latency/cost budgets for no benefit. Bulk artifacts (a full summary, a full flashcard set) inherently need to reflect the whole document, so they get the condensed-or-raw full text instead.
- **Async, per-material ingestion (`ingestMaterial`) instead of a topic-wide reindex**: the previous design (`reindexTopic`) regenerated every `ConceptSection` for a topic on every upload, which also reset a student's in-progress learning state for that topic. Chunking/embedding now happens per newly-uploaded `Material`, fire-and-forget, and never touches existing `ConceptSection`s or `Chunk`s from other materials.

---

## Known Limitations / Future Work

- `SameSite=Strict` cookies require same-site frontend/backend deployment in production (see [setup note above](#4-cross-origin-cookies-in-production))
- No password-reset-via-email flow yet — `change-password` requires knowing the current password
- The hand-rolled `generationLimiter` in `rateLimitMiddleware.js` stores counters in an in-process `Map`, which resets on server restart and doesn't share state across multiple server instances — fine for a single-instance deployment, but would need a shared store (e.g. Redis) behind a load balancer
- Large-document input swap (40,000-char threshold) is a fixed constant; a token-aware limit tied to the actual Gemini model's context window would be more precise