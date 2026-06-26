import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import AppLayout from '../components/layout/AppLayout';
import LeftPanel from '../components/learning/LeftPanel';
import RightPanel from '../components/learning/RightPanel';
import ChatInput from '../components/learning/ChatInput';
import Loader from '../components/common/Loader';


// ADD AFTER LINE 8:
const renderMarkdown = (text) => {
  if (!text) return '';
  return text
    .replace(/^### (.+)$/gm, '<h3 class="font-semibold text-sm mt-3 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="font-semibold text-base mt-4 mb-1.5">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="font-bold text-base mt-4 mb-2">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/(<li.*<\/li>\n?)+/g, '<ul class="space-y-0.5 my-1">$&</ul>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
};


// const MOCK_MODE = true;
const MOCK_MODE = false;

const MOCK_MATERIAL = {
  _id: 'm1', title: 'Chapter 3 — OSI Model', totalPages: 4,
  pagesUnderstood: [], isComplete: false,
};

const MOCK_CHUNKS = {
  1: { content: `The OSI Model (Open Systems Interconnection) is a conceptual framework used to understand how different network protocols interact.\n\nIt divides network communication into 7 distinct layers:\n\n1. Physical Layer\n2. Data Link Layer\n3. Network Layer\n4. Transport Layer\n5. Session Layer\n6. Presentation Layer\n7. Application Layer\n\nEach layer has a specific role and communicates with the layers directly above and below it.`, pageNumber: 1 },
  2: { content: `The Physical Layer (Layer 1) is the lowest layer of the OSI model.\n\nIt deals with the physical connection between devices and the transmission of raw binary data (bits) over a physical medium.\n\nKey responsibilities:\n- Bit transmission\n- Physical topology\n- Cable specifications\n- Signal encoding\n\nExamples: Hubs, Repeaters, Cables (Ethernet, fiber optic)`, pageNumber: 2 },
  3: { content: `The Data Link Layer (Layer 2) provides node-to-node data transfer.\n\nIt ensures reliable data transfer and handles error detection.\n\nTwo sublayers:\n- MAC (Media Access Control)\n- LLC (Logical Link Control)\n\nExamples: Ethernet, Wi-Fi (802.11), Switches, Bridges`, pageNumber: 3 },
  4: { content: `The Network Layer (Layer 3) handles logical addressing and routing.\n\nKey functions:\n- IP Addressing\n- Routing\n- Packet forwarding\n- Fragmentation\n\nProtocols: IP (IPv4/IPv6), ICMP, OSPF, BGP\nDevices: Routers`, pageNumber: 4 },
};

const MOCK_QUIZ = [
  { type: 'mcq', question: 'How many layers does the OSI model have?', options: ['5', '6', '7', '8'], correctAnswer: '7', marks: 1 },
  { type: 'short', question: 'What is the role of the Physical Layer?', marks: 2 },
  { type: 'mcq', question: 'Which device operates at the Network Layer?', options: ['Switch', 'Hub', 'Router', 'Bridge'], correctAnswer: 'Router', marks: 1 },
];

// ── AI helper ─────────────────────────────────────────────────────────────────
const callAI = async (systemPrompt, userMessage) => {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });
  const data = await response.json();
  return data.content?.[0]?.text || '';
};

// ── Generate notes for a page, informed by learning chat questions ────────────
const generatePageNotes = async (pageContent, chatMessages, declaredLevel, strictMode = true) => {
    if (!MOCK_MODE) {
    const res = await api.post('/notes/generate-page', { pageContent, chatMessages, declaredLevel, strictMode });
    return res.data.notes;
  }

  const chatContext = chatMessages.length > 0
    ? '\n\nQUESTIONS THE STUDENT ASKED DURING LEARNING (use these to identify confusion points — give those topics extra clarity in notes):\n' +
      chatMessages.filter(m => m.role === 'user').map(m => `- ${m.content}`).join('\n')
    : '';

  const systemPrompt = `You are an expert study notes maker. Generate concise, exam-oriented notes from study material.
Student level: ${declaredLevel || 'General'}.
Return plain text notes with markdown — use ## for headings, bullet points with -, and **bold** for key terms.
Keep notes focused, concise, and specific to the topic. 
Do NOT include learning examples or analogies used for explanation — only the core knowledge.
If the student had confusion about something (shown in their questions), make sure that topic is explained extra clearly in the notes.
No preamble.`;

  return callAI(systemPrompt, `Generate notes for this page:\n\n${pageContent}${chatContext}`);
};

// ── Update notes via AI chat (note editing bot) ───────────────────────────────
const updateNotesWithAI = async (currentNotes, instruction, pageContent, learningMessages) => {
  const chatContext = learningMessages.length > 0
    ? '\n\nLEARNING CHAT CONTEXT:\n' +
      learningMessages.map(m => `${m.role === 'user' ? 'Student' : 'AI'}: ${m.content}`).join('\n')
    : '';

  if (!MOCK_MODE) {
    const res = await api.post('/notes/update-with-ai', { currentNotes, instruction, pageContent, chatContext });
    return res.data.notes;
  }

  const systemPrompt = `You are an expert note editor. Apply the student's instruction to the notes.
Return ONLY the updated notes in markdown — no preamble, no explanation.`;

  return callAI(systemPrompt,
    `CURRENT NOTES:\n${currentNotes}\n\nSTUDENT INSTRUCTION: ${instruction}\n\nORIGINAL PAGE CONTENT:\n${pageContent}${chatContext}`
  );
};

// ── Answer a learning question ────────────────────────────────────────────────
const answerLearningQuestion = async (pageContent, messages, question, declaredLevel, strictMode = true) => {
  if (!MOCK_MODE) {
    const res = await api.post('/learning/ask', { pageContent, messages, question, declaredLevel, strictMode });
    return res.data.answer;
  }
  const history = messages.map(m => `${m.role === 'user' ? 'Student' : 'AI'}: ${m.content}`).join('\n');
  const systemPrompt = `You are a friendly AI tutor. Explain concepts clearly with examples suited to level: ${declaredLevel || 'General'}. Be conversational and helpful.`;
  return callAI(systemPrompt,
    `PAGE CONTENT:\n${pageContent}\n\nCONVERSATION:\n${history}\n\nSTUDENT ASKS: ${question}`
  );
};

// ─── Mode Choice Modal ────────────────────────────────────────────────────────
const ModeChoiceModal = ({ onChoose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
    <div className="bg-[var(--surface-0)] border border-[var(--border)] rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
      <div className="text-center mb-5">
        <div className="text-3xl mb-2">📖</div>
        <h2 className="font-semibold text-[var(--text-primary)] text-base">How do you want to learn?</h2>
        <p className="text-xs text-[var(--text-muted)] mt-1.5">Choose your study mode for this session.</p>
      </div>
      <div className="space-y-3">
        <button
          onClick={() => onChoose('learn_and_notes')}
          className="w-full text-left px-4 py-4 rounded-xl border-2 border-[var(--accent)] bg-blue-50/30 dark:bg-blue-900/10 hover:opacity-90 transition-opacity"
        >
          <div className="flex items-start gap-3">
            <span className="text-xl">📝</span>
            <div>
              <p className="font-medium text-sm text-[var(--text-primary)]">Learn + Build Notes</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">
                Notes are auto-generated after each page using your learning chat. 3-panel view.
              </p>
            </div>
          </div>
        </button>
        <button
          onClick={() => onChoose('learn_only')}
          className="w-full text-left px-4 py-4 rounded-xl border border-[var(--border)] hover:border-[var(--accent)] transition-colors"
        >
          <div className="flex items-start gap-3">
            <span className="text-xl">🧠</span>
            <div>
              <p className="font-medium text-sm text-[var(--text-primary)]">Just Learn</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">
                Normal 2-panel view. No notes created.
              </p>
            </div>
          </div>
        </button>
      </div>
    </div>
  </div>
);

// ─── Uploaded Notes Drawer ─────────────────────────────────────────────────
const UploadedNotesDrawer = ({ content, onClose }) => (
  <div className="fixed inset-0 z-50 flex">
    <div className="absolute inset-0 bg-black/40" onClick={onClose} />
    <div className="relative ml-auto w-full max-w-md bg-[var(--surface-0)] border-l border-[var(--border)] flex flex-col h-full shadow-2xl">
      <div className="px-5 py-3 border-b border-[var(--border)] flex items-center justify-between shrink-0">
        <span className="text-sm font-semibold text-[var(--text-primary)]">📄 Your Uploaded Notes</span>
        <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-lg leading-none">✕</button>
      </div>
      <div className="flex-1 overflow-y-auto p-5 text-sm text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">
        {content || 'No uploaded content found.'}
      </div>
    </div>
  </div>
);

// ─── Notes Panel (3rd panel) ──────────────────────────────────────────────────
// Shows CUMULATIVE notes for all pages completed so far.
const NotesPanel = ({ cumulativeNotes, currentNotes, generating, pageContent, learningMessages, declaredLevel, onManualGenerate, onNotesChange, newNotesBannerPage, fontSize = 15 }) => {
  const [input, setInput] = useState('');
  const [updating, setUpdating] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (newNotesBannerPage && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [newNotesBannerPage, cumulativeNotes]);

  const handleNotesEdit = async () => {
    if (!input.trim() || updating) return;
    const instruction = input.trim();
    setInput('');
    setUpdating(true);
    try {
      const updated = await updateNotesWithAI(currentNotes, instruction, pageContent, learningMessages);
      onNotesChange(updated);
    } catch (e) {
      console.error('Notes update failed', e);
    } finally {
      setUpdating(false);
    }
  };

  const sortedNotes = [...cumulativeNotes].sort((a, b) => a.page - b.page);

  return (
    <div className="flex flex-col h-full border-r border-[var(--border)]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--surface-0)] shrink-0 flex items-center justify-between">
        <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">📝 Notes</span>
        {(generating || updating) && (
          <span className="text-xs text-[var(--accent)] animate-pulse">
            {generating ? 'Generating…' : 'Updating…'}
          </span>
        )}
      </div>

      {/* New notes banner */}
      {newNotesBannerPage && (
        <div className="px-4 py-2 bg-green-50 dark:bg-green-900/20 border-b border-green-200 dark:border-green-800 text-xs text-green-700 dark:text-green-400 flex items-center gap-2 shrink-0">
          <span>✨</span>
          <span>New notes added for Page {newNotesBannerPage}! Scroll down to view.</span>
        </div>
      )}

      {/* Cumulative notes content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {generating && (
          <div className="flex flex-col items-center justify-center h-20 gap-2">
            <div className="w-4 h-4 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-[var(--text-muted)]">Generating notes…</p>
          </div>
        )}

        {sortedNotes.length === 0 && !generating && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
            <span className="text-2xl">📋</span>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Notes appear here after each page. Click <strong>Next</strong> to generate.
            </p>
            <button
              onClick={onManualGenerate}
              disabled={generating}
              className="mt-1 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-xs font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              Generate Notes Now
            </button>
          </div>
        )}

        {sortedNotes.map(({ page, notes }) => (
          <div key={page} className="border border-[var(--border)] rounded-xl overflow-hidden">
            <div className="px-3 py-2 bg-[var(--surface-1)] border-b border-[var(--border)]">
              <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Page {page}</span>
            </div>
            <div className="p-3 text-sm text-[var(--text-primary)] leading-relaxed"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(notes) }}
            />
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* AI edit box — only shown when notes exist */}
      {sortedNotes.length > 0 && currentNotes && (
        <div className="border-t border-[var(--border)] bg-[var(--surface-0)] p-3 shrink-0">
          <p className="text-xs text-[var(--text-muted)] mb-2">Edit current page notes via AI:</p>
          <div className="flex gap-2 items-end">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleNotesEdit(); } }}
              placeholder={`e.g. "Add an example for TCP" or "Remove the last bullet"`}
              rows={2}
              disabled={updating || generating}
              className="flex-1 resize-none rounded-lg border border-[var(--border)] bg-[var(--surface-1)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] text-xs px-3 py-2 focus:outline-none focus:border-[var(--accent)] transition-colors"
            />
            <button
              onClick={handleNotesEdit}
              disabled={updating || generating || !input.trim()}
              className="px-3 py-2 bg-[var(--accent)] hover:opacity-90 text-white rounded-lg text-xs font-medium disabled:opacity-40 transition-colors self-end"
            >
              {updating ? '…' : 'Edit'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Notes Review Popup ───────────────────────────────────────────────────────
const NotesReviewPopup = ({ notes, onNotesChange, pageNumber, pageContent, learningMessages, declaredLevel, onSatisfied, onGoBack, onContinueAnyway }) => {
  const [input, setInput] = useState('');
  const [updating, setUpdating] = useState(false);

  const handleEdit = async () => {
    if (!input.trim() || updating) return;
    const instruction = input.trim();
    setInput('');
    setUpdating(true);
    try {
      const updated = await updateNotesWithAI(notes, instruction, pageContent, learningMessages);
      onNotesChange(updated);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-[var(--surface-0)] border border-[var(--border)] rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-[var(--border)] shrink-0">
          <h3 className="font-semibold text-[var(--text-primary)]">Notes for Page {pageNumber}</h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">Review and edit before moving on.</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="text-sm text-[var(--text-primary)] leading-relaxed bg-[var(--surface-1)] rounded-xl p-4 border border-[var(--border)]"
            dangerouslySetInnerHTML={{ __html: notes ? renderMarkdown(notes) : 'No notes generated.' }}
          />
        </div>

        <div className="px-6 py-3 border-t border-[var(--border)] bg-[var(--surface-0)] shrink-0">
          <p className="text-xs text-[var(--text-muted)] mb-2">Edit via AI:</p>
          <div className="flex gap-2 items-end">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEdit(); } }}
              placeholder={`e.g. "At line 3, remove the example" or "Make the TCP definition simpler"`}
              rows={2}
              disabled={updating}
              className="flex-1 resize-none rounded-lg border border-[var(--border)] bg-[var(--surface-1)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] text-xs px-3 py-2 focus:outline-none focus:border-[var(--accent)] transition-colors"
            />
            <button
              onClick={handleEdit}
              disabled={updating || !input.trim()}
              className="px-3 py-2 bg-[var(--accent)] hover:opacity-90 text-white rounded-lg text-xs font-medium disabled:opacity-40 self-end"
            >
              {updating ? '…' : 'Edit'}
            </button>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-[var(--border)] flex flex-col gap-2 shrink-0">
          <button
            onClick={onSatisfied}
            className="w-full py-2.5 rounded-xl bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            ✓ Satisfied — move to next page
          </button>
          <button
            onClick={onGoBack}
            className="w-full py-2.5 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:border-[var(--accent)] transition-colors"
          >
            ← Go back and keep learning
          </button>
          <button
            onClick={onContinueAnyway}
            className="w-full py-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            Continue anyway (skip for now)
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Final Notes Summary Popup ────────────────────────────────────────────────
const FinalNotesPopup = ({ allPageNotes, totalPages, onSave, onDiscard }) => {
  const combined = Object.entries(allPageNotes)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([page, notes]) => `### Page ${page}\n\n${notes}`)
    .join('\n\n---\n\n');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-[var(--surface-0)] border border-[var(--border)] rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-[var(--border)] shrink-0">
          <h3 className="font-semibold text-[var(--text-primary)] text-base">📋 Your Chapter Notes</h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            These notes were built from your learning session. Are you satisfied?
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {combined ? (
            <div className="text-sm text-[var(--text-primary)] leading-relaxed bg-[var(--surface-1)] rounded-xl p-4 border border-[var(--border)]"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(combined) }}
            />
          ) : (
            <p className="text-xs text-[var(--text-muted)] text-center mt-8">No notes were generated this session.</p>
          )}
        </div>

        <div className="px-6 py-4 border-t border-[var(--border)] flex flex-col gap-2 shrink-0">
          <button
            onClick={onSave}
            className="w-full py-2.5 rounded-xl bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90"
          >
            💾 Save notes for this chapter
          </button>
          <button
            onClick={onDiscard}
            className="w-full py-2.5 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:border-red-400 hover:text-red-500 transition-colors"
          >
            🗑️ Discard — don't save
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Quiz Modal ───────────────────────────────────────────────────────────────
// const QuizModal = ({ onClose, onSkip, quizMode }) => {
//   const [answers, setAnswers] = useState({});
//   const [submitted, setSubmitted] = useState(false);
//   const [score, setScore] = useState(0);

//   const handleSubmit = () => {
//     let s = 0;
//     MOCK_QUIZ.forEach((q, i) => {
//       if (q.type === 'mcq' && answers[i] === q.correctAnswer) s += q.marks;
//     });
//     setScore(s);
//     setSubmitted(true);
//   };

//   return (
//     <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
//       <div className="bg-[var(--surface-0)] border border-[var(--border)] rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto">
//         <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
//           <h3 className="font-semibold text-[var(--text-primary)]">{quizMode === 'end' ? 'Chapter Quiz' : 'Quick Check'}</h3>
//           <button onClick={onSkip} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] px-3 py-1 rounded-lg hover:bg-[var(--surface-2)] transition-colors">
//             {submitted ? 'Close' : 'Skip quiz'}
//           </button>
//         </div>
//         <div className="p-6 space-y-5">
//           {MOCK_QUIZ.map((q, i) => (
//             <div key={i} className="space-y-2">
//               <p className="text-sm font-medium text-[var(--text-primary)]">
//                 <span className="text-[var(--text-muted)] font-mono mr-2">Q{i + 1}.</span>{q.question}
//               </p>
//               {q.type === 'mcq' && q.options.map((opt, j) => (
//                 <label key={j} className={`flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer text-sm transition-colors ${
//                   submitted
//                     ? opt === q.correctAnswer ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
//                     : answers[i] === opt ? 'bg-red-50 dark:bg-red-900/20 text-red-500' : 'text-[var(--text-muted)]'
//                     : 'hover:bg-[var(--surface-2)] text-[var(--text-secondary)]'
//                 }`}>
//                   <input type="radio" name={`q${i}`} value={opt} checked={answers[i] === opt}
//                     onChange={() => setAnswers(a => ({ ...a, [i]: opt }))} disabled={submitted} />
//                   {opt}
//                 </label>
//               ))}
//               {q.type === 'short' && (
//                 <textarea rows={2} placeholder="Your answer…" value={answers[i] || ''}
//                   onChange={e => setAnswers(a => ({ ...a, [i]: e.target.value }))} disabled={submitted}
//                   className="w-full border border-[var(--border)] rounded-xl bg-[var(--surface-1)] text-[var(--text-primary)] px-3 py-2 text-sm resize-none focus:outline-none focus:border-[var(--accent)]" />
//               )}
//             </div>
//           ))}
//         </div>
//         <div className="px-6 py-4 border-t border-[var(--border)] flex items-center justify-between">
//           {submitted ? <p className="text-sm font-medium text-[var(--text-primary)]">Score: {score} / {MOCK_QUIZ.reduce((a, q) => a + q.marks, 0)}</p> : <span />}
//           {!submitted
//             ? <button onClick={handleSubmit} className="px-4 py-2 rounded-xl bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90">Submit</button>
//             : <button onClick={onClose} className="px-4 py-2 rounded-xl bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90">Continue</button>
//           }
//         </div>
//       </div>
//     </div>
//   );
// };
// Around line 414 — replace the entire QuizModal component
const QuizModal = ({ materialId, sectionContent, sectionHeading, declaredLevel, onClose, onSkip, quizMode }) => {
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (MOCK_MODE) { setQuiz({ questions: MOCK_QUIZ }); setLoading(false); return; }

    if (quizMode === 'between') {
      // Generate a fresh mini quiz from just this section's content
      if (!sectionContent) { setLoading(false); return; }
      api.post('/quiz/section-quiz', { sectionContent, sectionHeading, declaredLevel })
        .then(res => setQuiz(res.data))
        .catch(() => setQuiz(null))
        .finally(() => setLoading(false));
    } else {
      // End-of-topic: use the full pre-generated quiz
      api.get(`/quiz/${materialId}`)
        .then(res => setQuiz(res.data))
        .catch(() => {
          // No quiz saved yet — generate one now
          return api.post(`/quiz/${materialId}/generate`)
            .then(res => setQuiz(res.data))
            .catch(() => setQuiz(null));
        })
        .finally(() => setLoading(false));
    }
  }, [materialId, quizMode, sectionContent]);

  // If quiz loaded but has no questions, auto-dismiss without showing popup
  useEffect(() => {
    if (!loading && (!quiz || !quiz.questions || quiz.questions.length === 0)) {
      onSkip();
    }
  }, [loading, quiz, onSkip]);

  const handleSubmit = () => {
    let s = 0;
    (quiz?.questions || []).forEach((q, i) => {
      if (q.type === 'mcq' && answers[i] === q.correctAnswer) s += q.marks || 1;
    });
    setScore(s);
    setSubmitted(true);
    if (!MOCK_MODE && quiz?._id) {
      api.post('/quiz/attempt', { quizId: quiz._id, answers, score: s, total: quiz.questions.length }).catch(console.error);
    }
  };

  if (loading) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-[var(--surface-0)] border border-[var(--border)] rounded-2xl p-8"><Loader /></div>
    </div>
  );

  const questions = quiz?.questions || [];
  if (questions.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-[var(--surface-0)] border border-[var(--border)] rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <h3 className="font-semibold text-[var(--text-primary)]">{quizMode === 'end' ? 'Chapter Quiz' : 'Quick Check'}</h3>
          <button onClick={onSkip} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] px-3 py-1 rounded-lg hover:bg-[var(--surface-2)] transition-colors">
            {submitted ? 'Close' : 'Skip quiz'}
          </button>
        </div>
        <div className="p-6 space-y-5">
          {questions.map((q, i) => (
            <div key={i} className="space-y-2">
              <p className="text-sm font-medium text-[var(--text-primary)]">
                <span className="text-[var(--text-muted)] font-mono mr-2">Q{i + 1}.</span>{q.question}
              </p>
              {q.type === 'mcq' && (q.options || []).map((opt, j) => (
                <label key={j} className={`flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer text-sm transition-colors ${
                  submitted
                    ? opt === q.correctAnswer ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                    : answers[i] === opt ? 'bg-red-50 dark:bg-red-900/20 text-red-500' : 'text-[var(--text-muted)]'
                    : 'hover:bg-[var(--surface-2)] text-[var(--text-secondary)]'
                }`}>
                  <input type="radio" name={`q${i}`} value={opt} checked={answers[i] === opt}
                    onChange={() => setAnswers(a => ({ ...a, [i]: opt }))} disabled={submitted} />
                  {opt}
                </label>
              ))}
              {q.type !== 'mcq' && (
                <textarea rows={2} placeholder="Your answer…" value={answers[i] || ''}
                  onChange={e => setAnswers(a => ({ ...a, [i]: e.target.value }))} disabled={submitted}
                  className="w-full border border-[var(--border)] rounded-xl bg-[var(--surface-1)] text-[var(--text-primary)] px-3 py-2 text-sm resize-none focus:outline-none focus:border-[var(--accent)]" />
              )}
            </div>
          ))}
        </div>
        <div className="px-6 py-4 border-t border-[var(--border)] flex items-center justify-between">
          {submitted ? <p className="text-sm font-medium text-[var(--text-primary)]">Score: {score} / {questions.reduce((a, q) => a + (q.marks || 1), 0)}</p> : <span />}
          {!submitted
            ? <button onClick={handleSubmit} className="px-4 py-2 rounded-xl bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90">Submit</button>
            : <button onClick={onClose} className="px-4 py-2 rounded-xl bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90">Continue</button>
          }
        </div>
      </div>
    </div>
  );
};


// ─── Collapse Tab (thin vertical strip shown when a panel is collapsed) ───────
const CollapseTab = ({ label, onClick }) => (
  <div
    onClick={onClick}
    className="w-7 shrink-0 flex items-center justify-center cursor-pointer bg-[var(--surface-1)] hover:bg-[var(--surface-2)] border-r border-[var(--border)] transition-colors"
    title={`Expand ${label}`}
  >
    <span className="text-xs text-[var(--text-muted)] font-medium select-none" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
      {label} ▶
    </span>
  </div>
);


// ADD BEFORE: const LearningMode = () => {
const ChapterQuizPrompt = ({ onYes, onNo }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
    <div className="bg-[var(--surface-0)] border border-[var(--border)] rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 text-center">
      <div className="text-3xl mb-3">🎓</div>
      <h3 className="font-semibold text-[var(--text-primary)] text-base mb-2">Chapter Complete!</h3>
      <p className="text-sm text-[var(--text-muted)] mb-5 leading-relaxed">
        You've finished all sections. Would you like to take the full chapter quiz now?
      </p>
      <div className="flex flex-col gap-2">
        <button
          onClick={onYes}
          className="w-full py-2.5 rounded-xl bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Yes, take the chapter quiz
        </button>
        <button
          onClick={onNo}
          className="w-full py-2.5 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:border-[var(--accent)] transition-colors"
        >
          No, go back to dashboard
        </button>
      </div>
    </div>
  </div>
);


// ─── Main Component ───────────────────────────────────────────────────────────
const LearningMode = () => {
  const { materialId } = useParams();
  const navigate = useNavigate();

  const [material, setMaterial] = useState(null);
  const [chunk, setChunk] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [maxReachedPage, setMaxReachedPage] = useState(1);
  const [messages, setMessages] = useState([]);
  const [allPageMessages, setAllPageMessages] = useState({});
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false);
  const [quizMode, setQuizMode] = useState('between');
  const [quizzesEnabled, setQuizzesEnabled] = useState(true);
  const [fontSize, setFontSize] = useState(15);
  const [declaredLevel, setDeclaredLevel] = useState('General');
  const [strictDocMode, setStrictDocMode] = useState(true); // true = stick to uploaded docs only
  
  
  // Notes state
  const [hasExistingNotes, setHasExistingNotes] = useState(null);
  const [learnMode, setLearnMode] = useState(null);
  const [pageNotes, setPageNotes] = useState({});
  const [currentNotes, setCurrentNotes] = useState('');
  const [generatingNotes, setGeneratingNotes] = useState(false);
  const [cumulativeNotes, setCumulativeNotes] = useState([]); // [{page, notes}]
  const [newNotesBannerPage, setNewNotesBannerPage] = useState(null);

  // Uploaded notes
  const [uploadedNotesPanelOpen, setUploadedNotesPanelOpen] = useState(false);
  const [uploadedNotesContent, setUploadedNotesContent] = useState(null);

  // Panel collapse state
  const [notesCollapsed, setNotesCollapsed] = useState(false);
  const [contentCollapsed, setContentCollapsed] = useState(false);
  const [chatCollapsed, setChatCollapsed] = useState(false);

  // UI state
  const [showReview, setShowReview] = useState(false);
  const [showFinalNotes, setShowFinalNotes] = useState(false);
  const [showChapterQuizPrompt, setShowChapterQuizPrompt] = useState(false);
  const [nextTarget, setNextTarget] = useState(null);


  // Panel widths
  const [notesPct, setNotesPct] = useState(28);
  const [contentPct, setContentPct] = useState(38);
  const [leftPct, setLeftPct] = useState(50);
  const dragging = useRef(null);
  const containerRef = useRef(null);

  const onMouseMove = useCallback((e) => {
    if (!dragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    if (dragging.current === 'two') {
      setLeftPct(Math.min(80, Math.max(20, pct)));
    } else if (dragging.current === 'nc') {
      setNotesPct(Math.min(40, Math.max(15, pct)));
    } else if (dragging.current === 'cc') {
      const newContent = pct - notesPct;
      if (newContent >= 20 && notesPct + newContent <= 80) setContentPct(newContent);
    }
  }, [notesPct]);

  const onMouseUp = () => { dragging.current = null; };

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp); };
  }, [onMouseMove]);

  // Load material
  useEffect(() => {
    if (MOCK_MODE) {
      setMaterial(MOCK_MATERIAL);
      setDeclaredLevel('Class 11 (Science)');
      setHasExistingNotes(false);
      setUploadedNotesContent(`Chapter 3 — OSI Model\n\nYour Uploaded Notes:\n- OSI has 7 layers\n- Physical layer deals with bits\n- Data Link: MAC + LLC sublayers\n- Network layer: IP, routing\n- Transport: TCP/UDP\n- Session: manages connections\n- Presentation: encryption, encoding\n- Application: HTTP, FTP, DNS`);
      return;
    }
    api.get(`/topics/${materialId}`).then(res => {
      const topic = res.data;
      // Build a material-shaped object with totalPages unknown until chunk loads
      setMaterial({ _id: topic._id, title: topic.title, totalPages: 1 });
      // Show filenames as uploaded notes reference
      if (topic.materialDetails && topic.materialDetails.length > 0) {
        setUploadedNotesContent(topic.materialDetails.map(m => `📄 ${m.title}`).join('\n'));
      }
    });
    api.get('/auth/me').then(res => setDeclaredLevel(res.data?.declaredLevel || 'General'));
    api.get(`/notes/${materialId}/all`).then(res => {
      const exists = res.data && res.data.length > 0;
      setHasExistingNotes(exists);
      if (exists) setLearnMode('learn_only');
    }).catch(() => setHasExistingNotes(false));
  }, [materialId]);

  // Load chunk when page or mode changes
  useEffect(() => {
    if (!learnMode || !material) return;
    setPageLoading(true);

    if (messages.length > 0) {
      setAllPageMessages(prev => ({ ...prev, [currentPage]: messages }));
    }
    setMessages([]);
    setCurrentNotes(pageNotes[currentPage] || '');

    if (MOCK_MODE) {
      setTimeout(() => {
        setChunk(MOCK_CHUNKS[currentPage]);
        setPageLoading(false);
      }, 300);
      return;
    }

    api.get(`/learning/${materialId}/chunk/${currentPage}?level=${encodeURIComponent(declaredLevel)}&strict=${strictDocMode}`)
      .then(res => {
        setChunk(res.data);
        // Update totalPages now that we know it
        if (res.data.totalPages) {
          setMaterial(prev => prev ? { ...prev, totalPages: res.data.totalPages } : prev);
        }
      })
      .finally(() => setPageLoading(false));
  }, [materialId, currentPage, learnMode]);

  // When strictDocMode is toggled mid-session, force regenerate sections
  const prevStrictRef = useRef(strictDocMode);
  useEffect(() => {
    if (!learnMode || !material || prevStrictRef.current === strictDocMode) return;
    prevStrictRef.current = strictDocMode;
    setPageLoading(true);
    api.post(`/learning/${materialId}/regenerate-sections`, {
      declaredLevel,
      strictMode: strictDocMode,
    }).then(() => {
      setCurrentPage(1);
    }).catch(console.error).finally(() => setPageLoading(false));
  }, [strictDocMode]);

  // Sync currentNotes changes back to pageNotes map
  useEffect(() => {
    if (currentNotes && currentPage) {
      setPageNotes(prev => ({ ...prev, [currentPage]: currentNotes }));
    }
  }, [currentNotes]);

  const handleAsk = async (question) => {
    const newMsg = { role: 'user', content: question };
    setMessages(m => [...m, newMsg]);
    setLoading(true);
    try {
      const answer = await answerLearningQuestion(
        chunk?.content || '',
        [...messages, newMsg],
        question,
        declaredLevel,
        strictDocMode
      );
      setMessages(m => [...m, { role: 'ai', content: answer }]);
    } catch {
      setMessages(m => [...m, { role: 'ai', content: 'Something went wrong. Please try again.' }]);
    } finally { setLoading(false); }
  };

  const handleExplainSelection = async (selectedText, mode) => {
    setMessages(m => [...m, { role: 'user', content: `[${mode}] "${selectedText.slice(0, 60)}…"` }]);
    setLoading(true);
    try {
      const answer = await answerLearningQuestion(
        chunk?.content || '',
        messages,
        `${mode === 'explain' ? 'Explain' : mode === 'simplify' ? 'Simplify' : 'Give an example for'}: "${selectedText}"`,
        declaredLevel,
        strictDocMode
      );
      setMessages(m => [...m, { role: 'ai', content: answer }]);
    } finally { setLoading(false); }
  };

  const handleManualGenerateNotes = async () => {
    if (generatingNotes || !chunk) return;
    setGeneratingNotes(true);
    try {
      const notes = await generatePageNotes(chunk.content, messages, declaredLevel, strictDocMode);
      setCurrentNotes(notes);
      setPageNotes(prev => ({ ...prev, [currentPage]: notes }));
      setCumulativeNotes(prev => {
        const filtered = prev.filter(n => n.page !== currentPage);
        return [...filtered, { page: currentPage, notes }];
      });
      setNewNotesBannerPage(currentPage);
      setTimeout(() => setNewNotesBannerPage(null), 4000);
    } finally {
      setGeneratingNotes(false);
    }
  };

  const handleNext = async () => {
    const isLast = currentPage >= material.totalPages;
    const target = isLast ? 'end' : currentPage + 1;
    setNextTarget(target);
    // Extend max reachable page
    if (!isLast) setMaxReachedPage(prev => Math.max(prev, currentPage + 1));

    if (learnMode === 'learn_and_notes') {
      setGeneratingNotes(true);
      try {
        const savedMessages = [...messages];
        const notes = await generatePageNotes(chunk?.content || '', savedMessages, declaredLevel, strictDocMode);
        setCurrentNotes(notes);
        setPageNotes(prev => ({ ...prev, [currentPage]: notes }));
        setCumulativeNotes(prev => {
          const filtered = prev.filter(n => n.page !== currentPage);
          return [...filtered, { page: currentPage, notes }];
        });
        setNewNotesBannerPage(currentPage);
        setTimeout(() => setNewNotesBannerPage(null), 4000);
        setAllPageMessages(prev => ({ ...prev, [currentPage]: savedMessages }));

        // Auto-save this section's notes to backend immediately
        if (!MOCK_MODE) {
          api.post(`/notes/${materialId}/save-section`, {
            pageNumber: currentPage,
            content: notes,
            heading: chunk?.heading || `Section ${currentPage}`,
          }).catch(e => console.error('Notes save failed', e));
        }
      } catch (e) {
        console.error('Notes generation on Next failed', e);
      } finally {
        setGeneratingNotes(false);
      }
      // Skip review popup — notes already visible in left panel. Go straight to next.
      proceedToNext(target);
      return;
    }

    proceedToNext(target);
  };

  const proceedToNext = (target) => {
    if (target === 'end') {
      // Show section quiz for the LAST section first (like any other section)
      // then after that quiz, show final notes / chapter quiz prompt
      if (quizzesEnabled) {
        setQuizMode('between'); // section-specific quiz for the last page
        setQuizOpen(true);
        // flag that after this quiz we're actually done
        setNextTarget('end_after_section_quiz');
      } else if (learnMode === 'learn_and_notes' && Object.keys(pageNotes).length > 0) {
        setShowFinalNotes(true);
      } else {
        setShowChapterQuizPrompt(true);
      }
    } else if (quizzesEnabled) {
      setQuizMode('between');
      setQuizOpen(true);
    } else {
      setCurrentPage(target);
      setNextTarget(null);
    }
  };

  const handleReviewSatisfied = () => { setShowReview(false); proceedToNext(nextTarget); };
  const handleReviewGoBack = () => setShowReview(false);
  const handleReviewContinueAnyway = () => { setShowReview(false); proceedToNext(nextTarget); };

  const handleFinalSave = async () => {
    setShowFinalNotes(false);
    if (!MOCK_MODE) {
      const combined = Object.entries(pageNotes)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([, notes]) => notes)
        .join('\n\n---\n\n');
      await api.post(`/notes/${materialId}/save`, { content: combined });
    }
    setShowChapterQuizPrompt(true);
  };
  const handleFinalDiscard = () => { setShowFinalNotes(false); setShowChapterQuizPrompt(true); };


  const handleQuizClose = () => {
    setQuizOpen(false);
    if (quizMode === 'end') {
      navigate(`/material/${materialId}/quiz`);
    } else if (nextTarget === 'end_after_section_quiz') {    } else {
      if (nextTarget !== null) setCurrentPage(nextTarget);
      setNextTarget(null);
    }
  };
  const handleQuizSkip = () => {
    setQuizOpen(false);
    if (nextTarget === 'end_after_section_quiz') {
      if (learnMode === 'learn_and_notes' && Object.keys(pageNotes).length > 0) {
        setShowFinalNotes(true);
      } else {
        setShowChapterQuizPrompt(true);
      }
      setNextTarget(null);
    } else if (quizMode !== 'end') {
      if (nextTarget !== null) setCurrentPage(nextTarget);
      setNextTarget(null);
    }
  };

  if (!material || hasExistingNotes === null) return <AppLayout><Loader text="Loading material…" /></AppLayout>;

  const isThreePanel = learnMode === 'learn_and_notes';

  return (
    <AppLayout>
      {!learnMode && hasExistingNotes === false && (
        <ModeChoiceModal onChoose={setLearnMode} />
      )}

      {uploadedNotesPanelOpen && (
        <UploadedNotesDrawer
          content={uploadedNotesContent}
          onClose={() => setUploadedNotesPanelOpen(false)}
        />
      )}

      {showReview && (
        <NotesReviewPopup
          notes={currentNotes}
          onNotesChange={setCurrentNotes}
          pageNumber={currentPage}
          pageContent={chunk?.content || ''}
          learningMessages={messages}
          declaredLevel={declaredLevel}
          onSatisfied={handleReviewSatisfied}
          onGoBack={handleReviewGoBack}
          onContinueAnyway={handleReviewContinueAnyway}
        />
      )}

      {showFinalNotes && (
        <FinalNotesPopup
          allPageNotes={pageNotes}
          totalPages={material.totalPages}
          onSave={handleFinalSave}
          onDiscard={handleFinalDiscard}
        />
      )}

      {showChapterQuizPrompt && (
        <ChapterQuizPrompt
          onYes={() => { setShowChapterQuizPrompt(false); setQuizMode('end'); setQuizOpen(true); }}
          onNo={() => { setShowChapterQuizPrompt(false); navigate('/dashboard'); }}
        />
      )}

      {quizOpen && materialId && (
        <QuizModal
          materialId={materialId}
          sectionContent={chunk?.content || ''}
          sectionHeading={chunk?.heading || ''}
          declaredLevel={declaredLevel}
          onClose={handleQuizClose}
          onSkip={handleQuizSkip}
          quizMode={quizMode}
        />
      )}

      {generatingNotes && !showReview && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20 backdrop-blur-sm pointer-events-none">
          <div className="bg-[var(--surface-0)] border border-[var(--border)] rounded-xl px-5 py-3 flex items-center gap-3 shadow-lg">
            <div className="w-4 h-4 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-[var(--text-primary)]">Generating notes from your session…</span>
          </div>
        </div>
      )}

      <div className="h-[calc(100vh-48px)] flex flex-col">
        {/* Top bar */}
        <div className="border-b border-[var(--border)] bg-[var(--surface-0)] px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] px-2 py-1 rounded-lg hover:bg-[var(--surface-2)] transition-colors shrink-0"
            >
              ← Back
            </button>
            <h2 className="font-medium text-sm text-[var(--text-primary)] truncate max-w-xs">{material.title}</h2>
            {isThreePanel && (
              <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">📝 Learn + Notes</span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs">
            {/* Font size controls */}
            <div className="flex items-center gap-1 border border-[var(--border)] rounded-lg px-1.5 py-0.5">
              <button
                onClick={() => setFontSize(s => Math.max(11, s - 1))}
                className="w-5 h-5 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] font-bold text-xs"
                title="Decrease font size"
              >A-</button>
              <span className="text-[var(--text-muted)] text-xs w-5 text-center">{fontSize}</span>
              <button
                onClick={() => setFontSize(s => Math.min(26, s + 1))}
                className="w-5 h-5 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] font-bold text-xs"
                title="Increase font size"
              >A+</button>
            </div>
            {/* View Uploaded Notes — always visible in top bar */}
            <button
              onClick={() => setUploadedNotesPanelOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--surface-1)] hover:bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-secondary)] transition-colors font-medium text-xs"
            >
              📄 View Uploaded Notes
            </button>
            <label className="flex items-center gap-2 cursor-pointer select-none text-[var(--text-muted)]">
              <span>Quizzes</span>
              <button
                onClick={() => setQuizzesEnabled(q => !q)}
                className={`relative w-8 h-4 rounded-full transition-colors ${quizzesEnabled ? 'bg-[var(--accent)]' : 'bg-[var(--surface-2)]'}`}
              >
                <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all ${quizzesEnabled ? 'left-4' : 'left-0.5'}`} />
              </button>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none text-[var(--text-muted)]">
              <span className="text-xs">{strictDocMode ? '📄 Doc only' : '🌐 + Gemini'}</span>
              <button
                onClick={() => setStrictDocMode(s => !s)}
                className={`relative w-8 h-4 rounded-full transition-colors ${!strictDocMode ? 'bg-[var(--accent)]' : 'bg-[var(--surface-2)]'}`}
                title="Toggle: stick to uploaded documents vs allow Gemini to fill gaps"
              >
                <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all ${!strictDocMode ? 'left-4' : 'left-0.5'}`} />
              </button>
            </label>
          </div>
        </div>

        {/* Panels */}
        <div ref={containerRef} className="flex flex-1 overflow-hidden select-none">
          {isThreePanel ? (
            <>
              {/* Notes panel */}
              {notesCollapsed ? (
                <CollapseTab label="📝 Notes" onClick={() => setNotesCollapsed(false)} />
              ) : (
                <div className="flex flex-col overflow-hidden" style={{ width: `${notesPct}%` }}>
                  <div className="px-3 py-1.5 border-b border-[var(--border)] bg-[var(--surface-0)] flex items-center justify-end shrink-0">
                    <button onClick={() => setNotesCollapsed(true)} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] px-2 py-0.5 rounded hover:bg-[var(--surface-2)] transition-colors">◀ Collapse</button>
                  </div>
                  <NotesPanel
                    cumulativeNotes={cumulativeNotes}
                    currentNotes={currentNotes}
                    onNotesChange={setCurrentNotes}
                    generating={generatingNotes}
                    pageContent={chunk?.content || ''}
                    learningMessages={allPageMessages[currentPage] || messages}
                    declaredLevel={declaredLevel}
                    onManualGenerate={handleManualGenerateNotes}
                    newNotesBannerPage={newNotesBannerPage}
                    fontSize={fontSize}
                  />
                </div>
              )}

              <div onMouseDown={() => { if (!notesCollapsed) dragging.current = 'nc'; }}
                className="w-1 bg-[var(--border)] hover:bg-[var(--accent)] cursor-col-resize shrink-0 transition-colors" />

              {/* Content panel */}
              {contentCollapsed ? (
                <CollapseTab label="📖 Content" onClick={() => setContentCollapsed(false)} />
              ) : (
                <div className="flex flex-col overflow-hidden" style={{ width: `${contentPct}%` }}>
                  <div className="px-3 py-1.5 border-b border-[var(--border)] bg-[var(--surface-0)] flex items-center justify-between shrink-0">
                    <span className="text-xs text-[var(--text-muted)]">Page {currentPage} / {material.totalPages}</span>
                    <button onClick={() => setContentCollapsed(true)} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] px-2 py-0.5 rounded hover:bg-[var(--surface-2)] transition-colors">◀ Collapse</button>
                  </div>
                  {pageLoading ? <Loader /> : (
                    <LeftPanel
                      chunk={chunk}
                      currentPage={currentPage}
                      totalPages={material.totalPages}
                      maxReachedPage={maxReachedPage}
                      onPageChange={setCurrentPage}
                      onExplainSelection={handleExplainSelection}
                      onNext={handleNext}
                      fontSize={fontSize}
                    />
                  )}
                </div>
              )}

              <div onMouseDown={() => { if (!contentCollapsed) dragging.current = 'cc'; }}
                className="w-1 bg-[var(--border)] hover:bg-[var(--accent)] cursor-col-resize shrink-0 transition-colors" />

              {/* Chat panel */}
              {chatCollapsed ? (
                <CollapseTab label="💬 Chat" onClick={() => setChatCollapsed(false)} />
              ) : (
                <div className="flex flex-col overflow-hidden flex-1">
                  <div className="px-4 py-1.5 border-b border-[var(--border)] bg-[var(--surface-0)] shrink-0 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">💬 Ask AI</span>
                      <p className="text-xs text-[var(--text-muted)]">Your questions inform the auto-generated notes</p>
                    </div>
                    <button onClick={() => setChatCollapsed(true)} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] px-2 py-0.5 rounded hover:bg-[var(--surface-2)] transition-colors">▶ Collapse</button>
                  </div>
                 <RightPanel messages={messages} loading={loading} fontSize={fontSize} />
                  <ChatInput onSend={handleAsk} disabled={loading} />
                </div>
              )}
            </>
          ) : (
            <>
              {/* learn_only — 2-panel with collapse */}
              {contentCollapsed ? (
                <CollapseTab label="📖 Content" onClick={() => setContentCollapsed(false)} />
              ) : (
                <div className="flex flex-col overflow-hidden" style={{ width: `${leftPct}%` }}>
                  <div className="px-3 py-1.5 border-b border-[var(--border)] bg-[var(--surface-0)] flex items-center justify-between shrink-0">
                    <span className="text-xs text-[var(--text-muted)]">Page {currentPage} / {material.totalPages}</span>
                    <button onClick={() => setContentCollapsed(true)} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] px-2 py-0.5 rounded hover:bg-[var(--surface-2)] transition-colors">◀ Collapse</button>
                  </div>
                  {pageLoading ? <Loader /> : (
                    <LeftPanel
                      chunk={chunk}
                      currentPage={currentPage}
                      totalPages={material.totalPages}
                      maxReachedPage={maxReachedPage}
                      onPageChange={setCurrentPage}
                      onExplainSelection={handleExplainSelection}
                      onNext={handleNext}
                      fontSize={fontSize}
                    />
                  )}
                </div>
              )}

              <div onMouseDown={() => { if (!contentCollapsed) dragging.current = 'two'; }}
                className="w-1 bg-[var(--border)] hover:bg-[var(--accent)] cursor-col-resize shrink-0 transition-colors" />

              {chatCollapsed ? (
                <CollapseTab label="💬 Chat" onClick={() => setChatCollapsed(false)} />
              ) : (
                <div className="flex flex-col overflow-hidden flex-1">
                  <div className="px-4 py-1.5 border-b border-[var(--border)] bg-[var(--surface-0)] shrink-0 flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">💬 Ask AI</span>
                    <button onClick={() => setChatCollapsed(true)} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] px-2 py-0.5 rounded hover:bg-[var(--surface-2)] transition-colors">▶ Collapse</button>
                  </div>
                 <RightPanel messages={messages} loading={loading} fontSize={fontSize} />
                  <ChatInput onSend={handleAsk} disabled={loading} />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default LearningMode;