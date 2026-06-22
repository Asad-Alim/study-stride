import Button from '../common/Button';

const TextSelectionMenu = ({ position, onAction, onClose }) => {
  if (!position) return null;
  return (
    <div
      style={{ top: position.top, left: position.left, transform: 'translateX(-50%)' }}
      className="absolute z-50 flex gap-1 bg-[var(--surface-0)] border border-[var(--border)] rounded-lg shadow-lg p-1"
    >
      <Button size="sm" variant="ghost" onClick={() => onAction('explain')}>Explain</Button>
      <Button size="sm" variant="ghost" onClick={() => onAction('simplify')}>Simplify</Button>
      <Button size="sm" variant="ghost" onClick={() => onAction('example')}>Example</Button>
      <Button size="sm" variant="ghost" onClick={onClose}>✕</Button>
    </div>
  );
};

export default TextSelectionMenu;