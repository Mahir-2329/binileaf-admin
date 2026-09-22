import { redirect } from 'next/navigation';
import { getSql, hasDatabase } from '@/lib/db';
import LoginForm from './LoginForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sign in' };

/**
 * A sign-in form is useless while no account exists, so a fresh deployment is
 * sent to `/setup` instead of a form nothing can satisfy. Once an account is
 * there, `/setup` sends people straight back here — the two pages are the same
 * door from either side.
 */
async function needsSetup() {
  if (!hasDatabase) return false;

  try {
    const [{ n }] = await getSql()`select count(*)::int as n from admin_users`;
    return n === 0;
  } catch {
    // A database that cannot be reached is not an unclaimed one: show the form.
    return false;
  }
}

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  const next = typeof params?.next === 'string' ? params.next : '/';

  if (await needsSetup()) redirect('/setup');

  return (
    <div className="on-navy flex min-h-svh flex-col bg-ink-deep text-paper">
      <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center px-6 py-16">
        <p className="t-label text-brass">Binileaf</p>
        <h1 className="t-title mt-3 text-paper">Admin</h1>
        <p className="t-serif mt-3 text-[0.9375rem] italic text-paper-dim">
          The menu, the photographs and the copy — all of it, without a deploy.
        </p>

        <div className="mt-10">
          <LoginForm next={next} />
        </div>
      </div>

      <p className="pb-8 text-center text-[0.6875rem] tracking-[0.12em] text-paper-dim/70">
        BINILEAF CAFÉ · UNIVERSITY AREA, AHMEDABAD
      </p>
    </div>
  );
}
