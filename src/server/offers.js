'use server';

import 'server-only';
import { revalidatePath } from 'next/cache';
import { getSql } from '@/lib/db';
import { requireSession } from '@/server/session';
import { recordChange } from '@/server/audit';

/**
 * Offers & deals — every write the /offers screen makes.
 *
 * The form validates first, so most of what follows never fires. It fires
 * anyway: a server action is a public endpoint, and the `offers_window` check
 * constraint must never be the thing a café owner reads. Each guard returns a
 * sentence, not a code.
 *
 * Three JSON columns are written here, and nothing else writes them:
 *
 *   applies_to  { groups?: string[], items?: string[], min_spend?: number }
 *               menu_groups.slug and menu_items.slug. Keys are omitted when
 *               empty, so `{}` honestly means "the whole menu".
 *
 *   placement   { home_band: boolean, menu_top: boolean }
 *               Both keys are always written, so reading the row tells you
 *               what was considered. The site filters on truthiness.
 *
 *   schedule    null | { days: number[], from: "HH:MM", to: "HH:MM" }
 *               days are 0=Sunday … 6=Saturday. null means "no recurrence",
 *               which is the common case.
 */

const KINDS = ['discount', 'combo', 'happy_hour', 'announcement'];
const VALUE_TYPES = ['percent', 'flat', 'none'];

const fail = (message) => ({ ok: false, error: message });

const clean = (value, max = 2000) => {
  const text = String(value ?? '').trim();
  return text ? text.slice(0, max) : null;
};

/* ───────────────────────────────────────────────────────────── slugs ──── */

function slugify(text) {
  return (
    String(text ?? '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'offer'
  );
}

/** `slug` is unique in the table, so a clash has to be resolved before insert. */
async function uniqueSlug(sql, base) {
  const taken = await sql`
    select slug from offers
    where slug = ${base} or slug like ${`${base}-%`}
  `;
  const used = new Set(taken.map((row) => row.slug));
  if (!used.has(base)) return base;

  for (let n = 2; n < 500; n += 1) {
    const candidate = `${base}-${n}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
}

/* ────────────────────────────────────────────────────────── json shapes ──── */

function normaliseAppliesTo(input) {
  const list = (value) =>
    Array.from(
      new Set(
        (Array.isArray(value) ? value : [])
          .map((entry) => String(entry ?? '').trim())
          .filter(Boolean)
          .slice(0, 200)
      )
    );

  const groups = list(input?.groups);
  const items = list(input?.items);
  const minSpend = Number(input?.min_spend);

  const out = {};
  if (groups.length) out.groups = groups;
  if (items.length) out.items = items;
  if (Number.isFinite(minSpend) && minSpend > 0) out.min_spend = Math.round(minSpend);
  return out;
}

function normalisePlacement(input) {
  return {
    home_band: Boolean(input?.home_band),
    menu_top: Boolean(input?.menu_top),
  };
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function normaliseSchedule(input) {
  if (!input || !input.enabled) return null;

  const days = Array.from(
    new Set(
      (Array.isArray(input.days) ? input.days : [])
        .map((day) => Number(day))
        .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    )
  ).sort((a, b) => a - b);

  if (!days.length) return { error: 'Pick at least one day for the recurring window.' };
  if (!TIME.test(input.from ?? '') || !TIME.test(input.to ?? '')) {
    return { error: 'Give the recurring window a start and end time, like 16:00 and 19:00.' };
  }
  if (input.from >= input.to) {
    return { error: 'The recurring window has to end later in the day than it starts.' };
  }

  return { days, from: input.from, to: input.to };
}

/* ───────────────────────────────────────────────────────── validation ──── */

/** Returns either `{ error }` or the row values, ready to write. */
function readOffer(input) {
  const title = clean(input?.title, 160);
  if (!title) return fail('Give the offer a title — it is the line people read on the site.');

  const kind = KINDS.includes(input?.kind) ? input.kind : 'announcement';
  const valueType = VALUE_TYPES.includes(input?.value_type) ? input.value_type : 'none';

  let value = null;
  if (valueType !== 'none') {
    const parsed = Number(input?.value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fail(
        valueType === 'percent'
          ? 'Enter the discount as a number — 20 means twenty per cent off.'
          : 'Enter the amount coming off in rupees — 50 means ₹50 off.'
      );
    }
    if (valueType === 'percent' && parsed > 100) {
      return fail('A percentage discount cannot be more than 100.');
    }
    value = Math.round(parsed);
  }

  const startsAt = input?.starts_at ? new Date(input.starts_at) : null;
  const endsAt = input?.ends_at ? new Date(input.ends_at) : null;

  if (startsAt && Number.isNaN(startsAt.getTime())) return fail('That start date could not be read.');
  if (endsAt && Number.isNaN(endsAt.getTime())) return fail('That end date could not be read.');
  if (startsAt && endsAt && endsAt <= startsAt) {
    return fail('The offer has to end after it starts. Check the two dates.');
  }

  const schedule = normaliseSchedule(input?.schedule);
  if (schedule?.error) return fail(schedule.error);

  const priority = Number(input?.priority);

  return {
    ok: true,
    row: {
      title,
      subtitle: clean(input?.subtitle, 200),
      body: clean(input?.body, 2000),
      code: clean(input?.code, 40)?.toUpperCase() ?? null,
      kind,
      valueType,
      value,
      appliesTo: normaliseAppliesTo(input?.applies_to),
      placement: normalisePlacement(input?.placement),
      schedule,
      mediaSlug: clean(input?.media_slug, 200),
      startsAt: startsAt ? startsAt.toISOString() : null,
      endsAt: endsAt ? endsAt.toISOString() : null,
      priority: Number.isFinite(priority) ? Math.max(-99, Math.min(99, Math.round(priority))) : 0,
      isActive: input?.is_active !== false,
    },
  };
}

/* ───────────────────────────────────────────────────────────── writes ──── */

export async function saveOffer(input) {
  const session = await requireSession();
  const sql = getSql();
  if (!sql) return fail('No database is configured on this machine.');

  const parsed = readOffer(input);
  if (!parsed.ok) return parsed;
  const row = parsed.row;

  const id = clean(input?.id, 60);

  try {
    if (id) {
      // The slug is part of the offer's identity once it exists; renaming the
      // title must not silently break a link someone has already shared.
      const [saved] = await sql`
        update offers set
          title       = ${row.title},
          subtitle    = ${row.subtitle},
          body        = ${row.body},
          code        = ${row.code},
          kind        = ${row.kind},
          value_type  = ${row.valueType},
          value       = ${row.value},
          applies_to  = ${JSON.stringify(row.appliesTo)}::jsonb,
          placement   = ${JSON.stringify(row.placement)}::jsonb,
          schedule    = ${row.schedule ? JSON.stringify(row.schedule) : null}::jsonb,
          media_slug  = ${row.mediaSlug},
          starts_at   = ${row.startsAt},
          ends_at     = ${row.endsAt},
          priority    = ${row.priority},
          is_active   = ${row.isActive},
          updated_at  = now()
        where id = ${id}
        returning id, slug, title
      `;

      if (!saved) return fail('That offer is no longer there — it may have been deleted.');

      revalidatePath('/offers');
      await recordChange({
        actor: session.email,
        action: 'offer.update',
        entity: 'offer',
        entityId: saved.id,
        detail: { slug: saved.slug, title: saved.title },
      });

      return { ok: true, id: saved.id };
    }

    const slug = await uniqueSlug(sql, slugify(row.title));

    const [created] = await sql`
      insert into offers
        (slug, kind, title, subtitle, body, code, value_type, value,
         applies_to, placement, media_slug, starts_at, ends_at, schedule, priority, is_active)
      values
        (${slug}, ${row.kind}, ${row.title}, ${row.subtitle}, ${row.body}, ${row.code},
         ${row.valueType}, ${row.value},
         ${JSON.stringify(row.appliesTo)}::jsonb, ${JSON.stringify(row.placement)}::jsonb,
         ${row.mediaSlug}, ${row.startsAt}, ${row.endsAt},
         ${row.schedule ? JSON.stringify(row.schedule) : null}::jsonb,
         ${row.priority}, ${row.isActive})
      returning id, slug, title
    `;

    revalidatePath('/offers');
    await recordChange({
      actor: session.email,
      action: 'offer.create',
      entity: 'offer',
      entityId: created.id,
      detail: { slug: created.slug, title: created.title },
    });

    return { ok: true, id: created.id };
  } catch (error) {
    console.error('[binileaf-admin] offer save failed:', error.message);
    return fail('That could not be saved. Check the dates and try again.');
  }
}

/**
 * Copy an offer, switched off and with its window cleared.
 *
 * Last Diwali's offer becomes this Diwali's, and the two things that must not
 * be inherited are the old dates and the live switch — a copy that went
 * straight onto the home page with last year's text would be worse than no
 * duplicate button at all.
 */
export async function duplicateOffer(id) {
  const session = await requireSession();
  const sql = getSql();
  if (!sql) return fail('No database is configured on this machine.');

  const [source] = await sql`select * from offers where id = ${id} limit 1`;
  if (!source) return fail('That offer is no longer there.');

  const title = `${source.title} (copy)`.slice(0, 160);
  const slug = await uniqueSlug(sql, slugify(title));

  const [created] = await sql`
    insert into offers
      (slug, kind, title, subtitle, body, code, value_type, value,
       applies_to, placement, media_slug, starts_at, ends_at, schedule, priority, is_active)
    values
      (${slug}, ${source.kind}, ${title}, ${source.subtitle}, ${source.body}, ${source.code},
       ${source.value_type}, ${source.value},
       ${JSON.stringify(source.applies_to ?? {})}::jsonb,
       ${JSON.stringify(source.placement ?? {})}::jsonb,
       ${source.media_slug}, null, null,
       ${source.schedule ? JSON.stringify(source.schedule) : null}::jsonb,
       ${source.priority}, false)
    returning id, slug
  `;

  revalidatePath('/offers');
  await recordChange({
    actor: session.email,
    action: 'offer.duplicate',
    entity: 'offer',
    entityId: created.id,
    detail: { from: source.slug, slug: created.slug },
  });

  return { ok: true, id: created.id };
}

export async function setOfferActive(id, isActive) {
  const session = await requireSession();
  const sql = getSql();
  if (!sql) return fail('No database is configured on this machine.');

  const [saved] = await sql`
    update offers set is_active = ${Boolean(isActive)}, updated_at = now()
    where id = ${id}
    returning id, slug, is_active
  `;
  if (!saved) return fail('That offer is no longer there.');

  revalidatePath('/offers');
  await recordChange({
    actor: session.email,
    action: saved.is_active ? 'offer.resume' : 'offer.pause',
    entity: 'offer',
    entityId: saved.id,
    detail: { slug: saved.slug },
  });

  return { ok: true };
}

export async function deleteOffer(id) {
  const session = await requireSession();
  const sql = getSql();
  if (!sql) return fail('No database is configured on this machine.');

  const [removed] = await sql`delete from offers where id = ${id} returning id, slug, title`;
  if (!removed) return fail('That offer is no longer there.');

  revalidatePath('/offers');
  await recordChange({
    actor: session.email,
    action: 'offer.delete',
    entity: 'offer',
    entityId: removed.id,
    detail: { slug: removed.slug, title: removed.title },
  });

  return { ok: true };
}
