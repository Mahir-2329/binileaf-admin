import { Page, PageHead, Section } from '@/components/ui';
import { getSql, hasDatabase } from '@/lib/db';
import EnquiriesScreen from './EnquiriesScreen';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Enquiries' };

export default async function EnquiriesPage() {
  if (!hasDatabase) {
    return (
      <Page>
        <PageHead title="Enquiries" />
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

  const sql = getSql();

  // The whole table in one go: a café's contact form, not a support desk.
  // If it ever outgrows that, this is the one query to page.
  const [rows, [tally]] = await Promise.all([
    sql`
      select id, kind, name, email, phone, city, has_property, topic, message,
             status, notes, user_agent, created_at
      from enquiries
      order by created_at desc
      limit 500
    `,
    sql`
      select
        count(*)::int                                        as "all",
        count(*) filter (where status = 'new')::int          as "new",
        count(*) filter (where status = 'read')::int         as "read",
        count(*) filter (where status = 'replied')::int      as "replied",
        count(*) filter (where status = 'spam')::int         as "spam",
        count(*) filter (where kind = 'contact')::int        as "contact",
        count(*) filter (where kind = 'franchise')::int      as "franchise"
      from enquiries
    `,
  ]);

  const enquiries = rows.map((row) => ({
    ...row,
    created_at: new Date(row.created_at).toISOString(),
  }));

  return <EnquiriesScreen enquiries={enquiries} counts={tally} />;
}
