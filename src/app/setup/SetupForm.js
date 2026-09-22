'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Mail } from 'lucide-react';

/**
 * Posts to `/api/bootstrap`, the one unauthenticated write in the app.
 *
 * A plain fetch rather than a Server Action, because the endpoint has to exist
 * as an API regardless — it is how a fresh deployment is claimed, with or
 * without this screen.
 */
export default function SetupForm() {
  const router = useRouter();
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    setError(null);

    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());

    if (payload.password !== payload.confirm) {
      setErrors({ confirm: 'The two passwords do not match.' });
      setBusy(false);
      return;
    }

    try {
      const response = await fetch('/api/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (!response.ok) {
        setErrors(result.errors ?? {});
        setError(result.errors ? null : result.error);
        setBusy(false);
        return;
      }

      router.replace('/login');
      router.refresh();
    } catch {
      setError('Could not reach the server. Try again.');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <label className="field">
        <span className="field__label text-paper-dim">Your name</span>
        <input
          name="name"
          autoComplete="name"
          placeholder="Vandan"
          className="input border-paper/25 bg-ink text-paper placeholder:text-paper-dim/40 focus:border-brass"
        />
      </label>

      <label className="field">
        <span className="field__label text-paper-dim">Email</span>
        <div className="relative">
          <Mail
            size={15}
            strokeWidth={1.6}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-paper-dim"
          />
          <input
            name="email"
            type="email"
            autoComplete="username"
            required
            placeholder="you@binileaf.com"
            className="input border-paper/25 bg-ink pl-9 text-paper placeholder:text-paper-dim/40 focus:border-brass"
          />
        </div>
        {errors.email ? <span className="field__error text-stamp">{errors.email}</span> : null}
      </label>

      <label className="field">
        <span className="field__label text-paper-dim">Password</span>
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          className="input border-paper/25 bg-ink text-paper focus:border-brass"
        />
        {errors.password ? (
          <span className="field__error text-stamp">{errors.password}</span>
        ) : (
          <span className="field__hint text-paper-dim/70">At least 10 characters.</span>
        )}
      </label>

      <label className="field">
        <span className="field__label text-paper-dim">Password again</span>
        <input
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          className="input border-paper/25 bg-ink text-paper focus:border-brass"
        />
        {errors.confirm ? <span className="field__error text-stamp">{errors.confirm}</span> : null}
      </label>

      {error ? <p className="field__error text-stamp">{error}</p> : null}

      <button type="submit" className="btn btn--primary w-full" disabled={busy}>
        {busy ? 'Creating…' : 'Create the account'}
        {busy ? null : <ArrowRight size={14} strokeWidth={1.7} />}
      </button>
    </form>
  );
}
