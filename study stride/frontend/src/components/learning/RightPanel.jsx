import { useEffect, useRef } from 'react';
import Loader from '../common/Loader';

const RightPanel = ({ messages, loading }) => {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.length === 0 && (
        <div className="text-center text-[var(--text-muted)] text-sm py-12">
          <p className="mb-1">Ask a question about this page</p>
          <p className="text-xs">Or highlight text to explain, simplify, or get examples</p>
        </div>
      )}
      {messages.map((msg, i) => (
        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div
            className={`max-w-[85%] px-3.5 py-2.5 rounded-xl text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--surface-2)] text-[var(--text-primary)]'
            }`}
          >
            {msg.content}
          </div>
        </div>
      ))}
      {loading && <Loader text="Thinking…" />}
      <div ref={bottomRef} />
    </div>
  );
};

export default RightPanel;