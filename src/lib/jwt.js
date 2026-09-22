import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * HS256 JSON Web Tokens, written out rather than pulled in.
 *
 * The whole surface is one issuer, one audience and one algorithm, so a library
 * here would be more code to keep patched than the sixty lines it replaces.
 * What matters is that the rules are enforced rather than assumed:
 *
 *   - `alg` is read from the header and must be exactly HS256. A token that
 *     says `none`, or names a different algorithm, is rejected before the
 *     signature is even computed — that confusion is how JWT goes wrong.
 *   - the signature is compared in constant time.
 *   - `exp` and `nbf` are checked, with a small clock skew allowance.
 *   - anything malformed returns null. There is no "partly valid" token.
 */

const ALG = 'HS256';
const SKEW_SECONDS = 30;

const SECRET =
  process.env.ADMIN_JWT_SECRET ||
  process.env.ADMIN_SESSION_SECRET ||
  'binileaf-dev-session-secret-change-me';

const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const decode = (part) => JSON.parse(Buffer.from(part, 'base64url').toString());

const signature = (data) => createHmac('sha256', SECRET).update(data).digest('base64url');

/** Seconds since the epoch — JWT counts in seconds, not milliseconds. */
const now = () => Math.floor(Date.now() / 1000);

export function signJwt(claims, { expiresInSeconds }) {
  const issuedAt = now();

  const header = encode({ alg: ALG, typ: 'JWT' });
  const payload = encode({
    ...claims,
    iat: issuedAt,
    nbf: issuedAt,
    exp: issuedAt + expiresInSeconds,
  });

  return `${header}.${payload}.${signature(`${header}.${payload}`)}`;
}

export function verifyJwt(token) {
  if (typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [header, payload, provided] = parts;

  let head;
  try {
    head = decode(header);
  } catch {
    return null;
  }

  // Reject the algorithm before doing any work with the signature.
  if (head?.alg !== ALG || (head.typ && head.typ !== 'JWT')) return null;

  const expected = signature(`${header}.${payload}`);
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let claims;
  try {
    claims = decode(payload);
  } catch {
    return null;
  }

  const at = now();
  if (typeof claims.exp !== 'number' || claims.exp + SKEW_SECONDS < at) return null;
  if (typeof claims.nbf === 'number' && claims.nbf - SKEW_SECONDS > at) return null;

  return claims;
}
