// PATH: frontend/src/pages/TopicFiles.jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useMaterial } from '../context/MaterialContext';
import AppLayout from '../components/layout/AppLayout';
import Button from '../components/common/Button';
import Loader from '../components/common/Loader';

const TopicFiles = () => {
  const { topicId } = useParams();
  const navigate = useNavigate();
  const { addFilesToTopic, deleteSingleFile } = useMaterial();

  const [topic, setTopic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [newFiles, setNewFiles] = useState([]);
  const [error, setError] = useState('');

  const loadTopic = () => {
    api.get(`/topics/${topicId}`)
      .then(res => setTopic(res.data))
      .catch(() => setError('Could not load topic'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadTopic(); }, [topicId]);

  const handleUpload = async () => {
    if (newFiles.length === 0) return;
    setUploading(true);
    setError('');
    try {
      await addFilesToTopic(topicId, newFiles);
      setNewFiles([]);
      loadTopic();
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (materialId) => {
    if (!confirm('Remove this file from the topic?')) return;
    try {
      await deleteSingleFile(materialId, topicId);
      loadTopic();
    } catch {
      setError('Delete failed');
    }
  };

  if (loading) return <AppLayout><Loader /></AppLayout>;

  return (
    <AppLayout>
      <div className="p-8 max-w-2xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] mb-6 flex items-center gap-1"
        >
          ← Back to Dashboard
        </button>

        <h1 className="text-xl font-semibold text-[var(--text-primary)] mb-1">{topic?.title}</h1>
        <p className="text-sm text-[var(--text-muted)] mb-6">{topic?.subject || 'No subject set'}</p>

        {error && (
          <div className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-md mb-4">{error}</div>
        )}

        {/* Uploaded files list */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">
            Uploaded Files ({topic?.materialDetails?.length || 0})
          </h2>
          {(!topic?.materialDetails || topic.materialDetails.length === 0) ? (
            <p className="text-sm text-[var(--text-muted)]">No files yet.</p>
          ) : (
            <div className="space-y-2">
              {topic.materialDetails.map(m => (
                <div
                  key={m._id}
                  className="flex items-center justify-between border border-[var(--border)] rounded-xl px-4 py-3 bg-[var(--surface-0)]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-lg">{m.fileType === 'pdf' ? '📕' : m.fileType === 'docx' ? '📘' : '📄'}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate">{m.title}</p>
                      <p className="text-xs text-[var(--text-muted)] uppercase">{m.fileType}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(m._id)}
                    className="text-[var(--text-muted)] hover:text-red-500 transition-colors text-xl leading-none ml-4 shrink-0"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add more files */}
        <div className="border border-[var(--border)] rounded-xl p-6 bg-[var(--surface-0)]">
          <h2 className="text-sm font-semibold text-[var(--text-secondary)] mb-4">Add More Files</h2>
          <div
            onClick={() => document.getElementById('addFilesInput').click()}
            onDrop={e => { e.preventDefault(); setNewFiles(Array.from(e.dataTransfer.files)); }}
            onDragOver={e => e.preventDefault()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors mb-4 ${
              newFiles.length > 0 ? 'border-[var(--accent)] bg-blue-50/30 dark:bg-blue-900/10' : 'border-[var(--border)] hover:border-[var(--accent)]'
            }`}
          >
            <input
              id="addFilesInput"
              type="file"
              accept=".pdf,.docx,.txt"
              multiple
              className="hidden"
              onChange={e => setNewFiles(Array.from(e.target.files))}
            />
            {newFiles.length > 0 ? (
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">{newFiles.length} file{newFiles.length > 1 ? 's' : ''} selected</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">{newFiles.map(f => f.name).join(', ')}</p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-[var(--text-secondary)] mb-1">Click or drag files here</p>
                <p className="text-xs text-[var(--text-muted)]">PDF, DOCX, TXT — up to 20MB each</p>
              </div>
            )}
          </div>
          <Button
            onClick={handleUpload}
            loading={uploading}
            disabled={newFiles.length === 0}
            className="w-full justify-center"
          >
            {uploading ? 'Uploading…' : `Add ${newFiles.length > 0 ? newFiles.length + ' ' : ''}File${newFiles.length !== 1 ? 's' : ''}`}
          </Button>
          {topic?.materialDetails?.length > 0 && (
            <p className="text-xs text-[var(--text-muted)] mt-3 text-center">
              Adding files will rebuild the topic's combined text for AI.
            </p>
          )}
        </div>

        {/* Study buttons */}
        <div className="mt-6 flex gap-3">
          <Button onClick={() => navigate(`/learn/${topicId}`)} className="flex-1 justify-center">
            🧠 Start Learning
          </Button>
          <Button onClick={() => navigate(`/material/${topicId}/notes`)} className="flex-1 justify-center" variant="secondary">
            📝 View Notes
          </Button>
        </div>
      </div>
    </AppLayout>
  );
};

export default TopicFiles;