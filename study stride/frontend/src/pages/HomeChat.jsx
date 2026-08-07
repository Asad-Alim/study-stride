import { useState, useRef, useEffect } from 'react';
import { askHomeChat } from '../api/homeChat';
import AppLayout from '../components/layout/AppLayout';

const SourceChip = ({ source }) => (
  <div className="px-2.5 py-1 rounded-md bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text-secondary)] max-w-[220px]">
    <span className="font-medium text-[var(--text-primary)]">{source.topicTitle}</span>
    <span className="block truncate text-[var(--text-muted)]">{source.snippet}</span>
  </div>
);

const Message = ({ msg }) => {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[75%] flex flex-col gap-2 ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`rounded-lg px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
            isUser
              ? 'bg-[var(--accent)] text-white'
              : 'bg-[var(--surface-1)] text-[var(--text-primary)] border border-[var(--border)]'
          }`}
        >
          {msg.content}
        </div>
        {!isUser && msg.sources?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {msg.sources.map((s, i) => <SourceChip key={i} source={s} />)}
          </div>
        )}
      </div>
    </div>
  );
};

const TypingIndicator = () => (
  <div className="flex justify-start">
    <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-lg px-3.5 py-2.5 flex gap-1 items-center">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  </div>
);

const HomeChat = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const submit = async () => {
    const question = input.trim();
    if (!question || loading) return;
    setInput('');
    setMessages(m => [...m, { role: 'user', content: question }]);
    setLoading(true);
    try {
      const res = await askHomeChat(question);
      setMessages(m => [...m, { role: 'ai', content: res.data.answer, sources: res.data.sources }]);
    } catch (err) {
      setMessages(m => [...m, { role: 'ai', content: 'Something went wrong. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <AppLayout>
    <div className="h-[calc(100vh-48px)] flex flex-col bg-[var(--surface-0)]">
      <div className="border-b border-[var(--border)] px-4 py-3 shrink-0">
        <h1 className="text-sm font-semibold text-[var(--text-primary)]">Ask Anything</h1>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">Ask about any topic or material you've uploaded — answers are pulled from everything you own.</p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && !loading && (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm text-[var(--text-muted)]">Ask a question about any of your uploaded notes to get started.</p>
          </div>
        )}
        {messages.map((msg, i) => <Message key={i} msg={msg} />)}
        {loading && <TypingIndicator />}
      </div>

      <div className="border-t border-[var(--border)] bg-[var(--surface-0)] p-3 shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question across all your topics…"
            rows={2}
            disabled={loading}
            className="flex-1 resize-none rounded-lg border border-[var(--border)] bg-[var(--surface-1)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] text-sm px-3 py-2 focus:outline-none focus:border-[var(--accent)] transition-colors"
          />
          <button
            onClick={submit}
            disabled={loading || !input.trim()}
            className="px-3 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg text-sm font-medium disabled:opacity-40 transition-colors self-end"
          >
            Ask
          </button>
        </div>
      </div>
    </div>
    </AppLayout>
  );
};

export default HomeChat;