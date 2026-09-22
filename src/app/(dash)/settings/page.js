import { Page, PageHead, Section } from '@/components/ui';
import { getSql, hasDatabase } from '@/lib/db';
import { mailerConfigured } from '@/lib/auth';
import { requireSession } from '@/server/session';
import SettingsScreen from './SettingsScreen';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Settings' };

const KEYS = ['hours', 'banner', 'ordering'];

export default async function SettingsPage() {
  const session = await requireSession();

  if (!hasDatabase) {
    return (
      <Page>
        <PageHead title="Settings" />
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

  const [rows, accounts] = await Promise.all([
    sql`select key, value from settings where key = any(${KEYS}::text[])`,
    // No password hashes leave the database: this list is for "who can get in
    // and when were they last here", nothing more.
    sql`
      select id, email, name, role, last_login_at, is_active
      from admin_users
      where is_active
      order by role, email
    `,
  ]);

  const settings = {};
  for (const row of rows) settings[row.key] = row.value;

  return (
    <SettingsScreen
      settings={settings}
      accounts={accounts.map((account) => ({
        ...account,
        last_login_at: account.last_login_at
          ? new Date(account.last_login_at).toISOString()
          : null,
      }))}
      mailerConfigured={mailerConfigured()}
      role={session.role}
    />
  );
}
