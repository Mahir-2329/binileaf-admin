'use server';

import { redirect } from 'next/navigation';
import { getSql, hasDatabase } from '@/lib/db';
import {
  DEV_OTP,
  deliverOtp,
  generateOtp,
  mailerConfigured,
  otpMatches,
  verifyPassword,
} from '@/lib/auth';
import { startSession } from './session';
import { attempt, callerAddress, forget, inMinutes } from './throttle';

/**
 * Two steps, because one password is one factor.
 *
 *   1. email + password  → a six-digit code is issued and sent
 *   2. the code          → the session cookie is written
 *
 * While no mail provider is configured there is nowhere to send a code, so
 * `111111` is accepted as well as the generated one. Setting RESEND_API_KEY,
 * SMTP_URL or MAIL_FROM turns that off with no other change.
 */

const OTP_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 6;

/** Per email, then per address: one guessed account, and one busy guesser. */
const PASSWORD_TRIES = 8;
const ADDRESS_TRIES = 25;

const fail = (step, message, values = {}) => ({ step, error: message, ...values });

export async function requestCode(_previous, formData) {
  if (!hasDatabase) return fail('password', 'The database is not configured on this machine.');

  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) return fail('password', 'Email and password are both needed.', { email });

  // Counted before the password is checked, so a wrong guess costs a try
  // whether or not the account exists.
  const address = await callerAddress();
  const byAddress = attempt(`ip:${address}`, ADDRESS_TRIES);
  const byEmail = attempt(`pw:${email}`, PASSWORD_TRIES);
  const limited = !byAddress.ok ? byAddress : !byEmail.ok ? byEmail : null;

  if (limited) {
    return fail('password', `Too many attempts. Try again in ${inMinutes(limited.seconds)}.`, { email });
  }

  const sql = getSql();
  const [user] = await sql`
    select id, email, password_hash, is_active
    from admin_users
    where email = ${email}
    limit 1
  `;

  // The same message either way: a wrong email should not be distinguishable
  // from a wrong password.
  const ok = user?.is_active && (await verifyPassword(password, user.password_hash));
  if (!ok) return fail('password', 'That email and password do not match.', { email });

  const code = generateOtp();
  const expires = new Date(Date.now() + OTP_TTL_MINUTES * 60_000).toISOString();

  await sql`
    update admin_users
    set otp_code = ${code}, otp_expires_at = ${expires}, otp_attempts = 0
    where id = ${user.id}
  `;

  // The password was right, so the guess counter has served its purpose.
  forget(`pw:${email}`);

  await deliverOtp(email, code);

  return {
    step: 'code',
    email,
    error: null,
    notice: mailerConfigured()
      ? `A six-digit code is on its way to ${email}.`
      : `No mail provider is configured yet, so use ${DEV_OTP}.`,
  };
}

export async function verifyCode(_previous, formData) {
  if (!hasDatabase) return fail('code', 'The database is not configured on this machine.');

  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const code = String(formData.get('code') ?? '').trim();
  const next = String(formData.get('next') ?? '/');

  const byAddress = attempt(`ip:${await callerAddress()}`, ADDRESS_TRIES);
  if (!byAddress.ok) {
    return fail('code', `Too many attempts. Try again in ${inMinutes(byAddress.seconds)}.`, { email });
  }

  const sql = getSql();
  const [user] = await sql`
    select id, email, role, otp_code, otp_expires_at, otp_attempts, is_active
    from admin_users
    where email = ${email}
    limit 1
  `;

  if (!user?.is_active) return fail('password', 'Start again.', { email });

  if (user.otp_attempts >= MAX_ATTEMPTS) {
    await sql`update admin_users set otp_code = null, otp_expires_at = null where id = ${user.id}`;
    return fail('password', 'Too many attempts. Sign in again.', { email });
  }

  if (!otpMatches(code, user.otp_code, user.otp_expires_at)) {
    await sql`update admin_users set otp_attempts = otp_attempts + 1 where id = ${user.id}`;
    return fail('code', 'That code is not right, or it has expired.', { email });
  }

  await sql`
    update admin_users
    set otp_code = null, otp_expires_at = null, otp_attempts = 0, last_login_at = now()
    where id = ${user.id}
  `;

  await startSession({ id: user.id, email: user.email, role: user.role });

  redirect(next.startsWith('/') ? next : '/');
}
