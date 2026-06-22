const config = {
  critical: { label: '🔴 Critical', color: 'text-[var(--critical)] bg-red-50 dark:bg-red-900/20' },
  important: { label: '🟡 Important', color: 'text-[var(--important)] bg-yellow-50 dark:bg-yellow-900/20' },
  general: { label: '⚪ General', color: 'text-[var(--general)] bg-gray-100 dark:bg-gray-800' },
};

const ImportanceTag = ({ level }) => {
  const { label, color } = config[level] || config.general;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      {label}
    </span>
  );
};

export default ImportanceTag;