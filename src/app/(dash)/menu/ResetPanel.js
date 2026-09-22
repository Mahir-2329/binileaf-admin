'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { RotateCcw } from 'lucide-react';
import { Confirm, useToast } from '@/components/ui';
import { resetMenuToPrintedCard, summariseReset } from '@/server/menu-reset';
import { plural } from './shared';

/**
 * Put the whole menu back to the printed card.
 *
 * It lives at the foot of the page, in its own bordered plate, away from the
 * everyday controls — this is the one button on the screen that can undo a
 * week of work, and the distance is part of how it is kept safe.
 *
 * The confirmation quotes live counts from `summariseReset()` rather than
 * describing the action in the abstract. "Replaces 15 categories and 83 items"
 * is something the operator can check against what is in front of them;
 * "resets the menu" is not.
 */
export default function ResetPanel({ revision }) {
  const toast = useToast();
  const [busy, startTransition] = useTransition();
  const [summary, setSummary] = useState(null);

  const refresh = useCallback(() => {
    // Read-only, so a failure here is not worth a toast — it only means the
    // button stays disabled and nothing destructive can be reached.
    summariseReset()
      .then(setSummary)
      .catch(() => setSummary(null));
  }, []);

  // The counts have to be right at the moment they are read, so they are taken
  // again after every edit the page has made, and again when the operator
  // reaches for the button.
  useEffect(refresh, [refresh, revision]);

  const body = summary
    ? `Replaces all ${plural(summary.current.groups, 'category', 'categories')} and ${plural(
        summary.current.items,
        'item',
        'items'
      )} with the ${plural(summary.card.groups, 'category', 'categories')} and ${plural(
        summary.card.items,
        'item',
        'items'
      )} on the printed card. Every edit made since is gone, including anything you added today${
        summary.losing
          ? `, and ${plural(summary.losing, 'item', 'items')} more than the card holds will simply not come back`
          : ''
      }.`
    : '';

  const reset = () =>
    new Promise((resolve) => {
      startTransition(async () => {
        const reply = await resetMenuToPrintedCard();

        if (reply?.ok) {
          toast(
            `Menu restored — ${plural(reply.restored.groups, 'category', 'categories')}, ${plural(
              reply.restored.items,
              'item',
              'items'
            )} from the printed card.`
          );
        } else {
          toast('The menu was not reset. Nothing has changed.', 'error');
        }

        resolve();
      });
    });

  return (
    <div className="panel border-stamp/40">
      <div className="panel-head border-stamp/25">
        <h2 className="t-h2">Start again from the printed card</h2>
      </div>

      <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
        <div className="max-w-[62ch]">
          <p className="t-serif text-[0.9375rem]">
            This throws the menu in the database away and rebuilds it from the card the café had
            printed in November 2025 — the physical one, transcribed. It is for the day somebody
            renamed six things, moved a category and cannot remember what any of it was.
          </p>
          <p className="t-serif mt-3 text-[0.9375rem] text-pencil">
            Every item comes back as a new row, so any offer aimed at a particular item stops
            matching and has to be pointed at the new one in Offers &amp; deals. Photographs,
            enquiries and page copy are untouched.
          </p>

          {summary ? (
            <p className="t-meta tabular mt-3">
              Now: {plural(summary.current.groups, 'category', 'categories')},{' '}
              {plural(summary.current.items, 'item', 'items')}. The card:{' '}
              {plural(summary.card.groups, 'category', 'categories')},{' '}
              {plural(summary.card.items, 'item', 'items')}.
            </p>
          ) : (
            <p className="t-meta mt-3">Counting what is in the menu now…</p>
          )}
        </div>

        <Confirm
          title="Reset to the printed card?"
          body={body}
          confirmLabel="Reset the menu"
          onConfirm={reset}
        >
          <button
            type="button"
            className="btn btn--danger shrink-0"
            disabled={!summary || busy}
            onFocus={refresh}
            onPointerEnter={refresh}
          >
            <RotateCcw size={14} strokeWidth={1.8} />
            Reset to the printed card
          </button>
        </Confirm>
      </div>
    </div>
  );
}
