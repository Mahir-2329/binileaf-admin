import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSql, hasDatabase } from '@/lib/db';
import { SESSION_COOKIE, cookieOptions, createSessionToken, readSessionToken } from '@/lib/auth';

/**
 * Who is asking.
 *
 * Two checks, not one. The cookie has to carry a JWT this server signed and
 * has not expired — that is the middleware's gate and it costs nothing. Then
 * the account behind it is read back from Postgres, because a token is a
 * week-old memory: it still says `owner` after the role was changed, and it
 * still names an account that has since been switched off. Anything that
 * decides what somebody may do reads the row, not the claim.
 *
 * `cache()` keeps that to one query per request however many actions or
 * components ask.
 */

async function claims() {
  const store = await cookies();
  return readSessionToken(store.get(SESSION_COOKIE)?.value);
}

export const getSession = cache(async function getSession() {
  const token = await claims();
  if (!token) return null;

  // No database configured: the token is all there is, and every screen is
  // already showing its "no database" state.
  if (!hasDatabase) return { id: token.id, email: token.email, role: token.role };

  try {
    const [user] = await getSql()`
      select id, email, role, is_active
      from admin_users
      where id = ${token.id}
      limit 1
    `;

    // Deleted, disabled, or a token for an account this database never had.
    if (!user?.is_active) return null;

    return { id: user.id, email: user.email, role: user.role };
  } catch (error) {
    // A database that cannot be reached must not become a way in.
    console.error('[binileaf-admin] session lookup failed:', error.message);
    return null;
  }
});

/**
 * For pages and Server Actions: the session, or the login screen.
 *
 * Actions are reachable by anyone who can post to this origin, so this is not
 * decoration on top of the middleware — it is the check that counts.
 */
export async function requireSession() {
  const session = await getSession();
  if (!session) redirect('/login');
  return session;
}

/** For anything that must be an owner: adding accounts, and nothing else yet. */
export async function requireOwner() {
  const session = await requireSession();
  if (session.role !== 'owner') redirect('/');
  return session;
}

export async function startSession(user) {
  const store = await cookies();
  store.set(SESSION_COOKIE, createSessionToken(user), cookieOptions);
}

export async function endSession() {
  const store = await cookies();
  store.set(SESSION_COOKIE, '', { ...cookieOptions, maxAge: 0 });
}
