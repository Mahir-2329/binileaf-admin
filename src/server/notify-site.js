import 'server-only';

/**
 * Tells the site to rebuild the pages an edit affects.
 *
 * The site's pages are statically rendered with a long revalidate window, so
 * without this a corrected price would sit unseen for minutes. Every mutation
 * already calls `recordChange`, which calls this — one integration point rather
 * than a line to remember in thirty server actions.
 *
 * Fire-and-forget on purpose: the café's edit has already been written to
 * Postgres and must not fail because the site happens to be down or not running
 * locally. A missed ping costs the revalidate window, nothing more.
 */
export function notifySite(entity) {
  const origin = process.env.NEXT_PUBLIC_SITE_ORIGIN;
  const secret = process.env.REVALIDATE_SECRET;

  if (!origin || !secret) return;

  fetch(new URL('/api/revalidate', origin), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-revalidate-secret': secret },
    body: JSON.stringify({ entity }),
    // Never let a slow or missing site hold up the response to the operator.
    signal: AbortSignal.timeout(2500),
  }).catch((error) => {
    console.warn(`[binileaf-admin] could not revalidate the site: ${error.message}`);
  });
}

/**
 * Map an audited entity name onto the group of pages the site rebuilds. The
 * site knows the paths; this only has to name the kind of thing that changed.
 */
export function entityGroup(entity) {
  const name = String(entity ?? '').toLowerCase();

  if (name.startsWith('menu')) return 'menu';
  if (name.startsWith('offer')) return 'offer';
  if (name.startsWith('placement')) return 'placement';
  if (name.startsWith('media')) return 'media';
  if (name.startsWith('content')) return 'content';
  if (name.startsWith('faq')) return 'faq';
  if (name.startsWith('setting')) return 'settings';

  return null; // unknown: the site falls back to rebuilding everything
}
