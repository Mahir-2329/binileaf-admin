import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Page, PageHead, Section } from '@/components/ui';
import { getSql, hasDatabase } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Overview' };

/** One query for the whole dashboard — every count the café actually asks for. */
async function loadCounts() {
  if (!hasDatabase) return null;

  const sql = getSql();
  const [row] = await sql`
    select
      (select count(*) from menu_items where is_active)                       as items,
      (select count(*) from menu_items where is_active and not is_available)  as unavailable,
      (select count(*) from menu_groups where is_active)                      as categories,
      (select count(*) from media)                                            as photographs,
      (select count(*) from media where in_gallery)                           as in_gallery,
      (select count(*) from offers where is_active)                           as offers,
      (select count(*) from live_offers)                                      as live_offers,
      (select count(*) from enquiries where status = 'new')                   as new_enquiries,
      (select count(*) from faqs where is_active)                             as faqs
  `;
  return row;
}

async function loadRecent() {
  if (!hasDatabase) return { enquiries: [], changes: [] };

  const sql = getSql();
  const [enquiries, changes] = await Promise.all([
    sql`select id, kind, name, email, created_at from enquiries order by created_at desc limit 5`,
    sql`select action, entity, entity_id, actor, created_at from audit_log order by created_at desc limit 6`,
  ]);
  return { enquiries, changes };
}

const when = (value) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    .format(new Date(value));

function Stat({ label, value, note, href }) {
  const body = (
    <>
      <p className="t-label text-pencil">{label}</p>
      <p className="tabular mt-3 font-[family-name:var(--font-display)] text-[2rem] leading-none">
        {value}
      </p>
      {note ? <p className="t-meta mt-2">{note}</p> : null}
      {href ? (
        <ArrowUpRight
          size={14}
          strokeWidth={1.7}
          className="absolute right-4 top-4 text-pencil opacity-0 transition-opacity group-hover:opacity-100"
        />
      ) : null}
    </>
  );

  const className = 'panel group relative p-5';
  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

export default async function OverviewPage() {
  const [counts, recent] = await Promise.all([loadCounts(), loadRecent()]);

  if (!counts) {
    return (
      <Page>
        <PageHead title="Overview" />
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

  return (
    <Page>
      <PageHead title="Overview" meta="Everything on the site, and what has changed lately." />

      <Section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Menu items"
          value={counts.items}
          note={`${counts.categories} categories · ${counts.unavailable} marked unavailable`}
          href="/menu"
        />
        <Stat
          label="Offers running"
          value={counts.live_offers}
          note={`${counts.offers} set up in total`}
          href="/offers"
        />
        <Stat
          label="Photographs"
          value={counts.photographs}
          note={`${counts.in_gallery} shown in the gallery`}
          href="/media"
        />
        <Stat
          label="New enquiries"
          value={counts.new_enquiries}
          note="Unread messages from the site"
          href="/enquiries"
        />
      </Section>

      <Section className="grid gap-5 pt-0 lg:grid-cols-2">
        <div className="panel">
          <div className="panel-head">
            <h2 className="t-h2">Latest enquiries</h2>
            <Link href="/enquiries" className="t-label text-pencil hover:text-stamp">
              All
            </Link>
          </div>

          {recent.enquiries.length ? (
            recent.enquiries.map((row) => (
              <div key={row.id} className="row">
                <span className="tag tag--muted shrink-0">{row.kind}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.8125rem]">{row.name}</p>
                  <p className="t-meta truncate">{row.email}</p>
                </div>
                <span className="t-meta tabular shrink-0">{when(row.created_at)}</span>
              </div>
            ))
          ) : (
            <p className="t-meta p-5">Nothing yet.</p>
          )}
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2 className="t-h2">Recent changes</h2>
          </div>

          {recent.changes.length ? (
            recent.changes.map((row, i) => (
              <div key={`${row.created_at}-${i}`} className="row">
                <span className="tag tag--muted shrink-0">{row.entity}</span>
                <p className="min-w-0 flex-1 truncate text-[0.8125rem]">
                  {row.action}
                  {row.actor ? <span className="t-meta"> · {row.actor}</span> : null}
                </p>
                <span className="t-meta tabular shrink-0">{when(row.created_at)}</span>
              </div>
            ))
          ) : (
            <p className="t-meta p-5">No edits recorded yet.</p>
          )}
        </div>
      </Section>
    </Page>
  );
}
