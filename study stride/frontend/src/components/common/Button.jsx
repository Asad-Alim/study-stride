const variants = {
  primary: 'bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white',
  ghost: 'bg-transparent hover:bg-[var(--surface-2)] text-[var(--text-secondary)]',
  danger: 'bg-transparent hover:bg-red-50 dark:hover:bg-red-900/20 text-[var(--critical)]',
  outline: 'border border-[var(--border)] hover:border-[var(--accent)] bg-transparent text-[var(--text-primary)]',
};

const sizes = {
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-3.5 py-1.5 text-sm',
  lg: 'px-5 py-2.5 text-sm',
};

const Button = ({ children, variant = 'primary', size = 'md', className = '', loading, ...props }) => (
  <button
    className={`inline-flex items-center gap-1.5 rounded-md font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
    disabled={loading || props.disabled}
    {...props}
  >
    {loading && (
      <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    )}
    {children}
  </button>
);

export default Button;