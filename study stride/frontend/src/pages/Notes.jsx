import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import AppLayout from '../components/layout/AppLayout';
import NoteSection from '../components/notes/NoteSection';
import Button from '../components/common/Button';
import Loader from '../components/common/Loader';

const Notes = () => {
  const { materialId } = useParams(); // this is actually the topicId
  const navigate = useNavigate();
  const [allNotes, setAllNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [generatingMore, setGeneratingMore] = useState(false);
  const [generateError, setGenerateError] = useState('');

  const refreshQueueStatus = async () => {
    try {
      const res = await api.get(`/notes/${materialId}/queue-status`);
      setHasMore(res.data.hasMore);
    } catch {
      // non-critical — button just won't show if this fails
    }
  };

  useEffect(() => {
    api.get(`/notes/${materialId}/all`)
      .then(async res => {
        if (res.data.length === 0) {
          // Auto-generate if none exist
          try {
            const gen = await api.post(`/notes/${materialId}/generate-next-batch`);
            setAllNotes([gen.data]);
          } catch (e) {
            setAllNotes([]);
          }
        } else {
          setAllNotes(res.data);
        }
        await refreshQueueStatus();
      })
      .finally(() => setLoading(false));
  }, [materialId]);

  const handleApprove = async (notesId) => {
    const res = await api.put(`/notes/${notesId}/approve`);
    setAllNotes(n => n.map(notes => notes._id === notesId ? res.data : notes));
  };

  const handleUpdate = async (notesId, idx, section) => {
    const res = await api.put(`/notes/${notesId}/section/${idx}`, section);
    setAllNotes(n => n.map(notes => notes._id === notesId ? res.data : notes));
  };

  const handleRegenerate = async (notesId, idx, feedback) => {
    const res = await api.post(`/notes/${notesId}/section/${idx}/regenerate`, { feedback });
    setAllNotes(n => n.map(notes => notes._id === notesId ? res.data : notes));
  };

  // Item 10/11 — pull the next batch of notes off the queue. When
  // includeLearning is true, also advances the (independent) learning
  // sections queue for this topic, so "Notes + Learning" mode keeps both
  // in sync from one click.
  const handleGenerateMore = async (includeLearning) => {
    setGeneratingMore(true);
    setGenerateError('');
    try {
      const notesRes = await api.post(`/notes/${materialId}/generate-next-batch`);
      setAllNotes(n => [...n, notesRes.data]);
      if (includeLearning) {
        await api.post(`/topics/${materialId}/sections/generate-next`).catch(() => {
          // Learning-side failure shouldn't block the notes that already succeeded.
        });
      }
      await refreshQueueStatus();
    } catch (err) {
      if (err.response?.data?.code === 'GEMINI_UNAVAILABLE') {
        setGenerateError('AI generation is temporarily unavailable — please try again.');
      } else {
        setGenerateError(err.response?.data?.message || 'Something went wrong generating more notes.');
      }
    } finally {
      setGeneratingMore(false);
    }
  };

  if (loading) return <AppLayout><Loader /></AppLayout>;

  return (
    <AppLayout>
      <div className="p-8 max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] px-2 py-1 rounded-lg hover:bg-[var(--surface-2)] transition-colors"
          >
            ← Back
          </button>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Notes</h1>
        </div>
        {allNotes.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No notes yet. Go to Learning Mode to generate notes for this topic.</p>
        ) : (
          <div className="space-y-8">
            {allNotes.map(notes => (
              <div key={notes._id}>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-medium text-sm text-[var(--text-secondary)]">Page {notes.pageNumber}</h2>
                  {notes.status === 'draft' ? (
                    <Button size="sm" onClick={() => handleApprove(notes._id)}>Approve</Button>
                  ) : (
                    <span className="text-xs text-green-600 dark:text-green-400 font-medium">✓ Approved</span>
                  )}
                </div>
                <div className="space-y-3">
                  {(notes.sections || []).map((section, i) => (
                    <NoteSection
                      key={i}
                      section={section}
                      index={i}
                      notesId={notes._id}
                      onUpdate={(idx, s) => handleUpdate(notes._id, idx, s)}
                      onRegenerate={(idx, fb) => handleRegenerate(notes._id, idx, fb)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Item 11 — continue generating from where the queue left off */}
        {hasMore && (
          <div className="mt-8 border border-[var(--border)] rounded-xl p-5 bg-[var(--surface-0)]">
            <p className="text-sm text-[var(--text-primary)] mb-1">There's more material to turn into notes.</p>
            <p className="text-xs text-[var(--text-muted)] mb-4">Pick how you'd like to continue.</p>
            {generateError && <p className="text-xs text-red-600 mb-3">{generateError}</p>}
            <div className="flex gap-2">
              <Button loading={generatingMore} onClick={() => handleGenerateMore(false)}>
                Continue Notes only
              </Button>
              <Button variant="outline" loading={generatingMore} onClick={() => handleGenerateMore(true)}>
                Continue Notes + Learning
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Notes;