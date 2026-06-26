import { useEffect, useRef } from 'react';
import Loader from '../common/Loader';

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

const RightPanel = ({ messages, loading, fontSize = 15 }) => {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.length === 0 && (
        <div className="text-center text-[var(--text-muted)] text-sm py-12" style={{ fontSize: `${fontSize}px` }}>
          <p className="mb-1">Ask a question about this page</p>
          <p className="text-xs">Or highlight text to explain, simplify, or get examples</p>
        </div>
      )}
      {messages.map((msg, i) => (
        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div
            className={`max-w-[85%] px-3.5 py-2.5 rounded-xl leading-relaxed ${
              msg.role === 'user'
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--surface-2)] text-[var(--text-primary)]'
            }`}
            style={{ fontSize: `${fontSize}px` }}
          >
            {msg.role === 'ai' ? (
              <div dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
            ) : (
              msg.content
            )}
          </div>
        </div>
      ))}
      {loading && <Loader text="Thinking…" />}
      <div ref={bottomRef} />
    </div>
  );
};

export default RightPanel;