'use client';

import { useMemo, useState, useTransition } from 'react';
import { Copy, Pause, Play, Plus, SquarePen, Trash2 } from 'lucide-react';
import { Confirm, Empty, Modal, Page, PageHead, Section, useToast } from '@/components/ui';
import { cx } from '@/lib/utils';
import { deleteOffer, duplicateOffer, saveOffer, setOfferActive } from '@/server/offers';
import { OFFER_STATES, scheduleSentence, valueLabel, when, windowSentence } from './state';
import OfferForm from './OfferForm';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'running', label: 'Running' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'paused', label: 'Paused' },
  { value: 'ended', label: 'Ended' },
];

/** "Hot Coffee, Tea and 2 drinks · over ₹500" — or the honest "the whole menu". */
function appliesSentence(appliesTo, groups) {
  const parts = [];

  const groupNames = (appliesTo?.groups ?? [])
    .map((slug) => groups.find((group) => group.slug === slug)?.title ?? slug)
    .filter(Boolean);

  if (groupNames.length) parts.push(groupNames.join(', '));

  const itemCount = appliesTo?.items?.length ?? 0;
  if (itemCount) parts.push(`${itemCount} item${itemCount === 1 ? '' : 's'}`);

  if (!parts.length) parts.push('The whole menu');
  if (appliesTo?.min_spend) parts.push(`over ₹${appliesTo.min_spend}`);

  return parts.join(' · ');
}

function placementSentence(placement) {
  const shown = [];
  if (placement?.home_band) shown.push('Home page band');
  if (placement?.menu_top) shown.push('Top of the menu');
  return shown.length ? shown.join(' · ') : 'Nowhere yet — pick a placement to show it';
}

export default function OffersScreen({ offers, groups, items }) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState(null); // null = closed, {} = new

  const counts = useMemo(() => {
    const tally = { all: offers.length };
    for (const offer of offers) tally[offer.state] = (tally[offer.state] ?? 0) + 1;
    return tally;
  }, [offers]);

  const visible = filter === 'all' ? offers : offers.filter((offer) => offer.state === filter);
  const running = counts.running ?? 0;

  /** Every mutation goes through here so the toast and the error path are identical. */
  const run = (action, okMessage) =>
    new Promise((resolve) => {
      startTransition(async () => {
        const result = await action();
        if (result?.ok) toast(okMessage);
        else toast(result?.error ?? 'That did not save.', 'error');
        resolve(result);
      });
    });

  async function handleSave(payload) {
    const result = await saveOffer(payload);
    if (result.ok) {
      toast(payload.id ? 'Offer saved.' : 'Offer created.');
      setEditing(null);
    }
    return result;
  }

  return (
    <Page>
      <PageHead
        title="Offers & deals"
        meta={
          running
            ? `${running} showing on the site right now · ${offers.length} set up in total`
            : `Nothing is showing on the site right now · ${offers.length} set up in total`
        }
      >
        <button type="button" className="btn btn--primary" onClick={() => setEditing({})}>
          <Plus size={14} strokeWidth={1.8} aria-hidden="true" />
          New offer
        </button>
      </PageHead>

      {offers.length ? (
        <Section className="pb-0">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by state">
            {FILTERS.map((entry) => (
              <button
                key={entry.value}
                type="button"
                className="chip min-h-[44px]"
                aria-pressed={filter === entry.value}
                onClick={() => setFilter(entry.value)}
              >
                {entry.label}
                <span className="tabular opacity-60">{counts[entry.value] ?? 0}</span>
              </button>
            ))}
          </div>
        </Section>
      ) : null}

      <Section>
        {!offers.length ? (
          <Empty
            title="No offers yet"
            body="An offer is anything the café wants the site to shout about — money off, a combo, a happy hour, or just a line of news. Create one, pick where it shows, and the site prints it in stamp red."
          >
            <button type="button" className="btn btn--primary" onClick={() => setEditing({})}>
              <Plus size={14} strokeWidth={1.8} aria-hidden="true" />
              New offer
            </button>
          </Empty>
        ) : !visible.length ? (
          <Empty title="Nothing here" body="No offer is in that state at the moment." />
        ) : (
          <ul className={cx('flex flex-col gap-3', pending && 'opacity-70')}>
            {visible.map((offer) => {
              const state = OFFER_STATES[offer.state];
              const value = valueLabel(offer);
              const recurrence = scheduleSentence(offer.schedule);

              return (
                <li key={offer.id} className="panel p-4 lg:p-5">
                  <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cx('tag', state.tone)}>{state.label}</span>
                        {value ? <span className="tag tag--brass">{value}</span> : null}
                        {offer.code ? <span className="tag tag--muted">{offer.code}</span> : null}
                        {offer.priority ? (
                          <span className="t-meta tabular">Priority {offer.priority}</span>
                        ) : null}
                      </div>

                      <h2 className="t-h2 mt-3 break-words">{offer.title}</h2>
                      {offer.subtitle ? (
                        <p className="t-meta mt-1 break-words">{offer.subtitle}</p>
                      ) : null}

                      <dl className="mt-3 flex flex-col gap-1 text-[0.8125rem]">
                        <div className="flex flex-wrap gap-x-2">
                          <dt className="t-meta w-[72px] shrink-0">Window</dt>
                          <dd className="min-w-0 flex-1">{windowSentence(offer)}</dd>
                        </div>
                        {recurrence ? (
                          <div className="flex flex-wrap gap-x-2">
                            <dt className="t-meta w-[72px] shrink-0">Repeats</dt>
                            <dd className="min-w-0 flex-1">{recurrence}</dd>
                          </div>
                        ) : null}
                        <div className="flex flex-wrap gap-x-2">
                          <dt className="t-meta w-[72px] shrink-0">Applies to</dt>
                          <dd className="min-w-0 flex-1">
                            {appliesSentence(offer.applies_to, groups)}
                          </dd>
                        </div>
                        <div className="flex flex-wrap gap-x-2">
                          <dt className="t-meta w-[72px] shrink-0">Shows on</dt>
                          <dd className="min-w-0 flex-1">{placementSentence(offer.placement)}</dd>
                        </div>
                      </dl>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm min-h-[44px]"
                        onClick={() => setEditing(offer)}
                      >
                        <SquarePen size={13} strokeWidth={1.8} aria-hidden="true" />
                        Edit
                      </button>

                      <button
                        type="button"
                        className="btn btn--ghost btn--sm min-h-[44px]"
                        onClick={() =>
                          run(
                            () => setOfferActive(offer.id, !offer.is_active),
                            offer.is_active ? 'Offer paused.' : 'Offer switched on.'
                          )
                        }
                      >
                        {offer.is_active ? (
                          <Pause size={13} strokeWidth={1.8} aria-hidden="true" />
                        ) : (
                          <Play size={13} strokeWidth={1.8} aria-hidden="true" />
                        )}
                        {offer.is_active ? 'Pause' : 'Switch on'}
                      </button>

                      <button
                        type="button"
                        className="btn btn--ghost btn--sm min-h-[44px]"
                        onClick={() =>
                          run(
                            () => duplicateOffer(offer.id),
                            'Copied. The copy is switched off with no dates.'
                          )
                        }
                      >
                        <Copy size={13} strokeWidth={1.8} aria-hidden="true" />
                        Duplicate
                      </button>

                      <Confirm
                        title={`Delete “${offer.title}”?`}
                        body="The offer is removed for good, along with everything typed into it. If you only want it off the site, pause it instead."
                        confirmLabel="Delete offer"
                        onConfirm={() => run(() => deleteOffer(offer.id), 'Offer deleted.')}
                      >
                        <button
                          type="button"
                          className="btn btn--danger btn--sm min-h-[44px]"
                          aria-label={`Delete ${offer.title}`}
                        >
                          <Trash2 size={13} strokeWidth={1.8} aria-hidden="true" />
                        </button>
                      </Confirm>
                    </div>
                  </div>

                  <p className="t-meta mt-4 border-t border-ink/10 pt-3">
                    Last edited {when(offer.updated_at)} · <span className="tabular">{offer.slug}</span>
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        wide
        title={editing?.id ? 'Edit offer' : 'New offer'}
        description="What it says, when it runs, what it applies to, and where it shows."
      >
        {editing !== null ? (
          <OfferForm
            key={editing.id ?? 'new'}
            offer={editing.id ? editing : null}
            groups={groups}
            items={items}
            onSave={handleSave}
            onCancel={() => setEditing(null)}
          />
        ) : null}
      </Modal>
    </Page>
  );
}
