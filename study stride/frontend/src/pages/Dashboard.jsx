import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMaterial } from '../context/MaterialContext';
import { useAuth } from '../context/AuthContext';
import AppLayout from '../components/layout/AppLayout';
import Button from '../components/common/Button';

const ModePicker = ({ topic, onClose }) => {
  const navigate = useNavigate();
  const id = topic._id;

  const modes = [
    { id: 'files', label: 'View / Add Files', icon: '📁', desc: 'See uploaded files, add more PDFs to this topic.', route: `/topic/${id}/files` },
    { id: 'learn', label: 'Learning Mode', icon: '🧠', desc: 'Section-by-section AI explanations and chat.', route: `/learn/${id}` },
    { id: 'notes', label: 'Notes Mode', icon: '📝', desc: 'Read and edit AI-generated colour-coded notes.', route: `/material/${id}/notes` },
    { id: 'flashcards', label: 'Flashcards', icon: '🃏', desc: 'Review all cards at a glance and flip to reveal answers.', route: `/material/${id}/flashcards` },
    { id: 'quiz', label: 'Quiz', icon: '📊', desc: 'Test your knowledge with MCQs and descriptive questions.', route: `/material/${id}/quiz` },
    { id: 'generate', label: 'Study Kit', icon: '⚡', desc: 'Generate summaries, flashcards, quizzes all at once.', route: `/material/${id}/generate` },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)' }}
      onClick={onClose}
    >
      <div
        className="bg-[var(--surface-0)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="font-semibold text-[var(--text-primary)] text-base">Study this topic</h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate max-w-[200px]">{topic.title}</p>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xl leading-none">×</button>
        </div>

        <div className="space-y-2">
          {modes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => navigate(mode.route)}
              className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl border border-[var(--border)] hover:border-[var(--accent)] bg-[var(--surface-1)] hover:bg-[var(--surface-0)] transition-all group"
            >
              <span className="text-xl">{mode.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">{mode.label}</p>
                <p className="text-xs text-[var(--text-muted)] truncate">{mode.desc}</p>
              </div>
              <span className="text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors">→</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const { topics, fetchMaterials, deleteMaterial } = useMaterial();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [selectedTopic, setSelectedTopic] = useState(null);

  useEffect(() => { fetchMaterials(); }, []);

  const filtered = topics.filter(t => t.title.toLowerCase().includes(search.toLowerCase()));

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (confirm('Delete this topic and all its files?')) await deleteMaterial(id);
  };

  return (
    <AppLayout>
      <div className="p-8 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-[var(--text-primary)]">My Topics</h1>
            <p className="text-sm text-[var(--text-muted)] mt-0.5">Welcome back, {user?.name}</p>
          </div>
          <Button onClick={() => navigate('/upload')}>Upload Material</Button>
        </div>

        <div className="mb-6">
          <input
            type="text" placeholder="Search topics…" value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full max-w-sm border border-[var(--border)] rounded-xl bg-[var(--surface-0)] text-[var(--text-primary)] placeholder-[var(--text-muted)] px-4 py-2 text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
          />
        </div>

        {topics.length === 0 ? (
          <div className="text-center py-20 text-[var(--text-muted)]">
            <p className="text-lg mb-2">No topics yet</p>
            <p className="text-sm mb-6">Upload a PDF, DOCX, or TXT file to get started</p>
            <Button onClick={() => navigate('/upload')}>Upload your first material</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(t => (
              <div
                key={t._id}
                onClick={() => setSelectedTopic(t)}
                className="group border border-[var(--border)] rounded-xl p-5 bg-[var(--surface-0)] hover:border-[var(--accent)] cursor-pointer transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="text-xs font-mono uppercase text-[var(--text-muted)] bg-[var(--surface-2)] px-2 py-0.5 rounded">
                    {t.subject || 'topic'}
                  </span>
                  <button onClick={(e) => handleDelete(e, t._id)} className="opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-[var(--critical)] transition-all text-lg leading-none">×</button>
                </div>
                <h3 className="font-medium text-sm text-[var(--text-primary)] mb-1 truncate">{t.title}</h3>
                <p className="text-xs text-[var(--text-muted)]">
                  {t.materials?.length || 0} file{(t.materials?.length || 0) !== 1 ? 's' : ''} uploaded
                </p>
                <p className="text-xs text-[var(--text-accent)] mt-2 opacity-0 group-hover:opacity-100 transition-opacity">Click to choose study mode →</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedTopic && (
        <ModePicker topic={selectedTopic} onClose={() => setSelectedTopic(null)} />
      )}
    </AppLayout>
  );
};

export default Dashboard;