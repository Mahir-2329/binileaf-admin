'use server';

import 'server-only';
import { createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { getSql, hasDatabase } from '@/lib/db';
import { requireSession } from '@/server/session';
import { recordChange } from '@/server/audit';

/**
 * Everything the photograph library and the placement board read and write.
 *
 * Two rules run through this file:
 *
 * 1. `media.data` (the bytea) is never selected outside the route handler that
 *    streams it. 93 rows × ~450 KB is 40 MB down the wire for a page that only
 *    needs filenames — so every list here names its columns.
 *
 * 2. `slug` and `path` are frozen once a row exists. The path IS the public URL
 *    (`/media/<slug>.<ext>`), it is baked into the site's fallbacks and into
 *    every `media_slug` foreign key, and the bytes are keyed by it. `category`
 *    therefore edits the label only — it does not move the file, because there
 *    is no file to move.
 */

/* ──────────────────────────────────────────────────────────── constants ──── */

const PLACES_TO_REFRESH = ['/media', '/placements', '/'];

/** Everything on `media` except the bytes. */
const LIST_COLUMNS = `id, slug, path, width, height, alt, caption, credit, category, tags,
  orientation, has_alpha, bytes, content_type, source, in_gallery, is_active, position,
  created_at, updated_at`;

/* ───────────────────────────────────────────────────────────── helpers ──── */

const iso = (value) => (value ? new Date(value).toISOString() : null);

/** Rows cross the server/client boundary, so dates become strings and nulls become ''. */
function shape(row) {
  return {
    id: row.id,
    slug: row.slug,
    path: row.path,
    width: row.width,
    height: row.height,
    alt: row.alt ?? '',
    caption: row.caption ?? '',
    credit: row.credit ?? '',
    category: row.category,
    tags: row.tags ?? [],
    orientation: row.orientation ?? 'landscape',
    hasAlpha: Boolean(row.has_alpha),
    bytes: row.bytes ?? 0,
    contentType: row.content_type,
    source: row.source ?? '',
    inGallery: Boolean(row.in_gallery),
    isActive: Boolean(row.is_active),
    position: row.position,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

const text = (value) => (typeof value === 'string' ? value.trim() : '');

function cleanCategory(value) {
  const slug = text(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'misc';
}

/** Tags are lowercase, de-duplicated, and capped so one paste cannot fill the column. */
function cleanTags(value) {
  const list = Array.isArray(value) ? value : String(value ?? '').split(',');
  const seen = [];
  for (const raw of list) {
    const tag = text(raw).toLowerCase().replace(/\s+/g, '-');
    if (tag && !seen.includes(tag)) seen.push(tag);
  }
  return seen.slice(0, 12);
}

/**
 * The public gallery orders by `media.position` among `in_gallery` rows, so that
 * set has to stay a dense 0..n run: with ties, "move up" would be a no-op that
 * looked like a bug. Everything outside the gallery is parked on the 999
 * sentinel the seed uses, so it never interleaves with a real position.
 */
async function renumberGallery(sql) {
  await sql`
    update media as m
    set position = v.ord - 1
    from (
      select id, row_number() over (order by position, created_at, slug) as ord
      from media where in_gallery
    ) as v
    where m.id = v.id and m.position <> v.ord - 1
  `;
  await sql`update media set position = 999 where not in_gallery and position <> 999`;
}

/* ───────────────────────────────────────────────────────────── loading ──── */

export async function listMedia() {
  await requireSession();
  if (!hasDatabase) return [];

  const sql = getSql();
  const rows = await sql`
    select ${sql.unsafe(LIST_COLUMNS)} from media
    order by created_at desc, slug
  `;
  return rows.map(shape);
}

/**
 * Every row anywhere in the database that points at a photograph, in one query.
 *
 * There are five of them (`media_placements`, the three menu levels and
 * `offers`) and together they are well under a hundred rows, so the whole map
 * is loaded with the page rather than fetched per photograph. That is what
 * makes "where this appears" instant, and — more importantly — it is what lets
 * the delete confirmation name the slots it is about to empty *before* the
 * `on delete set null` quietly empties them.
 */
export async function listUsage() {
  await requireSession();
  if (!hasDatabase) return {};

  const sql = getSql();
  const rows = await sql`
      select media_slug as slug, 'placement' as kind, key as ref, label as name,
             page as context, position as ord
      from media_placements where media_slug is not null
    union all
      select media_slug, 'section', slug, title, null::text, position
      from menu_sections where media_slug is not null
    union all
      select media_slug, 'group', slug, title, null::text, position
      from menu_groups where media_slug is not null
    union all
      select media_slug, 'item', coalesce(slug, id::text), name, null::text, position
      from menu_items where media_slug is not null
    union all
      select media_slug, 'offer', slug, title, null::text, priority
      from offers where media_slug is not null
    order by kind, ord, name
  `;

  const map = {};
  for (const row of rows) {
    (map[row.slug] ||= []).push({
      kind: row.kind,
      ref: row.ref,
      name: row.name,
      context: row.context ?? '',
    });
  }
  return map;
}

export async function listPlacements() {
  await requireSession();
  if (!hasDatabase) return [];

  const sql = getSql();
  const rows = await sql`
    select p.key, p.label, p.page, p.hint, p.aspect, p.media_slug, p.position,
           m.path, m.width, m.height, m.alt, m.orientation, m.is_active
    from media_placements p
    left join media m on m.slug = p.media_slug
    order by p.position, p.key
  `;

  return rows.map((row) => ({
    key: row.key,
    label: row.label,
    page: row.page,
    hint: row.hint ?? '',
    aspect: row.aspect ?? '4/5',
    position: row.position,
    slug: row.media_slug ?? null,
    photo: row.path
      ? {
          path: row.path,
          width: row.width,
          height: row.height,
          alt: row.alt ?? '',
          orientation: row.orientation ?? 'landscape',
          isActive: Boolean(row.is_active),
        }
      : null,
  }));
}

/* ───────────────────────────────────────────────────────────── writing ──── */

async function afterWrite(session, entry) {
  for (const path of PLACES_TO_REFRESH) revalidatePath(path);
  await recordChange({ actor: session.email, ...entry });
}

/** The detail panel's save. Slug, path and bytes are not editable — see the header. */
export async function saveMedia(id, patch) {
  const session = await requireSession();
  if (!hasDatabase) throw new Error('No database is configured.');
  if (!id) throw new Error('Which photograph?');

  const alt = text(patch?.alt);
  const category = cleanCategory(patch?.category);
  const tags = cleanTags(patch?.tags);
  const inGallery = Boolean(patch?.inGallery);

  const sql = getSql();
  const [before] = await sql`select slug, in_gallery from media where id = ${id}::uuid`;
  if (!before) throw new Error('That photograph is no longer in the library.');

  await sql`
    update media set
      alt        = ${alt},
      caption    = ${text(patch?.caption) || null},
      credit     = ${text(patch?.credit) || null},
      category   = ${category},
      tags       = ${tags},
      in_gallery = ${inGallery},
      is_active  = ${Boolean(patch?.isActive)},
      updated_at = now()
    where id = ${id}::uuid
  `;

  // Only touch `position` when the row crosses into or out of the gallery —
  // a photograph that was already in it keeps the place the operator gave it.
  // 998 parks it just under the sentinel so the renumber lands it last.
  if (inGallery !== before.in_gallery) {
    await sql`update media set position = ${inGallery ? 998 : 999} where id = ${id}::uuid`;
  }
  await renumberGallery(sql);

  const [row] = await sql`select ${sql.unsafe(LIST_COLUMNS)} from media where id = ${id}::uuid`;
  await afterWrite(session, {
    action: 'media.update',
    entity: 'media',
    entityId: before.slug,
    detail: { alt, category, tags, inGallery, isActive: Boolean(patch?.isActive) },
  });

  return shape(row);
}

/** Bulk: add to or remove from the public gallery. */
export async function setGallery(ids, inGallery) {
  const session = await requireSession();
  if (!hasDatabase) throw new Error('No database is configured.');
  const list = (Array.isArray(ids) ? ids : []).filter(Boolean);
  if (!list.length) throw new Error('Nothing was selected.');

  const sql = getSql();
  await sql`
    update media
    set in_gallery = ${Boolean(inGallery)},
        position = ${inGallery ? 998 : 999},
        updated_at = now()
    where id = any(${list}::uuid[])
  `;
  await renumberGallery(sql);

  await afterWrite(session, {
    action: inGallery ? 'media.gallery.add' : 'media.gallery.remove',
    entity: 'media',
    entityId: null,
    detail: { count: list.length, ids: list },
  });

  return list.length;
}

/** Bulk: relabel the folder several photographs sit in. */
export async function setCategory(ids, category) {
  const session = await requireSession();
  if (!hasDatabase) throw new Error('No database is configured.');
  const list = (Array.isArray(ids) ? ids : []).filter(Boolean);
  if (!list.length) throw new Error('Nothing was selected.');

  const value = cleanCategory(category);
  const sql = getSql();
  await sql`
    update media set category = ${value}, updated_at = now()
    where id = any(${list}::uuid[])
  `;

  await afterWrite(session, {
    action: 'media.category',
    entity: 'media',
    entityId: null,
    detail: { category: value, count: list.length, ids: list },
  });

  return list.length;
}

/**
 * Persist the gallery order as a dense 0..n run.
 *
 * The client sends the whole gallery in its new order rather than "move this
 * one up", so a dropped request can never leave two photographs claiming the
 * same slot — the last write in wins outright.
 */
export async function reorderGallery(ids) {
  const session = await requireSession();
  if (!hasDatabase) throw new Error('No database is configured.');
  const list = (Array.isArray(ids) ? ids : []).filter(Boolean);
  if (!list.length) return 0;

  const sql = getSql();
  await sql`
    update media as m
    set position = v.ord - 1, updated_at = now()
    from unnest(${list}::uuid[]) with ordinality as v(id, ord)
    where m.id = v.id and m.in_gallery
  `;
  // Anything the client did not know about (added in another tab) keeps its old
  // position; the renumber folds it back into the run instead of colliding.
  await renumberGallery(sql);

  await afterWrite(session, {
    action: 'media.reorder',
    entity: 'media',
    entityId: null,
    detail: { count: list.length },
  });

  return list.length;
}

/**
 * Delete a photograph and its bytes.
 *
 * Every `media_slug` foreign key is `on delete set null`, so this cannot fail —
 * it just silently empties whatever pointed here. The usage is read back first
 * and written into the audit line, so the log says what went dark.
 */
export async function deleteMedia(id) {
  const session = await requireSession();
  if (!hasDatabase) throw new Error('No database is configured.');
  if (!id) throw new Error('Which photograph?');

  const sql = getSql();
  const [row] = await sql`select slug, path from media where id = ${id}::uuid`;
  if (!row) throw new Error('That photograph is already gone.');

  const [counts] = await sql`
    select
      (select count(*) from media_placements where media_slug = ${row.slug}) as placements,
      (select count(*) from menu_sections   where media_slug = ${row.slug}) as sections,
      (select count(*) from menu_groups     where media_slug = ${row.slug}) as groups,
      (select count(*) from menu_items      where media_slug = ${row.slug}) as items,
      (select count(*) from offers          where media_slug = ${row.slug}) as offers
  `;

  await sql`delete from media where id = ${id}::uuid`;
  await renumberGallery(sql);

  await afterWrite(session, {
    action: 'media.delete',
    entity: 'media',
    entityId: row.slug,
    detail: { path: row.path, emptied: counts },
  });

  return row.slug;
}

/* ────────────────────────────────────────────────────────── placements ──── */

/** Point a slot at a photograph, or pass null to empty it. */
export async function setPlacement(key, slug) {
  const session = await requireSession();
  if (!hasDatabase) throw new Error('No database is configured.');
  if (!key) throw new Error('Which slot?');

  const value = text(slug) || null;
  const sql = getSql();

  // The column is a foreign key, so a bad slug would be a raw Postgres error in
  // a toast. Check it here and say something a person can act on.
  if (value) {
    const [photo] = await sql`select slug from media where slug = ${value}`;
    if (!photo) throw new Error('That photograph is not in the library any more.');
  }

  const [row] = await sql`
    update media_placements
    set media_slug = ${value}, updated_at = now()
    where key = ${key}
    returning key, label, page, hint, aspect, media_slug, position
  `;
  if (!row) throw new Error('That slot is not in the registry.');

  await afterWrite(session, {
    action: value ? 'placement.set' : 'placement.clear',
    entity: 'media_placement',
    entityId: key,
    detail: { slug: value },
  });

  return row.key;
}

/* ─────────────────────────────────────────────────────────────── upload ──── */

/** `<category>/<kebab-name>`, with `-2`, `-3`… appended until it is free. */
async function uniqueSlug(sql, category, name) {
  const base = text(name)
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

  const stem = `${cleanCategory(category)}/${base || 'photograph'}`;
  const taken = await sql`select slug from media where slug = ${stem} or slug like ${`${stem}-%`}`;
  const used = new Set(taken.map((row) => row.slug));

  if (!used.has(stem)) return stem;
  for (let n = 2; n < 500; n += 1) {
    if (!used.has(`${stem}-${n}`)) return `${stem}-${n}`;
  }
  return `${stem}-${Date.now()}`;
}

/**
 * Store an uploaded photograph, bytes and all.
 *
 * Called only from the upload route handler: a Server Action caps its request
 * body at 1 MB and raising that lives in `next.config.mjs`, which this task does
 * not own — so the multipart parse happens in the route and lands here. The
 * `buffer` argument is a Node Buffer, which is not something a browser can
 * serialise into an action call, so this is not reachable as a public endpoint.
 */
export async function insertUpload(fields) {
  const session = await requireSession();
  if (!hasDatabase) throw new Error('No database is configured.');

  const sql = getSql();
  const category = cleanCategory(fields.category);
  const slug = await uniqueSlug(sql, category, fields.name);
  const path = `/media/${slug}.${fields.extension}`;

  // The checksum is the ETag the media route serves, so it has to be derived
  // from the bytes themselves — two uploads of the same picture must collide.
  const checksum = createHash('sha256').update(fields.buffer).digest('hex').slice(0, 32);


  const alt = text(fields.alt);
  const inGallery = Boolean(fields.inGallery);

  const [inserted] = await sql`
    insert into media (slug, path, width, height, alt, caption, credit, category, tags,
                       has_alpha, bytes, content_type, data, checksum, source,
                       in_gallery, is_active, position)
    values (${slug}, ${path}, ${fields.width}, ${fields.height},
            ${alt}, ${text(fields.caption) || null}, ${text(fields.credit) || null},
            ${category}, ${cleanTags(fields.tags)}, ${Boolean(fields.hasAlpha)},
            ${fields.buffer.length}, ${fields.contentType},
            -- The Neon HTTP driver has no binary parameter type, so the bytes
            -- ride as base64 text and Postgres decodes them into the bytea.
            decode(${fields.buffer.toString('base64')}, 'base64'),
            ${checksum}, 'upload', ${inGallery}, true, ${inGallery ? 998 : 999})
    returning id
  `;

  await renumberGallery(sql);

  await afterWrite(session, {
    action: 'media.upload',
    entity: 'media',
    entityId: slug,
    detail: { path, bytes: fields.buffer.length, width: fields.width, height: fields.height },
  });

  const [row] = await sql`select ${sql.unsafe(LIST_COLUMNS)} from media where id = ${inserted.id}`;
  return shape(row);
}
