'use client';

import { useMemo, useState, useTransition } from 'react';
import { Check, ImageUp, ListOrdered, Loader2, Star, X } from 'lucide-react';
import { Empty, Section, useToast } from '@/components/ui';
import { cx } from '@/lib/utils';
import { setCategory, setGallery } from '@/server/media';
import { CATEGORIES, EMPTY_FILTER, filterMedia, formatBytes } from './constants';
import FilterBar from './FilterBar';
import GalleryOrder from './GalleryOrder';
import MediaDetail from './MediaDetail';
import Thumb from './Thumb';
import UploadDialog from './UploadDialog';

/* ──────────────────────────────────────────────────────────────── tile ──── */

function Tile({ photo, selected, onToggle, onOpen, usageCount }) {
  return (
    <li className="relative">
      <button
        type="button"
        onClick={() => onOpen(photo)}
        title={`${photo.slug} — ${photo.width}×${photo.height}, ${formatBytes(photo.bytes)}`}
        className={cx(
          'block w-full text-left',
          selected && 'outline outline-2 outline-offset-[-2px] outline-stamp'
        )}
      >
        <Thumb photo={photo} />

        <span className="mt-1 block truncate text-[0.6875rem] leading-tight text-pencil">
          {photo.slug.split('/').pop()}
        </span>
        <span className="t-meta flex items-center gap-1 truncate text-[0.625rem]">
          {photo.inGallery ? (
            <Star size={10} strokeWidth={2} className="shrink-0 text-brass" aria-hidden="true" />
          ) : null}
          <span className="tabular">{photo.width}×{photo.height}</span>
          {usageCount ? <span> · {usageCount} used</span> : null}
        </span>
      </button>

      {/* Flags, top-right, out of the way of the select target. */}
      <span className="pointer-events-none absolute right-0 top-0 flex flex-col items-end gap-[2px] p-1">
        {!photo.alt.trim() ? (
          <span className="bg-stamp px-1 text-[0.5rem] font-semibold uppercase tracking-[0.1em] text-paper">
            No alt
          </span>
        ) : null}
        {!photo.isActive ? (
          <span className="bg-ink px-1 text-[0.5rem] font-semibold uppercase tracking-[0.1em] text-paper">
            Off
          </span>
        ) : null}
      </span>

      {/* 44px select target, overlaying the top-left corner of the frame. */}
      <button
        type="button"
        role="checkbox"
        aria-checked={selected}
        aria-label={`Select ${photo.slug}`}
        onClick={() => onToggle(photo.id)}
        className="absolute left-0 top-0 flex h-11 w-11 items-start justify-start p-[6px]"
      >
        <span
          className={cx(
            'flex h-[18px] w-[18px] items-center justify-center border transition-colors',
            selected
              ? 'border-stamp bg-stamp text-paper'
              : 'border-ink/40 bg-paper-bright/80 text-transparent'
          )}
        >
          <Check size={12} strokeWidth={2.6} />
        </span>
      </button>
    </li>
  );
}

/* ───────────────────────────────────────────────────────────── library ──── */

export default function MediaLibrary({ initialItems, usage }) {
  const notify = useToast();

  // The list is held locally so a save, an upload or a bulk action shows up at
  // once; the server action revalidates behind it and the two agree.
  const [items, setItems] = useState(initialItems);
  const [filter, setFilter] = useState({ ...EMPTY_FILTER });
  const [selected, setSelected] = useState(() => new Set());
  const [openId, setOpenId] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showOrder, setShowOrder] = useState(false);
  const [bulkCategory, setBulkCategory] = useState('');
  const [busy, startBulk] = useTransition();

  const visible = useMemo(() => filterMedia(items, filter), [items, filter]);
  const gallery = useMemo(
    () => items.filter((item) => item.inGallery).sort((a, b) => a.position - b.position),
    [items]
  );
  const open = openId ? items.find((item) => item.id === openId) : null;

  const toggle = (id) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const replace = (updated) =>
    setItems((current) => current.map((item) => (item.id === updated.id ? updated : item)));

  const bulk = (run, message) => {
    const ids = [...selected];
    startBulk(async () => {
      try {
        await run(ids);
        notify(message(ids.length));
        setSelected(new Set());
      } catch (error) {
        notify(error?.message || 'That did not work.', 'error');
      }
    });
  };

  /**
   * A bulk write changes `position` across the gallery, so the local copy is
   * patched rather than guessed at: the flags are known, and the exact order is
   * whatever the revalidated page sends back on the next render.
   */
  const patchLocal = (ids, patch) =>
    setItems((current) =>
      current.map((item) => (ids.includes(item.id) ? { ...item, ...patch } : item))
    );

  const anySelected = selected.size > 0;

  return (
    <>
      <Section className="flex flex-col gap-5">
        <div className="panel p-4 lg:p-5">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn--primary" onClick={() => setShowUpload(true)}>
              <ImageUp size={14} strokeWidth={1.8} />
              Add a photograph
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setShowOrder(true)}>
              <ListOrdered size={14} strokeWidth={1.8} />
              Gallery order ({gallery.length})
            </button>
          </div>

          <FilterBar
            filter={filter}
            onChange={setFilter}
            total={items.length}
            shown={visible.length}
          />
        </div>

        {visible.length ? (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2 sm:gap-3">
            {visible.map((photo) => (
              <Tile
                key={photo.id}
                photo={photo}
                selected={selected.has(photo.id)}
                usageCount={usage[photo.slug]?.length ?? 0}
                onToggle={toggle}
                onOpen={(item) => setOpenId(item.id)}
              />
            ))}
          </ul>
        ) : (
          <Empty
            title={items.length ? 'Nothing matches' : 'No photographs yet'}
            body={
              items.length
                ? 'No photograph matches those filters. Clear them, or search for something else.'
                : 'The library is empty. Add the first photograph and give it alt text while you are there.'
            }
          >
            {items.length ? (
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setFilter({ ...EMPTY_FILTER })}
              >
                Clear filters
              </button>
            ) : (
              <button type="button" className="btn btn--primary" onClick={() => setShowUpload(true)}>
                Add a photograph
              </button>
            )}
          </Empty>
        )}
      </Section>

      {/* ── bulk bar ─────────────────────────────────────────────────── */}
      {anySelected ? (
        <div className="sticky bottom-0 z-30 border-t border-ink/20 bg-paper-bright px-5 py-3 lg:px-8">
          <div className="flex flex-wrap items-center gap-2">
            <p className="t-label mr-2 tabular">{selected.size} selected</p>

            <button
              type="button"
              className="btn btn--ghost btn--sm"
              disabled={busy}
              onClick={() =>
                bulk(
                  async (ids) => {
                    await setGallery(ids, true);
                    patchLocal(ids, { inGallery: true });
                  },
                  (n) => `${n} added to the gallery.`
                )
              }
            >
              Add to gallery
            </button>

            <button
              type="button"
              className="btn btn--ghost btn--sm"
              disabled={busy}
              onClick={() =>
                bulk(
                  async (ids) => {
                    await setGallery(ids, false);
                    patchLocal(ids, { inGallery: false, position: 999 });
                  },
                  (n) => `${n} removed from the gallery.`
                )
              }
            >
              Remove from gallery
            </button>

            <span className="flex items-center gap-2">
              <select
                className="input h-[30px] w-auto py-0 text-[0.75rem]"
                value={bulkCategory}
                aria-label="Move the selected photographs to a folder"
                onChange={(event) => setBulkCategory(event.target.value)}
              >
                <option value="">Move to folder…</option>
                {CATEGORIES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                disabled={!bulkCategory || busy}
                onClick={() =>
                  bulk(
                    async (ids) => {
                      await setCategory(ids, bulkCategory);
                      patchLocal(ids, { category: bulkCategory });
                      setBulkCategory('');
                    },
                    (n) => `${n} moved.`
                  )
                }
              >
                Apply
              </button>
            </span>

            {busy ? (
              <Loader2 size={14} strokeWidth={1.8} className="animate-spin text-pencil" />
            ) : null}

            <button
              type="button"
              className="btn btn--ghost btn--sm ml-auto"
              onClick={() => setSelected(new Set())}
            >
              <X size={12} strokeWidth={2} />
              Clear
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => setSelected(new Set(visible.map((item) => item.id)))}
            >
              Select all shown
            </button>
          </div>
        </div>
      ) : null}

      {/* ── overlays ─────────────────────────────────────────────────── */}
      {open ? (
        <MediaDetail
          // Keyed on the row: opening a different photograph mounts a fresh
          // form rather than leaving the last one's alt text in the fields.
          key={open.id}
          photo={open}
          usage={usage[open.slug] ?? []}
          notify={notify}
          onClose={() => setOpenId(null)}
          onSaved={(updated) => replace(updated)}
          onDeleted={(id) => {
            setItems((current) => current.filter((item) => item.id !== id));
            setOpenId(null);
          }}
        />
      ) : null}

      <UploadDialog
        open={showUpload}
        onClose={() => setShowUpload(false)}
        notify={notify}
        onUploaded={(photo) => setItems((current) => [photo, ...current])}
      />

      {showOrder ? (
        <GalleryOrder
          onClose={() => setShowOrder(false)}
          items={gallery}
          notify={notify}
          onSaved={(order) =>
            setItems((current) => {
              const places = new Map(order.map((photo, index) => [photo.id, index]));
              return current.map((item) =>
                places.has(item.id) ? { ...item, position: places.get(item.id) } : item
              );
            })
          }
        />
      ) : null}

    </>
  );
}
