import { redirect } from 'next/navigation';
import { endSession } from '@/server/session';

/** A form post rather than a link, so a prefetch can never sign you out. */
export async function POST() {
  await endSession();
  redirect('/login');
}
