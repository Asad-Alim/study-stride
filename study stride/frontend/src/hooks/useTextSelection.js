import { useState, useEffect } from 'react';

const useTextSelection = (containerRef) => {
  const [selection, setSelection] = useState({ text: '', position: null });

  useEffect(() => {
    const handleMouseUp = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !containerRef.current?.contains(sel.anchorNode)) {
        setSelection({ text: '', position: null });
        return;
      }
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect();
      setSelection({
        text: sel.toString().trim(),
        position: {
          top: rect.top - containerRect.top - 40,
          left: rect.left - containerRect.left + rect.width / 2,
        },
      });
    };

    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, [containerRef]);

  const clear = () => {
    window.getSelection()?.removeAllRanges();
    setSelection({ text: '', position: null });
  };

  return { selection, clear };
};

export default useTextSelection;