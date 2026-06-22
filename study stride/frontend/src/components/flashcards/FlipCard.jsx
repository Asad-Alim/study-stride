import { useState } from 'react';

const FlipCard = ({ question, answer }) => {
  const [flipped, setFlipped] = useState(false);

  return (
    <div
      onClick={() => setFlipped(f => !f)}
      style={{ perspective: '1000px', cursor: 'pointer' }}
      className="w-full"
    >
      <div
        style={{
          transition: 'transform 0.5s',
          transformStyle: 'preserve-3d',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          position: 'relative',
          height: '200px',
        }}
      >
        {/* Front */}
        <div
          style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
          className="absolute inset-0 flex flex-col items-center justify-center p-6 rounded-xl border border-[var(--border)] bg-[var(--surface-0)]"
        >
          <span className="text-xs text-[var(--text-muted)] mb-3 uppercase tracking-wider">Question</span>
          <p className="text-sm text-center text-[var(--text-primary)] font-medium">{question}</p>
          <span className="mt-4 text-xs text-[var(--text-muted)]">Click to reveal answer</span>
        </div>
        {/* Back */}
        <div
          style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          className="absolute inset-0 flex flex-col items-center justify-center p-6 rounded-xl border border-[var(--accent)] bg-[var(--surface-2)]"
        >
          <span className="text-xs text-[var(--accent)] mb-3 uppercase tracking-wider">Answer</span>
          <p className="text-sm text-center text-[var(--text-primary)]">{answer}</p>
        </div>
      </div>
    </div>
  );
};

export default FlipCard;