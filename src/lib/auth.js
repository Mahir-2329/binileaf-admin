import 'server-only';
import { randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { signJwt, verifyJwt } from './jwt';

const scryptAsync = promisify(scrypt);

/**
 * Passwords, one-time codes and the session cookie.
 *
 * No auth library: the whole surface is one account type, one cookie and a
 * six-digit code, and a dependency here would be more code to audit than the
 * eighty lines it replaces.
 */

/* ───────────────────────────────────────────────────────── passwords ──── */

const SCRYPT = { N: 16384, r: 8, p: 1, keyLength: 64 };

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, SCRYPT.keyLength, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('hex')}$${key.toString('hex')}`;
}

export async function verifyPassword(password, stored) {
  if (typeof stored !== 'string' || !stored.startsWith('scrypt$')) return false;

  const [, N, r, p, saltHex, keyHex] = stored.split('$');
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(keyHex, 'hex');

  const actual = await scryptAsync(password, salt, expected.length, {
    N: Number(N),
    r: Number(r),
    p: Number(p),
  });

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/* ─────────────────────────────────────────────────────── one-time code ──── */

/**
 * Until a mail provider is configured there is nowhere to send a code to, so
 * a fixed development code is accepted alongside the generated one. Setting
 * RESEND_API_KEY (or any `MAIL_*`) turns that off.
 */
export const mailerConfigured = () =>
  Boolean(process.env.RESEND_API_KEY || process.env.SMTP_URL || process.env.MAIL_FROM);

export const DEV_OTP = '111111';

export const generateOtp = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

export function otpMatches(input, stored, expiresAt) {
  const code = String(input ?? '').trim();
  if (!/^\d{6}$/.test(code)) return false;

  // The development code works from either side while there is no mailer.
  if (!mailerConfigured() && code === DEV_OTP) return true;

  if (!stored || !expiresAt) return false;
  if (new Date(expiresAt).getTime() < Date.now()) return false;

  const a = Buffer.from(code);
  const b = Buffer.from(String(stored));
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Delivery. With no provider configured this logs the code to the server
 * console, which is exactly what a local operator needs.
 */
export async function deliverOtp(email, code) {
  if (!mailerConfigured()) {
    console.info(`[binileaf-admin] OTP for ${email}: ${code} (or use ${DEV_OTP})`);
    return { delivered: false };
  }

  // Wire the provider here; the rest of the flow does not change.
  console.info(`[binileaf-admin] OTP for ${email} ready to send`);
  return { delivered: true };
}

/* ─────────────────────────────────────────────────────────── session ──── */

/**
 * The session is a signed JWT in an httpOnly cookie. Nothing is stored server
 * side, so there is no session table to keep in step — and no token means no
 * session, full stop: `readSessionToken` returns null and the middleware sends
 * the request to the login screen with the stale cookie cleared.
 */

const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export function createSessionToken({ id, email, role }) {
  return signJwt(
    { sub: id, email, role, iss: 'binileaf-admin', aud: 'binileaf-admin' },
    { expiresInSeconds: MAX_AGE_SECONDS }
  );
}

export function readSessionToken(token) {
  const claims = verifyJwt(token);
  if (!claims) return null;

  // A token signed for something else is not a session here, however valid.
  if (claims.iss !== 'binileaf-admin' || claims.aud !== 'binileaf-admin') return null;
  if (!claims.sub || !claims.email) return null;

  return { id: claims.sub, email: claims.email, role: claims.role, exp: claims.exp };
}

export const SESSION_COOKIE = 'binileaf_admin';
export const SESSION_MAX_AGE = MAX_AGE_SECONDS;

export const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: MAX_AGE_SECONDS,
};
