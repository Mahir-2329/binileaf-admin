'use client';

import { useState } from 'react';
import { KeyRound, UserPlus } from 'lucide-react';
import {
  Field,
  Page,
  PageHead,
  Section,
  Select,
  SubmitButton,
  Text,
  Toggle,
  useToast,
} from '@/components/ui';
import { changeOwnPassword, createAdminUser, saveSetting } from '@/server/settings';

/**
 * Settings: the three rows the site reads, your own password, and who else
 * can sign in.
 *
 * Each card saves on its own. They have nothing to do with each other, and a
 * single Save at the bottom would mean a typo in the banner blocking a change
 * to the hours.
 */

/** Café time everywhere, so this never drifts with whoever is holding the laptop. */
const stamp = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'Asia/Kolkata',
});

function Card({ title, meta, onSave, saveLabel, children }) {
  const toast = useToast();
  const [error, setError] = useState(null);

  async function submit() {
    setError(null);
    const result = await onSave();
    if (result?.ok) toast(`${title} saved.`);
    else setError(result?.error ?? 'That could not be saved.');
  }

  return (
    <form action={submit} className="panel">
      <div className="panel-head">
        <div className="min-w-0">
          <h2 className="t-h2">{title}</h2>
          {meta ? <p className="t-meta mt-1">{meta}</p> : null}
        </div>
      </div>

      <div className="flex flex-col gap-5 p-5 lg:p-6">
        {children}
        {error ? <p className="field__error">{error}</p> : null}

        <div className="flex justify-end border-t border-ink/15 pt-5">
          <SubmitButton>{saveLabel}</SubmitButton>
        </div>
      </div>
    </form>
  );
}

/* ──────────────────────────────────────────────────────────────── hours ──── */

function HoursCard({ initial }) {
  const [form, setForm] = useState({
    opens: initial?.opens ?? '10:30',
    closes: initial?.closes ?? '00:30',
    days: initial?.days ?? '',
  });

  const set = (patch) => setForm((current) => ({ ...current, ...patch }));

  // Closing before opening is the normal case here: the café shuts after
  // midnight. Saying so is better than letting it look like a mistake.
  const overnight = form.closes < form.opens;

  return (
    <Card
      title="Opening hours"
      meta="Printed in the footer, on the contact page and in the site's structured data."
      saveLabel="Save hours"
      onSave={() => saveSetting('hours', form)}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Text
          label="Opens"
          type="time"
          required
          value={form.opens}
          onChange={(event) => set({ opens: event.target.value })}
        />
        <Text
          label="Closes"
          type="time"
          required
          value={form.closes}
          hint={overnight ? 'After midnight — the site reads this as the next day.' : undefined}
          onChange={(event) => set({ closes: event.target.value })}
        />
      </div>

      <Text
        label="Days"
        hint="Written out, the way it reads on the site."
        value={form.days}
        onChange={(event) => set({ days: event.target.value })}
        placeholder="Monday to Sunday"
      />
    </Card>
  );
}

/* ─────────────────────────────────────────────────────────────── banner ──── */

function BannerCard({ initial }) {
  const [form, setForm] = useState({
    enabled: Boolean(initial?.enabled),
    text: initial?.text ?? '',
  });

  const set = (patch) => setForm((current) => ({ ...current, ...patch }));

  return (
    <Card
      title="Site banner"
      meta="One line across the top of every page. For a closure, a holiday, a change of hours."
      saveLabel="Save banner"
      onSave={() => saveSetting('banner', form)}
    >
      <Toggle
        label="Show the banner"
        checked={form.enabled}
        onChange={(event) => set({ enabled: event.target.checked })}
      />

      <Text
        label="Banner text"
        value={form.text}
        maxLength={300}
        onChange={(event) => set({ text: event.target.value })}
        placeholder="Closed 14 November for Diwali. Back on the 15th."
      />

      {form.enabled && form.text.trim() ? (
        <div>
          <p className="t-label text-pencil">On the site</p>
          <p className="mt-2 bg-ink px-4 py-3 text-center text-[0.8125rem] text-paper">
            {form.text}
          </p>
        </div>
      ) : null}
    </Card>
  );
}

/* ───────────────────────────────────────────────────────────── ordering ──── */

function OrderingCard({ initial }) {
  const [form, setForm] = useState({
    online: Boolean(initial?.online),
    provider: initial?.provider ?? '',
  });

  const set = (patch) => setForm((current) => ({ ...current, ...patch }));

  return (
    <Card
      title="Online ordering"
      meta="Whether the site offers ordering, and through whom."
      saveLabel="Save ordering"
      onSave={() => saveSetting('ordering', form)}
    >
      <Toggle
        label="Orders can be placed online"
        hint="Off means the site says nothing about ordering at all."
        checked={form.online}
        onChange={(event) => set({ online: event.target.checked })}
      />

      <Text
        label="Who takes the orders"
        hint="Swiggy, Zomato, or whoever it is. Needed when ordering is switched on."
        value={form.provider}
        onChange={(event) => set({ provider: event.target.value })}
        placeholder="Swiggy"
      />
    </Card>
  );
}

/* ───────────────────────────────────────────────────────────── password ──── */

function PasswordCard() {
  const toast = useToast();
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);

  async function submit(formData) {
    // The action takes (previousState, formData) so it can also be driven by
    // useActionState; here there is no previous state to hand it.
    const result = await changeOwnPassword(null, formData);

    if (result?.ok) {
      setError(null);
      setDone(result.message);
      toast(result.message);
    } else {
      setDone(null);
      setError(result?.error ?? 'That could not be changed.');
    }
  }

  return (
    // React clears an uncontrolled form once its action resolves, so the three
    // password boxes empty themselves without any help here.
    <form action={submit} className="panel">
      <div className="panel-head">
        <div className="min-w-0">
          <h2 className="t-h2">Your password</h2>
          <p className="t-meta mt-1">Changes your own sign-in, nobody else&rsquo;s.</p>
        </div>
        <KeyRound size={16} strokeWidth={1.6} aria-hidden="true" className="shrink-0 text-pencil" />
      </div>

      <div className="flex flex-col gap-5 p-5 lg:p-6">
        <Text
          label="Current password"
          name="current"
          type="password"
          autoComplete="current-password"
          required
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Text
            label="New password"
            name="next"
            type="password"
            autoComplete="new-password"
            minLength={10}
            required
            hint="At least 10 characters. A short sentence you will remember beats a clever one you will not."
          />
          <Text
            label="New password again"
            name="again"
            type="password"
            autoComplete="new-password"
            minLength={10}
            required
          />
        </div>

        {error ? <p className="field__error">{error}</p> : null}
        {done ? <p className="t-serif text-[0.875rem] text-leaf">{done}</p> : null}

        <div className="flex justify-end border-t border-ink/15 pt-5">
          <SubmitButton>Change password</SubmitButton>
        </div>
      </div>
    </form>
  );
}

/* ───────────────────────────────────────────────────────────── accounts ──── */

function AccountsCard({ accounts, canAdd }) {
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState(null);

  async function submit(formData) {
    const result = await createAdminUser(null, formData);

    if (result?.ok) {
      setError(null);
      setAdding(false);
      toast(result.message);
    } else {
      setError(result?.error ?? 'That account could not be created.');
    }
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <div className="min-w-0">
          <h2 className="t-h2">Who can sign in</h2>
          <p className="t-meta mt-1">
            {accounts.length} account{accounts.length === 1 ? '' : 's'}
          </p>
        </div>

        {canAdd && !adding ? (
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setAdding(true)}>
            <UserPlus size={13} strokeWidth={1.8} aria-hidden="true" />
            Add
          </button>
        ) : null}
      </div>

      <ul>
        {accounts.map((account) => (
          <li key={account.id} className="row flex-wrap">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.875rem]">{account.name || account.email}</p>
              <p className="t-meta truncate">{account.email}</p>
            </div>

            <span className={`tag ${account.role === 'owner' ? 'tag--brass' : 'tag--muted'}`}>
              {account.role}
            </span>

            <span className="t-meta tabular shrink-0">
              {account.last_login_at
                ? `Last in ${stamp.format(new Date(account.last_login_at))}`
                : 'Never signed in'}
            </span>
          </li>
        ))}
      </ul>

      {adding ? (
        <form action={submit} className="flex flex-col gap-5 border-t border-ink/15 p-5 lg:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Text label="Email" name="email" type="email" autoComplete="off" required />
            <Text label="Name" name="name" autoComplete="off" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Role"
              name="role"
              defaultValue="editor"
              options={[
                { value: 'editor', label: 'Editor — can change everything on the site' },
                { value: 'owner', label: 'Owner — can also add accounts' },
              ]}
            />
            <Text
              label="Their first password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={10}
              required
              hint="At least 10 characters. Tell it to them yourself — nothing is emailed."
            />
          </div>

          {error ? <p className="field__error">{error}</p> : null}

          <div className="flex flex-wrap justify-end gap-2 border-t border-ink/15 pt-5">
            <button type="button" className="btn btn--ghost" onClick={() => setAdding(false)}>
              Cancel
            </button>
            <SubmitButton>Create account</SubmitButton>
          </div>
        </form>
      ) : null}

      {!canAdd ? (
        <p className="t-meta border-t border-ink/15 p-5">
          Only an owner can add an account.
        </p>
      ) : null}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── the screen ──── */

export default function SettingsScreen({ settings, accounts, mailerConfigured, role }) {
  return (
    <Page>
      <PageHead title="Settings" meta="The site's standing facts, and who can change them." />

      <Section className="grid gap-5 xl:grid-cols-2">
        <HoursCard initial={settings.hours} />
        <BannerCard initial={settings.banner} />
        <OrderingCard initial={settings.ordering} />
        <PasswordCard />
      </Section>

      <Section className="pt-0">
        <AccountsCard accounts={accounts} canAdd={role === 'owner'} />
      </Section>

      <Section className="pt-0">
        {/* Stated plainly. A security note that reads like marketing is a
            security note nobody acts on. */}
        <div className="panel border-l-2 border-l-stamp p-5 lg:p-6">
          <h2 className="t-label text-stamp">The one-time code at sign-in</h2>

          {mailerConfigured ? (
            <>
              <p className="t-serif mt-3 max-w-[70ch] text-[0.9375rem]">
                A mail provider is configured, so the six-digit code is emailed and the emailed
                code is the only one that works. The fixed development code is off.
              </p>
              <p className="t-meta mt-3">
                It is on because one of <span className="tabular">RESEND_API_KEY</span>,{' '}
                <span className="tabular">SMTP_URL</span> or{' '}
                <span className="tabular">MAIL_FROM</span> is set.
              </p>
            </>
          ) : (
            <>
              <p className="t-serif mt-3 max-w-[70ch] text-[0.9375rem]">
                No mail provider is configured, so there is nowhere to send a code. Until one is,
                the fixed code <span className="tabular font-semibold">111111</span> is accepted at
                sign-in alongside the generated one. Anyone with an email address and a password
                can get in with it.
              </p>
              <p className="t-meta mt-3 max-w-[70ch]">
                Setting any one of <span className="tabular">RESEND_API_KEY</span>,{' '}
                <span className="tabular">SMTP_URL</span> or{' '}
                <span className="tabular">MAIL_FROM</span> turns it off, with no other change: the
                emailed code becomes the only one that works. Do that before this admin is
                reachable from the internet.
              </p>
            </>
          )}
        </div>
      </Section>
    </Page>
  );
}
