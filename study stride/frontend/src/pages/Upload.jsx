import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMaterial } from '../context/MaterialContext';
import AppLayout from '../components/layout/AppLayout';
import Button from '../components/common/Button';

const MODE_OPTIONS = [
  {
    id: 'learn',
    label: 'Learning Mode',
    icon: '🧠',
    desc: 'Go section-by-section with AI explanations and Q&A. Best for understanding new material.',
    route: (id) => `/learn/${id}`,
  },
  {
    id: 'notes',
    label: 'Notes Mode',
    icon: '📝',
    desc: 'Jump straight into AI-generated notes with color-coded importance. Best for revision.',
    route: (id) => `/material/${id}/notes`,
  },
  {
    id: 'generate',
    label: 'Study Kit',
    icon: '⚡',
    desc: 'Generate flashcards, quizzes, summaries and revision sheets all at once.',
    route: (id) => `/material/${id}/generate`,
  },
];

const Upload = () => {
  const [files, setFiles] = useState([]);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadedTopicId, setUploadedTopicId] = useState(null);
  const { uploadMaterial } = useMaterial();
  const navigate = useNavigate();

  const handleFiles = (e) => {
    const selected = Array.from(e.target.files);
    if (selected.length > 0) {
      setFiles(selected);
      if (!title) setTitle(selected[0].name.replace(/\.[^.]+$/, ''));
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files).filter(f =>
      ['.pdf', '.docx', '.txt'].some(ext => f.name.toLowerCase().endsWith(ext))
    );
    if (dropped.length > 0) {
      setFiles(dropped);
      if (!title) setTitle(dropped[0].name.replace(/\.[^.]+$/, ''));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (files.length === 0) return setError('Please select at least one file');
    setLoading(true);
    setError('');
    try {
      const res = await uploadMaterial(files, title, subject);
      setUploadedTopicId(res.topic._id);
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  // Mode picker — shown after successful upload
  if (uploadedTopicId) {
    return (
      <AppLayout>
        <div className="p-8 max-w-2xl mx-auto">
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-3 py-1.5 mb-4">
              <span className="text-green-600 dark:text-green-400 text-xs font-medium">✓ Uploaded successfully</span>
            </div>
            <h1 className="text-xl font-semibold text-[var(--text-primary)]">How do you want to study?</h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              <span className="font-medium text-[var(--text-secondary)]">{title}</span> is ready — pick a mode to begin.
            </p>
          </div>

          <div className="space-y-3">
            {MODE_OPTIONS.map((mode) => (
              <button
                key={mode.id}
                onClick={() => navigate(mode.route(uploadedTopicId))}
                className="w-full text-left border border-[var(--border)] hover:border-[var(--accent)] rounded-xl p-5 bg-[var(--surface-0)] hover:bg-[var(--surface-1)] transition-all group"
              >
                <div className="flex items-start gap-4">
                  <span className="text-2xl mt-0.5">{mode.icon}</span>
                  <div>
                    <p className="font-medium text-sm text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">{mode.label}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">{mode.desc}</p>
                  </div>
                  <span className="ml-auto text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors text-lg self-center">→</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-8 max-w-2xl mx-auto">
        <h1 className="text-xl font-semibold text-[var(--text-primary)] mb-6">Upload Material</h1>

        <div className="bg-[var(--surface-0)] border border-[var(--border)] rounded-xl p-8">
          {error && <div className="text-xs text-[var(--critical)] bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-md mb-4">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => document.getElementById('fileInput').click()}
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
                files.length > 0 ? 'border-[var(--accent)] bg-blue-50/30 dark:bg-blue-900/10' : 'border-[var(--border)] hover:border-[var(--accent)]'
              }`}
            >
              <input
                id="fileInput"
                type="file"
                accept=".pdf,.docx,.txt"
                multiple
                onChange={handleFiles}
                className="hidden"
              />
              {files.length > 0 ? (
                <div>
                  <p className="font-medium text-sm text-[var(--text-primary)]">
                    {files.length === 1 ? files[0].name : `${files.length} files selected`}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    {files.map(f => f.name).join(', ')}
                  </p>
                  <p className="text-xs text-[var(--accent)] mt-2">Click to change selection</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-[var(--text-secondary)] mb-1">Click or drag files here</p>
                  <p className="text-xs text-[var(--text-muted)]">Supports PDF, DOCX, TXT — up to 20MB each. Multiple files allowed.</p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Topic Title</label>
              <input
                type="text" value={title} onChange={e => setTitle(e.target.value)} required
                placeholder="e.g. Chapter 3 — Cell Biology"
                className="w-full border border-[var(--border)] rounded-lg bg-[var(--surface-1)] text-[var(--text-primary)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Subject <span className="text-[var(--text-muted)]">(optional)</span></label>
              <input
                type="text" value={subject} onChange={e => setSubject(e.target.value)}
                placeholder="e.g. Biology, Computer Networks"
                className="w-full border border-[var(--border)] rounded-lg bg-[var(--surface-1)] text-[var(--text-primary)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <Button type="submit" loading={loading} className="w-full justify-center">
              {loading ? 'Processing files…' : `Upload ${files.length > 1 ? `${files.length} Files` : 'Material'}`}
            </Button>
          </form>
        </div>
      </div>
    </AppLayout>
  );
};

export default Upload;