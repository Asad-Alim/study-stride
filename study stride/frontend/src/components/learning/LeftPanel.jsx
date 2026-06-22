import { useRef } from 'react';
import useTextSelection from '../../hooks/useTextSelection';
import TextSelectionMenu from './TextSelectionMenu';
import Button from '../common/Button';

const LeftPanel = ({ chunk, currentPage, totalPages, onPageChange, onExplainSelection, onNext }) => {
  const containerRef = useRef(null);
  const { selection, clear } = useTextSelection(containerRef);

  const handleAction = async (mode) => {
    if (selection.text) {
      await onExplainSelection(selection.text, mode);
      clear();
    }
  };

  const isLastPage = currentPage >= totalPages;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--surface-0)]">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage <= 1}>←</Button>
          <span className="text-xs text-[var(--text-muted)] font-mono">
            Page {currentPage} / {totalPages}
          </span>
          <Button size="sm" variant="outline" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage >= totalPages}>→</Button>
        </div>
        <Button size="sm" variant="primary" onClick={onNext}>
          {isLastPage ? 'Finish Chapter →' : 'Next →'}
        </Button>
      </div>

      <div ref={containerRef} className="relative flex-1 overflow-y-auto p-5">
        {selection.text && selection.position && (
          <TextSelectionMenu
            position={selection.position}
            onAction={handleAction}
            onClose={clear}
          />
        )}
        <div className="text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap font-mono text-xs leading-6 select-text">
          {chunk?.content || 'Loading page content…'}
        </div>
      </div>
    </div>
  );
};

export default LeftPanel;