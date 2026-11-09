'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    // z-[60] keeps the sheet above the mobile bottom nav, so a dialog's last
    // action row is never covered by it. On phones the panel is also capped a
    // little lower than the viewport and pads past the home-indicator inset.
    <div className='fixed inset-0 z-60 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6' onClick={onClose}>
      <div
        ref={panelRef}
        role='dialog'
        aria-modal='true'
        aria-label={title}
        tabIndex={-1}
        className={`max-h-[85dvh] w-full overflow-y-auto rounded-t-2xl bg-background p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-xl outline-none sm:max-h-[90vh] sm:rounded-2xl sm:p-6 ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className='mb-3 flex items-center justify-between'>
          <h3 className='text-base font-bold text-foreground'>{title}</h3>
          <button
            onClick={onClose}
            aria-label='Close'
            className='rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground'
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
