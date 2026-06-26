import { useState } from 'react';
import ImportanceTag from '../common/ImportanceTag';
import Button from '../common/Button';
import api from '../../api/axios';

// ADD AFTER LINE 4:
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
            <div className="text-sm text-[var(--text-secondary)] leading-relaxed prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(section.content) }}
            />
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