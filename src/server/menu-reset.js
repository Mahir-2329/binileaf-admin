'use server';

import { revalidatePath } from 'next/cache';
import { getSql } from '@/lib/db';
import { menu as printedCard } from '@/data/menu-default';
import { requireSession } from './session';
import { recordChange } from './audit';

/**
 * Put the menu back to the printed card.
 *
 * This is a real undo for a day that went wrong — somebody renamed six things,
 * moved a category and cannot remember what it was. It rebuilds
 * `menu_sections` / `menu_groups` / `menu_items` from
 * `src/data/menu-default.js`, which is the November 2025 card transcribed.
 *
 * It is destructive and it says so: every edit made since — new items, moved
 * categories, changed prices, offers' `applies_to` references to items that no
 * longer exist — is gone. `summariseReset()` exists so the confirmation can
 * state the actual cost before anyone presses the button.
 */

/** Which rule colour a category carries: the bean side or the leaf side. */
const FAMILY = {
  'hot-coffee': 'bean',
  'cold-coffee': 'bean',
  'iced-coffee': 'bean',
  'hot-chocolate': 'bean',
  tea: 'leaf',
  'ice-tea': 'leaf',
  lemonade: 'leaf',
  mocktails: 'leaf',
};

const slugify = (value) =>
  value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const cardCounts = () => ({
  sections: printedCard.length,
  groups: printedCard.reduce((n, section) => n + section.groups.length, 0),
  items: printedCard.reduce(
    (n, section) => n + section.groups.reduce((m, group) => m + group.items.length, 0),
    0
  ),
});

/**
 * What the reset would cost, in the numbers a person can check against what
 * they see on screen. Read-only.
 */
export async function summariseReset() {
  await requireSession();

  const sql = getSql();
  const [current] = await sql`
    select
      (select count(*) from menu_sections) as sections,
      (select count(*) from menu_groups)   as groups,
      (select count(*) from menu_items)    as items
  `;

  const card = cardCounts();

  return {
    current: {
      sections: Number(current.sections),
      groups: Number(current.groups),
      items: Number(current.items),
    },
    card,
    // A blunt but honest signal: the card has fewer items than the database.
    losing: Math.max(0, Number(current.items) - card.items),
  };
}

/**
 * Rebuild the menu from the card.
 *
 * `delete from menu_sections` cascades to groups, items and variants, so one
 * statement clears the tree. It runs inside a transaction: a half-written menu
 * would be worse than the mess it was called to fix.
 */
export async function resetMenuToPrintedCard() {
  const session = await requireSession();
  const sql = getSql();

  const before = await summariseReset();

  await sql.transaction((tx) => {
    const statements = [tx`delete from menu_sections`];

    // The Neon driver's transaction takes a prepared list, so the tree is
    // flattened here rather than inserted with awaited round trips.
    printedCard.forEach((section, sectionPos) => {
      const mediaSlug = section.image?.replace('/media/', '').replace(/\.\w+$/, '') ?? null;

      statements.push(tx`
        insert into menu_sections (slug, title, kicker, blurb, media_slug, position)
        values (${section.id}, ${section.title}, ${section.kicker ?? null},
                ${section.blurb ?? null}, ${mediaSlug}, ${sectionPos})
      `);

      section.groups.forEach((group, groupPos) => {
        statements.push(tx`
          insert into menu_groups (section_id, slug, title, note, family, position)
          select id, ${group.id}, ${group.title}, ${group.note ?? null},
                 ${FAMILY[group.id] ?? 'ink'}, ${groupPos}
          from menu_sections where slug = ${section.id}
        `);

        group.items.forEach((item, itemPos) => {
          statements.push(tx`
            insert into menu_items (group_id, slug, name, price, is_star, note, position)
            select id, ${`${group.id}-${slugify(item.name)}`}, ${item.name},
                   ${item.price}, ${Boolean(item.star)}, ${item.note ?? null}, ${itemPos}
            from menu_groups where slug = ${group.id}
          `);
        });
      });
    });

    return statements;
  });

  await recordChange({
    actor: session.email,
    action: 'Reset the menu to the printed card',
    entity: 'menu',
    detail: { replaced: before.current, restored: before.card },
  });

  revalidatePath('/menu');
  revalidatePath('/');

  return { ok: true, restored: before.card };
}
