'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { Area, Field, Select, SubmitButton, Text, Toggle } from '@/components/ui';
import { cx } from '@/lib/utils';
import { DAYS, fromLocalInput, toLocalInput, windowSentence } from './state';
import OfferPreview from './OfferPreview';

/**
 * The whole offer, in one form.
 *
 * Nothing here is typed as JSON. `applies_to`, `placement` and `schedule` are
 * three JSON columns, and a café owner should never see a brace — categories
 * are chips, placements are checkboxes, the happy-hour window is days and two
 * times. The shapes those controls produce are documented in
 * `src/server/offers.js`, which is the only thing that writes them.
 */

const KINDS = [
  { value: 'announcement', label: 'Announcement — something to say' },
  { value: 'discount', label: 'Discount — money off' },
  { value: 'combo', label: 'Combo — things together for less' },
  { value: 'happy_hour', label: 'Happy hour — only at certain times' },
];

const VALUE_TYPES = [
  { value: 'none', label: 'No number — just the words' },
  { value: 'percent', label: 'A percentage off' },
  { value: 'flat', label: 'A fixed amount off' },
];

const PLACEMENTS = [
  {
    key: 'home_band',
    label: 'Home page band',
    hint: 'The red band under the signature drinks. The site reads this one today.',
  },
  {
    key: 'menu_top',
    label: 'Top of the menu',
    hint: 'Stored and ready for the menu page to pick up.',
  },
];

const empty = {
  id: null,
  title: '',
  subtitle: '',
  body: '',
  code: '',
  kind: 'announcement',
  value_type: 'none',
  value: '',
  priority: 0,
  is_active: true,
  starts_at: null,
  ends_at: null,
  applies_to: {},
  placement: {},
  schedule: null,
};

/** The row shape → the form's own state. Kept in one place so edit and duplicate agree. */
function toFormState(offer) {
  const row = offer ?? empty;

  return {
    id: row.id ?? null,
    title: row.title ?? '',
    subtitle: row.subtitle ?? '',
    body: row.body ?? '',
    code: row.code ?? '',
    kind: row.kind ?? 'announcement',
    valueType: row.value_type ?? 'none',
    value: row.value == null ? '' : String(row.value),
    priority: String(row.priority ?? 0),
    isActive: row.is_active !== false,
    startsLocal: toLocalInput(row.starts_at),
    endsLocal: toLocalInput(row.ends_at),
    groups: row.applies_to?.groups ?? [],
    items: row.applies_to?.items ?? [],
    minSpend: row.applies_to?.min_spend == null ? '' : String(row.applies_to.min_spend),
    placement: {
      home_band: Boolean(row.placement?.home_band),
      menu_top: Boolean(row.placement?.menu_top),
    },
    scheduleOn: Boolean(row.schedule?.days?.length),
    scheduleDays: row.schedule?.days ?? [],
    scheduleFrom: row.schedule?.from ?? '16:00',
    scheduleTo: row.schedule?.to ?? '19:00',
  };
}

/* ─────────────────────────────────────────────────────────── the picker ──── */

function Chosen({ label, values, onRemove }) {
  if (!values.length) return null;

  return (
    <ul className="mt-2 flex flex-wrap gap-2" aria-label={label}>
      {values.map(({ slug, name }) => (
        <li key={slug}>
          <button
            type="button"
            className="chip"
            onClick={() => onRemove(slug)}
            aria-label={`Remove ${name}`}
          >
            {name}
            <X size={11} strokeWidth={2} aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
}

function ItemPicker({ items, chosen, onToggle }) {
  const [term, setTerm] = useState('');

  const matches = useMemo(() => {
    const needle = term.trim().toLowerCase();
    if (!needle) return items.slice(0, 40);
    return items
      .filter(
        (item) =>
          item.name.toLowerCase().includes(needle) ||
          item.group_title.toLowerCase().includes(needle)
      )
      .slice(0, 40);
  }, [items, term]);

  return (
    <div>
      <div className="relative">
        <Search
          size={14}
          strokeWidth={1.7}
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-pencil"
        />
        <input
          type="search"
          className="input pl-9"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Search drinks and dishes"
          aria-label="Search the menu"
        />
      </div>

      <ul className="mt-2 max-h-[200px] overflow-y-auto border border-ink/15">
        {matches.length ? (
          matches.map((item) => {
            const on = chosen.includes(item.slug);

            return (
              <li key={item.slug}>
                <button
                  type="button"
                  onClick={() => onToggle(item.slug)}
                  aria-pressed={on}
                  className={cx(
                    'flex min-h-[44px] w-full items-center gap-3 border-b border-ink/10 px-3 text-left text-[0.8125rem] last:border-b-0',
                    on ? 'bg-ink text-paper' : 'hover:bg-paper-shade/50'
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cx(
                      'inline-block h-[13px] w-[13px] shrink-0 border',
                      on ? 'border-paper bg-paper' : 'border-ink/40'
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate">{item.name}</span>
                  <span className={cx('t-meta shrink-0', on && 'text-paper/70')}>
                    {item.group_title}
                  </span>
                </button>
              </li>
            );
          })
        ) : (
          <li className="t-meta p-3">Nothing on the menu matches that.</li>
        )}
      </ul>

      {!term && items.length > 40 ? (
        <p className="field__hint">
          Showing the first 40 of {items.length}. Search to find the rest.
        </p>
      ) : null}
    </div>
  );
}

/* ───────────────────────────────────────────────────────────── the form ──── */

export default function OfferForm({ offer, groups, items, onSave, onCancel }) {
  const [form, setForm] = useState(() => toFormState(offer));
  const [errors, setErrors] = useState({});
  const [showRecurrence, setShowRecurrence] = useState(Boolean(offer?.schedule?.days?.length));

  const set = (patch) => setForm((current) => ({ ...current, ...patch }));

  const toggleIn = (list, slug) =>
    list.includes(slug) ? list.filter((entry) => entry !== slug) : [...list, slug];

  const chosenGroups = groups.filter((group) => form.groups.includes(group.slug));
  const chosenItems = items.filter((item) => form.items.includes(item.slug));

  // The same sentence the list shows, recomputed as the two date fields change,
  // so the window is readable before it is saved.
  const startsIso = fromLocalInput(form.startsLocal);
  const endsIso = fromLocalInput(form.endsLocal);
  const windowBad = Boolean(startsIso && endsIso && new Date(endsIso) <= new Date(startsIso));

  function validate() {
    const next = {};

    if (!form.title.trim()) {
      next.title = 'Give the offer a title — it is the line people read on the site.';
    }

    if (form.valueType !== 'none') {
      const amount = Number(form.value);
      if (!form.value.trim() || !Number.isFinite(amount) || amount <= 0) {
        next.value =
          form.valueType === 'percent'
            ? 'How much off? Type 20 for twenty per cent.'
            : 'How much off? Type 50 for ₹50.';
      } else if (form.valueType === 'percent' && amount > 100) {
        next.value = 'A percentage cannot be more than 100.';
      }
    }

    if (windowBad) {
      next.ends = 'The offer has to end after it starts. Check the two dates.';
    }

    if (form.minSpend.trim()) {
      const spend = Number(form.minSpend);
      if (!Number.isFinite(spend) || spend < 0) {
        next.minSpend = 'Minimum spend is a number of rupees, like 500.';
      }
    }

    if (form.scheduleOn) {
      if (!form.scheduleDays.length) {
        next.scheduleDays = 'Pick the days this runs on.';
      }
      if (!form.scheduleFrom || !form.scheduleTo) {
        next.scheduleTime = 'Give the window a start and an end time.';
      } else if (form.scheduleFrom >= form.scheduleTo) {
        next.scheduleTime = 'The window has to end later in the day than it starts.';
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit() {
    if (!validate()) {
      // The disclosure may be closed over the field that failed.
      if (form.scheduleOn) setShowRecurrence(true);
      return;
    }

    const payload = {
      id: form.id,
      title: form.title,
      subtitle: form.subtitle,
      body: form.body,
      code: form.code,
      kind: form.kind,
      value_type: form.valueType,
      value: form.valueType === 'none' ? null : Number(form.value),
      priority: Number(form.priority) || 0,
      is_active: form.isActive,
      starts_at: startsIso,
      ends_at: endsIso,
      applies_to: {
        groups: form.groups,
        items: form.items,
        min_spend: form.minSpend.trim() ? Number(form.minSpend) : null,
      },
      placement: form.placement,
      schedule: form.scheduleOn
        ? {
            enabled: true,
            days: form.scheduleDays,
            from: form.scheduleFrom,
            to: form.scheduleTo,
          }
        : null,
    };

    const result = await onSave(payload);
    if (result && result.ok === false) setErrors({ form: result.error });
  }

  const valueSuffix = form.valueType === 'percent' ? '%' : '₹';

  return (
    <form action={submit} className="flex flex-col gap-7">
      {/* ── what it says ─────────────────────────────────────────────── */}
      <fieldset className="flex flex-col gap-4">
        <legend className="t-label mb-3 text-pencil">What it says</legend>

        <Text
          label="Title"
          required
          value={form.title}
          error={errors.title}
          maxLength={160}
          onChange={(event) => set({ title: event.target.value })}
          placeholder="Two chai for the price of one"
        />

        <Text
          label="Subtitle"
          hint="A short line under the title. Optional."
          value={form.subtitle}
          maxLength={200}
          onChange={(event) => set({ subtitle: event.target.value })}
          placeholder="Every weekday afternoon"
        />

        <Area
          label="Body"
          hint="A sentence or two. The site sets this in italics."
          value={form.body}
          rows={3}
          maxLength={2000}
          onChange={(event) => set({ body: event.target.value })}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Kind"
            value={form.kind}
            options={KINDS}
            onChange={(event) => set({ kind: event.target.value })}
          />
          <Text
            label="Code to mention"
            hint="Printed in a box: Mention “CHAI2”. Optional."
            value={form.code}
            maxLength={40}
            onChange={(event) => set({ code: event.target.value.toUpperCase() })}
            placeholder="CHAI2"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Money off"
            value={form.valueType}
            options={VALUE_TYPES}
            onChange={(event) => set({ valueType: event.target.value })}
          />

          {/* Hidden entirely for 'none' — an empty amount box next to "just the
              words" only invites someone to fill it in. */}
          {form.valueType === 'none' ? null : (
            <Field
              label={form.valueType === 'percent' ? 'Per cent off' : 'Rupees off'}
              error={errors.value}
              hint={
                form.valueType === 'percent'
                  ? 'The site prints this as “20% off”.'
                  : 'The site prints this as “₹50 off”.'
              }
              required
            >
              <div className="relative">
                <input
                  className="input pr-9"
                  inputMode="numeric"
                  value={form.value}
                  onChange={(event) => set({ value: event.target.value.replace(/[^\d]/g, '') })}
                  placeholder={form.valueType === 'percent' ? '20' : '50'}
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[0.875rem] text-pencil"
                >
                  {valueSuffix}
                </span>
              </div>
            </Field>
          )}
        </div>
      </fieldset>

      <OfferPreview
        offer={{
          title: form.title,
          subtitle: form.subtitle,
          body: form.body,
          code: form.code,
          value_type: form.valueType,
          value: Number(form.value) || null,
        }}
      />

      {/* ── when it runs ─────────────────────────────────────────────── */}
      <fieldset className="flex flex-col gap-4">
        <legend className="t-label mb-3 text-pencil">When it runs</legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <Text
            label="Starts"
            type="datetime-local"
            hint="Leave blank to start straight away."
            value={form.startsLocal}
            onChange={(event) => set({ startsLocal: event.target.value })}
          />
          <Text
            label="Ends"
            type="datetime-local"
            hint="Leave blank for no end date."
            value={form.endsLocal}
            error={errors.ends}
            onChange={(event) => set({ endsLocal: event.target.value })}
          />
        </div>

        <p
          className={cx('t-serif text-[0.875rem]', windowBad ? 'text-stamp-deep' : 'text-pencil')}
          aria-live="polite"
        >
          {windowBad
            ? 'The offer has to end after it starts. Check the two dates.'
            : windowSentence({ starts_at: startsIso, ends_at: endsIso })}
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Text
            label="Priority"
            hint="Higher shows first when two offers are running. 0 is fine."
            inputMode="numeric"
            value={form.priority}
            onChange={(event) => set({ priority: event.target.value.replace(/[^\d-]/g, '') })}
          />
          <div className="flex items-end pb-2">
            <Toggle
              label="Switched on"
              hint="Off keeps everything typed here but shows nothing on the site."
              checked={form.isActive}
              onChange={(event) => set({ isActive: event.target.checked })}
            />
          </div>
        </div>
      </fieldset>

      {/* ── recurrence, behind a disclosure ──────────────────────────── */}
      <div className="border border-ink/15">
        <button
          type="button"
          onClick={() => setShowRecurrence((open) => !open)}
          aria-expanded={showRecurrence}
          className="flex min-h-[44px] w-full items-center justify-between gap-3 px-4 text-left"
        >
          <span>
            <span className="t-label block text-pencil">Only at certain times</span>
            <span className="t-meta">
              {form.scheduleOn ? 'A recurring window is set.' : 'Not set — it runs all day.'}
            </span>
          </span>
          <ChevronDown
            size={15}
            strokeWidth={1.7}
            aria-hidden="true"
            className={cx('shrink-0 transition-transform', showRecurrence && 'rotate-180')}
          />
        </button>

        {showRecurrence ? (
          <div className="flex flex-col gap-4 border-t border-ink/15 p-4">
            <Toggle
              label="Repeat on certain days and hours"
              hint="For a happy hour: Monday to Friday, 16:00 to 19:00."
              checked={form.scheduleOn}
              onChange={(event) => set({ scheduleOn: event.target.checked })}
            />

            {form.scheduleOn ? (
              <>
                <fieldset>
                  <legend className="field__label">Days</legend>
                  <div className="flex flex-wrap gap-2">
                    {DAYS.map((day) => {
                      const on = form.scheduleDays.includes(day.value);

                      return (
                        <button
                          key={day.value}
                          type="button"
                          className="chip min-h-[44px]"
                          aria-pressed={on}
                          onClick={() =>
                            set({
                              scheduleDays: on
                                ? form.scheduleDays.filter((entry) => entry !== day.value)
                                : [...form.scheduleDays, day.value],
                            })
                          }
                        >
                          {day.short}
                        </button>
                      );
                    })}
                  </div>
                  {errors.scheduleDays ? (
                    <span className="field__error block">{errors.scheduleDays}</span>
                  ) : null}
                </fieldset>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Text
                    label="From"
                    type="time"
                    value={form.scheduleFrom}
                    onChange={(event) => set({ scheduleFrom: event.target.value })}
                  />
                  <Text
                    label="To"
                    type="time"
                    value={form.scheduleTo}
                    error={errors.scheduleTime}
                    onChange={(event) => set({ scheduleTo: event.target.value })}
                  />
                </div>

                <p className="field__hint">
                  The recurring window is stored with the offer. The site reads the start and end
                  dates today, so treat this as a note of the intended hours until the menu picks
                  it up.
                </p>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* ── what it applies to ───────────────────────────────────────── */}
      <fieldset className="flex flex-col gap-4">
        <legend className="t-label mb-3 text-pencil">What it applies to</legend>
        <p className="t-meta -mt-2">Leave everything unpicked and it applies to the whole menu.</p>

        <div>
          <span className="field__label">Categories</span>
          <div className="flex flex-wrap gap-2">
            {groups.map((group) => {
              const on = form.groups.includes(group.slug);

              return (
                <button
                  key={group.slug}
                  type="button"
                  className="chip min-h-[44px]"
                  aria-pressed={on}
                  onClick={() => set({ groups: toggleIn(form.groups, group.slug) })}
                >
                  {group.title}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <span className="field__label">Individual drinks and dishes</span>
          <ItemPicker
            items={items}
            chosen={form.items}
            onToggle={(slug) => set({ items: toggleIn(form.items, slug) })}
          />
          <Chosen
            label="Chosen items"
            values={chosenItems.map((item) => ({ slug: item.slug, name: item.name }))}
            onRemove={(slug) => set({ items: toggleIn(form.items, slug) })}
          />
        </div>

        {chosenGroups.length ? (
          <div>
            <span className="field__label">Chosen categories</span>
            <Chosen
              label="Chosen categories"
              values={chosenGroups.map((group) => ({ slug: group.slug, name: group.title }))}
              onRemove={(slug) => set({ groups: toggleIn(form.groups, slug) })}
            />
          </div>
        ) : null}

        <Field
          label="Minimum spend"
          hint="Rupees. Leave blank if there is no minimum."
          error={errors.minSpend}
          className="sm:max-w-[240px]"
        >
          <div className="relative">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[0.875rem] text-pencil"
            >
              ₹
            </span>
            <input
              className="input pl-7"
              inputMode="numeric"
              value={form.minSpend}
              onChange={(event) => set({ minSpend: event.target.value.replace(/[^\d]/g, '') })}
              placeholder="500"
            />
          </div>
        </Field>
      </fieldset>

      {/* ── where it shows ───────────────────────────────────────────── */}
      <fieldset className="flex flex-col gap-3">
        <legend className="t-label mb-3 text-pencil">Where it shows</legend>

        {PLACEMENTS.map((place) => (
          <Toggle
            key={place.key}
            label={place.label}
            hint={place.hint}
            checked={Boolean(form.placement[place.key])}
            onChange={(event) =>
              set({ placement: { ...form.placement, [place.key]: event.target.checked } })
            }
          />
        ))}
      </fieldset>

      {errors.form ? <p className="field__error">{errors.form}</p> : null}

      <div className="flex flex-wrap justify-end gap-2 border-t border-ink/15 pt-5">
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          Cancel
        </button>
        <SubmitButton>{form.id ? 'Save offer' : 'Create offer'}</SubmitButton>
      </div>
    </form>
  );
}
