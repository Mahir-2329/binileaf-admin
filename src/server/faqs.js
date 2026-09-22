'use server';

import 'server-only';
import { revalidatePath } from 'next/cache';
import { getSql } from '@/lib/db';
import { requireSession } from '@/server/session';
import { recordChange } from '@/server/audit';

/**
 * FAQs.
 *
 * `position` is the printed order and is kept dense: 0, 1, 2 … with no gaps.
 * Dense numbering means a move is two rows changing places rather than a
 * fractional index nobody can read in psql, and it costs one small UPDATE
 * over a table that will never hold more than a few dozen rows.
 */

const fail = (message) => ({ ok: false, error: message });

const text = (value, max = 4000) => String(value ?? '').trim().slice(0, max);

/** Free text, lower-cased and tidied — the topic is a grouping, not an enum. */
const topicOf = (value) =>
  text(value, 40)
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-') || 'general';

/**
 * Rewrite every row's position to its index in the current order. Runs after
 * any change to the order so the column always reads 0..n-1.
 */
async function renumber(sql) {
  await sql`
    update faqs as f
    set position = ordered.rank - 1
    from (
      select id, row_number() over (order by position, created_at) as rank
      from faqs
    ) as ordered
    where ordered.id = f.id and f.position <> ordered.rank - 1
  `;
}

export async function saveFaq(input) {
  const session = await requireSession();
  const sql = getSql();
  if (!sql) return fail('No database is configured on this machine.');

  const question = text(input?.question, 500);
  const answer = text(input?.answer);

  if (!question) return fail('Type the question the way someone would actually ask it.');
  if (!answer) return fail('An answer is needed — this is the text search engines will quote.');

  const topic = topicOf(input?.topic);
  const isActive = input?.is_active !== false;
  const id = text(input?.id, 60);

  try {
    if (id) {
      const [saved] = await sql`
        update faqs set
          question = ${question},
          answer = ${answer},
          topic = ${topic},
          is_active = ${isActive},
          updated_at = now()
        where id = ${id}
        returning id, question
      `;
      if (!saved) return fail('That question is no longer there.');

      revalidatePath('/faqs');
      await recordChange({
        actor: session.email,
        action: 'faq.update',
        entity: 'faq',
        entityId: saved.id,
        detail: { question: saved.question },
      });

      return { ok: true, id: saved.id };
    }

    // New questions go to the bottom; anything else would move the ones
    // already there without being asked to.
    const [created] = await sql`
      insert into faqs (question, answer, topic, is_active, position)
      values (${question}, ${answer}, ${topic}, ${isActive},
              (select coalesce(max(position), -1) + 1 from faqs))
      returning id, question
    `;

    revalidatePath('/faqs');
    await recordChange({
      actor: session.email,
      action: 'faq.create',
      entity: 'faq',
      entityId: created.id,
      detail: { question: created.question },
    });

    return { ok: true, id: created.id };
  } catch (error) {
    console.error('[binileaf-admin] faq save failed:', error.message);
    return fail('That could not be saved. Try again in a moment.');
  }
}

export async function setFaqActive(id, isActive) {
  const session = await requireSession();
  const sql = getSql();
  if (!sql) return fail('No database is configured on this machine.');

  const [saved] = await sql`
    update faqs set is_active = ${Boolean(isActive)}, updated_at = now()
    where id = ${id}
    returning id, question, is_active
  `;
  if (!saved) return fail('That question is no longer there.');

  revalidatePath('/faqs');
  await recordChange({
    actor: session.email,
    action: saved.is_active ? 'faq.show' : 'faq.hide',
    entity: 'faq',
    entityId: saved.id,
    detail: { question: saved.question },
  });

  return { ok: true };
}

/**
 * Move one question one place. The two rows swap positions inside a single
 * statement, so there is no moment where both hold the same number.
 */
export async function moveFaq(id, direction) {
  const session = await requireSession();
  const sql = getSql();
  if (!sql) return fail('No database is configured on this machine.');

  const step = direction === 'up' ? -1 : 1;

  const [row] = await sql`select id, position, question from faqs where id = ${id} limit 1`;
  if (!row) return fail('That question is no longer there.');

  const [neighbour] =
    step === -1
      ? await sql`select id, position from faqs where position < ${row.position} order by position desc limit 1`
      : await sql`select id, position from faqs where position > ${row.position} order by position asc limit 1`;

  // Already at the end — a no-op, not an error. The buttons are disabled
  // there anyway; this is the guard for a double-tap that beat the re-render.
  if (!neighbour) return { ok: true, moved: false };

  // The casts are not decoration: inside a CASE, Postgres has no column to
  // infer the parameter types from, and the driver sends them as text.
  await sql`
    update faqs set
      position = case id
                   when ${row.id}::uuid then ${neighbour.position}::int
                   else ${row.position}::int
                 end,
      updated_at = now()
    where id in (${row.id}::uuid, ${neighbour.id}::uuid)
  `;

  await renumber(sql);

  revalidatePath('/faqs');
  await recordChange({
    actor: session.email,
    action: 'faq.reorder',
    entity: 'faq',
    entityId: row.id,
    detail: { question: row.question, direction },
  });

  return { ok: true, moved: true };
}

export async function deleteFaq(id) {
  const session = await requireSession();
  const sql = getSql();
  if (!sql) return fail('No database is configured on this machine.');

  const [removed] = await sql`delete from faqs where id = ${id} returning id, question`;
  if (!removed) return fail('That question is no longer there.');

  await renumber(sql);

  revalidatePath('/faqs');
  await recordChange({
    actor: session.email,
    action: 'faq.delete',
    entity: 'faq',
    entityId: removed.id,
    detail: { question: removed.question },
  });

  return { ok: true };
}
