import { useState } from 'react';

const ChatInput = ({ onSend, disabled }) => {
  const [value, setValue] = useState('');

  const submit = () => {
    if (!value.trim() || disabled) return;
    onSend(value.trim());
    setValue('');
  };

  return (
    <div className="border-t border-[var(--border)] bg-[var(--surface-0)] p-3">
      <div className="flex gap-2 items-end">
        <textarea
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
          placeholder="Ask a question about this page…"
          rows={2}
          disabled={disabled}
          className="flex-1 resize-none rounded-lg border border-[var(--border)] bg-[var(--surface-1)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] text-sm px-3 py-2 focus:outline-none focus:border-[var(--accent)] transition-colors"
        />
        <button
          onClick={submit}
          disabled={disabled || !value.trim()}
          className="px-3 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg text-sm font-medium disabled:opacity-40 transition-colors self-end"
        >
          Ask
        </button>
      </div>
    </div>
  );
};

export default ChatInput;