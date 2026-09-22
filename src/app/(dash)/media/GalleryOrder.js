'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, GripVertical, Loader2 } from 'lucide-react';
import { Empty, Modal } from '@/components/ui';
import { cx } from '@/lib/utils';
import { reorderGallery } from '@/server/media';
import Thumb from './Thumb';

/**
 * The order the public gallery runs in.
 *
 * Up/down buttons are the real control: they work with a keyboard, they work
 * with one thumb on a phone, and they cannot half-happen. Pointer drag sits on
 * top for anyone on a mouse who expects it, but nothing depends on it.
 *
 * Each move renumbers the whole list locally and then posts the whole list —
 * never "move item X up" — so the server always writes a complete 0..n run and
 * a dropped request cannot leave two photographs sharing a place.
 */
export default function GalleryOrder({ onClose, items, onSaved, notify }) {
  // Seeded once, on mount. The library only renders this panel while it is
  // open, so reopening it is what picks up an upload or a bulk add — no effect
  // has to chase the prop.
  const [order, setOrder] = useState(items);
  const [saving, setSaving] = useState(false);
  const timer = useRef(null);
  const rowRefs = useRef(new Map());
  const focusAfterMove = useRef(null);
  const [dragFrom, setDragFrom] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  const persist = useCallback(
    (next) => {
      // Clicking "up" four times should be one write, not four. The debounce
      // also keeps Next's one-action-at-a-time dispatcher from queueing.
      clearTimeout(timer.current);
      setSaving(true);
      timer.current = setTimeout(async () => {
        try {
          await reorderGallery(next.map((photo) => photo.id));
          onSaved(next);
          notify('Gallery order saved.');
        } catch (error) {
          notify(error?.message || 'The order did not save.', 'error');
        } finally {
          setSaving(false);
        }
      }, 700);
    },
    [notify, onSaved]
  );

  useEffect(() => () => clearTimeout(timer.current), []);

  const move = (from, to) => {
    if (to < 0 || to >= order.length || from === to) return;
    const next = [...order];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    // The button the operator just pressed travels with the row, so focus has
    // to follow it or the next press lands on a different photograph.
    focusAfterMove.current = { id: moved.id, direction: to < from ? 'up' : 'down' };
    setOrder(next);
    persist(next);
  };

  useEffect(() => {
    const pending = focusAfterMove.current;
    if (!pending) return;
    focusAfterMove.current = null;
    rowRefs.current.get(`${pending.id}:${pending.direction}`)?.focus();
  }, [order]);

  const onDrop = (index) => {
    if (dragFrom === null || dragFrom === index) return;
    move(dragFrom, index);
    setDragFrom(null);
    setDragOver(null);
  };

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title="Gallery order"
      description="The order these run in on the public gallery. Changes save themselves."
    >
      <div className="mb-4 flex items-center gap-3">
        <p className="t-meta flex-1">
          {order.length} photographs in the gallery. Use the arrows, or drag a row.
        </p>
        <span className="t-meta flex min-h-[18px] items-center gap-2" aria-live="polite">
          {saving ? (
            <>
              <Loader2 size={13} strokeWidth={1.8} className="animate-spin" />
              Saving
            </>
          ) : null}
        </span>
      </div>

      {order.length ? (
        <ol className="panel">
          {order.map((photo, index) => (
            <li
              key={photo.id}
              draggable
              onDragStart={() => setDragFrom(index)}
              onDragEnd={() => {
                setDragFrom(null);
                setDragOver(null);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOver(index);
              }}
              onDrop={(event) => {
                event.preventDefault();
                onDrop(index);
              }}
              className={cx(
                'row grab gap-3',
                dragFrom === index && 'dragging',
                dragOver === index && dragFrom !== null && dragFrom > index && 'drop-before',
                dragOver === index && dragFrom !== null && dragFrom < index && 'drop-after'
              )}
            >
              <GripVertical
                size={15}
                strokeWidth={1.7}
                aria-hidden="true"
                className="hidden shrink-0 text-pencil sm:block"
              />
              <span className="tabular w-6 shrink-0 text-[0.75rem] text-pencil">{index + 1}</span>

              <Thumb photo={photo} size="row" className="h-12 w-12 shrink-0" />

              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.8125rem]">{photo.slug}</span>
                <span className="t-meta block truncate">{photo.alt || 'No alt text'}</span>
              </span>

              <span className="flex shrink-0 gap-1">
                <button
                  type="button"
                  ref={(node) => {
                    if (node) rowRefs.current.set(`${photo.id}:up`, node);
                    else rowRefs.current.delete(`${photo.id}:up`);
                  }}
                  className="inline-flex h-11 w-11 items-center justify-center border border-ink/20 disabled:opacity-30"
                  disabled={index === 0}
                  aria-label={`Move ${photo.slug} up`}
                  onClick={() => move(index, index - 1)}
                >
                  <ChevronUp size={16} strokeWidth={1.9} />
                </button>
                <button
                  type="button"
                  ref={(node) => {
                    if (node) rowRefs.current.set(`${photo.id}:down`, node);
                    else rowRefs.current.delete(`${photo.id}:down`);
                  }}
                  className="inline-flex h-11 w-11 items-center justify-center border border-ink/20 disabled:opacity-30"
                  disabled={index === order.length - 1}
                  aria-label={`Move ${photo.slug} down`}
                  onClick={() => move(index, index + 1)}
                >
                  <ChevronDown size={16} strokeWidth={1.9} />
                </button>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <Empty
          title="The gallery is empty"
          body="Tick some photographs on the library and add them to the gallery — then they can be put in order here."
        />
      )}
    </Modal>
  );
}
