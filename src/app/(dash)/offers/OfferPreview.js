'use client';

import { valueLabel } from './state';

/**
 * How the offer reads on the site.
 *
 * The site prints a running offer as one full-bleed plate of stamp red on the
 * home page: the value in an uppercase label, the title in Fraunces, the body
 * in italic Newsreader, the code in a hairline box. This is that band at
 * admin scale — same ink, same faces, same order — so what is typed here can
 * be judged before it is switched on.
 *
 * It is an approximation, not an iframe: the real band is full-bleed and sets
 * its type against the page's grid. Sizes are smaller here. Everything else
 * is the same, deliberately.
 */
export default function OfferPreview({ offer }) {
  const value = valueLabel(offer);
  const title = offer.title?.trim() || 'Your offer title';

  return (
    <div>
      <p className="t-label text-pencil">On the site</p>

      <div className="mt-2 bg-stamp px-5 py-6 text-paper">
        {value ? <p className="t-label text-paper/75">{value}</p> : null}

        <h3 className="mt-2 font-[family-name:var(--font-display)] text-[1.25rem] leading-[1.15]">
          {title}
        </h3>

        {offer.subtitle?.trim() ? (
          <p className="t-label mt-3 text-paper/75">{offer.subtitle}</p>
        ) : null}

        {offer.body?.trim() ? (
          <p className="t-serif mt-4 text-[0.9375rem] italic leading-[1.5] text-paper/85">
            {offer.body}
          </p>
        ) : null}

        {offer.code?.trim() ? (
          <p className="t-label mt-5 inline-block border border-paper/45 px-3 py-2">
            Mention &ldquo;{offer.code.trim().toUpperCase()}&rdquo;
          </p>
        ) : null}
      </div>
    </div>
  );
}
