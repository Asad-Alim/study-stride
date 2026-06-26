import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import AppLayout from '../components/layout/AppLayout';
import NoteSection from '../components/notes/NoteSection';
import Button from '../components/common/Button';
import Loader from '../components/common/Loader';

const Notes = () => {
  const { materialId } = useParams();
  const navigate = useNavigate();
  const [allNotes, setAllNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    api.get(`/notes/${materialId}/all`)
      .then(async res => {
        if (res.data.length === 0) {
          // Auto-generate if none exist
          try {
            const gen = await api.post(`/notes/${materialId}/page/1/generate`);
            setAllNotes([gen.data]);
          } catch (e) {
            setAllNotes([]);
          }
        } else {
          setAllNotes(res.data);
        }
      })
      .finally(() => setLoading(false));
  }, [materialId]);

//   useEffect(() => {
//     api.get(`/notes/${materialId}/all`)
//       .then(res => setAllNotes(res.data))
//       .finally(() => setLoading(false));
//   }, [materialId]);

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
      </div>
    </AppLayout>
  );
};

export default Notes;