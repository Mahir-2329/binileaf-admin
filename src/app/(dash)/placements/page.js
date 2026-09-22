import { Page, PageHead, Section } from '@/components/ui';
import { hasDatabase } from '@/lib/db';
import { listMedia, listPlacements } from '@/server/media';
import PlacementsBoard from './PlacementsBoard';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Where they appear' };

export default async function PlacementsPage() {
  if (!hasDatabase) {
    return (
      <Page>
        <PageHead title="Where they appear" />
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

  // The whole library comes along so the picker is instant — it is the same
  // list the `/media` screen renders, and it is only the metadata, never bytes.
  const [slots, library] = await Promise.all([listPlacements(), listMedia()]);
  const empty = slots.filter((slot) => !slot.photo).length;

  return (
    <Page>
      <PageHead
        title="Where they appear"
        meta={`${slots.length} photograph slots across the site${empty ? ` · ${empty} empty` : ''}`}
      />
      <PlacementsBoard slots={slots} library={library} />
    </Page>
  );
}
