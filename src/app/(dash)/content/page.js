import { Page, PageHead, Section } from '@/components/ui';
import { getSql, hasDatabase } from '@/lib/db';
import ContentScreen from './ContentScreen';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Page copy' };

const KEYS = ['story', 'values', 'franchise', 'quickFacts'];

/** One query for all four rows; a missing row is simply an empty block. */
async function loadBlocks() {
  const sql = getSql();
  const rows = await sql`
    select key, value, updated_at from content_blocks where key = any(${KEYS}::text[])
  `;

  const blocks = {};
  for (const row of rows) blocks[row.key] = row.value;

  const edited = rows
    .map((row) => new Date(row.updated_at).getTime())
    .sort((a, b) => b - a)
    .at(0);

  return { blocks, edited };
}

export default async function ContentPage() {
  if (!hasDatabase) {
    return (
      <Page>
        <PageHead title="Page copy" />
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

  const { blocks, edited } = await loadBlocks();

  const lastEdited = edited
    ? new Intl.DateTimeFormat('en-GB', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
        timeZone: 'Asia/Kolkata',
      }).format(new Date(edited))
    : null;

  return (
    <Page>
      <PageHead
        title="Page copy"
        meta={
          lastEdited
            ? `The long-form writing on the about and franchise pages · last edited ${lastEdited}`
            : 'The long-form writing on the about and franchise pages'
        }
      />

      <Section>
        <ContentScreen blocks={blocks} />
      </Section>
    </Page>
  );
}
