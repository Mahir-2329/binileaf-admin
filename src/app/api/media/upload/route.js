import { NextResponse } from 'next/server';
import { sameOrigin } from '@/lib/http';
import { getSession } from '@/server/session';
import { insertUpload } from '@/server/media';

/**
 * Upload endpoint for the photograph library.
 *
 * Why this is a route handler and not a Server Action, which is what the rest
 * of these two screens uses: a Server Action's request body is capped at 1 MB,
 * and raising it means `experimental.serverActions.bodySizeLimit` in
 * `next.config.mjs` — a file this task does not own and that two other agents
 * are editing around. A route handler has no such cap, so the 6 MB the café
 * needs for a phone photograph goes through here instead. Everything the
 * handler then does (session, audit, revalidate) is the same code the actions
 * use, in `@/server/media`.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Six megabytes: comfortably a phone photograph, nowhere near a RAW file. */
const MAX_BYTES = 6 * 1024 * 1024;

/**
 * Only formats a browser renders without help. There is no `sharp` in this app,
 * so whatever arrives is what gets served — no transcode, no resize.
 */
const EXTENSIONS = {
  'image/webp': 'webp',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/avif': 'avif',
};

const fail = (message, status = 400) => NextResponse.json({ error: message }, { status });

export async function POST(request) {
  if (!sameOrigin(request)) return fail('Cross-site uploads are refused.', 403);

  const session = await getSession();
  if (!session) return fail('Your session has expired. Sign in again.', 401);

  let form;
  try {
    form = await request.formData();
  } catch {
    return fail('That upload did not arrive in one piece. Try again.');
  }

  const file = form.get('file');
  if (!file || typeof file === 'string' || typeof file.arrayBuffer !== 'function') {
    return fail('Choose a photograph first.');
  }

  const extension = EXTENSIONS[file.type];
  if (!extension) {
    return fail('That file is not a WebP, PNG, JPEG or AVIF.');
  }
  if (file.size > MAX_BYTES) {
    return fail(`That file is ${(file.size / 1048576).toFixed(1)} MB. The limit is 6 MB.`);
  }
  if (!file.size) {
    return fail('That file is empty.');
  }

  const alt = String(form.get('alt') ?? '').trim();
  if (!alt) {
    // The library has no way to add alt text that is easy to skip, so this is
    // the one place it can be missed — and a photograph without it is a bug.
    return fail('Alt text is required. Describe what is in the photograph.');
  }

  // The browser measured the image before sending it; the server cannot decode
  // one without an image library, so guessing here would write a wrong
  // width/height into every `next/image` on the site.
  const width = Number.parseInt(form.get('width'), 10);
  const height = Number.parseInt(form.get('height'), 10);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    return fail('That image could not be measured in the browser. Try a different file.');
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  // Re-check against the bytes actually received, not the declared size.
  if (buffer.length > MAX_BYTES) return fail('That file is over the 6 MB limit.');

  try {
    const row = await insertUpload({
      name: String(form.get('name') ?? '') || file.name,
      category: String(form.get('category') ?? 'misc'),
      alt,
      caption: String(form.get('caption') ?? ''),
      credit: String(form.get('credit') ?? ''),
      tags: String(form.get('tags') ?? ''),
      inGallery: form.get('inGallery') === 'true',
      hasAlpha: form.get('hasAlpha') === 'true',
      width,
      height,
      extension,
      contentType: file.type,
      buffer,
    });

    return NextResponse.json({ photo: row });
  } catch (error) {
    console.error('[binileaf-admin] upload failed:', error);
    return fail(error?.message || 'The upload could not be saved.', 500);
  }
}
