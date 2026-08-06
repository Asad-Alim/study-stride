// PATH: frontend/src/pages/LearningMode.jsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import AppLayout from '../components/layout/AppLayout';
import LeftPanel from '../components/learning/LeftPanel';
import RightPanel from '../components/learning/RightPanel';
import ChatInput from '../components/learning/ChatInput';
import Loader from '../components/common/Loader';
import NoteSection from '../components/notes/NoteSection';

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

// Maps a backend chatHistory entry ({role, message}) to the shape RightPanel expects ({role, content})
const toDisplayMessages = (chatHistory = []) => chatHistory.map(m => ({ role: m.role, content: m.message }));

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
                Notes are auto-generated after each section using your learning chat.
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
        <span className="text-sm font-semibold text-[var(--text-primary)]">📄 Your Uploaded Files</span>
        <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-lg leading-none">✕</button>
      </div>
      <div className="flex-1 overflow-y-auto p-5 text-sm text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">
        {content || 'No uploaded content found.'}
      </div>
    </div>
  </div>
);

// ─── Notes Panel (3rd panel) — shows notes for every completed section so far ─
const NotesPanel = ({ sections, generating, generatingIndex, onUpdateNote, onRegenerateNote, newNotesBannerSectionId }) => {
  const bottomRef = useRef(null);

  useEffect(() => {
    if (newNotesBannerSectionId && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [newNotesBannerSectionId, sections]);

  const withNotes = sections.filter(s => s.generatedNotes?.sections?.length > 0);

  return (
    <div className="flex flex-col h-full border-r border-[var(--border)]">
      <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--surface-0)] shrink-0 flex items-center justify-between">
        <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">📝 Notes</span>
        {generating && <span className="text-xs text-[var(--accent)] animate-pulse">Generating…</span>}
      </div>

      {newNotesBannerSectionId && (
        <div className="px-4 py-2 bg-green-50 dark:bg-green-900/20 border-b border-green-200 dark:border-green-800 text-xs text-green-700 dark:text-green-400 flex items-center gap-2 shrink-0">
          <span>✨</span>
          <span>New notes added! Scroll down to view.</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {withNotes.length === 0 && !generating && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
            <span className="text-2xl">📋</span>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Notes appear here automatically when you click <strong>Next</strong>.
            </p>
          </div>
        )}

        {withNotes.map((section) => (
          <div key={section._id} className="space-y-2">
            <div className="px-1">
              <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">{section.heading}</span>
            </div>
            <div className="space-y-2">
              {section.generatedNotes.sections.map((block, idx) => (
                <NoteSection
                  key={idx}
                  section={block}
                  index={idx}
                  onUpdate={(i, updated) => onUpdateNote(section._id, i, updated)}
                  onRegenerate={(i, feedback) => onRegenerateNote(section._id, i, feedback)}
                />
              ))}
            </div>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>
    </div>
  );
};

// ─── Quiz Modal ───────────────────────────────────────────────────────────────
const QuizModal = ({ materialId, sectionContent, sectionHeading, declaredLevel, onClose, onSkip, quizMode }) => {
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (quizMode === 'between') {
      if (!sectionContent) { setLoading(false); return; }
      api.post('/quiz/section-quiz', { sectionContent, sectionHeading, declaredLevel })
        .then(res => setQuiz(res.data))
        .catch(() => setQuiz(null))
        .finally(() => setLoading(false));
    } else {
      api.get(`/quiz/${materialId}`)
        .then(res => setQuiz(res.data))
        .catch(() => {
          return api.post(`/quiz/${materialId}/generate`)
            .then(res => setQuiz(res.data))
            .catch(() => setQuiz(null));
        })
        .finally(() => setLoading(false));
    }
  }, [materialId, quizMode, sectionContent]);

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
    if (quiz?._id) {
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

// ─── Collapse Tab ───────────────────────────────────────────────────────────
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

// ─── Final Notes Summary Popup ───────────────────────────────────────────────
const FinalNotesPopup = ({ sections, onSave, onDiscard }) => {
  const blocks = sections.flatMap(s => (s.generatedNotes?.sections || []).map(b => ({ ...b, sectionHeading: s.heading })));
  const combined = blocks.map(b => `### ${b.heading}\n\n${b.content}`).join('\n\n---\n\n');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-[var(--surface-0)] border border-[var(--border)] rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-[var(--border)] shrink-0">
          <h3 className="font-semibold text-[var(--text-primary)] text-base">📋 Your Chapter Notes</h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">These notes were built from your learning session. Are you satisfied?</p>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {combined ? (
            <div className="text-sm text-[var(--text-primary)] leading-relaxed bg-[var(--surface-1)] rounded-xl p-4 border border-[var(--border)]"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(combined) }} />
          ) : (
            <p className="text-xs text-[var(--text-muted)] text-center mt-8">No notes were generated this session.</p>
          )}
        </div>
        <div className="px-6 py-4 border-t border-[var(--border)] flex flex-col gap-2 shrink-0">
          <button onClick={onSave} className="w-full py-2.5 rounded-xl bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90">
            💾 Save notes for this chapter
          </button>
          <button onClick={onDiscard} className="w-full py-2.5 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:border-red-400 hover:text-red-500 transition-colors">
            🗑️ Discard — don't save
          </button>
        </div>
      </div>
    </div>
  );
};

const ChapterQuizPrompt = ({ onYes, onNo }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
    <div className="bg-[var(--surface-0)] border border-[var(--border)] rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 text-center">
      <div className="text-3xl mb-3">🎓</div>
      <h3 className="font-semibold text-[var(--text-primary)] text-base mb-2">Chapter Complete!</h3>
      <p className="text-sm text-[var(--text-muted)] mb-5 leading-relaxed">
        You've finished all sections. Would you like to take the full chapter quiz now?
      </p>
      <div className="flex flex-col gap-2">
        <button onClick={onYes} className="w-full py-2.5 rounded-xl bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity">
          Yes, take the chapter quiz
        </button>
        <button onClick={onNo} className="w-full py-2.5 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:border-[var(--accent)] transition-colors">
          No, go back to dashboard
        </button>
      </div>
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const LearningMode = () => {
  const { materialId: topicId } = useParams(); // route param name kept for URL compat — it's actually the topicId
  const navigate = useNavigate();

  const [topic, setTopic] = useState(null);
  const [sections, setSections] = useState([]);          // light list: no chatHistory, no generatedNotes.versions
  const [currentIndex, setCurrentIndex] = useState(0);
  const [maxReachedIndex, setMaxReachedIndex] = useState(0);
  const [currentFull, setCurrentFull] = useState(null);   // full section doc for the section being viewed (has chatHistory)
  const [sectionLoading, setSectionLoading] = useState(false);

  const [regeneratingStale, setRegeneratingStale] = useState(false);
  const [hasMoreInQueue, setHasMoreInQueue] = useState(false);
  const [generatingBatch, setGeneratingBatch] = useState(false);
  const [generateError, setGenerateError] = useState('');

  const [messages, setMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);

  const [quizOpen, setQuizOpen] = useState(false);
  const [quizMode, setQuizMode] = useState('between');
  const [quizzesEnabled, setQuizzesEnabled] = useState(true);
  const [fontSize, setFontSize] = useState(15);
  const [declaredLevel, setDeclaredLevel] = useState('General');
  const [strictMode, setStrictMode] = useState(true);
  const [strictModeSaving, setStrictModeSaving] = useState(false);

  const [hasExistingNotes, setHasExistingNotes] = useState(null);
  const [learnMode, setLearnMode] = useState(null);
  const [generatingNotes, setGeneratingNotes] = useState(false);
  const [newNotesBannerSectionId, setNewNotesBannerSectionId] = useState(null);

  const [uploadedNotesPanelOpen, setUploadedNotesPanelOpen] = useState(false);
  const [uploadedNotesContent, setUploadedNotesContent] = useState(null);

  const [notesCollapsed, setNotesCollapsed] = useState(false);
  const [contentCollapsed, setContentCollapsed] = useState(false);
  const [chatCollapsed, setChatCollapsed] = useState(false);

  const [showFinalNotes, setShowFinalNotes] = useState(false);
  const [showChapterQuizPrompt, setShowChapterQuizPrompt] = useState(false);
  const [nextTarget, setNextTarget] = useState(null); // number index | 'end' | 'end_after_section_quiz'

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

  // Fetch the current queue-status
  const refreshQueueStatus = async () => {
    const res = await api.get(`/topics/${topicId}/queue-status`);
    setHasMoreInQueue(res.data.hasMore);
    return res.data;
  };

  // Pull the next batch of sections off the queue
  const generateNextBatch = async () => {
    setGeneratingBatch(true);
    setGenerateError('');
    try {
      const res = await api.post(`/topics/${topicId}/sections/generate-next`);
      const newSections = res.data;
      setSections(prev => [...prev, ...newSections]);
      await refreshQueueStatus();
      return newSections;
    } catch (err) {
      if (err.response?.data?.code === 'GEMINI_UNAVAILABLE') {
        setGenerateError('AI generation is temporarily unavailable — please try again.');
      } else {
        setGenerateError(err.response?.data?.message || 'Something went wrong generating the next section.');
      }
      throw err;
    } finally {
      setGeneratingBatch(false);
    }
  };

  // Initial load: topic info, existing sections, queue status
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const topicRes = await api.get(`/topics/${topicId}`);
      if (cancelled) return;
      setTopic(topicRes.data);
      setStrictMode(topicRes.data.strictMode !== false);
      if (topicRes.data.materialDetails?.length > 0) {
        setUploadedNotesContent(topicRes.data.materialDetails.map(m => `📄 ${m.title}`).join('\n'));
      }

      api.get('/auth/me').then(res => setDeclaredLevel(res.data?.declaredLevel || 'General')).catch(() => {});

      const sectionsRes = await api.get(`/sections/material/${topicId}`);
      if (cancelled) return;
      let list = sectionsRes.data;

      const status = await refreshQueueStatus();

      const alreadyHasNotes = list.some(s => s.generatedNotes?.sections?.length > 0);
      setHasExistingNotes(alreadyHasNotes);
      if (alreadyHasNotes) setLearnMode('learn_only');

      // Nothing generated yet — kick off the first batch automatically.
      if (list.length === 0 && status.hasMore) {
        try {
          const first = await generateNextBatch();
          list = first;
        } catch {
          // generateError is already set; user can retry from the UI.
        }
      }

      setSections(list);
      setMaxReachedIndex(0);
      setCurrentIndex(0);
    })();
    return () => { cancelled = true; };
  }, [topicId]);

  // Load the full section (with chat history + notes) whenever the current one changes
  useEffect(() => {
    const section = sections[currentIndex];
    if (!section) { setCurrentFull(null); setMessages([]); return; }
    setSectionLoading(true);
    api.get(`/sections/${section._id}`)
      .then(res => {
        setCurrentFull(res.data);
        setMessages(toDisplayMessages(res.data.chatHistory));
      })
      .finally(() => setSectionLoading(false));
  }, [sections, currentIndex]);

  // Strict mode: ON = sections/chat answers must come only from the uploaded
  // material (and flag anything they can't ground in it). OFF = Gemini may
  // supplement with its own knowledge. Stored on the topic, read server-side
  // on every generate-next / chat call — no need to resend it per request.
  const toggleStrictMode = async () => {
    const next = !strictMode;
    setStrictMode(next);
    setStrictModeSaving(true);
    try {
      await api.patch(`/topics/${topicId}/strict-mode`, { strictMode: next });
    } catch {
      setStrictMode(!next); // revert on failure
    } finally {
      setStrictModeSaving(false);
    }
  };

  const handleAsk = async (question) => {
    const section = sections[currentIndex];
    if (!section) return;
    setMessages(m => [...m, { role: 'user', content: question }]);
    setChatLoading(true);
    try {
      const res = await api.post(`/sections/${section._id}/chat`, { message: question });
      setMessages(toDisplayMessages(res.data.chatHistory));
    } catch {
      setMessages(m => [...m, { role: 'ai', content: 'Something went wrong. Please try again.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleExplainSelection = async (selectedText, mode) => {
    const label = mode === 'explain' ? 'Explain' : mode === 'simplify' ? 'Simplify' : 'Give an example for';
    await handleAsk(`${label}: "${selectedText}"`);
  };

  // Generates notes for the current section from its chat history so far.
  const completeCurrentSection = async () => {
    const section = sections[currentIndex];
    if (!section) return;
    setGeneratingNotes(true);
    try {
      const res = await api.post(`/sections/${section._id}/complete`);
      setSections(prev => prev.map(s => (s._id === section._id ? res.data : s)));
      setNewNotesBannerSectionId(section._id);
      setTimeout(() => setNewNotesBannerSectionId(null), 4000);
    } catch (e) {
      console.error('completeSection failed', e);
    } finally {
      setGeneratingNotes(false);
    }
  };

  const handleUpdateNote = async (sectionId, index, updatedBlock) => {
    const res = await api.post(`/sections/${sectionId}/update-note`, { index, section: updatedBlock });
    setSections(prev => prev.map(s => (s._id === sectionId ? res.data : s)));
  };

  const handleRegenerateNote = async (sectionId, index, feedback) => {
    const res = await api.post(`/sections/${sectionId}/edit`, { feedback, sectionIndex: index });
    setSections(prev => prev.map(s => (s._id === sectionId ? res.data : s)));
  };

  const handleRegenerateStaleSection = async (sectionId) => {
    setRegeneratingStale(true);
    try {
      const res = await api.post(`/sections/${sectionId}/regenerate-stale`);
      setCurrentFull(res.data);
      setSections(prev => prev.map(s => (s._id === sectionId ? res.data : s)));
    } catch (err) {
      console.error('Failed to regenerate stale section', err);
    } finally {
      setRegeneratingStale(false);
    }
  };

  const handleNext = async () => {
    if (learnMode === 'learn_and_notes') {
      await completeCurrentSection();
    }

    const isLastGenerated = currentIndex >= sections.length - 1;

    if (!isLastGenerated) {
      setMaxReachedIndex(prev => Math.max(prev, currentIndex + 1));
      proceedToNext(currentIndex + 1);
      return;
    }

    // At the last currently-generated section.
    if (hasMoreInQueue) {
      setNextTarget('pending_more');
      try {
        const before = sections.length;
        await generateNextBatch();
        setMaxReachedIndex(before);
        proceedToNext(before);
      } catch {
        setNextTarget(null); // stay put — generateError is shown in the UI
      }
      return;
    }

    // Truly the end of the document.
    proceedToNext('end');
  };

  const proceedToNext = (target) => {
    setNextTarget(target);
    if (target === 'end') {
      if (quizzesEnabled) {
        setQuizMode('between');
        setQuizOpen(true);
        setNextTarget('end_after_section_quiz');
      } else if (learnMode === 'learn_and_notes' && sections.some(s => s.generatedNotes?.sections?.length > 0)) {
        setShowFinalNotes(true);
      } else {
        setShowChapterQuizPrompt(true);
      }
    } else if (quizzesEnabled) {
      setQuizMode('between');
      setQuizOpen(true);
    } else {
      setCurrentIndex(target);
      setNextTarget(null);
    }
  };

  const handleFinalSave = async () => {
    setShowFinalNotes(false);
    const blocks = sections.flatMap(s => (s.generatedNotes?.sections || []));
    const combined = blocks.map(b => `${b.heading}\n\n${b.content}`).join('\n\n---\n\n');
    await api.post(`/notes/${topicId}/save`, { content: combined }).catch(console.error);
    setShowChapterQuizPrompt(true);
  };
  const handleFinalDiscard = () => { setShowFinalNotes(false); setShowChapterQuizPrompt(true); };

  const handleQuizClose = () => {
    setQuizOpen(false);
    if (quizMode === 'end') {
      navigate(`/material/${topicId}/quiz`);
    } else if (nextTarget === 'end_after_section_quiz') {
      // handled in handleQuizSkip below to avoid double logic
    } else if (typeof nextTarget === 'number') {
      setCurrentIndex(nextTarget);
      setNextTarget(null);
    }
  };
  const handleQuizSkip = () => {
    setQuizOpen(false);
    if (nextTarget === 'end_after_section_quiz') {
      if (learnMode === 'learn_and_notes' && sections.some(s => s.generatedNotes?.sections?.length > 0)) {
        setShowFinalNotes(true);
      } else {
        setShowChapterQuizPrompt(true);
      }
      setNextTarget(null);
    } else if (quizMode !== 'end' && typeof nextTarget === 'number') {
      setCurrentIndex(nextTarget);
      setNextTarget(null);
    }
  };

  if (!topic || hasExistingNotes === null) return <AppLayout><Loader text="Loading material…" /></AppLayout>;

  const isThreePanel = learnMode === 'learn_and_notes';
  const currentSection = sections[currentIndex];
  // "chunk"-shaped view of the current section, so LeftPanel/QuizModal need no changes
  const chunk = currentSection ? { content: currentSection.rawContent, heading: currentSection.heading } : null;
  const totalPages = hasMoreInQueue ? sections.length + 1 : sections.length; // "+1" hints more is coming

  return (
    <AppLayout>
      {!learnMode && hasExistingNotes === false && (
        <ModeChoiceModal onChoose={setLearnMode} />
      )}

      {uploadedNotesPanelOpen && (
        <UploadedNotesDrawer content={uploadedNotesContent} onClose={() => setUploadedNotesPanelOpen(false)} />
      )}

      {showFinalNotes && (
        <FinalNotesPopup sections={sections} onSave={handleFinalSave} onDiscard={handleFinalDiscard} />
      )}

      {showChapterQuizPrompt && (
        <ChapterQuizPrompt
          onYes={() => { setShowChapterQuizPrompt(false); setQuizMode('end'); setQuizOpen(true); }}
          onNo={() => { setShowChapterQuizPrompt(false); navigate('/dashboard'); }}
        />
      )}

      {quizOpen && topicId && (
        <QuizModal
          materialId={topicId}
          sectionContent={chunk?.content || ''}
          sectionHeading={chunk?.heading || ''}
          declaredLevel={declaredLevel}
          onClose={handleQuizClose}
          onSkip={handleQuizSkip}
          quizMode={quizMode}
        />
      )}

      {(generatingNotes || generatingBatch) && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20 backdrop-blur-sm pointer-events-none">
          <div className="bg-[var(--surface-0)] border border-[var(--border)] rounded-xl px-5 py-3 flex items-center gap-3 shadow-lg">
            <div className="w-4 h-4 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-[var(--text-primary)]">
              {generatingBatch ? 'Generating the next section(s)…' : 'Generating notes from your session…'}
            </span>
          </div>
        </div>
      )}

      {generateError && !generatingBatch && (
        <div className="fixed bottom-4 right-4 z-40 bg-[var(--surface-0)] border border-red-300 dark:border-red-800 rounded-xl px-4 py-3 shadow-lg flex items-center gap-3 max-w-sm">
          <span className="text-sm text-[var(--text-primary)]">{generateError}</span>
          <button
            onClick={() => { setGenerateError(''); generateNextBatch().then(() => proceedToNext(sections.length)); }}
            className="text-xs font-medium text-[var(--accent)] hover:underline shrink-0"
          >
            Retry
          </button>
          <button onClick={() => setGenerateError('')} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] shrink-0">✕</button>
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
            <h2 className="font-medium text-sm text-[var(--text-primary)] truncate max-w-xs">{topic.title}</h2>
            {isThreePanel && (
              <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">📝 Learn + Notes</span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1 border border-[var(--border)] rounded-lg px-1.5 py-0.5">
              <button onClick={() => setFontSize(s => Math.max(11, s - 1))} className="w-5 h-5 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] font-bold text-xs" title="Decrease font size">A-</button>
              <span className="text-[var(--text-muted)] text-xs w-5 text-center">{fontSize}</span>
              <button onClick={() => setFontSize(s => Math.min(26, s + 1))} className="w-5 h-5 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] font-bold text-xs" title="Increase font size">A+</button>
            </div>
            <button
              onClick={() => setUploadedNotesPanelOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--surface-1)] hover:bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-secondary)] transition-colors font-medium text-xs"
            >
              📄 View Uploaded Files
            </button>
            <label
              className="flex items-center gap-2 cursor-pointer select-none text-[var(--text-muted)]"
              title={strictMode
                ? 'Strict mode: sections and chat answers come only from your uploaded material, and flag anything they can\'t.'
                : 'Strict mode off: the AI may supplement your material with its own knowledge.'}
            >
              <span>Strict mode{strictModeSaving ? '…' : ''}</span>
              <button
                onClick={toggleStrictMode}
                disabled={strictModeSaving}
                className={`relative w-8 h-4 rounded-full transition-colors ${strictMode ? 'bg-[var(--accent)]' : 'bg-[var(--surface-2)]'}`}
              >
                <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all ${strictMode ? 'left-4' : 'left-0.5'}`} />
              </button>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none text-[var(--text-muted)]">
              <span>Quizzes</span>
              <button
                onClick={() => setQuizzesEnabled(q => !q)}
                className={`relative w-8 h-4 rounded-full transition-colors ${quizzesEnabled ? 'bg-[var(--accent)]' : 'bg-[var(--surface-2)]'}`}
              >
                <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all ${quizzesEnabled ? 'left-4' : 'left-0.5'}`} />
              </button>
            </label>
          </div>
        </div>

        {/* Panels */}
        <div ref={containerRef} className="flex flex-1 overflow-hidden select-none">
          {isThreePanel ? (
            <>
              {notesCollapsed ? (
                <CollapseTab label="📝 Notes" onClick={() => setNotesCollapsed(false)} />
              ) : (
                <div className="flex flex-col overflow-hidden" style={{ width: `${notesPct}%` }}>
                  <div className="px-3 py-1.5 border-b border-[var(--border)] bg-[var(--surface-0)] flex items-center justify-end shrink-0">
                    <button onClick={() => setNotesCollapsed(true)} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] px-2 py-0.5 rounded hover:bg-[var(--surface-2)] transition-colors">◀ Collapse</button>
                  </div>
                  <NotesPanel
                    sections={sections}
                    generating={generatingNotes}
                    onUpdateNote={handleUpdateNote}
                    onRegenerateNote={handleRegenerateNote}
                    newNotesBannerSectionId={newNotesBannerSectionId}
                  />
                </div>
              )}

              <div onMouseDown={() => { if (!notesCollapsed) dragging.current = 'nc'; }}
                className="w-1 bg-[var(--border)] hover:bg-[var(--accent)] cursor-col-resize shrink-0 transition-colors" />

              {contentCollapsed ? (
                <CollapseTab label="📖 Content" onClick={() => setContentCollapsed(false)} />
              ) : (
                <div className="flex flex-col overflow-hidden" style={{ width: `${contentPct}%` }}>
                  <div className="px-3 py-1.5 border-b border-[var(--border)] bg-[var(--surface-0)] flex items-center justify-between shrink-0">
                    <span className="text-xs text-[var(--text-muted)]">Section {currentIndex + 1} / {totalPages}</span>
                    <button onClick={() => setContentCollapsed(true)} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] px-2 py-0.5 rounded hover:bg-[var(--surface-2)] transition-colors">◀ Collapse</button>
                  </div>
                  {sectionLoading ? <Loader /> : (
                    <>
                      {currentFull?.assumptionsStale && (
                        <div className="flex items-start gap-2 px-3 py-2 mx-3 mt-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
                          <span>⚠️</span>
                          <div className="flex-1">
                            <p>{currentFull.staleReason}</p>
                            <button
                              onClick={() => handleRegenerateStaleSection(currentFull._id)}
                              disabled={regeneratingStale}
                              className="mt-1 underline font-medium hover:opacity-80"
                            >
                              {regeneratingStale ? 'Regenerating…' : 'Regenerate this section'}
                            </button>
                          </div>
                        </div>
                      )}
                      <LeftPanel
                        chunk={chunk}
                        currentPage={currentIndex + 1}
                        totalPages={totalPages}
                        maxReachedPage={maxReachedIndex + 1}
                        onPageChange={(p) => setCurrentIndex(p - 1)}
                        onExplainSelection={handleExplainSelection}
                        onNext={handleNext}
                        fontSize={fontSize}
                      />
                    </>
                  )}
                </div>
              )}

              <div onMouseDown={() => { if (!contentCollapsed) dragging.current = 'cc'; }}
                className="w-1 bg-[var(--border)] hover:bg-[var(--accent)] cursor-col-resize shrink-0 transition-colors" />

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
                  <RightPanel messages={messages} loading={chatLoading} fontSize={fontSize} />
                  <ChatInput onSend={handleAsk} disabled={chatLoading} />
                </div>
              )}
            </>
          ) : (
            <>
              {contentCollapsed ? (
                <CollapseTab label="📖 Content" onClick={() => setContentCollapsed(false)} />
              ) : (
                <div className="flex flex-col overflow-hidden" style={{ width: `${leftPct}%` }}>
                  <div className="px-3 py-1.5 border-b border-[var(--border)] bg-[var(--surface-0)] flex items-center justify-between shrink-0">
                    <span className="text-xs text-[var(--text-muted)]">Section {currentIndex + 1} / {totalPages}</span>
                    <button onClick={() => setContentCollapsed(true)} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] px-2 py-0.5 rounded hover:bg-[var(--surface-2)] transition-colors">◀ Collapse</button>
                  </div>
                  {sectionLoading ? <Loader /> : (
                    <>
                      {currentFull?.assumptionsStale && (
                        <div className="flex items-start gap-2 px-3 py-2 mx-3 mt-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
                          <span>⚠️</span>
                          <div className="flex-1">
                            <p>{currentFull.staleReason}</p>
                            <button
                              onClick={() => handleRegenerateStaleSection(currentFull._id)}
                              disabled={regeneratingStale}
                              className="mt-1 underline font-medium hover:opacity-80"
                            >
                              {regeneratingStale ? 'Regenerating…' : 'Regenerate this section'}
                            </button>
                          </div>
                        </div>
                      )}
                      <LeftPanel
                        chunk={chunk}
                        currentPage={currentIndex + 1}
                        totalPages={totalPages}
                        maxReachedPage={maxReachedIndex + 1}
                        onPageChange={(p) => setCurrentIndex(p - 1)}
                        onExplainSelection={handleExplainSelection}
                        onNext={handleNext}
                        fontSize={fontSize}
                      />
                    </>
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
                  <RightPanel messages={messages} loading={chatLoading} fontSize={fontSize} />
                  <ChatInput onSend={handleAsk} disabled={chatLoading} />
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