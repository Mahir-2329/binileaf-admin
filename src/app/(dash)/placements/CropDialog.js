'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { Crop, Loader2, RotateCcw, ZoomIn } from 'lucide-react';
import { Modal, useToast } from '@/components/ui';
import { DEFAULT_CROP, frameStyle } from '@/lib/frame';
import { setPlacementCrop } from '@/server/media';

/**
 * Frame a photograph inside a slot.
 *
 * Nothing is cut. The café drags the picture until the right part of it is in
 * the frame and pushes in if it wants closer, and what is saved is a focal
 * point and a zoom — so the bytes stay one copy, the same photograph can sit
 * differently in two slots, and a change takes effect on the site the moment
 * it is saved.
 *
 * The frame below is not an approximation of the page: it is the page's own
 * `frameStyle` applied to the page's own aspect ratio. If the two ever drift
 * apart, this file is wrong, not the site.
 */

const ZOOM = { min: 1, max: 3, step: 0.02 };

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export default function CropDialog({ slot, open, onClose, onSaved }) {
  const toast = useToast();
  const frame = useRef(null);
  const drag = useRef(null);

  // The board mounts this per slot (`key={slot.key}`), so the slot's saved
  // framing is the initial state and there is nothing to synchronise.
  const [crop, setCrop] = useState(slot.crop ?? DEFAULT_CROP);
  const [saving, setSaving] = useState(false);

  if (!slot.photo) return null;

  /* ── dragging ──────────────────────────────────────────────────────── */

  /*
    Dragging moves the photograph, so the focal point moves the other way:
    pulling the picture right brings more of its left edge into view. The
    distance is read against the frame, so a drag across the box is a move
    across the whole photograph however big the box is on screen.
  */
  const onPointerDown = (event) => {
    const box = frame.current?.getBoundingClientRect();
    if (!box) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, box, from: crop };
  };

  const onPointerMove = (event) => {
    if (!drag.current) return;
    event.preventDefault();

    const { x, y, box, from } = drag.current;
    setCrop({
      ...from,
      x: clamp(from.x - ((event.clientX - x) / box.width) * 100, 0, 100),
      y: clamp(from.y - ((event.clientY - y) / box.height) * 100, 0, 100),
    });
  };

  const onPointerUp = (event) => {
    drag.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  /** Arrow keys for anyone not using a pointer. */
  const onKeyDown = (event) => {
    const step = event.shiftKey ? 10 : 2;
    const moves = {
      ArrowLeft: { x: -step },
      ArrowRight: { x: step },
      ArrowUp: { y: -step },
      ArrowDown: { y: step },
    };
    const move = moves[event.key];
    if (!move) return;

    event.preventDefault();
    setCrop((current) => ({
      ...current,
      x: clamp(current.x + (move.x ?? 0), 0, 100),
      y: clamp(current.y + (move.y ?? 0), 0, 100),
    }));
  };

  /* ── saving ────────────────────────────────────────────────────────── */

  const save = async () => {
    setSaving(true);
    try {
      const saved = await setPlacementCrop(slot.key, crop);
      onSaved(slot.key, saved);
      toast('Framing saved. The site is already showing it.');
      onClose();
    } catch (error) {
      toast(error.message || 'That could not be saved.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const untouched =
    crop.x === DEFAULT_CROP.x && crop.y === DEFAULT_CROP.y && crop.zoom === DEFAULT_CROP.zoom;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Frame — ${slot.label}`}
      description={`${slot.aspect} · the shape this slot is printed at on the site`}
    >
      <div className="flex flex-col gap-5">
        <div
          ref={frame}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
          role="application"
          aria-label={`Drag to frame ${slot.photo.alt || slot.label}`}
          tabIndex={0}
          className="relative w-full cursor-grab touch-none select-none overflow-hidden border border-ink/25 bg-paper-shade focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stamp active:cursor-grabbing"
          style={{ aspectRatio: slot.aspect.replace('/', ' / ') }}
        >
          <Image
            src={slot.photo.url ?? slot.photo.path}
            alt=""
            fill
            sizes="(max-width: 640px) 92vw, 520px"
            className="pointer-events-none object-cover"
            style={frameStyle({ crop })}
          />

          {/* Thirds, drawn over the picture — the one guide worth having. */}
          <span aria-hidden="true" className="pointer-events-none absolute inset-0">
            <span className="absolute inset-y-0 left-1/3 w-px bg-paper/30" />
            <span className="absolute inset-y-0 left-2/3 w-px bg-paper/30" />
            <span className="absolute inset-x-0 top-1/3 h-px bg-paper/30" />
            <span className="absolute inset-x-0 top-2/3 h-px bg-paper/30" />
          </span>
        </div>

        <p className="t-meta">
          Drag the photograph to choose what stays in the frame. Arrow keys nudge it.
        </p>

        <label className="flex items-center gap-3">
          <ZoomIn size={15} strokeWidth={1.7} className="shrink-0 text-pencil" aria-hidden="true" />
          <span className="field__label mb-0 shrink-0">Zoom</span>
          <input
            type="range"
            min={ZOOM.min}
            max={ZOOM.max}
            step={ZOOM.step}
            value={crop.zoom}
            onChange={(event) =>
              setCrop((current) => ({ ...current, zoom: Number(event.target.value) }))
            }
            className="h-11 flex-1 accent-[var(--color-ink)]"
          />
          <span className="tabular t-meta w-[3.5rem] shrink-0 text-right">
            {crop.zoom.toFixed(2)}×
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-2 border-t border-ink/15 pt-5">
          <button type="button" className="btn btn--primary" onClick={save} disabled={saving}>
            {saving ? (
              <Loader2 size={13} strokeWidth={1.8} className="animate-spin" />
            ) : (
              <Crop size={13} strokeWidth={1.8} />
            )}
            Save framing
          </button>

          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => setCrop(DEFAULT_CROP)}
            disabled={untouched}
          >
            <RotateCcw size={13} strokeWidth={1.8} />
            Middle again
          </button>

          <button type="button" className="btn btn--ghost ml-auto" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
