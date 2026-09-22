'use client';

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { AlertCircle, Check, Loader2, X } from 'lucide-react';
import { cx } from '@/lib/utils';

/**
 * The shared admin kit.
 *
 * Every screen is built from these, so the whole tool behaves the same way:
 * one toast, one confirm, one save button, one field. If a screen needs a
 * control that is not here, it belongs here.
 */

/* ───────────────────────────────────────────────────────────── toast ──── */

const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  const show = useCallback((message, tone = 'ok') => {
    clearTimeout(timer.current);
    setToast({ message, tone, id: Date.now() });
    timer.current = setTimeout(() => setToast(null), 3600);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <ToastContext.Provider value={show}>
      {children}

      <div aria-live="polite" aria-atomic="true">
        {toast ? (
          <div className={cx('toast', toast.tone === 'error' && 'toast--error')} role="status">
            {toast.tone === 'error' ? (
              <AlertCircle size={15} strokeWidth={1.7} />
            ) : (
              <Check size={15} strokeWidth={1.7} />
            )}
            {toast.message}
          </div>
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

/* ────────────────────────────────────────────────────────────── page ──── */

export function PageHead({ title, meta, children }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-b border-ink/15 px-5 py-6 lg:px-8 lg:py-8">
      <div className="min-w-0">
        <h1 className="t-title">{title}</h1>
        {meta ? <p className="t-meta mt-2">{meta}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </header>
  );
}

export const Page = ({ children }) => <div className="pb-24">{children}</div>;

export const Section = ({ children, className }) => (
  <div className={cx('px-5 py-6 lg:px-8', className)}>{children}</div>
);

/* ───────────────────────────────────────────────────────────── fields ──── */

export function Field({ label, hint, error, required, children, className }) {
  return (
    <label className={cx('field', className)}>
      <span className="field__label">
        {label}
        {required ? <span className="field__req">*</span> : null}
      </span>
      {children}
      {error ? <span className="field__error">{error}</span> : null}
      {!error && hint ? <span className="field__hint">{hint}</span> : null}
    </label>
  );
}

export function Text({ label, hint, error, required, className, ...rest }) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      <input className="input" required={required} {...rest} />
    </Field>
  );
}

export function Area({ label, hint, error, required, className, ...rest }) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      <textarea className="input" required={required} {...rest} />
    </Field>
  );
}

export function Select({ label, hint, error, required, options, className, ...rest }) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      <select className="input" required={required} {...rest}>
        {options.map((option) =>
          typeof option === 'string' ? (
            <option key={option} value={option}>
              {option}
            </option>
          ) : (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          )
        )}
      </select>
    </Field>
  );
}

/** A switch that posts as a real checkbox, so it works inside a plain form. */
export function Toggle({ label, hint, name, defaultChecked, checked, onChange, disabled }) {
  const id = useId();

  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="peer sr-only"
      />
      {/*
        The knob is a child of this label, not a sibling of the input, so
        `peer-checked:` cannot reach it on its own — it has to be addressed
        through the label (`peer-checked:[&>span]:…`). Written the other way the
        switch sits still and turns ink-on-ink, which is what it used to do.
      */}
      <label
        htmlFor={id}
        aria-hidden="true"
        className="mt-[1px] inline-flex h-[22px] w-[38px] shrink-0 cursor-pointer items-center border border-ink/30 bg-paper-bright p-[3px] transition-colors peer-checked:border-ink peer-checked:bg-ink peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-stamp peer-disabled:cursor-not-allowed peer-disabled:opacity-40 peer-checked:[&>span]:translate-x-[16px] peer-checked:[&>span]:bg-paper"
      >
        <span className="block h-[14px] w-[14px] bg-ink/65 transition-[translate,background-color] duration-150 ease-out" />
      </label>

      <label htmlFor={id} className="cursor-pointer select-none">
        <span className="block text-[0.8125rem]">{label}</span>
        {hint ? <span className="t-meta block">{hint}</span> : null}
      </label>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── actions ──── */

export function SubmitButton({ children, variant = 'primary', className, ...rest }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className={cx('btn', `btn--${variant}`, className)}
      disabled={pending}
      {...rest}
    >
      {pending ? <Loader2 size={13} strokeWidth={1.8} className="animate-spin" /> : null}
      {children}
    </button>
  );
}

/**
 * A destructive action behind one deliberate confirmation. Not a browser
 * `confirm()` — that cannot be styled, and on a phone it is a system sheet
 * that reads as a crash.
 */
export function Confirm({ children, title, body, confirmLabel = 'Delete', onConfirm }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <span onClick={() => setOpen(true)}>{children}</span>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-ink-deep/70 p-5"
          onClick={() => setOpen(false)}
        >
          <div
            className="panel w-full max-w-[420px] p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="t-h2">{title}</h2>
            {body ? <p className="t-serif mt-3 text-[0.9375rem] text-pencil">{body}</p> : null}

            <div className="mt-7 flex justify-end gap-2">
              <button type="button" className="btn btn--ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--danger"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await onConfirm();
                    setOpen(false);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? <Loader2 size={13} strokeWidth={1.8} className="animate-spin" /> : null}
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

/** A dialog that holds a form — used for "add" and "edit" throughout. */
export function Modal({ open, onClose, title, description, children, wide }) {
  useEffect(() => {
    if (!open) return;
    document.body.dataset.lock = 'true';
    const onKey = (event) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);

    return () => {
      document.body.dataset.lock = 'false';
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[70] flex items-end justify-center bg-ink-deep/70 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className={cx(
          'panel max-h-[92svh] w-full overflow-y-auto',
          wide ? 'sm:max-w-[760px]' : 'sm:max-w-[520px]'
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="panel-head sticky top-0 z-10 bg-paper-bright">
          <div className="min-w-0">
            <h2 className="t-h2 truncate">{title}</h2>
            {description ? <p className="t-meta mt-1">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="btn btn--ghost btn--icon shrink-0"
          >
            <X size={14} strokeWidth={1.8} />
          </button>
        </div>

        <div className="p-5 lg:p-6">{children}</div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── empties ──── */

export function Empty({ title, body, children }) {
  return (
    <div className="panel flex flex-col items-start gap-3 p-8">
      <h3 className="t-h2">{title}</h3>
      {body ? <p className="t-serif max-w-[52ch] text-[0.9375rem] text-pencil">{body}</p> : null}
      {children}
    </div>
  );
}
