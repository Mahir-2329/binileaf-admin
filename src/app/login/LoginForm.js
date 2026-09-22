'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { ArrowRight, KeyRound, Mail } from 'lucide-react';
import { requestCode, verifyCode } from '@/server/auth-actions';

/**
 * One component, two steps. The password step issues a code; the code step
 * writes the session. Keeping both here means the email typed in step one is
 * still on screen in step two without a round trip.
 */

function Submit({ children }) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className="btn btn--primary w-full" disabled={pending}>
      {pending ? 'Working…' : children}
      {pending ? null : <ArrowRight size={14} strokeWidth={1.7} />}
    </button>
  );
}

const PASSWORD_INITIAL = { step: 'password', error: null, email: '', notice: null };

// The code form starts at 'code' so its untouched state cannot be mistaken for
// the server sending us back to the password step.
const CODE_INITIAL = { step: 'code', error: null, email: '', notice: null };

export default function LoginForm({ next }) {
  const [passwordState, passwordAction] = useActionState(requestCode, PASSWORD_INITIAL);
  const [codeState, codeAction] = useActionState(verifyCode, CODE_INITIAL);

  // Show the code step once a code has been issued, unless the code action
  // has explicitly bounced us back (expired, too many attempts).
  const onCodeStep = passwordState.step === 'code' && codeState.step === 'code';

  const codeRef = useRef(null);
  useEffect(() => {
    if (onCodeStep) codeRef.current?.focus();
  }, [onCodeStep]);

  const email = codeState.email || passwordState.email || '';
  const error = onCodeStep ? codeState.error : passwordState.error || codeState.error;

  if (onCodeStep) {
    return (
      <form action={codeAction} className="flex flex-col gap-5">
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="next" value={next} />

        <div>
          <p className="t-label text-paper-dim">Step 2 of 2</p>
          <h2 className="t-h2 mt-2 text-paper">Enter the code</h2>
          {passwordState.notice ? (
            <p className="t-serif mt-2 text-[0.875rem] italic text-paper-dim">
              {passwordState.notice}
            </p>
          ) : null}
        </div>

        <label className="field">
          <span className="field__label text-paper-dim">Six-digit code</span>
          <div className="relative">
            <KeyRound
              size={15}
              strokeWidth={1.6}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-paper-dim"
            />
            <input
              ref={codeRef}
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              pattern="\d{6}"
              required
              placeholder="000000"
              className="input tabular border-paper/25 bg-ink pl-9 text-[1.125rem] tracking-[0.5em] text-paper placeholder:text-paper-dim/40 focus:border-brass"
            />
          </div>
        </label>

        {error ? <p className="field__error text-stamp">{error}</p> : null}

        <Submit>Sign in</Submit>

        <p className="text-center text-[0.75rem] text-paper-dim">
          Not you?{' '}
          <a href="/login" className="underline underline-offset-4 hover:text-brass">
            Start again
          </a>
        </p>
      </form>
    );
  }

  return (
    <form action={passwordAction} className="flex flex-col gap-5">
      <div>
        <p className="t-label text-paper-dim">Step 1 of 2</p>
        <h2 className="t-h2 mt-2 text-paper">Sign in</h2>
      </div>

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
            defaultValue={email}
            placeholder="you@binileaf.com"
            className="input border-paper/25 bg-ink pl-9 text-paper placeholder:text-paper-dim/40 focus:border-brass"
          />
        </div>
      </label>

      <label className="field">
        <span className="field__label text-paper-dim">Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="input border-paper/25 bg-ink text-paper focus:border-brass"
        />
      </label>

      {error ? <p className="field__error text-stamp">{error}</p> : null}

      <Submit>Continue</Submit>
    </form>
  );
}
