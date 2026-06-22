const { GoogleGenerativeAI } = require('@google/generative-ai');

const getModel = () => {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
};

const generate = async (prompt) => {
  const model = getModel();
  const result = await model.generateContent(prompt);
  return result.response.text();
};

const explainPage = async (pageContent, question) => {
  const prompt = `You are a helpful AI tutor. Based on the following study material, answer the student's question clearly and helpfully.

STUDY MATERIAL:
${pageContent}

STUDENT QUESTION:
${question}

Provide a clear, educational response. Use examples when helpful.`;
  return generate(prompt);
};

const explainSelection = async (selectedText, pageContent, mode) => {
  const modeMap = {
    explain: 'Explain this text clearly',
    simplify: 'Simplify this text for a beginner',
    example: 'Give a real-world example for this concept',
  };
  const instruction = modeMap[mode] || 'Explain this text';
  const prompt = `${instruction}:

SELECTED TEXT:
${selectedText}

CONTEXT FROM STUDY MATERIAL:
${pageContent}

Provide a helpful, focused response.`;
  return generate(prompt);
};

const generateNotes = async (pageContent) => {
  const prompt = `You are an expert note-maker. Generate structured, exam-oriented notes from the following study material.

Return ONLY valid JSON in this exact format with no markdown, no backticks:
{"sections":[{"heading":"Section heading","content":"Concise note content","importance":"critical"}]}

importance must be one of: "critical", "important", "general"
Generate 3-6 sections. Keep each section concise and exam-focused.

STUDY MATERIAL:
${pageContent}`;
  const raw = await generate(prompt);
  const clean = raw.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
};

const regenerateSection = async (pageContent, heading, feedback) => {
  const prompt = `Regenerate this note section based on the student's feedback.

PAGE CONTENT:
${pageContent}

CURRENT HEADING: ${heading}

STUDENT FEEDBACK: ${feedback}

Return ONLY valid JSON with no markdown, no backticks:
{"heading":"...","content":"...","importance":"critical"}`;
  const raw = await generate(prompt);
  const clean = raw.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
};

const generateFlashcards = async (fullText) => {
  const prompt = `Generate flashcards from this study material. Return ONLY valid JSON with no markdown, no backticks:
{"flashcards":[{"question":"...","answer":"..."}]}

Generate 10-15 flashcards covering key concepts, definitions, and important facts.

MATERIAL:
${fullText.slice(0, 8000)}`;
  const raw = await generate(prompt);
  const clean = raw.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
};

const generateQuiz = async (fullText) => {
  const prompt = `Generate a comprehensive quiz from this study material. Return ONLY valid JSON with no markdown, no backticks:
{"questions":[{"type":"mcq","question":"...","options":["A","B","C","D"],"correctAnswer":"A","marks":1},{"type":"short","question":"...","correctAnswer":"...","marks":2},{"type":"long","question":"...","correctAnswer":"...","marks":5},{"type":"descriptive","question":"...","correctAnswer":"...","marks":10}]}

Generate 5 MCQs, 3 short, 2 long, 1 descriptive.

MATERIAL:
${fullText.slice(0, 8000)}`;
  const raw = await generate(prompt);
  const clean = raw.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
};

const generateSummary = async (fullText) => {
  const prompt = `Generate a comprehensive summary. Return ONLY valid JSON with no markdown, no backticks:
{"keyConcepts":["..."],"importantDefinitions":[{"term":"...","definition":"..."}],"examPoints":["..."]}

MATERIAL:
${fullText.slice(0, 8000)}`;
  const raw = await generate(prompt);
  const clean = raw.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
};

const generateRevisionSheet = async (fullText) => {
  const prompt = `Generate a revision sheet. Return ONLY valid JSON with no markdown, no backticks:
{"quickRevision":["..."],"formulaSheet":["..."],"lastMinuteConcepts":["..."]}

MATERIAL:
${fullText.slice(0, 8000)}`;
  const raw = await generate(prompt);
  const clean = raw.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
};

const generateCheatSheet = async (fullText) => {
  const prompt = `Generate a one-page cheat sheet. Return ONLY valid JSON with no markdown, no backticks:
{"keywords":["..."],"formulae":["..."],"memoryTricks":["..."]}

MATERIAL:
${fullText.slice(0, 8000)}`;
  const raw = await generate(prompt);
  const clean = raw.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
};

const evaluateAnswer = async (question, studentAnswer, referenceContent) => {
  const prompt = `You are an examiner. Evaluate this student's answer objectively.

QUESTION:
${question}

STUDENT'S ANSWER:
${studentAnswer}

REFERENCE MATERIAL:
${referenceContent.slice(0, 3000)}

Return ONLY valid JSON with no markdown, no backticks:
{"score":8,"outOf":10,"feedback":"Detailed feedback string","missingPoints":["Point 1","Point 2"]}`;
  const raw = await generate(prompt);
  const clean = raw.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
};

// Learning Mode — split into concept sections adapted to student level.
// strictMode=true: only use the uploaded documents.
// strictMode=false: Gemini can supplement with its own knowledge if docs are thin.
const splitIntoLearningSections = async (fullText, declaredLevel, strictMode = true) => {
  const strictInstruction = strictMode
    ? 'IMPORTANT: Base your sections STRICTLY on the provided material. Do not add information from outside the document.'
    : 'You may supplement the provided material with your own knowledge to fill gaps, but clearly derive section structure from the document.';

  const prompt = `You are an expert teacher. Split this study material into logical concept sections for a student at level: "${declaredLevel}".

${strictInstruction}

Rules:
- Each section must be a complete, self-contained concept a student can learn in one sitting.
- Adapt depth and language to the student level. A Class 10 student needs simpler language than a B.Tech student.
- If the same concept is scattered across the document (e.g. Application Layer mentioned on page 1 and page 9), MERGE it into one section.
- Aim for 4-10 sections depending on content breadth.
- Each section's content should be 150-400 words — enough to learn from, not overwhelming.

Return ONLY valid JSON with no markdown, no backticks:
{"sections":[{"heading":"Section Title","content":"Full section content written for the student's level","readingTime":3,"difficulty":"beginner"}]}

difficulty must be: "beginner", "intermediate", or "advanced"
readingTime is estimated minutes.

STUDY MATERIAL:
${fullText.slice(0, 12000)}`;

  const raw = await generate(prompt);
  const clean = raw.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(clean);
  return parsed.sections;
};

// V2 — generate notes from chat history + section content
const generateNotesFromChat = async (sectionContent, chatHistory, declaredLevel) => {
  const chatSummary = chatHistory.map(m => `${m.role === 'user' ? 'Student' : 'AI'}: ${m.message}`).join('\n');
  const prompt = `You are an expert note-maker. Generate exam-oriented notes for this concept section.

The student has already studied this section and had the following learning conversation. Use their questions to understand what they found confusing and emphasise those points.

SECTION CONTENT:
${sectionContent}

LEARNING CONVERSATION:
${chatSummary}

STUDENT LEVEL: ${declaredLevel || 'General'}

Return ONLY valid JSON with no markdown, no backticks:
{"sections":[{"heading":"...","content":"...","importance":"critical"}]}

importance: "critical" (must-know for exam), "important" (supporting concept), "general" (background)
Generate 3-6 concise, exam-focused sections.`;
  const raw = await generate(prompt);
  const clean = raw.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
};

const chatWithSection = async (sectionContent, chatHistory, userMessage, declaredLevel, strictMode = true) => {
  const history = chatHistory.map(m => `${m.role === 'user' ? 'Student' : 'AI'}: ${m.message || m.content}`).join('\n');
  const strictInstruction = strictMode
    ? 'Answer ONLY based on the section content provided. Do not bring in outside knowledge.'
    : 'Use the section content as the primary source. You may use your broader knowledge to clarify or fill gaps.';

  const prompt = `You are a helpful AI tutor explaining a concept to a student at level: "${declaredLevel || 'General'}".

${strictInstruction}

SECTION BEING STUDIED:
${sectionContent}

CONVERSATION SO FAR:
${history}

STUDENT NOW ASKS: ${userMessage}

Respond helpfully with examples and analogies suited to their level. Be conversational.`;
  return generate(prompt);
};


const generateNotesFromLearning = async (pageContent, chatMessages, declaredLevel, strictMode = true) => {
  const questionContext = chatMessages
    .filter(m => m.role === 'user' || m.role === 'student')
    .map(m => `- ${m.message || m.content}`)
    .join('\n');

  const strictInstruction = strictMode
    ? 'Notes must be based STRICTLY on the study material below. Do not add information from outside the document.'
    : `You may supplement the notes with your broader knowledge where the document is thin or unclear, especially to serve a student at level "${declaredLevel}".`;

  const prompt = `You are an expert study notes maker. Generate concise, exam-oriented notes.

STUDENT LEVEL: ${declaredLevel || 'General'}

${strictInstruction}

IMPORTANT RULES:
1. Keep notes specific to the topic — no teaching analogies.
2. If the student asked about something repeatedly (see questions below), make that topic extra clear.
3. Use markdown: ## for headings, - for bullets, **bold** for key terms.
4. Revision-friendly — someone should be able to memorize from these notes.
5. Return ONLY the notes. No preamble.

STUDY MATERIAL:
${pageContent}

${questionContext ? `STUDENT'S QUESTIONS DURING LEARNING (confusion indicators — prioritize clarity on these):\n${questionContext}` : ''}`;

  return generate(prompt);
};

// ── Update notes based on a student's plain-English instruction ───────────────
const updateNotesFromInstruction = async (currentNotes, instruction, pageContent, chatContext) => {
  const prompt = `You are an expert note editor. Apply the student's instruction to the existing notes.

CURRENT NOTES:
${currentNotes}

STUDENT INSTRUCTION: ${instruction}

ORIGINAL PAGE CONTENT (for reference):
${pageContent}

${chatContext ? `LEARNING CHAT CONTEXT:\n${chatContext}` : ''}

Return ONLY the updated notes in the same markdown format. No preamble, no explanation.`;

  return generate(prompt);
};

module.exports = {
  explainPage,
  explainSelection,
  generateNotes,
  regenerateSection,
  generateFlashcards,
  generateQuiz,
  generateSummary,
  generateRevisionSheet,
  generateCheatSheet,
  evaluateAnswer,
  splitIntoLearningSections,
  chatWithSection,
  generateNotesFromChat,
  generateNotesFromLearning,
  updateNotesFromInstruction,
};