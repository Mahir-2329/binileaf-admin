'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { cx } from '@/lib/utils';

/**
 * The phone's answer to a row of six icons.
 *
 * On a wide screen the rarely-used controls appear on the row when it is
 * pointed at, which costs nothing. A phone has no pointer and no room: eighty
 * rows each carrying a second line of buttons is a screen you scroll for a
 * minute to reach the food. So below the editor's breakpoint the row keeps the
 * two daily switches and one "more", and everything else lives in here.
 *
 * It is deliberately not a menu: full-width rows, thumb height, and the label
 * spelled out — this is read standing at a counter, one-handed.
 */
export default function RowSheet({ title, open, onClose, children }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[60] flex items-end bg-ink-deep/60 lg:hidden"
      onClick={onClose}
    >
      <div
        className="w-full border-t border-ink/20 bg-paper-bright pb-[env(safe-area-inset-bottom)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-ink/15 px-4 py-3">
          <p className="t-h2 truncate text-[0.9375rem]">{title}</p>
          <button type="button" className="iconb" onClick={onClose} aria-label="Close">
            <X size={16} strokeWidth={1.8} />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}

export function SheetRow({ icon: Icon, label, hint, onClick, disabled, tone }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        'flex w-full items-center gap-3 border-b border-ink/10 px-4 py-3 text-left text-[0.875rem] last:border-b-0 disabled:opacity-35',
        tone === 'danger' && 'text-stamp'
      )}
    >
      <Icon
        size={16}
        strokeWidth={1.7}
        className={cx('shrink-0', tone === 'danger' ? 'text-stamp' : 'text-pencil')}
      />
      <span className="min-w-0 flex-1">
        {label}
        {hint ? <span className="t-meta block">{hint}</span> : null}
      </span>
    </button>
  );
}
