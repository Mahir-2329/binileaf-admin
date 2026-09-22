import 'server-only';
import { headers } from 'next/headers';

/**
 * A rate limit on signing in.
 *
 * scrypt makes a stolen hash expensive to crack offline; it does nothing about
 * somebody sitting on the login form guessing "binileaf", "binileaf1",
 * "binileaf2". This puts a ceiling on that: a handful of tries per email and a
 * wider one per address, then a wait.
 *
 * It lives in this process's memory, which is the honest scope of it — one
 * café, one admin, one Node server. Behind several instances each would hold
 * its own count, and the limit would want to be a table instead. It is written
 * so that swapping the two functions below for a SQL-backed pair is the whole
 * change.
 */

const WINDOW_MS = 10 * 60_000;

/** key → { count, resetAt } */
const buckets = new Map();

function sweep(now) {
  if (buckets.size < 512) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Count one attempt against `key`.
 * Returns `{ ok: true }` while there is room, `{ ok: false, seconds }` after.
 */
export function attempt(key, limit) {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true };
  }

  bucket.count += 1;
  if (bucket.count <= limit) return { ok: true };

  return { ok: false, seconds: Math.ceil((bucket.resetAt - now) / 1000) };
}

/** A successful sign-in wipes the count, so normal use never meets the limit. */
export function forget(...keys) {
  for (const key of keys) buckets.delete(key);
}

/** Best effort: behind a proxy this is the forwarded address, otherwise none. */
export async function callerAddress() {
  const head = await headers();
  const forwarded = head.get('x-forwarded-for');
  return (forwarded ? forwarded.split(',')[0] : head.get('x-real-ip'))?.trim() || 'local';
}

export const inMinutes = (seconds) =>
  seconds < 90 ? `${seconds} seconds` : `${Math.ceil(seconds / 60)} minutes`;
