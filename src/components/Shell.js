'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BookOpen,
  ExternalLink,
  FileText,
  Images,
  LayoutGrid,
  LogOut,
  MailOpen,
  MessageSquareText,
  Settings,
  Tag,
} from 'lucide-react';
import { cx } from '@/lib/utils';

/**
 * The admin frame: a fixed rail on a wide screen, a slide-over on a phone.
 *
 * Navigation is one flat list — this is a tool for six people who each open it
 * once a week, so nothing is nested behind a disclosure they would have to
 * learn.
 */

const NAV = [
  { href: '/', label: 'Overview', icon: LayoutGrid, exact: true },
  { href: '/menu', label: 'Menu', icon: BookOpen },
  { href: '/offers', label: 'Offers & deals', icon: Tag },
  { href: '/media', label: 'Photographs', icon: Images },
  { href: '/placements', label: 'Where they appear', icon: LayoutGrid },
  { href: '/content', label: 'Page copy', icon: FileText },
  { href: '/faqs', label: 'FAQs', icon: MessageSquareText },
  { href: '/enquiries', label: 'Enquiries', icon: MailOpen },
  { href: '/settings', label: 'Settings', icon: Settings },
];

const SITE = process.env.NEXT_PUBLIC_SITE_ORIGIN || 'http://localhost:3000';

export default function Shell({ session, children }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // The drawer closes when a link is used rather than by watching the path,
  // which keeps the state change out of an effect body.
  const close = () => setOpen(false);

  useEffect(() => {
    document.body.dataset.lock = open ? 'true' : 'false';
  }, [open]);

  const isActive = (item) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

  const nav = (
    <nav className="flex flex-col gap-[2px]" aria-label="Sections">
      {NAV.map((item) => {
        const Icon = item.icon;
        const active = isActive(item);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={close}
            aria-current={active ? 'page' : undefined}
            className={cx(
              'relative flex items-center gap-3 px-4 py-[10px] text-[0.8125rem] transition-colors',
              active
                ? 'bg-ink-wash/40 text-paper'
                : 'text-paper-dim hover:bg-ink-wash/25 hover:text-paper'
            )}
          >
            {active ? (
              <span className="absolute inset-y-0 left-0 w-[3px] bg-stamp" aria-hidden="true" />
            ) : null}
            <Icon size={16} strokeWidth={1.6} className="shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const foot = (
    <div className="mt-auto border-t border-ink-wash px-4 py-4">
      <p className="t-label text-paper-dim">Signed in</p>
      <p className="mt-1 truncate text-[0.8125rem] text-paper">{session?.email}</p>

      <a
        href={SITE}
        target="_blank"
        rel="noreferrer"
        className="mt-4 flex items-center gap-2 text-[0.75rem] text-paper-dim transition-colors hover:text-brass"
      >
        <ExternalLink size={13} strokeWidth={1.6} />
        View the site
      </a>

      <form action="/logout" method="post" className="mt-3">
        <button
          type="submit"
          className="flex items-center gap-2 text-[0.75rem] text-paper-dim transition-colors hover:text-stamp"
        >
          <LogOut size={13} strokeWidth={1.6} />
          Sign out
        </button>
      </form>
    </div>
  );

  return (
    <div className="min-h-svh lg:pl-[var(--sidebar-w)]">
      {/* ── rail ──────────────────────────────────────────────────────── */}
      <aside
        className={cx(
          'on-navy fixed inset-y-0 left-0 z-50 flex w-[var(--sidebar-w)] flex-col bg-ink-deep transition-transform duration-[240ms] lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
        style={{ transitionTimingFunction: 'var(--ease-out)' }}
      >
        <div className="flex h-[var(--topbar-h)] items-center border-b border-ink-wash px-4">
          <Link href="/" className="font-[family-name:var(--font-display)] text-[1.0625rem] font-semibold uppercase tracking-[0.16em] text-paper">
            Binileaf
          </Link>
          <span className="t-label ml-auto text-brass">Admin</span>
        </div>

        <div className="flex-1 overflow-y-auto py-3">{nav}</div>
        {foot}
      </aside>

      {open ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-ink-deep/60 lg:hidden"
        />
      ) : null}

      {/* ── topbar (phone) ────────────────────────────────────────────── */}
      <header className="on-navy sticky top-0 z-30 flex h-[var(--topbar-h)] items-center gap-3 border-b border-ink-wash bg-ink-deep px-4 text-paper lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          aria-expanded={open}
          className="relative -ml-2 inline-flex h-11 w-11 items-center justify-center"
        >
          <span className="relative block h-[12px] w-[20px]" aria-hidden="true">
            <span className="absolute left-0 top-0 h-[1.5px] w-[20px] bg-paper" />
            <span className="absolute left-0 top-[5px] h-[1.5px] w-[12px] bg-stamp" />
            <span className="absolute left-0 top-[10px] h-[1.5px] w-[16px] bg-paper" />
          </span>
        </button>

        <span className="font-[family-name:var(--font-display)] text-[0.9375rem] font-semibold uppercase tracking-[0.16em]">
          Binileaf
        </span>
        <span className="t-label ml-auto text-brass">Admin</span>
      </header>

      <main className="min-w-0">{children}</main>
    </div>
  );
}
