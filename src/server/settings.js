'use server';

import 'server-only';
import { revalidatePath } from 'next/cache';
import { getSql } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/auth';
import { requireSession } from '@/server/session';
import { recordChange } from '@/server/audit';

/**
 * Settings, and the accounts that can change them.
 *
 * Three `settings` rows, each a small JSON object the site reads directly:
 *
 *   hours     { opens: "HH:MM", closes: "HH:MM", days: string }
 *             `closes` may be earlier than `opens` — the café shuts at 00:30,
 *             which is the next day. That is not an error and is not treated
 *             as one.
 *   banner    { enabled: boolean, text: string }
 *   ordering  { online: boolean, provider: string | null }
 */

const MIN_PASSWORD = 10;

const fail = (message) => ({ ok: false, error: message });

const text = (value, max = 400) => String(value ?? '').trim().slice(0, max);

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const SHAPES = {
  hours: (input) => {
    const opens = text(input?.opens, 5);
    const closes = text(input?.closes, 5);

    if (!TIME.test(opens) || !TIME.test(closes)) {
      return { error: 'Opening and closing times both need to be filled in.' };
    }

    return { value: { opens, closes, days: text(input?.days, 120) } };
  },

  banner: (input) => {
    const enabled = Boolean(input?.enabled);
    const message = text(input?.text, 300);

    if (enabled && !message) {
      return { error: 'A banner with nothing written in it would show an empty stripe. Add the text, or switch it off.' };
    }

    return { value: { enabled, text: message } };
  },

  ordering: (input) => {
    const online = Boolean(input?.online);
    const provider = text(input?.provider, 120) || null;

    if (online && !provider) {
      return { error: 'Name who takes the orders — Swiggy, Zomato, or whoever it is.' };
    }

    return { value: { online, provider } };
  },
};

export async function saveSetting(key, value) {
  const session = await requireSession();

  const shape = SHAPES[key];
  if (!shape) return fail('That is not a setting this screen can change.');

  const sql = getSql();
  if (!sql) return fail('No database is configured on this machine.');

  const parsed = shape(value);
  if (parsed.error) return fail(parsed.error);

  try {
    await sql`
      insert into settings (key, value, updated_at)
      values (${key}, ${JSON.stringify(parsed.value)}::jsonb, now())
      on conflict (key) do update set value = excluded.value, updated_at = now()
    `;
  } catch (error) {
    console.error('[binileaf-admin] setting save failed:', error.message);
    return fail('That could not be saved. Try again in a moment.');
  }

  revalidatePath('/settings');
  await recordChange({
    actor: session.email,
    action: 'setting.update',
    entity: 'setting',
    entityId: key,
    detail: parsed.value,
  });

  return { ok: true };
}

/* ─────────────────────────────────────────────────────────── accounts ──── */

/**
 * Change your own password, and only your own.
 *
 * The account is taken from the session, never from the form — a field naming
 * whose password to change would be an account-takeover endpoint with a nice
 * label on it. The current password is re-checked even though the session is
 * valid, because a session is a week old by design and a borrowed laptop is
 * the case this guards.
 */
export async function changeOwnPassword(_previous, formData) {
  const session = await requireSession();
  const sql = getSql();
  if (!sql) return fail('No database is configured on this machine.');

  const current = String(formData.get('current') ?? '');
  const next = String(formData.get('next') ?? '');
  const again = String(formData.get('again') ?? '');

  if (!current) return fail('Type your current password first.');
  if (next.length < MIN_PASSWORD) {
    return fail(`The new password needs at least ${MIN_PASSWORD} characters. A short sentence works well.`);
  }
  if (next !== again) return fail('The two new passwords do not match.');
  if (next === current) return fail('The new password is the same as the current one.');

  const [user] = await sql`
    select id, password_hash from admin_users where id = ${session.id} limit 1
  `;
  if (!user) return fail('That account is no longer there. Sign out and back in.');

  const ok = await verifyPassword(current, user.password_hash);
  if (!ok) return fail('That is not your current password.');

  await sql`
    update admin_users set password_hash = ${await hashPassword(next)}, updated_at = now()
    where id = ${user.id}
  `;

  revalidatePath('/settings');
  await recordChange({
    actor: session.email,
    action: 'account.password',
    entity: 'admin_user',
    entityId: user.id,
    detail: {},
  });

  return { ok: true, message: 'Password changed. It is what you will use next time you sign in.' };
}

/**
 * Add a second account. Owners only — an editor adding an owner would make
 * the role column decorative.
 */
export async function createAdminUser(_previous, formData) {
  const session = await requireSession();
  const sql = getSql();
  if (!sql) return fail('No database is configured on this machine.');

  if (session.role !== 'owner') {
    return fail('Only an owner can add an account.');
  }

  const email = text(formData.get('email'), 200).toLowerCase();
  const name = text(formData.get('name'), 120) || null;
  const role = formData.get('role') === 'owner' ? 'owner' : 'editor';
  const password = String(formData.get('password') ?? '');

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('That does not look like an email address.');
  if (password.length < MIN_PASSWORD) {
    return fail(`Their password needs at least ${MIN_PASSWORD} characters.`);
  }

  const [existing] = await sql`select id from admin_users where email = ${email} limit 1`;
  if (existing) return fail('There is already an account with that email.');

  const [created] = await sql`
    insert into admin_users (email, name, password_hash, role)
    values (${email}, ${name}, ${await hashPassword(password)}, ${role})
    returning id, email, role
  `;

  revalidatePath('/settings');
  await recordChange({
    actor: session.email,
    action: 'account.create',
    entity: 'admin_user',
    entityId: created.id,
    detail: { email: created.email, role: created.role },
  });

  return {
    ok: true,
    message: `${created.email} can sign in now. Tell them the password yourself — nothing is emailed.`,
  };
}
