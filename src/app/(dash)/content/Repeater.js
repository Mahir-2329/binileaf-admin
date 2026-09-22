'use client';

import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';

/**
 * A list you can add to, take from and reorder.
 *
 * Reordering is two buttons, not a drag handle. A drag needs a pointer, a
 * steady hand and a screen tall enough to see where the row is going; up and
 * down work with a thumb, with a keyboard and with a screen reader, and a
 * paragraph only ever moves one place at a time anyway.
 *
 * Rows carry no id — the list is short and ordered, and the index is the
 * identity. `renderRow` gets an `update` callback so the caller never has to
 * splice the array itself.
 */
export default function Repeater({
  label,
  hint,
  items,
  onChange,
  createItem,
  addLabel = 'Add',
  emptyLabel = 'Nothing here yet.',
  rowLabel = (index) => `Row ${index + 1}`,
  renderRow,
}) {
  const move = (from, to) => {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  const update = (index, value) =>
    onChange(items.map((item, position) => (position === index ? value : item)));

  const remove = (index) => onChange(items.filter((_, position) => position !== index));

  return (
    <div>
      <span className="field__label">{label}</span>
      {hint ? <p className="t-meta -mt-1 mb-2">{hint}</p> : null}

      {items.length ? (
        <ul className="flex flex-col gap-3">
          {items.map((item, index) => (
            <li key={index} className="border border-ink/15 p-3">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">{renderRow(item, index, (value) => update(index, value))}</div>

                <div className="flex shrink-0 flex-col gap-1">
                  <button
                    type="button"
                    className="btn btn--ghost btn--icon h-11 w-11"
                    onClick={() => move(index, index - 1)}
                    disabled={index === 0}
                    aria-label={`Move ${rowLabel(index)} up`}
                  >
                    <ChevronUp size={14} strokeWidth={1.8} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost btn--icon h-11 w-11"
                    onClick={() => move(index, index + 1)}
                    disabled={index === items.length - 1}
                    aria-label={`Move ${rowLabel(index)} down`}
                  >
                    <ChevronDown size={14} strokeWidth={1.8} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="btn btn--danger btn--icon h-11 w-11"
                    onClick={() => remove(index)}
                    aria-label={`Remove ${rowLabel(index)}`}
                  >
                    <Trash2 size={14} strokeWidth={1.8} aria-hidden="true" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="t-meta border border-dashed border-ink/25 p-4">{emptyLabel}</p>
      )}

      <button
        type="button"
        className="btn btn--ghost btn--sm mt-3 min-h-[44px]"
        onClick={() => onChange([...items, createItem()])}
      >
        <Plus size={13} strokeWidth={1.8} aria-hidden="true" />
        {addLabel}
      </button>
    </div>
  );
}
