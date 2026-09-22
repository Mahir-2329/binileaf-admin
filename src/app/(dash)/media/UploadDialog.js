'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ImageUp, Loader2 } from 'lucide-react';
import { Area, Field, Modal, Text, Toggle } from '@/components/ui';
import { cx } from '@/lib/utils';
import { CATEGORIES, GALLERY_TAGS, formatBytes } from './constants';

/** Kept in step with the route handler, which re-checks both server-side. */
const MAX_BYTES = 6 * 1024 * 1024;
const ACCEPTED = ['image/webp', 'image/png', 'image/jpeg', 'image/avif'];

const kebab = (value) =>
  value
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

/**
 * Measure the file in the browser.
 *
 * There is no `sharp` in this app, so the server cannot decode an image to find
 * out how big it is — and a wrong width/height is a layout shift on every page
 * that renders the photograph. The browser already has a decoder, so it does
 * the measuring and sends the numbers along with the bytes.
 *
 * The same decode answers whether the image carries transparency: sample it
 * down to 64px and look for a pixel that is not fully opaque. JPEG never has
 * an alpha channel, so it skips the sampling entirely.
 */
async function measure(file) {
  const bitmap = await createImageBitmap(file);
  const width = bitmap.width;
  const height = bitmap.height;

  let hasAlpha = false;
  if (file.type !== 'image/jpeg') {
    const scale = Math.min(1, 64 / Math.max(width, height));
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(bitmap, 0, 0, w, h);
    const { data } = context.getImageData(0, 0, w, h);
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 250) {
        hasAlpha = true;
        break;
      }
    }
  }

  bitmap.close?.();
  return { width, height, hasAlpha };
}

export default function UploadDialog({ open, onClose, onUploaded, notify }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [meta, setMeta] = useState(null);
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('drinks');
  const [alt, setAlt] = useState('');
  const [caption, setCaption] = useState('');
  const [credit, setCredit] = useState('');
  const [tags, setTags] = useState([]);
  const [inGallery, setInGallery] = useState(false);

  /** Drop the file but keep what has been typed — "wrong photograph" is not "start again". */
  const clearFile = () => {
    setFile(null);
    setMeta(null);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return '';
    });
    setError('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const reset = () => {
    setFile(null);
    setMeta(null);
    setPreview('');
    setError('');
    setName('');
    setAlt('');
    setCaption('');
    setCredit('');
    setTags([]);
    setInGallery(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  // The object URL is a handle on the file; letting it leak holds the whole
  // image in memory for as long as the tab is open.
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  const choose = async (chosen) => {
    setError('');
    if (!chosen) return;

    if (!ACCEPTED.includes(chosen.type)) {
      setError('That is not a WebP, PNG, JPEG or AVIF.');
      return;
    }
    if (chosen.size > MAX_BYTES) {
      setError(`That file is ${formatBytes(chosen.size)}. The limit is 6 MB — shrink it first.`);
      return;
    }

    try {
      const measured = await measure(chosen);
      setFile(chosen);
      setMeta(measured);
      setPreview((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(chosen);
      });
      setName((current) => current || kebab(chosen.name));
    } catch {
      setError('That image could not be opened. It may be damaged.');
    }
  };

  const slug = `${category}/${kebab(name) || 'photograph'}`;
  const extension = file ? { 'image/jpeg': 'jpg' }[file.type] ?? file.type.split('/')[1] : '';
  const ready = Boolean(file && meta && alt.trim() && !busy);

  const submit = async (event) => {
    event.preventDefault();
    if (!ready) return;

    setBusy(true);
    setError('');

    const body = new FormData();
    body.set('file', file);
    body.set('name', kebab(name));
    body.set('category', category);
    body.set('alt', alt.trim());
    body.set('caption', caption.trim());
    body.set('credit', credit.trim());
    body.set('tags', tags.join(','));
    body.set('inGallery', String(inGallery));
    body.set('hasAlpha', String(meta.hasAlpha));
    body.set('width', String(meta.width));
    body.set('height', String(meta.height));

    try {
      const response = await fetch('/api/media/upload', { method: 'POST', body });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'The upload failed.');

      onUploaded(payload.photo);
      notify(`${payload.photo.slug} added to the library.`);
      reset();
      onClose();
    } catch (problem) {
      setError(problem.message);
      notify(problem.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!busy) {
          reset();
          onClose();
        }
      }}
      wide
      title="Add a photograph"
      description="WebP, PNG, JPEG or AVIF, up to 6 MB. It is stored exactly as you send it — nothing here resizes."
    >
      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
        {/* ── the file ───────────────────────────────────────────────── */}
        <div className="min-w-0">
          <label
            className={cx(
              'flex min-h-[176px] cursor-pointer flex-col items-center justify-center gap-3 border border-dashed border-ink/35 bg-paper-shade/40 p-4 text-center transition-colors hover:bg-paper-shade',
              preview && 'border-solid bg-paper-shade p-2'
            )}
          >
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED.join(',')}
              className="sr-only"
              onChange={(event) => choose(event.target.files?.[0])}
            />

            {preview ? (
              // A plain <img>: this is a blob: URL that exists only in this tab,
              // so there is nothing for the image optimiser to fetch.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="max-h-[38svh] w-auto object-contain" />
            ) : (
              <>
                <ImageUp size={24} strokeWidth={1.5} aria-hidden="true" className="text-pencil" />
                <span className="t-label">Choose a photograph</span>
                <span className="t-meta max-w-[30ch]">
                  WebP, PNG, JPEG or AVIF. 6 MB at most — a photograph straight off a phone is
                  usually under that; a screenshot of a RAW export is not.
                </span>
              </>
            )}
          </label>

          {file && meta ? (
            <p className="t-meta mt-3">
              <span className="tabular">
                {meta.width}×{meta.height}
              </span>{' '}
              · {formatBytes(file.size)} · {file.type.replace('image/', '')}
              {meta.hasAlpha ? ' · transparent' : ''}
            </p>
          ) : null}

          {file ? (
            <button
              type="button"
              className="btn btn--ghost btn--sm mt-3"
              onClick={clearFile}
            >
              Choose a different file
            </button>
          ) : null}
        </div>

        {/* ── the fields ─────────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Folder">
              <select
                className="input"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                {CATEGORIES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </Field>

            <Text
              label="Name"
              value={name}
              placeholder="matcha-tall"
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <p className="t-meta break-all border-l-2 border-brass pl-3">
            Address on the site: <span className="tabular">/media/{slug}{extension ? `.${extension}` : ''}</span>
            <br />
            If that name is taken a number is added, so nothing is ever overwritten.
          </p>

          <div>
            <Area
              label="Alt text"
              required
              rows={3}
              value={alt}
              placeholder="Describe what somebody who cannot see it would need to know."
              onChange={(event) => setAlt(event.target.value)}
            />
            <p
              className={cx(
                'mt-2 flex items-center gap-2 text-[0.75rem]',
                alt.trim() ? 'text-pencil' : 'text-stamp-deep'
              )}
            >
              {alt.trim() ? null : <AlertTriangle size={13} strokeWidth={1.9} />}
              {alt.trim()
                ? `${alt.trim().length} characters.`
                : 'Required. A photograph with no alt text is invisible to a screen reader.'}
            </p>
          </div>

          <Area
            label="Caption"
            rows={2}
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
          />

          <Text
            label="Credit"
            value={credit}
            placeholder="Photographer, if any"
            onChange={(event) => setCredit(event.target.value)}
          />

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
                    onClick={() =>
                      setTags(on ? tags.filter((value) => value !== tag) : [...tags, tag])
                    }
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          <Toggle
            label="Show in the public gallery"
            hint="Goes to the end of the gallery; reorder afterwards."
            checked={inGallery}
            onChange={(event) => setInGallery(event.target.checked)}
          />

          {error ? (
            <p className="flex items-start gap-2 border border-stamp/40 bg-stamp/5 p-3 text-[0.8125rem] text-stamp-deep">
              <AlertTriangle size={14} strokeWidth={1.9} className="mt-[2px] shrink-0" />
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2 border-t border-ink/15 pt-5">
            <button type="submit" className="btn btn--primary" disabled={!ready}>
              {busy ? <Loader2 size={13} strokeWidth={1.8} className="animate-spin" /> : null}
              Add to the library
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              disabled={busy}
              onClick={() => {
                reset();
                onClose();
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
