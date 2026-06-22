const Loader = ({ text = 'Loading…' }) => (
  <div className="flex flex-col items-center justify-center gap-3 py-16 text-[var(--text-muted)]">
    <svg className="animate-spin w-6 h-6" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
    <span className="text-sm">{text}</span>
  </div>
);

export default Loader;