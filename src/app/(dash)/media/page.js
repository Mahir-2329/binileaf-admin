import { Page, PageHead, Section } from '@/components/ui';
import { hasDatabase } from '@/lib/db';
import { listMedia, listUsage } from '@/server/media';
import MediaLibrary from './MediaLibrary';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Photographs' };

export default async function MediaPage() {
  if (!hasDatabase) {
    return (
      <Page>
        <PageHead title="Photographs" />
        <Section>
          <div className="panel p-6">
            <p className="t-serif text-[0.9375rem]">
              No database is configured. The photographs live in Postgres — put your Neon
              connection string in <code>.env</code> as <code>DATABASE_URL</code> and reload.
            </p>
          </div>
        </Section>
      </Page>
    );
  }

  // Both in one trip: the usage map is what makes "where this appears" and the
  // delete warning instant, and it is under a hundred rows.
  const [items, usage] = await Promise.all([listMedia(), listUsage()]);

  const inGallery = items.filter((item) => item.inGallery).length;
  const missingAlt = items.filter((item) => !item.alt.trim()).length;

  return (
    <Page>
      <PageHead
        title="Photographs"
        meta={`${items.length} in the library · ${inGallery} in the public gallery${
          missingAlt ? ` · ${missingAlt} with no alt text` : ''
        }`}
      />
      <MediaLibrary initialItems={items} usage={usage} />
    </Page>
  );
}
