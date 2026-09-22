'use client';

import { useMemo, useState, useTransition } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AlertTriangle, ArrowUpRight, Loader2, Plus, Trash2, X } from 'lucide-react';
import { Area, Confirm, Field, Modal, Text, Toggle } from '@/components/ui';
import { cx } from '@/lib/utils';
import { deleteMedia, saveMedia } from '@/server/media';
import { CATEGORIES, GALLERY_TAGS, USAGE_KINDS, formatBytes, formatDate } from './constants';

/** What the fields look like before anyone has typed. */
function draftOf(photo) {
  return {
    alt: photo.alt,
    caption: photo.caption,
    credit: photo.credit,
    category: photo.category,
    tags: [...photo.tags],
    inGallery: photo.inGallery,
    isActive: photo.isActive,
  };
}

/* ─────────────────────────────────────────────────────────── where used ──── */

/**
 * "Where this photograph appears", read off the usage map the page loaded.
 *
 * This is also the text the delete confirmation quotes: every `media_slug` is
 * `on delete set null`, so deleting a photograph empties these rows without a
 * word of complaint. Naming them is the only warning there is.
 */
function UsageList({ usage }) {
  if (!usage.length) {
    return (
      <p className="t-serif text-[0.9375rem] text-pencil">
        Nowhere. This photograph is in the library but no slot, menu row or offer points at it.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-[2px]">
      {usage.map((use) => {
        const kind = USAGE_KINDS[use.kind] ?? { label: use.kind, href: () => '/media' };
        return (
          <li key={`${use.kind}-${use.ref}`}>
            <Link
              href={kind.href(use.ref)}
              className="group flex items-center gap-3 border border-transparent px-3 py-[10px] transition-colors hover:border-ink/15 hover:bg-paper-shade/40"
            >
              <span className="tag tag--muted shrink-0">{kind.label}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.8125rem]">{use.name}</span>
                <span className="t-meta block truncate">
                  {use.context ? `${use.context} · ` : ''}
                  {use.ref}
                </span>
              </span>
              <ArrowUpRight
                size={14}
                strokeWidth={1.8}
                aria-hidden="true"
                className="shrink-0 text-pencil opacity-0 transition-opacity group-hover:opacity-100"
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/* ─────────────────────────────────────────────────────────────── tags ──── */

function TagEditor({ tags, onChange }) {
  const [entry, setEntry] = useState('');

  const add = (raw) => {
    const tag = raw.trim().toLowerCase().replace(/\s+/g, '-');
    if (!tag || tags.includes(tag)) return;
    onChange([...tags, tag]);
    setEntry('');
  };

  return (
    <div>
      <span className="field__label">Tags</span>

      <div className="flex flex-wrap gap-2">
        {GALLERY_TAGS.map((tag) => {
          const on = tags.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              className="chip"
              aria-pressed={on}
              onClick={() => onChange(on ? tags.filter((t) => t !== tag) : [...tags, tag])}
            >
              {tag}
            </button>
          );
        })}
      </div>

      {tags.some((tag) => !GALLERY_TAGS.includes(tag)) ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {tags
            .filter((tag) => !GALLERY_TAGS.includes(tag))
            .map((tag) => (
              <span key={tag} className="chip" data-active="true">
                {tag}
                <button
                  type="button"
                  aria-label={`Remove tag ${tag}`}
                  onClick={() => onChange(tags.filter((t) => t !== tag))}
                  className="-mr-1 inline-flex h-6 w-6 items-center justify-center"
                >
                  <X size={12} strokeWidth={2.2} />
                </button>
              </span>
            ))}
        </div>
      ) : null}

      <div className="mt-2 flex gap-2">
        <input
          className="input"
          value={entry}
          placeholder="Add another tag"
          aria-label="Add another tag"
          onChange={(event) => setEntry(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              add(entry);
            }
          }}
        />
        <button type="button" className="btn btn--ghost" onClick={() => add(entry)}>
          <Plus size={13} strokeWidth={2} />
          Add
        </button>
      </div>

      <span className="field__hint">
        The public gallery filters on {GALLERY_TAGS.join(', ')}. Anything else is a note to
        yourselves.
      </span>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── detail ──── */

export default function MediaDetail({ photo, usage, onClose, onSaved, onDeleted, notify }) {
  const [draft, setDraft] = useState(() => draftOf(photo));
  const [saving, startSave] = useTransition();
  const [removing, setRemoving] = useState(false);

  const set = (patch) => setDraft((current) => ({ ...current, ...patch }));

  const dirty = useMemo(() => {
    const clean = draftOf(photo);
    return (
      clean.alt !== draft.alt ||
      clean.caption !== draft.caption ||
      clean.credit !== draft.credit ||
      clean.category !== draft.category ||
      clean.inGallery !== draft.inGallery ||
      clean.isActive !== draft.isActive ||
      clean.tags.join(',') !== draft.tags.join(',')
    );
  }, [draft, photo]);

  const save = () => {
    startSave(async () => {
      try {
        const updated = await saveMedia(photo.id, draft);
        onSaved(updated);
        notify('Photograph saved.');
      } catch (error) {
        notify(error?.message || 'That did not save.', 'error');
      }
    });
  };

  const remove = async () => {
    setRemoving(true);
    try {
      await deleteMedia(photo.id);
      onDeleted(photo.id);
      notify('Photograph deleted.');
    } catch (error) {
      notify(error?.message || 'That could not be deleted.', 'error');
    } finally {
      setRemoving(false);
    }
  };

  const consequence = usage.length
    ? `${usage.length} ${usage.length === 1 ? 'place points' : 'places point'} at this photograph — ${usage
        .slice(0, 4)
        .map((use) => use.name)
        .join(', ')}${usage.length > 4 ? `, and ${usage.length - 4} more` : ''}. Deleting it empties ${
        usage.length === 1 ? 'that one' : 'them'
      } without asking again, and the site falls back to a default image there. The photograph itself is archived, not erased.`
    : 'Nothing points at this photograph, so nothing on the site will change. The photograph is archived, not erased.';

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={photo.slug}
      description={`${photo.width}×${photo.height} · ${photo.orientation} · ${formatBytes(photo.bytes)} · ${photo.contentType}`}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        {/* ── preview ────────────────────────────────────────────────── */}
        <div className="min-w-0">
          <div className="flex max-h-[42svh] items-center justify-center border border-ink/15 bg-paper-shade p-2 lg:max-h-none">
            <Image
              src={photo.url ?? photo.path}
              alt={photo.alt || ''}
              width={photo.width}
              height={photo.height}
              sizes="(max-width: 1024px) 90vw, 320px"
              className="h-auto max-h-[40svh] w-auto max-w-full object-contain lg:max-h-[56svh]"
            />
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
            {[
              ['Path', photo.path],
              ['Added', formatDate(photo.createdAt)],
              ['Transparency', photo.hasAlpha ? 'Yes' : 'No'],
              ['Gallery place', photo.inGallery ? `#${photo.position + 1}` : '—'],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="t-label text-pencil">{label}</dt>
                <dd className="mt-1 truncate text-[0.75rem]" title={String(value)}>
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* ── fields ─────────────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-col gap-5">
          <div>
            <Area
              label="Alt text"
              required
              rows={3}
              value={draft.alt}
              onChange={(event) => set({ alt: event.target.value })}
              placeholder="Describe what somebody who cannot see it would need to know."
            />
            <p
              className={cx(
                'mt-2 flex items-center gap-2 text-[0.75rem]',
                draft.alt.trim() ? 'text-pencil' : 'text-stamp-deep'
              )}
            >
              {draft.alt.trim() ? null : <AlertTriangle size={13} strokeWidth={1.9} />}
              <span className="tabular">{draft.alt.trim().length}</span>
              <span>
                {draft.alt.trim()
                  ? 'characters — this is read aloud by screen readers and printed under the photograph in the gallery.'
                  : 'characters. Empty alt text means this photograph is invisible to anyone using a screen reader.'}
              </span>
            </p>
          </div>

          <Area
            label="Caption"
            rows={2}
            value={draft.caption}
            hint="Optional. Shown under the photograph where the design calls for one."
            onChange={(event) => set({ caption: event.target.value })}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Text
              label="Credit"
              value={draft.credit}
              placeholder="Photographer, if any"
              onChange={(event) => set({ credit: event.target.value })}
            />

            <Field label="Folder" hint="A label only — the address of the image never changes.">
              <select
                className="input"
                value={draft.category}
                onChange={(event) => set({ category: event.target.value })}
              >
                {CATEGORIES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <TagEditor tags={draft.tags} onChange={(tags) => set({ tags })} />

          <div className="flex flex-col gap-4 border-t border-ink/15 pt-5">
            <Toggle
              label="Show in the public gallery"
              hint="Adds it to the end of the gallery; reorder from the Photographs screen."
              checked={draft.inGallery}
              onChange={(event) => set({ inGallery: event.target.checked })}
            />
            <Toggle
              label="Active"
              hint="Turning this off stops the image being served anywhere on the site."
              checked={draft.isActive}
              onChange={(event) => set({ isActive: event.target.checked })}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-ink/15 pt-5">
            <button type="button" className="btn btn--primary" disabled={!dirty || saving} onClick={save}>
              {saving ? <Loader2 size={13} strokeWidth={1.8} className="animate-spin" /> : null}
              Save changes
            </button>
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Close
            </button>

            <div className="ml-auto">
              <Confirm
                title="Delete this photograph?"
                body={consequence}
                confirmLabel="Archive it"
                onConfirm={remove}
              >
                <button type="button" className="btn btn--danger" disabled={removing}>
                  <Trash2 size={13} strokeWidth={1.8} />
                  Delete
                </button>
              </Confirm>
            </div>
          </div>
        </div>
      </div>

      {/* ── where used ───────────────────────────────────────────────── */}
      <section className="mt-8 border-t border-ink/15 pt-6">
        <h3 className="t-h2">Where this photograph appears</h3>
        <p className="t-meta mb-3 mt-1">
          Every slot, menu row and offer in the database that points at{' '}
          <span className="tabular">{photo.slug}</span>.
        </p>
        <UsageList usage={usage} />
      </section>
    </Modal>
  );
}
