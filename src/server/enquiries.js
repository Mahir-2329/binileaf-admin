'use server';

import 'server-only';
import { revalidatePath } from 'next/cache';
import { getSql } from '@/lib/db';
import { requireSession } from '@/server/session';
import { recordChange } from '@/server/audit';

/**
 * Enquiries.
 *
 * These are records of somebody writing to the café, so nothing here deletes
 * one. The only writes are the two things the café adds after the fact: where
 * the conversation has got to, and a note to itself. Spam is a status, not a
 * removal — a row marked spam can be read back if it turns out not to be.
 */

const STATUSES = ['new', 'read', 'replied', 'spam'];

const fail = (message) => ({ ok: false, error: message });

export async function setEnquiryStatus(id, status) {
  const session = await requireSession();
  const sql = getSql();
  if (!sql) return fail('No database is configured on this machine.');

  if (!STATUSES.includes(status)) return fail('That is not a status this screen can set.');

  const [saved] = await sql`
    update enquiries set status = ${status}, updated_at = now()
    where id = ${id}
    returning id, name, status
  `;
  if (!saved) return fail('That enquiry is no longer there.');

  revalidatePath('/enquiries');
  await recordChange({
    actor: session.email,
    action: 'enquiry.status',
    entity: 'enquiry',
    entityId: saved.id,
    detail: { name: saved.name, status: saved.status },
  });

  return { ok: true };
}

export async function saveEnquiryNotes(id, notes) {
  const session = await requireSession();
  const sql = getSql();
  if (!sql) return fail('No database is configured on this machine.');

  const text = String(notes ?? '').trim().slice(0, 4000) || null;

  const [saved] = await sql`
    update enquiries set notes = ${text}, updated_at = now()
    where id = ${id}
    returning id, name
  `;
  if (!saved) return fail('That enquiry is no longer there.');

  revalidatePath('/enquiries');
  await recordChange({
    actor: session.email,
    action: 'enquiry.note',
    entity: 'enquiry',
    entityId: saved.id,
    detail: { name: saved.name },
  });

  return { ok: true };
}

/**
 * Opening an unread enquiry marks it read.
 *
 * Only from `new`: once someone has replied or filed it as spam, opening it
 * again must not quietly undo that. Returns quietly either way — this runs as
 * a side effect of a click, and a toast for it would be noise.
 */
export async function markEnquiryRead(id) {
  await requireSession();
  const sql = getSql();
  if (!sql) return { ok: false };

  const [saved] = await sql`
    update enquiries set status = 'read', updated_at = now()
    where id = ${id} and status = 'new'
    returning id
  `;

  if (saved) revalidatePath('/enquiries');
  return { ok: true, changed: Boolean(saved) };
}
