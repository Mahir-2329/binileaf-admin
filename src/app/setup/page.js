import { redirect } from 'next/navigation';
import { getSql, hasDatabase } from '@/lib/db';
import SetupForm from './SetupForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Set up' };

/**
 * Claiming a fresh admin.
 *
 * Reachable only while `admin_users` is empty; the moment an account exists
 * this redirects to the login screen, so the page cannot be used to add a
 * second owner from outside.
 */
export default async function SetupPage() {
  if (!hasDatabase) {
    return (
      <main className="on-navy flex min-h-svh items-center justify-center bg-ink-deep p-6 text-paper">
        <p className="t-serif max-w-[46ch] text-center text-[0.9375rem] italic text-paper-dim">
          No database is configured. Put the Neon connection string in{' '}
          <code>admin/.env</code> as <code>DATABASE_URL</code> and reload.
        </p>
      </main>
    );
  }

  const sql = getSql();
  const [{ n }] = await sql`select count(*)::int as n from admin_users`;
  if (n > 0) redirect('/login');

  return (
    <div className="on-navy flex min-h-svh flex-col bg-ink-deep text-paper">
      <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center px-6 py-16">
        <p className="t-label text-brass">Binileaf</p>
        <h1 className="t-title mt-3 text-paper">Set up the admin</h1>
        <p className="t-serif mt-3 text-[0.9375rem] italic text-paper-dim">
          Nobody has claimed this admin yet. The account you make here owns it — after that
          this page closes for good.
        </p>

        <div className="mt-10">
          <SetupForm />
        </div>
      </div>

      <p className="pb-8 text-center text-[0.6875rem] tracking-[0.12em] text-paper-dim/70">
        BINILEAF CAFÉ · UNIVERSITY AREA, AHMEDABAD
      </p>
    </div>
  );
}
