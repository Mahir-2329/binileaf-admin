import { Page, PageHead, Section } from '@/components/ui';
import { getSql, hasDatabase } from '@/lib/db';
import { compareOffers, offerState } from './state';
import OffersScreen from './OffersScreen';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Offers & deals' };

/**
 * The offers screen loads three things: the offers themselves, and the real
 * menu categories and items an offer can be pointed at. Those two lists are
 * what keeps `applies_to` honest — the café picks from the menu that exists
 * rather than typing a slug and hoping.
 */
async function load() {
  const sql = getSql();

  const [offers, groups, items] = await Promise.all([
    sql`select * from offers`,
    sql`select slug, title from menu_groups where is_active order by position, title`,
    sql`
      select mi.slug, mi.name, mg.title as group_title
      from menu_items mi
      join menu_groups mg on mg.id = mi.group_id
      where mi.is_active and mi.slug is not null
      order by mg.position, mi.position, mi.name
    `,
  ]);

  // State is computed once, on the server, against a single `now`. Doing it
  // per-row in the browser would drift between the server render and the
  // hydrated one, and a badge that flickers from Running to Ended is worse
  // than one that is a few seconds stale.
  const now = Date.now();

  const rows = offers
    .map((offer) => ({
      ...offer,
      starts_at: offer.starts_at ? new Date(offer.starts_at).toISOString() : null,
      ends_at: offer.ends_at ? new Date(offer.ends_at).toISOString() : null,
      created_at: new Date(offer.created_at).toISOString(),
      updated_at: new Date(offer.updated_at).toISOString(),
      state: offerState(offer, now),
    }))
    .sort(compareOffers);

  return { rows, groups, items };
}

export default async function OffersPage() {
  if (!hasDatabase) {
    return (
      <Page>
        <PageHead title="Offers & deals" />
        <Section>
          <div className="panel p-6">
            <p className="t-serif text-[0.9375rem]">
              No database is configured. Put your Neon connection string in <code>.env</code> as{' '}
              <code>DATABASE_URL</code> and reload.
            </p>
          </div>
        </Section>
      </Page>
    );
  }

  const { rows, groups, items } = await load();

  return <OffersScreen offers={rows} groups={groups} items={items} />;
}
