'use client';

import { useEffect, useState, useTransition } from 'react';
import { Mail, Phone } from 'lucide-react';
import { Area, Empty, Modal, Page, PageHead, Section, SubmitButton, useToast } from '@/components/ui';
import { cx } from '@/lib/utils';
import { markEnquiryRead, saveEnquiryNotes, setEnquiryStatus } from '@/server/enquiries';

/**
 * Enquiries — read, file, annotate. Never delete.
 *
 * The list is deliberately thin: a name, a line of the message and when it
 * arrived. Everything else waits until the row is opened, because the useful
 * question on this screen is "what came in and what still needs an answer",
 * not "what does every message say".
 */

const STATUSES = [
  { value: 'new', label: 'New', tone: 'tag--stamp' },
  { value: 'read', label: 'Read', tone: 'tag--muted' },
  { value: 'replied', label: 'Replied', tone: 'tag--leaf' },
  { value: 'spam', label: 'Spam', tone: 'tag--muted' },
];

const statusOf = (value) => STATUSES.find((entry) => entry.value === value) ?? STATUSES[1];

/** Café time, fixed, so the server and the browser print the same string. */
const stamp = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'Asia/Kolkata',
});

const when = (value) => (value ? stamp.format(new Date(value)) : '');

/** A phone number a `tel:` link can dial: digits, and a leading + if it is there. */
const dialable = (phone) => String(phone ?? '').replace(/[^\d+]/g, '');

function Filters({ filters, onChange, counts }) {
  const group = (name, label, options) => (
    <div className="flex flex-wrap items-center gap-2">
      <span className="t-label w-full text-pencil sm:w-auto">{label}</span>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="chip min-h-[44px]"
          aria-pressed={filters[name] === option.value}
          onClick={() => onChange({ ...filters, [name]: option.value })}
        >
          {option.label}
          {option.count == null ? null : <span className="tabular opacity-60">{option.count}</span>}
        </button>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      {group('kind', 'Kind', [
        { value: 'all', label: 'All', count: counts.all },
        { value: 'contact', label: 'Contact', count: counts.contact },
        { value: 'franchise', label: 'Franchise', count: counts.franchise },
      ])}
      {group('status', 'Status', [
        { value: 'all', label: 'All' },
        ...STATUSES.map((entry) => ({
          value: entry.value,
          label: entry.label,
          count: counts[entry.value],
        })),
      ])}
    </div>
  );
}

/**
 * Enquiries taken before `topic` was a column carry the reason as a `[Bulk
 * order]` in front of the message. This reads it back out so an old row looks
 * like a new one, and nothing stored has to be rewritten.
 */
const LEGACY_TOPIC = /^\s*\[([^\]]{1,40})\]\s*/;

function readTopic(enquiry) {
  if (enquiry.topic) return { topic: enquiry.topic, message: enquiry.message ?? '' };

  const match = LEGACY_TOPIC.exec(enquiry.message ?? '');
  if (!match) return { topic: null, message: enquiry.message ?? '' };

  return { topic: match[1], message: (enquiry.message ?? '').slice(match[0].length) };
}

function Detail({ enquiry, onClose, onStatus, onNotes }) {
  const [notes, setNotes] = useState(enquiry.notes ?? '');
  const phone = dialable(enquiry.phone);
  const { topic, message } = readTopic(enquiry);

  const rows = [
    ['Kind', enquiry.kind === 'franchise' ? 'Franchise enquiry' : 'Contact form'],
    topic ? ['About', topic] : null,
    ['Arrived', when(enquiry.created_at)],
    enquiry.city ? ['City', enquiry.city] : null,
    enquiry.has_property
      ? ['Has a property', enquiry.has_property === 'yes' ? 'Yes' : 'No']
      : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2">
        <a className="btn btn--ghost btn--sm min-h-[44px]" href={`mailto:${enquiry.email}`}>
          <Mail size={13} strokeWidth={1.8} aria-hidden="true" />
          {enquiry.email}
        </a>
        {phone ? (
          <a className="btn btn--ghost btn--sm min-h-[44px]" href={`tel:${phone}`}>
            <Phone size={13} strokeWidth={1.8} aria-hidden="true" />
            {enquiry.phone}
          </a>
        ) : null}
      </div>

      <dl className="grid grid-cols-[minmax(0,110px)_minmax(0,1fr)] gap-x-4 gap-y-2 text-[0.8125rem]">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="t-meta">{label}</dt>
            <dd className="min-w-0 break-words">{value}</dd>
          </div>
        ))}
      </dl>

      <div>
        <span className="field__label">Their message</span>
        <p className="t-serif whitespace-pre-wrap break-words border border-ink/15 p-4 text-[0.9375rem]">
          {message.trim() || 'They left the message box empty.'}
        </p>
      </div>

      <fieldset>
        <legend className="field__label">Status</legend>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((entry) => (
            <button
              key={entry.value}
              type="button"
              className="chip min-h-[44px]"
              aria-pressed={enquiry.status === entry.value}
              onClick={() => onStatus(entry.value)}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </fieldset>

      <form
        action={async () => {
          await onNotes(notes);
        }}
      >
        <Area
          label="Internal notes"
          rows={4}
          value={notes}
          hint="Only ever shown here. Who called back, what was agreed, what is still open."
          onChange={(event) => setNotes(event.target.value)}
        />

        <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-ink/15 pt-5">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Close
          </button>
          <SubmitButton>Save notes</SubmitButton>
        </div>
      </form>

      {enquiry.user_agent ? (
        <p className="t-meta break-words border-t border-ink/10 pt-4">
          Sent from {enquiry.user_agent}
        </p>
      ) : null}
    </div>
  );
}

export default function EnquiriesScreen({ enquiries, counts }) {
  const toast = useToast();
  const [, startTransition] = useTransition();
  const [filters, setFilters] = useState({ kind: 'all', status: 'all' });
  const [openId, setOpenId] = useState(null);

  const visible = enquiries.filter(
    (row) =>
      (filters.kind === 'all' || row.kind === filters.kind) &&
      (filters.status === 'all' || row.status === filters.status)
  );

  const open = enquiries.find((row) => row.id === openId) ?? null;

  // Opening an unread enquiry files it as read — the same thing an inbox does,
  // and the reason the unread count on the overview can be trusted.
  const openedId = open?.id ?? null;
  const openedStatus = open?.status ?? null;

  useEffect(() => {
    if (!openedId || openedStatus !== 'new') return;
    startTransition(() => {
      markEnquiryRead(openedId);
    });
  }, [openedId, openedStatus]);

  const run = (action, okMessage) =>
    startTransition(async () => {
      const result = await action();
      if (result?.ok) toast(okMessage);
      else toast(result?.error ?? 'That did not save.', 'error');
    });

  return (
    <Page>
      <PageHead
        title="Enquiries"
        meta={
          counts.new
            ? `${counts.new} unread · ${counts.all} in total`
            : `Nothing unread · ${counts.all} in total`
        }
      />

      <Section className="pb-0">
        <Filters filters={filters} onChange={setFilters} counts={counts} />
      </Section>

      <Section>
        {!enquiries.length ? (
          <Empty
            title="No enquiries yet"
            body="Messages from the contact form and the franchise form land here. Nothing on this screen deletes one — they are records."
          />
        ) : !visible.length ? (
          <Empty title="Nothing here" body="No enquiry matches those two filters." />
        ) : (
          <ul className="panel">
            {visible.map((row) => {
              const status = statusOf(row.status);

              return (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => setOpenId(row.id)}
                    className={cx(
                      'row w-full min-h-[56px] text-left',
                      row.status === 'new' && 'bg-paper-shade/30'
                    )}
                  >
                    <span className={cx('tag shrink-0', status.tone)}>{status.label}</span>

                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline gap-x-2">
                        <span className="truncate text-[0.875rem]">{row.name}</span>
                        <span className="t-meta">
                          {row.kind === 'franchise' ? 'Franchise' : 'Contact'}
                        </span>
                      </span>
                      <span className="t-meta mt-[2px] block truncate">
                        {(() => {
                          const { topic, message } = readTopic(row);
                          const line = message.trim() || row.email;
                          return topic ? `${topic} · ${line}` : line;
                        })()}
                      </span>
                    </span>

                    <span className="t-meta tabular shrink-0">{when(row.created_at)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Modal
        open={Boolean(open)}
        onClose={() => setOpenId(null)}
        wide
        title={open?.name ?? ''}
        description={open ? `${open.email}${open.phone ? ` · ${open.phone}` : ''}` : ''}
      >
        {open ? (
          <Detail
            key={open.id}
            enquiry={open}
            onClose={() => setOpenId(null)}
            onStatus={(status) => run(() => setEnquiryStatus(open.id, status), 'Status updated.')}
            onNotes={async (notes) => {
              const result = await saveEnquiryNotes(open.id, notes);
              if (result?.ok) toast('Notes saved.');
              else toast(result?.error ?? 'Notes did not save.', 'error');
              return result;
            }}
          />
        ) : null}
      </Modal>
    </Page>
  );
}
