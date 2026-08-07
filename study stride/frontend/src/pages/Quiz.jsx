import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import AppLayout from '../components/layout/AppLayout';
import Button from '../components/common/Button';
import Loader from '../components/common/Loader';

const Quiz = () => {
  const { materialId } = useParams();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [evaluation, setEvaluation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [evalLoading, setEvalLoading] = useState(false);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    api.get(`/quiz/${materialId}`)
      .then(res => setQuiz(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
    // Item 14 — cheap check, safe on mount. generateQuiz already
    // deletes+regenerates every call, so this is purely informational.
    api.get(`/quiz/${materialId}/stale-check`)
      .then(res => setStale(res.data.stale))
      .catch(() => {});
  }, [materialId]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await api.post(`/quiz/${materialId}/generate`);
      setQuiz(res.data);
      setStale(false);
      setSubmitted(false);
      setAnswers({});
      setEvaluation(null);
    } catch (err) {
      console.error('Generate quiz failed', err);
    } finally {
      setGenerating(false);
    }
  };

  const handleAnswer = (idx, value) => setAnswers(a => ({ ...a, [idx]: value }));

  const handleSubmit = async () => {
    setSubmitted(true);
    let score = 0;
    quiz.questions.forEach((q, i) => {
      if (q.type === 'mcq' && answers[i] === q.correctAnswer) score += q.marks || 1;
    });
    await api.post('/quiz/attempt', { quizId: quiz._id, answers, score, total: quiz.questions.length });
  };

  const handleEvaluate = async (question, idx) => {
    if (!answers[idx]) return;
    setEvalLoading(idx);
    const res = await api.post('/quiz/evaluate', {
      question: question.question,
      studentAnswer: answers[idx],
      materialId,
    });
    setEvaluation(ev => ({ ...(ev || {}), [idx]: res.data }));
    setEvalLoading(null);
  };

  if (loading) return <AppLayout><Loader /></AppLayout>;

  return (
    <AppLayout>
      <div className="p-8 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] px-2 py-1 rounded-lg hover:bg-[var(--surface-2)] transition-colors"
            >
              ← Back
            </button>
            <h1 className="text-xl font-semibold text-[var(--text-primary)]">Quiz</h1>
          </div>
          {!quiz && <Button loading={generating} onClick={handleGenerate}>Generate Quiz</Button>}
        </div>

        {quiz && stale && (
          <div className="mb-4 flex items-center justify-between text-xs bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
            <span className="text-amber-800 dark:text-amber-300">New material was added since this quiz was generated.</span>
            <Button size="sm" variant="outline" loading={generating} onClick={handleGenerate}>
              Regenerate
            </Button>
          </div>
        )}
      </div>

        {!quiz ? (
          <p className="text-sm text-[var(--text-muted)]">No quiz yet. Complete the chapter and generate one.</p>
        ) : (
          <div className="space-y-6">
            {quiz.questions.map((q, i) => (
              <div key={i} className="border border-[var(--border)] rounded-xl p-5 bg-[var(--surface-0)] space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-[var(--text-muted)]">Q{i + 1}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--surface-2)] text-[var(--text-muted)] uppercase">{q.type}</span>
                  <span className="text-xs text-[var(--text-muted)] ml-auto">{q.marks} mark{q.marks > 1 ? 's' : ''}</span>
                </div>
                <p className="text-sm text-[var(--text-primary)] font-medium">{q.question}</p>

                {q.type === 'mcq' && q.options.map((opt, j) => (
                  <label key={j} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors ${
                    submitted
                      ? opt === q.correctAnswer
                        ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 font-medium'
                        : answers[i] === opt ? 'bg-red-50 dark:bg-red-900/20 text-red-600' : 'text-[var(--text-secondary)]'
                      : 'hover:bg-[var(--surface-2)] text-[var(--text-secondary)]'
                  }`}>
                    <input
                      type="radio" name={`q${i}`} value={opt}
                      checked={answers[i] === opt}
                      onChange={() => handleAnswer(i, opt)}
                      disabled={submitted}
                    />
                    {opt}
                    {submitted && opt === q.correctAnswer && !answers[i] && (
                      <span className="ml-auto text-xs text-green-600 dark:text-green-400">(correct answer)</span>
                    )}
                  </label>
                ))}
                {submitted && !answers[i] && q.type === 'mcq' && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 italic">— Not attempted. Correct answer highlighted above.</p>
                )}

                {(q.type === 'short' || q.type === 'long' || q.type === 'descriptive') && (
                  <>
                    <textarea
                      rows={q.type === 'short' ? 2 : q.type === 'long' ? 4 : 6}
                      placeholder="Your answer…"
                      value={answers[i] || ''}
                      onChange={e => handleAnswer(i, e.target.value)}
                      disabled={submitted}
                      className="w-full border border-[var(--border)] rounded-lg bg-[var(--surface-1)] text-[var(--text-primary)] px-3 py-2 text-sm resize-none focus:outline-none focus:border-[var(--accent)]"
                    />
                    {submitted && !answers[i] && q.correctAnswer && (
                      <div className="mt-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                        <p className="text-xs font-medium text-green-700 dark:text-green-400 mb-1">Not attempted — Model Answer:</p>
                        <p className="text-sm text-green-800 dark:text-green-300">{q.correctAnswer}</p>
                      </div>
                    )}
                    {submitted && (
                      <div>
                        <Button size="sm" variant="outline" loading={evalLoading === i} onClick={() => handleEvaluate(q, i)}>
                          Evaluate my answer
                        </Button>
                        {evaluation?.[i] && (
                          <div className="mt-3 p-3 rounded-lg bg-[var(--surface-2)] text-sm space-y-2">
                            <p className="font-medium text-[var(--text-primary)]">Score: {evaluation[i].score} / {evaluation[i].outOf}</p>
                            <p className="text-[var(--text-secondary)]">{evaluation[i].feedback}</p>
                            {evaluation[i].missingPoints?.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-[var(--text-muted)] mb-1">Missing points:</p>
                                <ul className="list-disc list-inside text-xs text-[var(--text-secondary)] space-y-0.5">
                                  {evaluation[i].missingPoints.map((p, k) => <li key={k}>{p}</li>)}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}

            {!submitted && (
              <Button onClick={handleSubmit} className="w-full justify-center">Submit Quiz</Button>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Quiz;