import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import AppLayout from '../components/layout/AppLayout';
import Button from '../components/common/Button';
import Loader from '../components/common/Loader';

const Section = ({ title, items }) => (
  <div>
    <h3 className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)] mb-2">{title}</h3>
    <ul className="space-y-1.5">
      {items?.map((item, i) => (
        <li key={i} className="text-sm text-[var(--text-secondary)] flex gap-2">
          <span className="text-[var(--text-muted)]">–</span>
          {typeof item === 'object' ? <span><strong className="text-[var(--text-primary)]">{item.term}:</strong> {item.definition}</span> : item}
        </li>
      ))}
    </ul>
  </div>
);

const GeneratedContent = () => {
  const { materialId } = useParams();
  const navigate = useNavigate();
  const [active, setActive] = useState(null);
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(null);
  const [stale, setStale] = useState({});

  const endpoints = {
    summary: `/generate/${materialId}/summary`,
    revision: `/generate/${materialId}/revision`,
    cheatsheet: `/generate/${materialId}/cheatsheet`,
  };

  // Item 14 — check which cached artifacts have new material since they
  // were generated. Cheap (no Gemini call), safe to call on mount.
  const refreshStale = async () => {
    try {
      const res = await api.get(`/generate/${materialId}/stale-check`);
      setStale(res.data);
    } catch {
      // non-critical
    }
  };

  useEffect(() => { refreshStale(); }, [materialId]);

  const load = async (type, force = false) => {
    if (data[type] && !force) return setActive(type);
    setLoading(type);
    try {
      const url = force ? `${endpoints[type]}?force=true` : endpoints[type];
      const res = await api.get(url);
      setData(d => ({ ...d, [type]: res.data.content }));
      setActive(type);
      setStale(s => ({ ...s, [type]: false }));
    } catch (err) {
      console.error('Failed to load', type, err);
    } finally {
      setLoading(null);
    }
  };

  const tabs = [
    { key: 'summary', label: 'Summary' },
    { key: 'revision', label: 'Revision Sheet' },
    { key: 'cheatsheet', label: 'Cheat Sheet' },
  ];

  const renderContent = () => {
    const d = data[active];
    if (!d) return null;

    if (active === 'summary') return (
      <div className="space-y-5">
        <Section title="Key Concepts" items={d.keyConcepts} />
        <Section title="Important Definitions" items={d.importantDefinitions} />
        <Section title="Exam Points" items={d.examPoints} />
      </div>
    );

    if (active === 'revision') return (
      <div className="space-y-5">
        <Section title="Quick Revision" items={d.quickRevision} />
        <Section title="Formula Sheet" items={d.formulaSheet} />
        <Section title="Last-Minute Concepts" items={d.lastMinuteConcepts} />
      </div>
    );

    if (active === 'cheatsheet') return (
      <div className="space-y-5">
        <Section title="Keywords" items={d.keywords} />
        <Section title="Formulae" items={d.formulae} />
        <Section title="Memory Tricks" items={d.memoryTricks} />
      </div>
    );
  };

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
            <h1 className="text-xl font-semibold text-[var(--text-primary)]">Study Materials</h1>
          </div>
          <div className="flex gap-2">
            <Link to={`/material/${materialId}/flashcards`}>
              <Button variant="outline" size="sm">Flashcards</Button>
            </Link>
            <Link to={`/material/${materialId}/quiz`}>
              <Button variant="outline" size="sm">Quiz</Button>
            </Link>
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          {tabs.map(t => (
            <Button
              key={t.key}
              variant={active === t.key ? 'primary' : 'outline'}
              size="sm"
              loading={loading === t.key}
              onClick={() => load(t.key)}
            >
              {t.label}
            </Button>
          ))}
        </div>

        {active && stale[active] && (
          <div className="mb-4 flex items-center justify-between text-xs bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
            <span className="text-amber-800 dark:text-amber-300">New material was added since this was generated.</span>
            <button
              onClick={() => load(active, true)}
              className="font-medium text-amber-900 dark:text-amber-200 underline shrink-0 ml-3"
            >
              Regenerate
            </button>
          </div>
        )}

        {active && (
          <div className="bg-[var(--surface-0)] border border-[var(--border)] rounded-xl p-6">
            {loading === active ? <Loader /> : renderContent()}
          </div>
        )}

        {!active && (
          <p className="text-sm text-[var(--text-muted)]">Select a tab above to generate study materials.</p>
        )}
      </div>
    </AppLayout>
  );
};

export default GeneratedContent;