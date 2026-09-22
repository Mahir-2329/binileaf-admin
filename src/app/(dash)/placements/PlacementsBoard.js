'use client';

import { useMemo, useState, useTransition } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AlertTriangle, ImageOff, Loader2, Replace, X } from 'lucide-react';
import { Empty, Section, useToast } from '@/components/ui';
import { setPlacement } from '@/server/media';
import { aspectRatio } from '../media/constants';
import MediaPicker from '../media/MediaPicker';

/**
 * Does the photograph fit the shape the slot wants?
 *
 * A portrait shot dropped into a 16/9 band is cropped to a strip of its middle,
 * which is the single most common way a slot goes wrong. The frame below draws
 * the real aspect with the real crop, so it is visible; this only decides
 * whether to say it out loud as well.
 */
function fitNote(slot) {
  if (!slot.photo) return null;
  const want = aspectRatio(slot.aspect);
  const have = slot.photo.width / slot.photo.height;
  const drift = Math.abs(Math.log(have / want));
  if (drift < 0.22) return null;
  return have > want
    ? 'Wider than the slot — the top and bottom are cropped away.'
    : 'Taller than the slot — the sides are cropped away.';
}

/* ─────────────────────────────────────────────────────────────── slot ──── */

function Slot({ slot, onChange, onClear, pending }) {
  const note = fitNote(slot);

  return (
    <li id={`slot-${slot.key}`} className="panel flex flex-col scroll-mt-24">
      <div
        className="relative w-full overflow-hidden border-b border-ink/15 bg-paper-shade"
        style={{ aspectRatio: slot.aspect.replace('/', ' / ') }}
      >
        {slot.photo ? (
          <Image
            src={slot.photo.url ?? slot.photo.path}
            alt={slot.photo.alt || ''}
            width={slot.photo.width}
            height={slot.photo.height}
            sizes="(max-width: 640px) 92vw, (max-width: 1024px) 45vw, 320px"
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
            <ImageOff size={20} strokeWidth={1.6} aria-hidden="true" className="text-stamp" />
            <span className="t-label text-stamp">Empty</span>
            <span className="t-meta max-w-[28ch]">
              The site falls back to a stock photograph here. Put the right one in.
            </span>
          </span>
        )}

        <span className="absolute left-0 top-0 bg-ink px-2 py-1 text-[0.5625rem] font-semibold uppercase tracking-[0.12em] text-paper">
          {slot.aspect}
        </span>

        {pending ? (
          <span className="absolute inset-0 flex items-center justify-center bg-paper/70">
            <Loader2 size={18} strokeWidth={1.8} className="animate-spin" />
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="t-h2 text-[1rem] leading-snug">{slot.label}</h3>
        <p className="t-meta break-all">{slot.key}</p>

        {slot.hint ? (
          <p className="t-serif text-[0.875rem] leading-snug text-pencil">{slot.hint}</p>
        ) : null}

        {slot.photo ? (
          <p className="t-meta break-all">
            <Link href="/media" className="underline decoration-ink/25 underline-offset-2">
              {slot.slug}
            </Link>{' '}
            · <span className="tabular">{slot.photo.width}×{slot.photo.height}</span>
          </p>
        ) : null}

        {slot.photo && !slot.photo.alt ? (
          <p className="flex items-start gap-2 text-[0.75rem] text-stamp-deep">
            <AlertTriangle size={13} strokeWidth={1.9} className="mt-[2px] shrink-0" />
            This photograph has no alt text.
          </p>
        ) : null}

        {slot.photo && !slot.photo.isActive ? (
          <p className="flex items-start gap-2 text-[0.75rem] text-stamp-deep">
            <AlertTriangle size={13} strokeWidth={1.9} className="mt-[2px] shrink-0" />
            This photograph is switched off, so the slot renders empty on the site.
          </p>
        ) : null}

        {note ? (
          <p className="flex items-start gap-2 text-[0.75rem] text-brass">
            <AlertTriangle size={13} strokeWidth={1.9} className="mt-[2px] shrink-0" />
            {note}
          </p>
        ) : null}

        <div className="mt-auto flex flex-wrap gap-2 pt-3">
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => onChange(slot)}>
            <Replace size={12} strokeWidth={1.9} />
            {slot.photo ? 'Change' : 'Choose'}
          </button>
          {slot.photo ? (
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => onClear(slot)}>
              <X size={12} strokeWidth={2} />
              Empty it
            </button>
          ) : null}
        </div>
      </div>
    </li>
  );
}

/* ──────────────────────────────────────────────────────────────── board ──── */

export default function PlacementsBoard({ slots, library }) {
  const notify = useToast();

  // Local copy so a pick lands in the frame the moment it is chosen; the server
  // action revalidates behind it.
  const [rows, setRows] = useState(slots);
  const [picking, setPicking] = useState(null);
  const [pendingKey, setPendingKey] = useState(null);
  const [, startWrite] = useTransition();

  // `position` is ordered across the whole registry, so taking the pages in the
  // order they first appear gives Home, Our Story, Franchise, Visit for free.
  const pages = useMemo(() => {
    const grouped = new Map();
    for (const slot of rows) {
      if (!grouped.has(slot.page)) grouped.set(slot.page, []);
      grouped.get(slot.page).push(slot);
    }
    return [...grouped.entries()];
  }, [rows]);

  const write = (slot, photo) => {
    const slug = photo?.slug ?? null;
    const before = rows;

    setPendingKey(slot.key);
    setRows((current) =>
      current.map((row) =>
        row.key === slot.key
          ? {
              ...row,
              slug,
              photo: photo
                ? {
                    path: photo.path,
                    url: photo.url,
                    width: photo.width,
                    height: photo.height,
                    alt: photo.alt,
                    orientation: photo.orientation,
                    isActive: photo.isActive,
                  }
                : null,
            }
          : row
      )
    );

    startWrite(async () => {
      try {
        await setPlacement(slot.key, slug);
        notify(slug ? `${slot.label} now shows ${slug}.` : `${slot.label} is empty.`);
      } catch (error) {
        setRows(before); // Put the old photograph back rather than lie about it.
        notify(error?.message || 'That slot did not change.', 'error');
      } finally {
        setPendingKey(null);
      }
    });
  };

  const empty = rows.filter((slot) => !slot.photo).length;

  if (!rows.length) {
    return (
      <Section>
        <Empty
          title="No slots are registered"
          body="The site's photograph slots are seeded into media_placements. Run the seed and they will appear here."
        />
      </Section>
    );
  }

  return (
    <>
      {empty ? (
        <Section className="pb-0">
          <p className="flex items-start gap-2 border border-stamp/40 bg-stamp/5 p-3 text-[0.8125rem] text-stamp-deep">
            <AlertTriangle size={14} strokeWidth={1.9} className="mt-[2px] shrink-0" />
            {empty} {empty === 1 ? 'slot is' : 'slots are'} empty. The site will not break — it
            falls back to a default photograph — but nobody chose what is there.
          </p>
        </Section>
      ) : null}

      {pages.map(([page, list]) => (
        <Section key={page} className="pt-6">
          <div className="mb-4 flex items-baseline gap-3 border-b border-ink/15 pb-2">
            <h2 className="t-h2">{page}</h2>
            <span className="t-meta tabular">{list.length} slots</span>
          </div>

          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {list.map((slot) => (
              <Slot
                key={slot.key}
                slot={slot}
                pending={pendingKey === slot.key}
                onChange={setPicking}
                onClear={(row) => write(row, null)}
              />
            ))}
          </ul>
        </Section>
      ))}

      <MediaPicker
        open={Boolean(picking)}
        onClose={() => setPicking(null)}
        items={library}
        current={picking?.slug ?? null}
        title={picking ? `${picking.page} · ${picking.label}` : ''}
        description={
          picking
            ? `${picking.hint ? `${picking.hint} ` : ''}This slot is drawn at ${picking.aspect}.`
            : ''
        }
        onPick={(photo) => {
          const slot = picking;
          setPicking(null);
          if (slot) write(slot, photo);
        }}
      />
    </>
  );
}
