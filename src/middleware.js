import { NextResponse } from 'next/server';
import { readSessionToken, SESSION_COOKIE, cookieOptions } from '@/lib/auth';

/**
 * No token, no admin.
 *
 * Every request carries the session JWT or it does not get in. A cookie that is
 * missing, malformed, signed with another key, or past its `exp` is all the same
 * thing here — the request goes to the login screen and the stale cookie is
 * cleared on the way out, so the browser stops presenting it.
 *
 * This is the gate, not the guard: pages still read the session for the account,
 * and every mutation re-checks before it writes.
 */

const PUBLIC = ['/login', '/setup'];

const isPublic = (pathname) =>
  PUBLIC.some((path) => pathname === path || pathname.startsWith(`${path}/`));

const clear = (response) => {
  response.cookies.set(SESSION_COOKIE, '', { ...cookieOptions, maxAge: 0 });
  return response;
};

export function middleware(request) {
  const { pathname } = request.nextUrl;

  const raw = request.cookies.get(SESSION_COOKIE)?.value;
  const session = readSessionToken(raw);

  if (!session && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    if (pathname !== '/') url.searchParams.set('next', pathname);

    const response = NextResponse.redirect(url);
    return raw ? clear(response) : response;
  }

  // A dead cookie is cleared even on a public page, so it cannot linger.
  if (!session && raw) return clear(NextResponse.next());

  if (session && isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

/**
 * Node, not Edge: the JWT signature is HMAC-SHA256 from `node:crypto`, which
 * the Edge runtime cannot load. Nothing here needs the edge.
 */
export const runtime = 'nodejs';

export const config = {
  // `/media` is excluded: the same photographs are public on the site, and
  // gating them here only breaks every <img> on a cold session.
  // `/api/bootstrap` is excluded because it exists to create the first account.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|media/|api/bootstrap).*)'],
};
