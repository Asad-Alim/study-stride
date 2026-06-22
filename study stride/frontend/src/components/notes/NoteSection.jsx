import { useState } from 'react';
import ImportanceTag from '../common/ImportanceTag';
import Button from '../common/Button';
import api from '../../api/axios';

const NoteSection = ({ section, index, notesId, onUpdate, onRegenerate }) => {
  const [editing, setEditing] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [content, setContent] = useState(section.content);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    await onUpdate(index, { ...section, content });
    setEditing(false);
  };

  const handleRegenerate = async () => {
    if (!feedback.trim()) return;
    setLoading(true);
    await onRegenerate(index, feedback);
    setFeedback('');
    setShowFeedback(false);
    setLoading(false);
  };

  return (
    <div className="border border-[var(--border)] rounded-lg p-4 space-y-3 bg-[var(--surface-0)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            <h4 className="font-medium text-sm text-[var(--text-primary)]">{section.heading}</h4>
            <ImportanceTag level={section.importance} />
          </div>
          {editing ? (
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={4}
              className="w-full text-sm border border-[var(--border)] rounded bg-[var(--surface-1)] text-[var(--text-primary)] px-2.5 py-2 resize-none focus:outline-none focus:border-[var(--accent)]"
            />
          ) : (
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{section.content}</p>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          {editing ? (
            <>
              <Button size="sm" onClick={handleSave}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>Edit</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowFeedback(v => !v)}>Regen</Button>
            </>
          )}
        </div>
      </div>
      {showFeedback && (
        <div className="flex gap-2">
          <input
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
            placeholder="e.g. Add more detail, simplify…"
            className="flex-1 text-sm border border-[var(--border)] rounded bg-[var(--surface-1)] text-[var(--text-primary)] px-2.5 py-1.5 focus:outline-none focus:border-[var(--accent)]"
          />
          <Button size="sm" loading={loading} onClick={handleRegenerate}>Apply</Button>
        </div>
      )}
    </div>
  );
};

export default NoteSection;