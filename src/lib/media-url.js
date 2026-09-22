import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * A photograph's URL, signed.
 *
 * The admin's media route is behind the session, which is right — and which
 * `next/image` cannot satisfy. The optimiser is a server fetching the upstream
 * URL on its own account: it carries no session cookie, so a gated route hands
 * it a 401 and the browser gets back "the requested resource isn't a valid
 * image" for every frame on the screen. That is not a bug in the gate; it is
 * the wrong kind of proof. A cookie proves who is asking. An image fetch needs
 * proof that lives in the URL.
 *
 * So each `src` carries a short signature over the path and an expiry. The
 * route takes either: a signature, or a session for a person who pastes the
 * path into the address bar. The signature is minted by a server component at
 * render time, only for someone who already has a session, and it is good for
 * a week — the same week the session itself lasts.
 */

const SECRET =
  process.env.ADMIN_MEDIA_SECRET ||
  process.env.ADMIN_JWT_SECRET ||
  process.env.ADMIN_SESSION_SECRET ||
  'binileaf-dev-session-secret-change-me';

const TTL_SECONDS = 60 * 60 * 24 * 7;

const sign = (path, expiry) =>
  createHmac('sha256', SECRET).update(`${path}:${expiry}`).digest('base64url');

/** `/media/drinks/x.webp` → `/media/drinks/x.webp?k=<expiry>.<signature>` */
export function signMediaPath(path) {
  if (!path) return path;

  const expiry = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  return `${path}?k=${expiry}.${sign(path, expiry)}`;
}

/** True when `key` is this server's signature for `path` and has not expired. */
export function verifyMediaKey(path, key) {
  if (typeof key !== 'string') return false;

  const [expiry, signature] = key.split('.');
  if (!expiry || !signature) return false;
  if (!/^\d+$/.test(expiry) || Number(expiry) < Math.floor(Date.now() / 1000)) return false;

  const expected = Buffer.from(sign(path, expiry));
  const given = Buffer.from(signature);

  return expected.length === given.length && timingSafeEqual(expected, given);
}
