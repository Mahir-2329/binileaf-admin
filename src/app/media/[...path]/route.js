import { getSql, hasDatabase } from '@/lib/db';
import { verifyMediaKey } from '@/lib/media-url';
import { getSession } from '@/server/session';

/**
 * Serves every image from Postgres — to signed-in staff only.
 *
 * The URLs are unchanged — `/media/drinks/tote-mocktail.webp` is still the
 * `src` on the page — but nothing sits in `public/`. The bytes come out of the
 * `media` table, which is what lets the café replace a photograph from an
 * admin screen without a deploy.
 *
 * This path is exempt from the middleware, because an <img> that is answered
 * with a redirect to an HTML login page is a broken image and nothing more.
 * The check happens here instead, and it takes either proof: the `?k=` the
 * page signed for this exact path, which is what `next/image` can carry, or a
 * session, for a person who pastes the path into the address bar. Neither one
 * and the answer is 401, not a photograph. The site is where images are
 * public, and it serves them from its own tokenised route.
 *
 * Responses are cached `private` and carry the row's checksum as an ETag, so a
 * replaced image invalidates itself, an unchanged one costs a 304, and no
 * shared cache between here and the browser keeps a copy.
 */

export const dynamic = 'force-dynamic';

/** The Neon HTTP driver returns bytea as a `\x…` hex string. */
function toBuffer(value) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === 'string' && value.startsWith('\\x')) {
    return Buffer.from(value.slice(2), 'hex');
  }
  return null;
}

const NO_STORE = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };

export async function GET(request, { params }) {
  const { path: segments } = await params;
  const publicPath = '/media/' + segments.map(decodeURIComponent).join('/');

  const signed = verifyMediaKey(publicPath, request.nextUrl.searchParams.get('k'));
  if (!signed && !(await getSession())) {
    return new Response('Sign in first.', { status: 401, headers: NO_STORE });
  }

  if (!hasDatabase) {
    return new Response('Media store is not configured.', { status: 503 });
  }

  const sql = getSql();
  let rows;

  try {
    rows = await sql`
      select data, content_type, bytes, checksum
      from media
      where path = ${publicPath} and is_active and deleted_at is null
      limit 1
    `;
  } catch (error) {
    console.error('[binileaf] media lookup failed:', error.message);
    return new Response('Media is temporarily unavailable.', { status: 503 });
  }

  const row = rows?.[0];
  const body = row && toBuffer(row.data);

  if (!body) {
    return new Response('Not found', { status: 404 });
  }

  const etag = `"${row.checksum ?? row.bytes}"`;
  if (request.headers.get('if-none-match') === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag } });
  }

  return new Response(body, {
    headers: {
      'Content-Type': row.content_type ?? 'application/octet-stream',
      'Content-Length': String(body.length),
      'Cache-Control': 'private, max-age=31536000, immutable',
      'X-Robots-Tag': 'noindex, nofollow',
      ETag: etag,
    },
  });
}
