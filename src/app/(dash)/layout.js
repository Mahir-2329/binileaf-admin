import Shell from '@/components/Shell';
import { ToastProvider } from '@/components/ui';
import { requireSession } from '@/server/session';

/** Everything in this group is behind the session and wears the admin frame. */
export default async function DashLayout({ children }) {
  const session = await requireSession();

  return (
    <ToastProvider>
      <Shell session={session}>{children}</Shell>
    </ToastProvider>
  );
}
