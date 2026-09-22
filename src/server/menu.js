'use server';

import { revalidatePath } from 'next/cache';
import { getSql, hasDatabase } from '@/lib/db';
import { requireSession } from '@/server/session';
import { recordChange } from '@/server/audit';

/**
 * Every write the menu editor makes.
 *
 * Three rules hold throughout:
 *
 *  1. Nothing runs before `requireSession()`. Server Actions are reachable by
 *     a bare POST, not only through our own buttons, so the check belongs in
 *     the action and not in the page that renders the button.
 *  2. Actions return `{ ok }` rather than throwing. The editor is a form over
 *     a database with real constraints, and a café owner should read "the was
 *     price is lower than the price", not a Postgres error code.
 *  3. Anything that changes structure finishes by renumbering `position`
 *     0..n for the parents it touched — see `compactItems` / `compactGroups`.
 */

/* ──────────────────────────────────────────────────────────── replies ──── */

// `ts` gives the client a value that changes on every reply, so a form can
// tell "saved again" from the success it already reacted to.
const ok = (extra = {}) => ({ ok: true, ts: Date.now(), ...extra });
const fail = (error, field = null) => ({ ok: false, error, field, ts: Date.now() });

const NO_DB = 'No database is configured on this machine, so nothing was saved.';

/* ───────────────────────────────────────────────────────────── values ──── */

const str = (form, key) => {
  const value = form.get(key);
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed || null;
};

const bool = (form, key) => form.get(key) === 'on' || form.get(key) === 'true';

/** Blank means "not set" — an empty price box is not the number zero. */
function whole(form, key) {
  const raw = form.get(key);
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const n = Number(raw.trim());
  return Number.isInteger(n) ? n : NaN;
}

const FAMILIES = new Set(['bean', 'leaf', 'ink']);

/** Title to anchor id. Matches the slugs already in the table (`hot-coffee`). */
function slugify(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

// A slug belonging to a deleted row is free again — that is what the partial
// unique indexes in the schema say, and these have to agree with them.
const SLUG_TAKEN = {
  section: (sql, slug) =>
    sql`select id from menu_sections where slug = ${slug} and deleted_at is null limit 1`,
  group: (sql, slug) =>
    sql`select id from menu_groups where slug = ${slug} and deleted_at is null limit 1`,
  item: (sql, slug) =>
    sql`select id from menu_items where slug = ${slug} and deleted_at is null limit 1`,
};

/**
 * Resolve a slug no other row of `kind` is using.
 *
 * `strict` is the difference between the two ways a slug arrives. When the
 * operator typed one we must not quietly hand back `lemonade-2` — they are
 * setting a public link and need to be told it is taken. When we derived one
 * from a title we suffix until it is free, because a second "Dessert" should
 * still save.
 */
async function freeSlug(sql, kind, wanted, ownId, strict) {
  const base = slugify(wanted);
  if (!base) return { error: 'Give this a name so it can have a web address.' };

  const owner = await SLUG_TAKEN[kind](sql, base);
  if (!owner.length || owner[0].id === ownId) return { slug: base };
  if (strict) return { error: `The web address "${base}" is already used by something else.` };

  for (let n = 2; n < 60; n += 1) {
    const candidate = `${base}-${n}`;
    // Sequential on purpose: each try only matters if the one before it failed.
    const held = await SLUG_TAKEN[kind](sql, candidate);
    if (!held.length || held[0].id === ownId) return { slug: candidate };
  }
  return { error: 'Could not find a free web address for this name.' };
}

/* ─────────────────────────────────────────────────────── renumbering ──── */

/**
 * Positions are stored, not derived, so they drift: deleting the third item
 * leaves 0,1,3,4 and moving one out leaves a hole. Nothing breaks — the read
 * is `order by position` and gaps sort the same — but every later reorder
 * would have to reason about them, and a hole is one more thing to be wrong.
 *
 * So after a structural change the affected parents are renumbered 0..n in
 * ONE statement: a window function numbers the rows inside each parent in
 * their current order and writes the result back. One round trip however many
 * rows moved, and running it twice changes nothing.
 */
const compactItems = (sql, groupIds) => sql`
  update menu_items as i
  set position = v.rn, updated_at = now()
  from (
    select id,
           (row_number() over (partition by group_id order by position, created_at)) - 1 as rn
    from menu_items
    where group_id = any(${groupIds}::uuid[]) and deleted_at is null
  ) as v
  where i.id = v.id and i.position is distinct from v.rn
`;

const compactGroups = (sql, sectionIds) => sql`
  update menu_groups as g
  set position = v.rn, updated_at = now()
  from (
    select id,
           (row_number() over (partition by section_id order by position, created_at)) - 1 as rn
    from menu_groups
    where section_id = any(${sectionIds}::uuid[]) and deleted_at is null
  ) as v
  where g.id = v.id and g.position is distinct from v.rn
`;

/** Shared tail: one revalidate, one audit line, one reply. */
async function settle(session, entry, extra) {
  revalidatePath('/menu');
  await recordChange({ actor: session.email, ...entry });
  return ok(extra);
}

/* ────────────────────────────────────────────────────────────── items ──── */

/**
 * Create or update one item; `id` in the form decides which.
 *
 * The `compare_price > price` rule is a check constraint in the database as
 * well. It is repeated here so the operator gets a sentence instead of a 500,
 * and so the reply can name the box that caused it.
 */
export async function saveItem(_previous, form) {
  const session = await requireSession();
  if (!hasDatabase) return fail(NO_DB);
  const sql = getSql();

  const id = str(form, 'id');
  const groupId = str(form, 'groupId');
  const name = str(form, 'name');
  const price = whole(form, 'price');
  const comparePrice = whole(form, 'comparePrice');

  if (!groupId) return fail('Choose a category for this item.', 'groupId');
  if (!name) return fail('An item needs a name.', 'name');
  if (price === null || Number.isNaN(price)) return fail('Give a price in whole rupees.', 'price');
  if (price < 0) return fail('A price cannot be less than nothing.', 'price');
  if (Number.isNaN(comparePrice)) {
    return fail('The was price must be a whole number of rupees.', 'comparePrice');
  }
  if (comparePrice !== null && comparePrice <= price) {
    return fail(
      `The was price has to be more than what you charge now (₹${price}) — that is the point of the line through it. Leave it empty if this is not a deal.`,
      'comparePrice'
    );
  }

  const description = str(form, 'description');
  const note = str(form, 'note');
  const isStar = bool(form, 'isStar');
  const isNew = bool(form, 'isNew');
  const isAvailable = bool(form, 'isAvailable');
  const isActive = bool(form, 'isActive');

  if (id) {
    // A rename never touches the slug: something may already link to it.
    const [row] = await sql`
      update menu_items set
        group_id = ${groupId}, name = ${name}, description = ${description},
        price = ${price}, compare_price = ${comparePrice}, note = ${note},
        is_star = ${isStar}, is_new = ${isNew},
        is_available = ${isAvailable}, is_active = ${isActive},
        updated_at = now()
      where id = ${id}
      returning id, group_id
    `;
    if (!row) return fail('That item is no longer there — reload the page.');

    await compactItems(sql, [row.group_id]);

    return settle(session, {
      action: 'menu.item.update',
      entity: 'menu_item',
      entityId: id,
      detail: { name, price },
    });
  }

  const slug = await freeSlug(sql, 'item', name, null, false);
  if (slug.error) return fail(slug.error, 'name');

  const [row] = await sql`
    insert into menu_items
      (group_id, slug, name, description, price, compare_price, note,
       is_star, is_new, is_available, is_active, position)
    values
      (${groupId}, ${slug.slug}, ${name}, ${description}, ${price}, ${comparePrice}, ${note},
       ${isStar}, ${isNew}, ${isAvailable}, ${isActive},
       (select coalesce(max(position) + 1, 0) from menu_items
          where group_id = ${groupId} and deleted_at is null))
    returning id
  `;

  return settle(
    session,
    { action: 'menu.item.create', entity: 'menu_item', entityId: row.id, detail: { name, price } },
    { createdId: row.id }
  );
}

/** The quick switches on a row: star, new, available, active. */
export async function setItemFlag({ id, field, value }) {
  const session = await requireSession();
  if (!hasDatabase) return fail(NO_DB);
  if (!id) return fail('That item is no longer there — reload the page.');

  const sql = getSql();
  const on = Boolean(value);
  let row;

  // A column name cannot be interpolated into a tagged template, and four
  // branches are the honest way to say which four columns a click may reach.
  if (field === 'isStar') {
    [row] = await sql`update menu_items set is_star = ${on}, updated_at = now() where id = ${id} returning name`;
  } else if (field === 'isNew') {
    [row] = await sql`update menu_items set is_new = ${on}, updated_at = now() where id = ${id} returning name`;
  } else if (field === 'isAvailable') {
    [row] = await sql`update menu_items set is_available = ${on}, updated_at = now() where id = ${id} returning name`;
  } else if (field === 'isActive') {
    [row] = await sql`update menu_items set is_active = ${on}, updated_at = now() where id = ${id} returning name`;
  } else {
    return fail('That switch is not one this screen can change.');
  }

  if (!row) return fail('That item is no longer there — reload the page.');

  return settle(session, {
    action: 'menu.item.flag',
    entity: 'menu_item',
    entityId: id,
    detail: { field, value: on, name: row.name },
  });
}

/** The daily 86 list, for a whole selection at once. */
export async function setItemsAvailability({ ids, available }) {
  const session = await requireSession();
  if (!hasDatabase) return fail(NO_DB);
  if (!ids?.length) return fail('Nothing was selected.');

  const sql = getSql();
  const on = Boolean(available);
  await sql`
    update menu_items set is_available = ${on}, updated_at = now()
    where id = any(${ids}::uuid[])
  `;

  return settle(session, {
    action: 'menu.item.availability',
    entity: 'menu_item',
    entityId: ids.length === 1 ? ids[0] : null,
    detail: { count: ids.length, available: on },
  });
}

/** Move one item, or a whole selection, into another category. */
export async function moveItems({ ids, groupId }) {
  const session = await requireSession();
  if (!hasDatabase) return fail(NO_DB);
  if (!ids?.length) return fail('Nothing was selected.');
  if (!groupId) return fail('Choose the category to move these into.');

  const sql = getSql();
  const from = await sql`
    select distinct group_id from menu_items
    where id = any(${ids}::uuid[]) and deleted_at is null
  `;

  // They land after whatever is already in the target, in the order they were
  // listed, so moving five rows keeps those five in the same sequence.
  await sql`
    update menu_items as i
    set group_id = ${groupId},
        position = (select coalesce(max(position) + 1, 0) from menu_items
                      where group_id = ${groupId} and deleted_at is null)
                   + v.pos - 1,
        updated_at = now()
    from unnest(${ids}::uuid[]) with ordinality as v(id, pos)
    where i.id = v.id and i.group_id <> ${groupId}
  `;

  const touched = [...new Set([groupId, ...from.map((row) => row.group_id)])];
  await compactItems(sql, touched);

  return settle(session, {
    action: 'menu.item.move',
    entity: 'menu_item',
    entityId: ids.length === 1 ? ids[0] : null,
    detail: { count: ids.length, groupId },
  });
}

/**
 * Persist an order the operator has already watched happen on screen.
 *
 * `ids` is the whole category in its new order, so one statement settles it:
 * `with ordinality` hands each id its index and the row takes index - 1. The
 * `group_id` guard means a stale list — someone moved an item away in another
 * tab — can renumber nothing outside this category.
 */
export async function reorderItems({ groupId, ids }) {
  const session = await requireSession();
  if (!hasDatabase) return fail(NO_DB);
  if (!groupId || !ids?.length) return fail('Nothing to reorder.');

  const sql = getSql();
  await sql`
    update menu_items as i
    set position = v.pos - 1, updated_at = now()
    from unnest(${ids}::uuid[]) with ordinality as v(id, pos)
    where i.id = v.id and i.group_id = ${groupId}
  `;

  return settle(session, {
    action: 'menu.item.reorder',
    entity: 'menu_group',
    entityId: groupId,
    detail: { count: ids.length },
  });
}

export async function deleteItem({ id }) {
  const session = await requireSession();
  if (!hasDatabase) return fail(NO_DB);

  const sql = getSql();
  // Archived, not erased: the row stays, off the card and out of every list.
  const [row] = await sql`
    update menu_items
    set deleted_at = now(), is_active = false, updated_at = now()
    where id = ${id} and deleted_at is null
    returning name, group_id
  `;
  if (!row) return fail('That item was already gone.');

  await compactItems(sql, [row.group_id]);

  return settle(session, {
    action: 'menu.item.delete',
    entity: 'menu_item',
    entityId: id,
    detail: { name: row.name },
  });
}

/* ─────────────────────────────────────────────────────────── categories ──── */

export async function saveGroup(_previous, form) {
  const session = await requireSession();
  if (!hasDatabase) return fail(NO_DB);
  const sql = getSql();

  const id = str(form, 'id');
  const sectionId = str(form, 'sectionId');
  const title = str(form, 'title');
  const note = str(form, 'note');
  const family = str(form, 'family') ?? 'ink';
  const isActive = bool(form, 'isActive');
  const typed = str(form, 'slug');

  if (!sectionId) return fail('Choose which part of the menu this sits in.', 'sectionId');
  if (!title) return fail('A category needs a name.', 'title');
  if (!FAMILIES.has(family)) return fail('Pick coffee, tea or plain.', 'family');

  const slug = await freeSlug(sql, 'group', typed ?? title, id, Boolean(typed));
  if (slug.error) return fail(slug.error, typed ? 'slug' : 'title');

  if (id) {
    const [before] = await sql`
      select section_id from menu_groups where id = ${id} and deleted_at is null
    `;
    if (!before) return fail('That category is no longer there — reload the page.');

    const moved = before.section_id !== sectionId;

    // Staying put keeps its place in the section; arriving somewhere new goes
    // to the end, because there is no sensible index to claim in a list it has
    // never been in.
    const [row] = await sql`
      update menu_groups set
        section_id = ${sectionId}, slug = ${slug.slug}, title = ${title},
        note = ${note}, family = ${family}, is_active = ${isActive},
        position = case
          when section_id = ${sectionId} then position
          else (select coalesce(max(position) + 1, 0) from menu_groups
                  where section_id = ${sectionId} and deleted_at is null)
        end,
        updated_at = now()
      where id = ${id}
      returning id
    `;
    if (!row) return fail('That category is no longer there — reload the page.');

    if (moved) await compactGroups(sql, [sectionId, before.section_id]);

    return settle(session, {
      action: 'menu.group.update',
      entity: 'menu_group',
      entityId: id,
      detail: { title, family, moved },
    });
  }

  const [row] = await sql`
    insert into menu_groups (section_id, slug, title, note, family, is_active, position)
    values (${sectionId}, ${slug.slug}, ${title}, ${note}, ${family}, ${isActive},
            (select coalesce(max(position) + 1, 0) from menu_groups
              where section_id = ${sectionId} and deleted_at is null))
    returning id
  `;

  return settle(
    session,
    {
      action: 'menu.group.create',
      entity: 'menu_group',
      entityId: row.id,
      detail: { title, family },
    },
    { createdId: row.id }
  );
}

/** The same statement as `reorderItems`, one level up. */
export async function reorderGroups({ sectionId, ids }) {
  const session = await requireSession();
  if (!hasDatabase) return fail(NO_DB);
  if (!sectionId || !ids?.length) return fail('Nothing to reorder.');

  const sql = getSql();
  await sql`
    update menu_groups as g
    set position = v.pos - 1, updated_at = now()
    from unnest(${ids}::uuid[]) with ordinality as v(id, pos)
    where g.id = v.id and g.section_id = ${sectionId}
  `;

  return settle(session, {
    action: 'menu.group.reorder',
    entity: 'menu_section',
    entityId: sectionId,
    detail: { count: ids.length },
  });
}

export async function deleteGroup({ id }) {
  const session = await requireSession();
  if (!hasDatabase) return fail(NO_DB);

  const sql = getSql();
  // Counted before the delete, so the log line says what actually went with it.
  const [counted] = await sql`
    select count(*)::int as items
    from menu_items where group_id = ${id} and deleted_at is null
  `;

  const [row] = await sql`
    update menu_groups
    set deleted_at = now(), is_active = false, updated_at = now()
    where id = ${id} and deleted_at is null
    returning title, section_id
  `;
  if (!row) return fail('That category was already gone.');

  // The foreign keys used to cascade the delete. Nothing cascades an archive,
  // so the items go down with it here.
  await sql`
    update menu_items
    set deleted_at = now(), is_active = false, updated_at = now()
    where group_id = ${id} and deleted_at is null
  `;

  await compactGroups(sql, [row.section_id]);

  return settle(session, {
    action: 'menu.group.delete',
    entity: 'menu_group',
    entityId: id,
    detail: { title: row.title, items: counted.items },
  });
}

/* ───────────────────────────────────────────────────────────── sections ──── */

export async function saveSection(_previous, form) {
  const session = await requireSession();
  if (!hasDatabase) return fail(NO_DB);
  const sql = getSql();

  const id = str(form, 'id');
  const title = str(form, 'title');
  const kicker = str(form, 'kicker');
  const blurb = str(form, 'blurb');
  const isActive = bool(form, 'isActive');
  const typed = str(form, 'slug');

  if (!title) return fail('A part of the menu needs a name.', 'title');

  const slug = await freeSlug(sql, 'section', typed ?? title, id, Boolean(typed));
  if (slug.error) return fail(slug.error, typed ? 'slug' : 'title');

  if (id) {
    const [row] = await sql`
      update menu_sections set
        slug = ${slug.slug}, title = ${title}, kicker = ${kicker},
        blurb = ${blurb}, is_active = ${isActive}, updated_at = now()
      where id = ${id}
      returning id
    `;
    if (!row) return fail('That part of the menu is no longer there — reload the page.');

    return settle(session, {
      action: 'menu.section.update',
      entity: 'menu_section',
      entityId: id,
      detail: { title, slug: slug.slug },
    });
  }

  const [row] = await sql`
    insert into menu_sections (slug, title, kicker, blurb, is_active, position)
    values (${slug.slug}, ${title}, ${kicker}, ${blurb}, ${isActive},
            (select coalesce(max(position) + 1, 0) from menu_sections where deleted_at is null))
    returning id
  `;

  return settle(
    session,
    { action: 'menu.section.create', entity: 'menu_section', entityId: row.id, detail: { title } },
    { createdId: row.id }
  );
}

export async function reorderSections({ ids }) {
  const session = await requireSession();
  if (!hasDatabase) return fail(NO_DB);
  if (!ids?.length) return fail('Nothing to reorder.');

  const sql = getSql();
  await sql`
    update menu_sections as s
    set position = v.pos - 1, updated_at = now()
    from unnest(${ids}::uuid[]) with ordinality as v(id, pos)
    where s.id = v.id
  `;

  return settle(session, {
    action: 'menu.section.reorder',
    entity: 'menu_section',
    entityId: null,
    detail: { count: ids.length },
  });
}

export async function deleteSection({ id }) {
  const session = await requireSession();
  if (!hasDatabase) return fail(NO_DB);

  const sql = getSql();
  const [counts] = await sql`
    select
      (select count(*)::int from menu_groups
        where section_id = ${id} and deleted_at is null) as groups,
      (select count(*)::int from menu_items i
         join menu_groups g on g.id = i.group_id
        where g.section_id = ${id} and i.deleted_at is null and g.deleted_at is null) as items
  `;

  const [row] = await sql`
    update menu_sections
    set deleted_at = now(), is_active = false, updated_at = now()
    where id = ${id} and deleted_at is null
    returning title
  `;
  if (!row) return fail('That part of the menu was already gone.');

  // Both levels below it, by hand, for the same reason as above.
  await sql`
    update menu_items as i
    set deleted_at = now(), is_active = false, updated_at = now()
    from menu_groups as g
    where g.id = i.group_id and g.section_id = ${id} and i.deleted_at is null
  `;
  await sql`
    update menu_groups
    set deleted_at = now(), is_active = false, updated_at = now()
    where section_id = ${id} and deleted_at is null
  `;

  // Sections have no parent, so the renumbering covers the whole table.
  await sql`
    update menu_sections as s
    set position = v.rn, updated_at = now()
    from (
      select id, (row_number() over (order by position, created_at)) - 1 as rn
      from menu_sections
      where deleted_at is null
    ) as v
    where s.id = v.id and s.position is distinct from v.rn
  `;

  return settle(session, {
    action: 'menu.section.delete',
    entity: 'menu_section',
    entityId: id,
    detail: { title: row.title, groups: counts.groups, items: counts.items },
  });
}
