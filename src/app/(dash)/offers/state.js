/**
 * Offer state, worked out honestly from the row — never stored.
 *
 * `is_active` on its own does not mean an offer is showing: a live offer is
 * active *and* inside its window, and the `live_offers` view says exactly
 * that. Anything the admin displays has to agree with that view, or the café
 * ends up trusting a green dot while the site shows nothing.
 *
 * Precedence, and why:
 *   1. ended     — the end date has passed. That is a fact about the calendar
 *                  and outranks the switch: an offer whose window closed last
 *                  Diwali is "Ended", not "Paused", whichever way the switch
 *                  is set. Calling it Paused would suggest flipping the switch
 *                  brings it back, which it would not.
 *   2. paused    — inside (or before) its window, but switched off by hand.
 *   3. scheduled — switched on, start date still in the future.
 *   4. running   — switched on, inside its window. This is the set the site
 *                  actually renders.
 */

export const OFFER_STATES = {
  running: { label: 'Running', tone: 'tag--leaf', rank: 0 },
  scheduled: { label: 'Scheduled', tone: 'tag--brass', rank: 1 },
  paused: { label: 'Paused', tone: 'tag--muted', rank: 2 },
  ended: { label: 'Ended', tone: 'tag--stamp', rank: 3 },
};

/** @returns {'running'|'scheduled'|'ended'|'paused'} */
export function offerState(offer, now = Date.now()) {
  const starts = offer.starts_at ? new Date(offer.starts_at).getTime() : null;
  const ends = offer.ends_at ? new Date(offer.ends_at).getTime() : null;

  if (ends !== null && ends < now) return 'ended';
  if (!offer.is_active) return 'paused';
  if (starts !== null && starts > now) return 'scheduled';
  return 'running';
}

/** Running first, then scheduled, then paused, then ended — highest priority within each. */
export function compareOffers(a, b) {
  const byState = OFFER_STATES[a.state].rank - OFFER_STATES[b.state].rank;
  if (byState) return byState;

  const byPriority = (b.priority ?? 0) - (a.priority ?? 0);
  if (byPriority) return byPriority;

  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

/* ─────────────────────────────────────────────────────────────── time ──── */

/**
 * Every date on this screen is café time.
 *
 * The café is in Ahmedabad and the offers are its offers, so a window typed as
 * "4 Oct, 16:00" has to mean four o'clock in the café — not in whatever
 * timezone the laptop or the server happens to sit in. India has never run
 * daylight saving, so a fixed +05:30 is exact and needs no timezone database.
 * Pinning it also means the server render and the browser render agree, which
 * a `toLocaleString()` would not.
 */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** ISO timestamp → the `datetime-local` value for that moment in café time. */
export function toLocalInput(iso) {
  if (!iso) return '';
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  return new Date(at.getTime() + IST_OFFSET_MS).toISOString().slice(0, 16);
}

/** A `datetime-local` value read as café time → an ISO timestamp to store. */
export function fromLocalInput(value) {
  if (!value) return null;
  // `datetime-local` gives "YYYY-MM-DDTHH:MM" (sometimes with seconds). Read
  // those digits as café wall-clock, then step back to the real instant.
  const wall = Date.parse(`${value.slice(0, 16)}:00Z`);
  if (Number.isNaN(wall)) return null;
  return new Date(wall - IST_OFFSET_MS).toISOString();
}

const dayMonth = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  timeZone: 'Asia/Kolkata',
});

const dayMonthTime = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'Asia/Kolkata',
});

/** "4 Oct, 16:30" — and "4 Oct" on its own when the time is midnight. */
export function when(value, { withTime = true } = {}) {
  if (!value) return '';
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return '';
  return (withTime ? dayMonthTime : dayMonth).format(at).replace(/,\s/, ', ');
}

/** True when the moment lands exactly on café midnight — then the time is noise. */
function isMidnight(value) {
  return toLocalInput(value).endsWith('T00:00');
}

const stamp = (value) => when(value, { withTime: !isMidnight(value) });

/** The window, in the sentence a café owner would say out loud. */
export function windowSentence({ starts_at: startsAt, ends_at: endsAt }) {
  if (!startsAt && !endsAt) return 'Runs until you switch it off — no start or end date.';
  if (startsAt && !endsAt) return `Runs from ${stamp(startsAt)}, no end date.`;
  if (!startsAt && endsAt) return `Runs from now until ${stamp(endsAt)}.`;
  return `Runs from ${stamp(startsAt)} to ${stamp(endsAt)}.`;
}

/* ──────────────────────────────────────────────────────────── recurrence ──── */

/** 0 is Sunday, matching JavaScript's `getDay()` and Postgres' `dow`. */
export const DAYS = [
  { value: 1, short: 'Mon' },
  { value: 2, short: 'Tue' },
  { value: 3, short: 'Wed' },
  { value: 4, short: 'Thu' },
  { value: 5, short: 'Fri' },
  { value: 6, short: 'Sat' },
  { value: 0, short: 'Sun' },
];

/** "Mon, Tue, Wed · 16:00–19:00" */
export function scheduleSentence(schedule) {
  if (!schedule || !Array.isArray(schedule.days) || !schedule.days.length) return null;

  const days = DAYS.filter((day) => schedule.days.includes(day.value)).map((day) => day.short);
  const times = schedule.from && schedule.to ? ` · ${schedule.from}–${schedule.to}` : '';

  return `${days.length === 7 ? 'Every day' : days.join(', ')}${times}`;
}

/* ──────────────────────────────────────────────────────────────── value ──── */

/** The same line the site prints above the title: "20% off", "₹50 off", or nothing. */
export function valueLabel({ value_type: valueType, value }) {
  if (valueType === 'percent' && value) return `${value}% off`;
  if (valueType === 'flat' && value) return `₹${value} off`;
  return null;
}
