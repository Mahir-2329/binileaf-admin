import { Page, PageHead, Section } from '@/components/ui';
import { getSql, hasDatabase } from '@/lib/db';
import { requireSession } from '@/server/session';
import MenuEditor from './MenuEditor';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Menu' };

/**
 * The whole menu in one query.
 *
 * Three levels, a few hundred rows: joining them and nesting in JavaScript is
 * one round trip, where a query per level would be sixteen. Unlike the public
 * site this reads retired rows too — the editor has to be able to bring one
 * back, and the count of what is hidden is worth showing.
 *
 * `created_at` is the tie-break on every level so two rows that share a
 * position still come back in the same order twice running; the next write
 * renumbers them apart.
 */
async function loadMenu() {
  const sql = getSql();

  const rows = await sql`
    select
      s.id as section_id, s.slug as section_slug, s.title as section_title,
      s.kicker as section_kicker, s.blurb as section_blurb, s.is_active as section_active,
      g.id as group_id, g.slug as group_slug, g.title as group_title,
      g.note as group_note, g.family as group_family, g.is_active as group_active,
      i.id as item_id, i.name as item_name, i.description as item_description,
      i.price as item_price, i.compare_price as item_compare_price, i.note as item_note,
      i.is_star, i.is_new, i.is_available, i.is_active as item_active
    from menu_sections s
    left join menu_groups g on g.section_id = s.id and g.deleted_at is null
    left join menu_items i on i.group_id = g.id and i.deleted_at is null
    where s.deleted_at is null
    order by s.position, s.created_at, g.position, g.created_at, i.position, i.created_at
  `;

  const sections = new Map();
  const groups = new Map();

  for (const row of rows) {
    if (!sections.has(row.section_id)) {
      sections.set(row.section_id, {
        id: row.section_id,
        slug: row.section_slug,
        title: row.section_title,
        kicker: row.section_kicker,
        blurb: row.section_blurb,
        isActive: row.section_active,
        groups: [],
      });
    }

    if (row.group_id && !groups.has(row.group_id)) {
      const group = {
        id: row.group_id,
        sectionId: row.section_id,
        slug: row.group_slug,
        title: row.group_title,
        note: row.group_note,
        family: row.group_family,
        isActive: row.group_active,
        items: [],
      };
      groups.set(row.group_id, group);
      sections.get(row.section_id).groups.push(group);
    }

    if (row.item_id) {
      groups.get(row.group_id).items.push({
        id: row.item_id,
        groupId: row.group_id,
        name: row.item_name,
        description: row.item_description,
        note: row.item_note,
        price: Number(row.item_price),
        comparePrice: row.item_compare_price == null ? null : Number(row.item_compare_price),
        isStar: row.is_star,
        isNew: row.is_new,
        isAvailable: row.is_available,
        isActive: row.item_active,
      });
    }
  }

  return [...sections.values()];
}

export default async function MenuPage() {
  await requireSession();

  if (!hasDatabase) {
    return (
      <Page>
        <PageHead title="Menu" />
        <Section>
          <div className="panel p-6">
            <p className="t-serif text-[0.9375rem]">
              No database is configured on this machine, so there is no menu to edit. Put your Neon
              connection string in <code>.env</code> as <code>DATABASE_URL</code> and reload.
            </p>
          </div>
        </Section>
      </Page>
    );
  }

  return <MenuEditor data={await loadMenu()} />;
}
