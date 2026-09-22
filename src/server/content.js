'use server';

import 'server-only';
import { revalidatePath } from 'next/cache';
import { getSql } from '@/lib/db';
import { requireSession } from '@/server/session';
import { recordChange } from '@/server/audit';

/**
 * Page copy — the four `content_blocks` rows the site's long-form pages read.
 *
 * Each block is a different shape, and the site destructures them without
 * guarding, so a block saved in the wrong shape takes a page down. The screen
 * edits real fields rather than JSON, and this file is the second wall: every
 * key is normalised into its exact shape here before it is written, so a
 * malformed payload becomes a tidy row rather than a broken About page.
 *
 *   story       { kicker, heading, lede, paragraphs: string[],
 *                 quote: { text, attribution } }
 *   values      Array<{ id, title, body }>            id is stable, see below
 *   franchise   { kicker, heading, lede,
 *                 reasons: Array<{ title, body }>, included: string[] }
 *   quickFacts  Array<{ label, value }>
 */

const fail = (message) => ({ ok: false, error: message });

const text = (value, max = 4000) => String(value ?? '').trim().slice(0, max);

const lines = (value, max = 4000) =>
  (Array.isArray(value) ? value : []).map((entry) => text(entry, max)).filter(Boolean);

/**
 * `values[].id` is the anchor the site scrolls to and the key React lists on.
 * Renaming a title should not silently break an existing link, so an id that
 * is already there is kept; only a new row gets one derived from its title.
 */
function slugify(value) {
  return (
    text(value, 80)
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'value'
  );
}

function withIds(rows) {
  const used = new Set();

  return rows.map((row, index) => {
    let id = text(row?.id, 80) || slugify(row?.title);
    while (used.has(id)) id = `${id}-${index + 1}`;
    used.add(id);

    return { id, title: text(row?.title, 200), body: text(row?.body) };
  });
}

const SHAPES = {
  story: (input) => ({
    kicker: text(input?.kicker, 200),
    heading: text(input?.heading, 300),
    lede: text(input?.lede),
    paragraphs: lines(input?.paragraphs),
    quote: {
      text: text(input?.quote?.text),
      attribution: text(input?.quote?.attribution, 200),
    },
  }),

  values: (input) =>
    withIds(Array.isArray(input) ? input : []).filter((row) => row.title || row.body),

  franchise: (input) => ({
    kicker: text(input?.kicker, 200),
    heading: text(input?.heading, 300),
    lede: text(input?.lede),
    reasons: (Array.isArray(input?.reasons) ? input.reasons : [])
      .map((row) => ({ title: text(row?.title, 200), body: text(row?.body) }))
      .filter((row) => row.title || row.body),
    included: lines(input?.included, 300),
  }),

  quickFacts: (input) =>
    (Array.isArray(input) ? input : [])
      .map((row) => ({ label: text(row?.label, 120), value: text(row?.value, 300) }))
      .filter((row) => row.label || row.value),
};

/** Saves one block. One block at a time, so a typo in the story cannot lose the values. */
export async function saveContentBlock(key, value) {
  const session = await requireSession();

  const shape = SHAPES[key];
  if (!shape) return fail('That is not a block this screen knows how to save.');

  const sql = getSql();
  if (!sql) return fail('No database is configured on this machine.');

  const next = shape(value);

  if (key === 'story' && !next.heading) {
    return fail('The story needs a heading — it is the first thing on the page.');
  }
  if (key === 'franchise' && !next.heading) {
    return fail('The franchise page needs a heading.');
  }

  try {
    await sql`
      insert into content_blocks (key, label, value, updated_at)
      values (${key}, ${key}, ${JSON.stringify(next)}::jsonb, now())
      on conflict (key) do update
        set value = excluded.value, updated_at = now()
    `;
  } catch (error) {
    console.error('[binileaf-admin] content save failed:', error.message);
    return fail('That could not be saved. Try again in a moment.');
  }

  revalidatePath('/content');

  await recordChange({
    actor: session.email,
    action: 'content.update',
    entity: 'content_block',
    entityId: key,
    detail: {
      // A summary, not the copy: the audit log should stay readable, and the
      // full text is one query away in the row itself.
      size: Array.isArray(next) ? next.length : Object.keys(next).length,
    },
  });

  return { ok: true };
}
