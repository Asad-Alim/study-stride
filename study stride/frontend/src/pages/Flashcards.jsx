import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/axios';
import AppLayout from '../components/layout/AppLayout';
import Button from '../components/common/Button';
import Loader from '../components/common/Loader';

const CARD_COLORS = [
  { bg: '#EEF2FF', border: '#A5B4FC', label: '#6366F1' },
  { bg: '#FFF7ED', border: '#FBB97D', label: '#EA580C' },
  { bg: '#F0FDF4', border: '#86EFAC', label: '#16A34A' },
  { bg: '#FDF4FF', border: '#E879F9', label: '#A21CAF' },
  { bg: '#FFFBEB', border: '#FDE047', label: '#CA8A04' },
  { bg: '#FFF1F2', border: '#FDA4AF', label: '#E11D48' },
  { bg: '#F0F9FF', border: '#7DD3FC', label: '#0284C7' },
  { bg: '#F5F3FF', border: '#C4B5FD', label: '#7C3AED' },
];

const MOCK_CARDS = [
  { question: 'What does OSI stand for?', answer: 'Open Systems Interconnection — a conceptual framework for network communication.' },
  { question: 'How many layers does the OSI model have?', answer: '7 layers: Physical, Data Link, Network, Transport, Session, Presentation, Application.' },
  { question: 'What is the role of the Transport Layer?', answer: 'Ensures end-to-end communication, error recovery, and flow control. Uses TCP/UDP.' },
  { question: 'Which layer handles IP addressing?', answer: 'The Network Layer (Layer 3). It handles routing and logical addressing.' },
  { question: 'What devices operate at the Data Link Layer?', answer: 'Switches and Bridges operate at Layer 2.' },
  { question: 'What is the Physical Layer responsible for?', answer: 'Transmitting raw bits over a physical medium like cables or wireless signals.' },
  { question: 'What protocol does the Application Layer use for web?', answer: 'HTTP and HTTPS are Application Layer protocols used for web communication.' },
];

const FlashcardGrid = ({ cards }) => {
  const [revealed, setRevealed] = useState({});

  const toggle = (idx) => setRevealed(prev => ({ ...prev, [idx]: !prev[idx] }));
  const doneCount = Object.values(revealed).filter(Boolean).length;
  const allDone = doneCount === cards.length;

  return (
    <div>
      {/* Progress bar */}
      <div className="mb-5 flex items-center gap-3">
        <div className="flex-1 h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden">
          <div
            className="h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${(doneCount / cards.length) * 100}%`, background: 'var(--accent)' }}
          />
        </div>
        <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">{doneCount} / {cards.length} revealed</span>
        {doneCount > 0 && (
          <button onClick={() => setRevealed({})} className="text-xs text-[var(--text-muted)] hover:text-[var(--accent)] underline">
            Reset
          </button>
        )}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card, idx) => {
          const color = CARD_COLORS[idx % CARD_COLORS.length];
          const isRevealed = !!revealed[idx];
          return (
            <div
              key={idx}
              onClick={() => toggle(idx)}
              style={{
                cursor: 'pointer',
                borderRadius: '14px',
                border: `2px solid ${isRevealed ? '#22C55E' : color.border}`,
                background: isRevealed ? '#F0FDF4' : color.bg,
                transition: 'all 0.25s ease',
                minHeight: '170px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '18px',
                boxShadow: isRevealed ? '0 0 0 3px rgba(34,197,94,0.15)' : '0 1px 3px rgba(0,0,0,0.06)',
                userSelect: 'none',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: isRevealed ? '#16A34A' : color.label, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {isRevealed ? '✓ Answered' : `Card ${idx + 1}`}
                </span>
                {isRevealed && <span style={{ fontSize: '16px' }}>✅</span>}
              </div>

              <p style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', lineHeight: 1.5, marginBottom: isRevealed ? '10px' : '0', flex: 1 }}>
                {card.question}
              </p>

              {isRevealed ? (
                <div style={{ borderTop: '1px solid rgba(34,197,94,0.3)', paddingTop: '10px', marginTop: '4px' }}>
                  <p style={{ fontSize: '12px', color: '#166534', lineHeight: 1.55 }}>{card.answer}</p>
                </div>
              ) : (
                <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '8px' }}>Tap to reveal answer →</p>
              )}
            </div>
          );
        })}
      </div>

      {allDone && (
        <div style={{ marginTop: '24px', textAlign: 'center', padding: '16px', background: '#F0FDF4', borderRadius: '12px', border: '1.5px solid #86EFAC' }}>
          <p style={{ fontSize: '15px', fontWeight: 600, color: '#15803D' }}>🎉 All {cards.length} flashcards completed!</p>
          <p style={{ fontSize: '12px', color: '#4ADE80', marginTop: '4px' }}>Great job — you've reviewed everything.</p>
        </div>
      )}
    </div>
  );
};

const Flashcards = () => {
  const { materialId } = useParams();
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    api.get(`/flashcards/${materialId}`)
      .then(res => setCards(res.data))
      .finally(() => setLoading(false));
  }, [materialId]);

  const handleGenerate = async () => {
    setGenerating(true);
    const res = await api.post(`/flashcards/${materialId}/generate`);
    setCards(res.data);
    setGenerating(false);
  };

  if (loading) return <AppLayout><Loader /></AppLayout>;

  return (
    <AppLayout>
      <div className="p-8 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-[var(--text-primary)]">Flashcards</h1>
            {cards.length > 0 && (
              <p className="text-xs text-[var(--text-muted)] mt-0.5">{cards.length} cards — tap any card to reveal its answer</p>
            )}
          </div>
          {cards.length === 0 && (
            <Button loading={generating} onClick={handleGenerate}>Generate Flashcards</Button>
          )}
        </div>

        {cards.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No flashcards yet. Complete the chapter and generate them.</p>
        ) : (
          <FlashcardGrid cards={cards} />
        )}
      </div>
    </AppLayout>
  );
};

export default Flashcards;