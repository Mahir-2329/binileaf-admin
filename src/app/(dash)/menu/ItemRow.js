'use client';

import { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Star,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import { Confirm } from '@/components/ui';
import { cx, rupees } from '@/lib/utils';
import RowSheet, { SheetRow } from './RowSheet';

/**
 * One line of the card, as the editor sees it.
 *
 * The two switches that get used every day — the house-special mark and the
 * daily 86 — sit on the row and are always drawn. Moving, editing and deleting
 * are needed once in a while, so on a wide screen they appear when the row is
 * pointed at, and on a phone they are behind the row's "more". Boxing all six
 * on every one of eighty rows, which is what this used to do, turns a menu
 * into a wall of rectangles nobody can read a dish out of.
 */

function Flag({ tone, children }) {
  return <span className={cx('tag', tone)}>{children}</span>;
}

export default function ItemRow({
  item,
  first,
  last,
  selected,
  onSelect,
  onMove,
  onEdit,
  onDelete,
  onFlag,
  drag,
}) {
  const [sheet, setSheet] = useState(false);
  const off = !item.isAvailable;
  const retired = !item.isActive;

  const run = (action) => () => {
    setSheet(false);
    action();
  };

  return (
    <li
      {...drag.zone}
      className={cx(
        'hit group/row relative flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-ink/10 py-1 pl-1 pr-2 transition-colors last:border-b-0 hover:bg-paper-shade/25 focus-within:bg-paper-shade/25 lg:pl-2 lg:pr-3',
        selected && 'bg-brass/8',
        retired && 'bg-paper-shade/40',
        drag.zone.className
      )}
    >
      <span
        {...drag.handle}
        className={cx(
          drag.handle.className,
          'hidden w-4 shrink-0 text-pencil/0 transition-colors group-hover/row:text-pencil/70 lg:block'
        )}
      >
        <GripVertical size={14} strokeWidth={1.6} />
      </span>

      <label className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center">
        <span className="sr-only">Select {item.name}</span>
        <input
          type="checkbox"
          checked={selected}
          onChange={(event) => onSelect(item.id, event.target.checked)}
          className="h-[15px] w-[15px] accent-[var(--color-ink)]"
        />
      </label>

      {/* The name is the target: clicking it opens the same editor the pencil does. */}
      <button
        type="button"
        onClick={() => onEdit(item)}
        className="min-w-0 flex-1 basis-[min(100%,6.5rem)] py-1 text-left lg:basis-[min(100%,11rem)]"
      >
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            className={cx(
              'text-[0.875rem] decoration-1 underline-offset-[3px] group-hover/row:underline',
              // Two lines on a phone, one truncated line where there is room.
              'line-clamp-2 lg:line-clamp-none lg:truncate',
              retired && 'line-through decoration-pencil',
              off && 'text-pencil'
            )}
          >
            {item.name}
          </span>

          {item.isStar ? <Flag tone="tag--brass">Special</Flag> : null}
          {item.isNew ? <Flag tone="tag--leaf">New</Flag> : null}
          {item.comparePrice ? <Flag tone="tag--stamp">Deal</Flag> : null}
          {off ? <Flag tone="tag--stamp">Off today</Flag> : null}
          {retired ? <Flag tone="tag--muted">Retired</Flag> : null}
        </span>

        {item.note ? <span className="t-meta mt-[2px] block truncate">{item.note}</span> : null}
      </button>

      <p className="tabular shrink-0 text-right font-[family-name:var(--font-display)] text-[0.9375rem]">
        {item.comparePrice ? (
          <span className="t-meta tabular mr-1.5 line-through">₹{rupees(item.comparePrice)}</span>
        ) : null}
        ₹{rupees(item.price)}
      </p>

      <div className="actions ml-auto shrink-0">
        <button
          type="button"
          className={cx('iconb', item.isStar && 'iconb--on')}
          aria-pressed={item.isStar}
          aria-label={`House special — ${item.name}`}
          title="House special"
          onClick={() => onFlag(item.id, 'isStar', !item.isStar)}
        >
          <Star size={15} strokeWidth={1.6} fill={item.isStar ? 'currentColor' : 'none'} />
        </button>

        <button
          type="button"
          className={cx('iconb', off && 'iconb--off')}
          aria-pressed={off}
          aria-label={off ? `Put ${item.name} back on` : `Mark ${item.name} unavailable today`}
          title={off ? 'Put it back on' : 'Run out for today'}
          onClick={() => onFlag(item.id, 'isAvailable', off)}
        >
          {off ? <Undo2 size={15} strokeWidth={1.6} /> : <X size={15} strokeWidth={1.6} />}
        </button>

        <span className="quiet mx-1 hidden h-4 w-px bg-ink/15 lg:block" aria-hidden="true" />

        {/* Phone: one button in place of the four below. */}
        <button
          type="button"
          className="iconb lg:hidden"
          aria-label={`More for ${item.name}`}
          aria-haspopup="dialog"
          onClick={() => setSheet(true)}
        >
          <MoreHorizontal size={16} strokeWidth={1.8} />
        </button>

        <button
          type="button"
          className="iconb quiet hidden lg:inline-flex"
          disabled={first}
          aria-label={`Move ${item.name} up`}
          onClick={() => onMove(item.id, -1)}
        >
          <ChevronUp size={15} strokeWidth={1.8} />
        </button>
        <button
          type="button"
          className="iconb quiet hidden lg:inline-flex"
          disabled={last}
          aria-label={`Move ${item.name} down`}
          onClick={() => onMove(item.id, 1)}
        >
          <ChevronDown size={15} strokeWidth={1.8} />
        </button>

        <button
          type="button"
          className="iconb quiet hidden lg:inline-flex"
          aria-label={`Edit ${item.name}`}
          title="Edit"
          onClick={() => onEdit(item)}
        >
          <Pencil size={14} strokeWidth={1.7} />
        </button>

        <span className="hidden lg:inline-flex">
          <Confirm
            title={`Delete ${item.name}?`}
            body="It comes off the card and out of this list. Nothing is erased — the row is archived, so the price and the history stay. If you only want it off for today, close this and use the cross on the row instead."
            confirmLabel="Delete item"
            onConfirm={() => onDelete(item)}
          >
            <button
              type="button"
              className="iconb iconb--danger quiet"
              aria-label={`Delete ${item.name}`}
              title="Delete"
            >
              <Trash2 size={14} strokeWidth={1.7} />
            </button>
          </Confirm>
        </span>
      </div>

      <RowSheet title={item.name} open={sheet} onClose={() => setSheet(false)}>
        <SheetRow
          icon={Pencil}
          label="Edit this item"
          hint="Name, price, category, flags"
          onClick={run(() => onEdit(item))}
        />
        <SheetRow
          icon={ChevronUp}
          label="Move up"
          disabled={first}
          onClick={run(() => onMove(item.id, -1))}
        />
        <SheetRow
          icon={ChevronDown}
          label="Move down"
          disabled={last}
          onClick={run(() => onMove(item.id, 1))}
        />

        <Confirm
          title={`Delete ${item.name}?`}
          body="It comes off the card and out of this list. Nothing is erased — the row is archived, so the price and the history stay. If you only want it off for today, close this and use the cross on the row instead."
          confirmLabel="Delete item"
          onConfirm={() => {
            setSheet(false);
            onDelete(item);
          }}
        >
          <SheetRow icon={Trash2} label="Delete this item" tone="danger" />
        </Confirm>
      </RowSheet>
    </li>
  );
}
