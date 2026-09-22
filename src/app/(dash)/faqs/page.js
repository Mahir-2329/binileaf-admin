import { Page, PageHead, Section } from '@/components/ui';
import { getSql, hasDatabase } from '@/lib/db';
import FaqsScreen from './FaqsScreen';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'FAQs' };

export default async function FaqsPage() {
  if (!hasDatabase) {
    return (
      <Page>
        <PageHead title="FAQs" />
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

  // `created_at` breaks the tie so the order is stable while positions are
  // being shuffled — two rows briefly sharing a number must not reshuffle
  // the whole list under the reader.
  const faqs = await sql`
    select id, question, answer, topic, position, is_active
    from faqs
    where deleted_at is null
    order by position, created_at
  `;

  return <FaqsScreen faqs={faqs} />;
}
