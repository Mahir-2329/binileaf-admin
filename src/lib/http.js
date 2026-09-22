/**
 * Same-origin check for route handlers.
 *
 * Server Actions get this from the framework; route handlers do not. The
 * session cookie is `SameSite=Lax`, so a cross-site form post never carries it
 * in the first place — this is the second lock, not the first, and it is here
 * because the first one is a browser default and defaults change.
 *
 * A request with no `Origin` header is not a browser post; it is curl, or a
 * server. Those are allowed through to be checked by the session like anything
 * else, because forging a header is not the hard part of that attack.
 */
export function sameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;

  try {
    return new URL(origin).host === request.headers.get('host');
  } catch {
    return false;
  }
}
