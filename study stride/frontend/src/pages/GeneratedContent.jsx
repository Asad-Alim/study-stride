import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
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
  const [active, setActive] = useState(null);
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(null);

  const endpoints = {
    summary: `/generate/${materialId}/summary`,
    revision: `/generate/${materialId}/revision`,
    cheatsheet: `/generate/${materialId}/cheatsheet`,
  };

//   const load = async (type) => {
//     if (data[type]) return setActive(type);
//     setLoading(type);
//     const res = await api.get(endpoints[type]);
//     setData(d => ({ ...d, [type]: res.data.content }));
//     setActive(type);
//     setLoading(null);
//   };
  const MOCK_DATA = {
    summary: {
      keyConcepts: ['OSI model has 7 layers', 'Each layer has a specific role', 'Layers communicate with adjacent layers only'],
      importantDefinitions: [{ term: 'OSI', definition: 'Open Systems Interconnection — a framework for network protocols' }, { term: 'Protocol', definition: 'A set of rules governing data communication' }],
      examPoints: ['Know all 7 layer names in order', 'Physical layer = bits, Data Link = frames, Network = packets', 'Transport layer uses TCP (reliable) or UDP (fast)'],
    },
    revision: {
      quickRevision: ['Layer 1 Physical — bits, cables, hubs', 'Layer 2 Data Link — frames, switches, MAC', 'Layer 3 Network — packets, routers, IP', 'Layer 4 Transport — TCP/UDP, ports', 'Layer 5-7 Session, Presentation, Application'],
      formulaSheet: ['Mnemonic: Please Do Not Throw Sausage Pizza Away (bottom to top)'],
      lastMinuteConcepts: ['Routers work at Layer 3', 'Switches at Layer 2', 'HTTP/HTTPS at Layer 7'],
    },
    cheatsheet: {
      keywords: ['Encapsulation', 'Protocol', 'MAC Address', 'IP Address', 'Port', 'Socket'],
      formulae: [{ term: 'Data unit at Layer 2', definition: 'Frame' }, { term: 'Data unit at Layer 3', definition: 'Packet' }, { term: 'Data unit at Layer 4', definition: 'Segment' }],
      memoryTricks: ['All People Seem To Need Data Processing (top to bottom)', 'Each layer adds its own header during encapsulation'],
    },
  };

   const load = async (type) => {
    if (data[type]) return setActive(type);
    setLoading(type);
    try {
      const res = await api.get(endpoints[type]);
      setData(d => ({ ...d, [type]: res.data.content }));
      setActive(type);
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
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Study Materials</h1>
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