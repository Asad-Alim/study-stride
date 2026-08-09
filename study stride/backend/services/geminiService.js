const { GoogleGenerativeAI } = require('@google/generative-ai');

const safeParseJSON = (raw, context = '') => {
  const clean = raw.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(clean);
  } catch (e) {
    throw new Error(`Gemini returned invalid JSON${context ? ' for ' + context : ''}. Please try again.`);
  }
};



const getModel = () => {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
};

const generate = async (prompt, retries = 3) => {
  const model = getModel();
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err) {
      const status = err.status || err.statusCode || err.httpStatusCode;
      const isRetryable = status === 429 || status === 503 ||
        err.message?.includes('503') || err.message?.includes('429') ||
        err.message?.includes('high demand') || err.message?.includes('overloaded');
      if (!isRetryable || attempt === retries) { console.error('Gemini error:', err); throw err; }
      const delay = 2 ** attempt * 2000; // 2s, 4s, 8s
      console.log(`Gemini ${status || 'error'} — retrying in ${delay/1000}s (attempt ${attempt + 1}/${retries})...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
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

const generateNotes = async (pageContent, alreadyTaughtOneLiners = []) => {
  // Same "don't re-teach covered ground" context that generateBatchSections
  // already gives learning sections — item 11 wants notes to carry this too.
  const alreadyTaughtBlock = alreadyTaughtOneLiners.length
    ? `\n\nTHE STUDENT HAS ALREADY BEEN TAUGHT THE FOLLOWING (do not re-explain these from scratch, only reference briefly if relevant):\n${alreadyTaughtOneLiners.map(l => `- ${l}`).join('\n')}`
    : '';

  const prompt = `You are an expert note-maker. Generate structured, exam-oriented notes from the following study material.
${alreadyTaughtBlock}

Return ONLY valid JSON in this exact format with no markdown, no backticks:
{"sections":[{"heading":"Section heading","content":"Concise note content","importance":"critical"}]}

importance must be one of: "critical", "important", "general"
Generate as many sections as needed — no fixed limit. Base the count on how many distinct concepts exist in the material. Each section must be complete, self-contained, and exam-focused.

STUDY MATERIAL:
${pageContent}`;
  const raw = await generate(prompt);
  return safeParseJSON(raw, 'notes');
};

// currentBlockContent: the note block's existing text (what the student sees right now)
// sourceContent: the section's underlying material, for grounding/facts
const regenerateSection = async (currentBlockContent, sourceContent, heading, feedback) => {
  const prompt = `You are editing one block of a student's notes based on their instruction.

CURRENT NOTE BLOCK ("${heading}"):
${currentBlockContent}

UNDERLYING SECTION MATERIAL (for facts/context, don't just re-summarize this):
${sourceContent}

STUDENT'S INSTRUCTION: ${feedback}

Apply the instruction to the CURRENT NOTE BLOCK above — keep everything that
instruction doesn't ask you to change. Do not regenerate the block from
scratch.

Return ONLY valid JSON with no markdown, no backticks:
{"heading":"...","content":"...","importance":"critical"}`;
  const raw = await generate(prompt);
  return safeParseJSON(raw, 'regenerateSection');
};

const regenerateWithMissingPrerequisites = async (currentContent, heading, orphanedConcepts) => {
  const missingBlock = orphanedConcepts.map(c => `- ${c.oneLiner}`).join('\n');
  const prompt = `You are revising a study section because some background material it relied on was removed from the course.

CURRENT SECTION ("${heading}"):
${currentContent}

THE FOLLOWING CONCEPTS WERE ASSUMED KNOWN BUT ARE NO LONGER TAUGHT ANYWHERE ELSE — teach them briefly inline (a short paragraph each is enough), then continue with the section's existing content adjusted so it no longer assumes them:
${missingBlock}

Return ONLY valid JSON with no markdown, no backticks:
{"content":"...","conceptTags":[{"tag":"...","oneLiner":"..."}]}`;
  const raw = await generate(prompt);
  return safeParseJSON(raw, 'regenerateWithMissingPrerequisites');
};

const generateFlashcards = async (fullText) => {
  const prompt = `Generate flashcards from this study material. Return ONLY valid JSON with no markdown, no backticks:
{"flashcards":[{"question":"...","answer":"..."}]}

Generate 10-15 flashcards covering key concepts, definitions, and important facts.

MATERIAL:
${fullText.slice(0, 40000)}`;
  const raw = await generate(prompt);
  return safeParseJSON(raw, 'flashcards');
};


// Mini quiz for between-section popup — only 2-5 MCQs from one section's content
const generateSectionQuiz = async (sectionContent, sectionHeading, declaredLevel) => {
  const wordCount = sectionContent.trim().split(/\s+/).length;
  const questionCount = wordCount < 200 ? 2 : wordCount < 500 ? 3 : 5;

  const prompt = `You are a teacher creating a quick comprehension check quiz.

SECTION TOPIC: "${sectionHeading || 'Current Section'}"
STUDENT LEVEL: ${declaredLevel || 'General'}

Generate EXACTLY ${questionCount} MCQ questions based ONLY on the section content below.
Do NOT include questions about topics outside this section.
Each question must have exactly 4 options with one correct answer.

Return ONLY valid JSON with no markdown, no backticks:
{"questions":[{"type":"mcq","question":"...","options":["A","B","C","D"],"correctAnswer":"A","marks":1}]}

SECTION CONTENT:
${sectionContent.slice(0, 8000)}`;

  const raw = await generate(prompt);
  return safeParseJSON(raw, 'sectionQuiz');
};

const generateQuiz = async (fullText) => {
  const prompt = `Generate a comprehensive quiz from this study material. Return ONLY valid JSON with no markdown, no backticks:
{"questions":[{"type":"mcq","question":"...","options":["A","B","C","D"],"correctAnswer":"A","marks":1},{"type":"short","question":"...","correctAnswer":"...","marks":2},{"type":"long","question":"...","correctAnswer":"...","marks":5},{"type":"descriptive","question":"...","correctAnswer":"...","marks":10}]}

Generate 5 MCQs, 3 short, 2 long, 1 descriptive.

MATERIAL:
${fullText.slice(0, 40000)}`;
  const raw = await generate(prompt);
  return safeParseJSON(raw, 'quiz');
};

const generateSummary = async (fullText) => {
  const prompt = `Generate a comprehensive summary. Return ONLY valid JSON with no markdown, no backticks:
{"keyConcepts":["..."],"importantDefinitions":[{"term":"...","definition":"..."}],"examPoints":["..."]}

MATERIAL:
${fullText.slice(0, 40000)}`;
  const raw = await generate(prompt);
  return safeParseJSON(raw, 'summary');
};

const generateRevisionSheet = async (fullText) => {
  const prompt = `Generate a revision sheet. Return ONLY valid JSON with no markdown, no backticks:
{"quickRevision":["..."],"formulaSheet":["..."],"lastMinuteConcepts":["..."]}

MATERIAL:
${fullText.slice(0, 40000)}`;
  const raw = await generate(prompt);
  return safeParseJSON(raw, 'revisionSheet');
};

const generateCheatSheet = async (fullText) => {
  const prompt = `Generate a one-page cheat sheet. Return ONLY valid JSON with no markdown, no backticks:
{"keywords":["..."],"formulae":["..."],"memoryTricks":["..."]}

MATERIAL:
${fullText.slice(0, 40000)}`;
  const raw = await generate(prompt);
  return safeParseJSON(raw, 'cheatSheet');
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
  return safeParseJSON(raw, 'evaluateAnswer');
};

// Learning Mode — split into concept sections adapted to student level.
// strictMode=true: only use the uploaded documents.
// strictMode=false: Gemini can supplement with its own knowledge if docs are thin.
const splitIntoLearningSections = async (fullText, declaredLevel, strictMode = true) => {
  const strictInstruction = strictMode
    ? 'IMPORTANT: Base your sections STRICTLY on the provided material. Do not add information from outside the document.'
    : 'You may supplement the provided material with your own knowledge to fill gaps, but clearly derive section structure from the document.';

  // Decide how many sections based on content size
  const wordCount = fullText.trim().split(/\s+/).length;
  let sectionGuidance;
  if (wordCount < 400)        sectionGuidance = 'Generate 1-2 sections — the material is very short.';
  else if (wordCount < 1500)  sectionGuidance = 'Generate 2-4 sections based on natural topic breaks.';
  else if (wordCount < 5000)  sectionGuidance = 'Generate 4-8 sections based on natural topic breaks.';
  else                         sectionGuidance = 'Generate 6-15 sections — split into clear concept groups.';

  const prompt = `You are an expert teacher. Split this study material into logical concept sections for a student at level: "${declaredLevel}".

${strictInstruction}

Rules:
- Each section must be a complete, self-contained concept a student can learn in one sitting.
- Adapt depth and language to the student level. A Class 10 student needs simpler language than a B.Tech student.
- If the same concept is scattered across the document, MERGE it into one section.
- ${sectionGuidance}
- Each section's content should be 200-700 words. Do NOT cut a concept mid-way to fit a word limit.
- Do NOT pad sections artificially. Only create a new section when there is a genuine topic change.

Return ONLY valid JSON with no markdown, no backticks:
{"sections":[{"heading":"Section Title","content":"Full section content written for the student's level","readingTime":3,"difficulty":"beginner"}]}

difficulty must be: "beginner", "intermediate", or "advanced"
readingTime is estimated minutes.

STUDY MATERIAL:
${fullText.slice(0, 60000)}`;

  const raw = await generate(prompt);
  const parsed = safeParseJSON(raw, 'learningSections');
  if (!parsed.sections || !Array.isArray(parsed.sections) || parsed.sections.length === 0) {
    throw new Error('Gemini returned no sections. Please try again.');
  }
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
  return safeParseJSON(raw, 'notesFromChat');
};

 const chatWithSection = async (sectionContent, chatHistory, userMessage, declaredLevel, strictMode = true, noRelevantContext = false) => {
  const history = chatHistory.map(m => `${m.role === 'user' ? 'Student' : 'AI'}: ${m.message || m.content}`).join('\n');

  let strictInstruction;
  if (noRelevantContext) {
    strictInstruction = 'No passage in the student\'s uploaded material matched this question closely enough to use as context (SECTION BEING STUDIED below is empty). Tell the student briefly, in one short sentence, that you couldn\'t find anything relevant in their notes for this — then answer the question yourself using your own general knowledge, concisely. Do not pretend the answer came from their material.';
  } else if (strictMode) {
    strictInstruction = 'STRICT MODE: Answer ONLY using the section content provided below. Do not bring in outside knowledge. If the student asks something the section content does not cover or contradicts, say so explicitly (e.g. "This isn\'t covered in the provided material.") instead of guessing or filling the gap from general knowledge.';
  } else {
    strictInstruction = 'Use the section content as the primary source. You may use your broader knowledge to clarify or fill gaps — but if you do, make clear which parts come from the material and which are your own addition.';
  }

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

// Section-scoped chat with subject-relevance judgment baked into the prompt.
// Unlike chatWithSection (used only by home chat, which is deliberately
// unscoped, and always gets '' for sectionContent there), this NEVER sends
// section.rawContent — it's Gemini-generated, not source material, and has
// no size cap. Grounding comes only from retrievedContext (real, retrieved
// chunks) when present, and conceptIndex (cheap one-liner tags) is always
// included as the topic's scope reference either way.
const chatWithSectionScoped = async ({
  retrievedContext,   // string | null — reranked chunks from this topic, or null if nothing cleared the threshold
  conceptIndex,       // [{ tag, oneLiner }] — everything taught so far in this topic; the scope reference
  chatHistory,
  userMessage,
  declaredLevel,
  strictMode,
}) => {
  const history = chatHistory.map(m => `${m.role === 'user' ? 'Student' : 'AI'}: ${m.message || m.content}`).join('\n');

  const conceptList = (conceptIndex && conceptIndex.length > 0)
    ? conceptIndex.map(c => `- ${c.tag}: ${c.oneLiner}`).join('\n')
    : '(no concepts recorded yet for this topic)';

  const groundingBlock = retrievedContext
    ? `RETRIEVED MATERIAL (actual source content relevant to this question):\n${retrievedContext}`
    : 'No passage in this topic\'s uploaded material matched this question closely enough to retrieve. You only have the concept list below to judge scope — no source text to quote or ground an answer in.';

  const modeInstruction = strictMode
    ? `STRICT MODE — follow these rules exactly, in order:
1. You may ONLY use facts found in "RETRIEVED MATERIAL" below, if present. Never answer using your own outside knowledge, even if you're confident you know the answer.
2. First, silently judge whether the question falls within what this topic covers, using "CONCEPTS TAUGHT SO FAR" as your reference for the topic's scope. A question about a closely related concept, sub-topic, or adjacent event within that same scope still counts as in-scope. Example: if the concepts taught are about WWII, a question about WWI is in-scope. A question about an unrelated period (e.g. the Mughal Empire) or unrelated subject (e.g. biology) is NOT in-scope.
3. If in-scope but RETRIEVED MATERIAL is empty or doesn't actually answer it, say plainly that it isn't covered in the uploaded material yet. Do not guess, and do not fill the gap from general knowledge.
4. If NOT in-scope at all, say plainly that the question is off-topic for what's currently being studied, and briefly name what the topic actually covers (from CONCEPTS TAUGHT SO FAR). Do not attempt to answer it, even partially.`
    : `NON-STRICT MODE — follow these rules exactly, in order:
1. Prefer "RETRIEVED MATERIAL" below as your primary source, if present. Where it's thin, empty, or silent on specifics, you may supplement with your own general knowledge to answer more completely — but make clear which parts of your answer come from the material and which are your own addition.
2. First, silently judge whether the question stays within the same broad subject/domain as this topic, using "CONCEPTS TAUGHT SO FAR" as your reference. This is a looser check than strict mode — the exact sub-topic doesn't need to be covered, just the general subject area. Example: if the concepts taught are about one war, a question about a different but related war or era is still the same subject and should be answered, using general knowledge if needed. A question about a completely different subject (e.g. history vs biology) is NOT the same domain.
3. If the question is a genuinely different subject/domain than this topic, say plainly that it's off-topic for what's currently being studied. Do not attempt to answer it at all, even from general knowledge.`;

  const prompt = `You are a helpful AI tutor helping a student study a specific topic, at level: "${declaredLevel || 'General'}".

${modeInstruction}

CONCEPTS TAUGHT SO FAR IN THIS TOPIC:
${conceptList}

${groundingBlock}

CONVERSATION SO FAR:
${history}

STUDENT NOW ASKS: ${userMessage}

If you're answering (not refusing as off-topic or uncovered), respond conversationally, with examples/analogies suited to their level.`;

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



// Replaces the direct splitIntoConceptSections(topic.combinedText) call.
// Batch is text labeled by source; alreadyTaughtOneLiners keeps Gemini from
// re-teaching covered ground; dedupNotes surfaces contradictions explicitly.
// strictMode=true: sections must be built ONLY from batchText; anything Gemini
// isn't sure is grounded in the source must be flagged, not silently included.
// strictMode=false: Gemini may supplement with its own knowledge to fill gaps.
const generateBatchSections = async (batchText, alreadyTaughtOneLiners, dedupNotes, pagingContext = {}, strictMode = true) => {
  const alreadyTaughtBlock = alreadyTaughtOneLiners.length
    ? `\n\nTHE STUDENT HAS ALREADY BEEN TAUGHT (do not re-explain these from scratch):\n${alreadyTaughtOneLiners.map(l => `- ${l}`).join('\n')}`
    : '';

  const contradictionBlock = dedupNotes?.contradictions?.length
    ? `\n\nCONTRADICTIONS TO SURFACE EXPLICITLY (earlier material said one thing, this source says another — call this out for the student, don't silently pick one):\n${dedupNotes.contradictions.map((c, i) => `${i + 1}. Earlier: "${c.existing.slice(0, 200)}" vs New: "${c.incoming.slice(0, 200)}"`).join('\n')}`
    : '';

  const pacingBlock = pagingContext?.pagesRemainingAfterThis > 0
    ? `\n\nPACING: This batch is only PART of a larger document — roughly ${pagingContext.pagesRemainingAfterThis} more page(s) of source material are still to come after this batch, in later batches. Only teach what THIS batch's content actually contains. Do not try to preview, summarize, or front-load topics you expect to appear later — later batches will cover them properly when their content arrives. Do not pad this batch's sections with generic background to compensate for not having the rest of the document yet.`
    : `\n\nPACING: This is the FINAL batch — there is no more source material coming after this one.`;

  const strictBlock = strictMode
    ? `\n\nSTRICT MODE: Base every section STRICTLY on the BATCH CONTENT below. Do not add facts, examples, or explanations from outside the provided text. If explaining a concept properly would require information the batch content doesn't contain, say so within the section (e.g. "The source material doesn't elaborate on X") instead of inventing or assuming it.`
    : `\n\nThe batch content is the primary source, but you may supplement with your own knowledge to fill gaps or add clarifying context where the material is thin — keep the section structure driven by the document itself.`;

  const prompt = `You are an expert teacher. Split this study material batch into logical concept sections.
${alreadyTaughtBlock}
${contradictionBlock}
${pacingBlock}
${strictBlock}

Rules:
- Each section must be a complete, self-contained concept.
- For each section, return conceptTags describing the SPECIFIC claims taught, not topic labels.
  Bad:  {"tag":"JWT","oneLiner":"JSON Web Tokens for auth"}
  Good: {"tag":"JWT storage — localStorage","oneLiner":"storing JWT in localStorage after login"}
- If a contradiction was flagged above, write the section so it explains the discrepancy to the student rather than silently picking one version.

Return ONLY valid JSON with no markdown, no backticks:
{"sections":[{"heading":"...","content":"...","readingTime":3,"difficulty":"intermediate","conceptTags":[{"tag":"...","oneLiner":"..."}]}]}

BATCH CONTENT:
${batchText}`;

  const raw = await generate(prompt);
  return safeParseJSON(raw, 'batchSections');
};

// Stage 2 dedup classification (design doc §7.2).
const classifyPassagePair = async (passageA, passageB) => {
  const prompt = `PASSAGE A (already taught): ${passageA.slice(0, 1500)}

PASSAGE B (new): ${passageB.slice(0, 1500)}

Classify the relationship between B and A as exactly one word: DUPLICATE, EXTENSION, DISTINCT_SUBTOPIC, or CONTRADICTION.
Return ONLY that one word, nothing else.`;

  const raw = await generate(prompt);
  const verdict = raw.trim().toUpperCase();
  const valid = ['DUPLICATE', 'EXTENSION', 'DISTINCT_SUBTOPIC', 'CONTRADICTION'];
  return valid.includes(verdict) ? verdict : 'DISTINCT_SUBTOPIC';
};

const splitIntoConceptSections = async (fullText) => {
  const prompt = `You are an expert teacher. Split this study material into logical concept sections.

Return ONLY valid JSON with no markdown, no backticks:
{"sections":[{"heading":"Section Title","content":"Full section content","readingTime":3,"difficulty":"intermediate"}]}

difficulty must be: "beginner", "intermediate", or "advanced"
readingTime is estimated minutes to read.
Generate as many sections as needed based on natural topic breaks.

STUDY MATERIAL:
${fullText.slice(0, 60000)}`;

  const raw = await generate(prompt);
  return safeParseJSON(raw, 'conceptSections');
};

module.exports = {
  explainPage,
  explainSelection,
  generateNotes,
  regenerateSection,
  regenerateWithMissingPrerequisites,
  generateFlashcards,
  generateSectionQuiz,
  generateQuiz,
  generateSummary,
  generateRevisionSheet,
  generateCheatSheet,
  evaluateAnswer,
  splitIntoLearningSections,
  chatWithSection,
  chatWithSectionScoped,
  generateNotesFromChat,
  generateNotesFromLearning,
  updateNotesFromInstruction,
  splitIntoConceptSections,
  generateBatchSections,
  classifyPassagePair,
};