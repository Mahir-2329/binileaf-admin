import { getSql, hasDatabase } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { sameOrigin } from '@/lib/http';
import { attempt, callerAddress, inMinutes } from '@/server/throttle';

/**
 * Creates the first admin account.
 *
 * The only unauthenticated write in this app, and it is safe for exactly one
 * reason: **it refuses once any account exists.** There is no secret to leak,
 * no seed password sitting in `.env`, and no script anybody has to remember to
 * run — a fresh database is claimed by whoever reaches the setup screen first,
 * and after that the endpoint is permanently closed.
 *
 * `GET` answers whether the admin still needs claiming, so the login screen can
 * offer setup instead of a form nobody can use yet.
 */

const MIN_PASSWORD = 10;
const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);

async function accountCount() {
  const sql = getSql();
  const [row] = await sql`select count(*)::int as n from admin_users`;
  return row.n;
}

export async function GET() {
  if (!hasDatabase) {
    return Response.json({ ok: false, error: 'The database is not configured.' }, { status: 503 });
  }

  return Response.json({ ok: true, needsSetup: (await accountCount()) === 0 });
}

export async function POST(request) {
  if (!sameOrigin(request)) {
    return Response.json({ ok: false, error: 'Cross-site requests are refused.' }, { status: 403 });
  }

  // Open by necessity, so it is not open to a machine hammering it.
  const rate = attempt(`bootstrap:${await callerAddress()}`, 10);
  if (!rate.ok) {
    return Response.json(
      { ok: false, error: `Too many attempts. Try again in ${inMinutes(rate.seconds)}.` },
      { status: 429 }
    );
  }

  if (!hasDatabase) {
    return Response.json({ ok: false, error: 'The database is not configured.' }, { status: 503 });
  }

  // Checked before anything is read, and again inside the insert below.
  if ((await accountCount()) > 0) {
    return Response.json(
      { ok: false, error: 'An account already exists. Sign in, or reset the password from Settings.' },
      { status: 409 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'Malformed request.' }, { status: 400 });
  }

  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  const name = String(body.name ?? '').trim() || 'Binileaf';

  const errors = {};
  if (!isEmail(email)) errors.email = 'That email address does not look right.';
  if (password.length < MIN_PASSWORD) {
    errors.password = `Use at least ${MIN_PASSWORD} characters.`;
  }

  if (Object.keys(errors).length) {
    return Response.json({ ok: false, errors }, { status: 422 });
  }

  const sql = getSql();

  // `where not exists` closes the gap between the check above and this write:
  // two people hitting setup at the same moment cannot both create an owner.
  const rows = await sql`
    insert into admin_users (email, name, password_hash, role)
    select ${email}, ${name}, ${await hashPassword(password)}, 'owner'
    where not exists (select 1 from admin_users)
    returning id, email
  `;

  if (!rows.length) {
    return Response.json(
      { ok: false, error: 'An account already exists. Sign in instead.' },
      { status: 409 }
    );
  }

  return Response.json({ ok: true, email: rows[0].email });
}
