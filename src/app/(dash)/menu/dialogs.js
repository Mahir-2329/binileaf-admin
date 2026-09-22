'use client';

import { useActionState, useEffect, useId, useRef, useState } from 'react';
import { Field, Modal, SubmitButton, Text, Toggle } from '@/components/ui';
import { saveGroup, saveItem, saveSection } from '@/server/menu';
import { FAMILIES } from './shared';

/**
 * The three forms, each in a dialog.
 *
 * All of them post a Server Action through `useActionState`, so they submit
 * without JavaScript having to assemble anything, and all of them read the
 * reply the same way: `{ ok }` closes the dialog, `{ error, field }` prints the
 * sentence under the box that caused it.
 */

const IDLE = { ok: false, error: null, field: null, ts: 0 };

/** Close on a fresh success, and only on a fresh one. */
function useCloseOnSave(state, onDone, label) {
  const seen = useRef(0);

  useEffect(() => {
    if (!state.ok || state.ts === seen.current) return;
    seen.current = state.ts;
    onDone(label, state.createdId);
  }, [state, onDone, label]);
}

/** The server names the box it objected to; everything else stays quiet. */
const errorFor = (state, name) => (state.field === name ? state.error : null);

/** An error with no box to sit under still has to be read. */
function FormError({ state }) {
  if (!state.error || state.field) return null;

  return (
    <p role="alert" className="border border-stamp/45 bg-stamp/5 p-3 text-[0.8125rem] text-stamp-deep">
      {state.error}
    </p>
  );
}

function Footer({ children, onCancel, label }) {
  return (
    <div className="mt-7 flex flex-wrap items-center justify-end gap-2 border-t border-ink/15 pt-5">
      {children}
      <button type="button" className="btn btn--ghost" onClick={onCancel}>
        Cancel
      </button>
      <SubmitButton>{label}</SubmitButton>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── item ──── */

export function ItemDialog({ item, groupId, sections, onClose, onSaved }) {
  const [state, action] = useActionState(saveItem, IDLE);
  useCloseOnSave(state, onSaved, item ? 'Item saved' : 'Item added');

  // The was-price rule is checked as it is typed as well as on the server, so
  // nobody fills in a long form to be told at the end.
  const [price, setPrice] = useState(item ? String(item.price) : '');
  const [was, setWas] = useState(item?.comparePrice != null ? String(item.comparePrice) : '');

  const priceNumber = Number(price);
  const wasNumber = Number(was);
  const wasTooLow =
    was.trim() !== '' &&
    price.trim() !== '' &&
    Number.isFinite(priceNumber) &&
    Number.isFinite(wasNumber) &&
    wasNumber <= priceNumber;

  const selectId = useId();

  return (
    <Modal
      open
      onClose={onClose}
      title={item ? item.name : 'New item'}
      description={item ? 'Everything on this row of the card.' : 'It will be added to the end of the category.'}
      wide
    >
      <form action={action} className="flex flex-col gap-5">
        {item ? <input type="hidden" name="id" value={item.id} /> : null}

        <FormError state={state} />

        <Text
          label="Name"
          name="name"
          required
          defaultValue={item?.name ?? ''}
          autoFocus
          error={errorFor(state, 'name')}
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <Text
            label="Price"
            name="price"
            required
            inputMode="numeric"
            className="tabular"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            hint="Whole rupees."
            error={errorFor(state, 'price')}
          />

          <Text
            label="Was price"
            name="comparePrice"
            inputMode="numeric"
            className="tabular"
            value={was}
            onChange={(event) => setWas(event.target.value)}
            hint="Only for a deal — the card prints it struck through. Leave it empty otherwise."
            error={
              wasTooLow
                ? 'The was price has to be more than the price you charge now.'
                : errorFor(state, 'comparePrice')
            }
          />
        </div>

        <Field
          label="Category"
          hint="Changing this moves the item, and it lands at the end of the category it arrives in."
          error={errorFor(state, 'groupId')}
        >
          <select
            id={selectId}
            name="groupId"
            className="input"
            defaultValue={item?.groupId ?? groupId}
            required
          >
            {sections.map((section) => (
              <optgroup key={section.id} label={section.title}>
                {section.groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.title}
                    {group.isActive ? '' : ' (retired)'}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>

        <Text
          label="Line under the name"
          name="note"
          defaultValue={item?.note ?? ''}
          hint="Printed under the name on the card — “double shot, no milk”."
        />

        <Text
          label="Longer description"
          name="description"
          defaultValue={item?.description ?? ''}
          hint="Kept for search and future use; the printed card does not show it."
        />

        <fieldset className="grid gap-4 border border-ink/15 p-4 sm:grid-cols-2">
          <legend className="t-label px-2 text-pencil">Marks and standing</legend>

          <Toggle
            name="isStar"
            defaultChecked={item?.isStar ?? false}
            label="House special"
            hint="Prints the cat-and-cup mark."
          />
          <Toggle name="isNew" defaultChecked={item?.isNew ?? false} label="New" hint="Prints a new flag." />
          <Toggle
            name="isAvailable"
            defaultChecked={item?.isAvailable ?? true}
            label="Available today"
            hint="Turn off when you run out. It stays on the card."
          />
          <Toggle
            name="isActive"
            defaultChecked={item?.isActive ?? true}
            label="On the menu"
            hint="Turn off to retire it for good. It leaves the card."
          />
        </fieldset>

        <Footer onCancel={onClose} label={item ? 'Save item' : 'Add item'} />
      </form>
    </Modal>
  );
}

/* ─────────────────────────────────────────────────────────── category ──── */

export function GroupDialog({ group, sectionId, sections, onClose, onSaved }) {
  const [state, action] = useActionState(saveGroup, IDLE);
  useCloseOnSave(state, onSaved, group ? 'Category saved' : 'Category added');

  return (
    <Modal
      open
      onClose={onClose}
      title={group ? group.title : 'New category'}
      description="A block on the card — a heading, a rule and its list of prices."
    >
      <form action={action} className="flex flex-col gap-5">
        {group ? <input type="hidden" name="id" value={group.id} /> : null}

        <FormError state={state} />

        <Text
          label="Name"
          name="title"
          required
          defaultValue={group?.title ?? ''}
          autoFocus
          error={errorFor(state, 'title')}
        />

        <Field label="Part of the menu" error={errorFor(state, 'sectionId')}>
          <select
            name="sectionId"
            className="input"
            defaultValue={group?.sectionId ?? sectionId}
            required
          >
            {sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.title}
                {section.isActive ? '' : ' (hidden)'}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Rule colour" error={errorFor(state, 'family')}>
          <select name="family" className="input" defaultValue={group?.family ?? 'ink'}>
            {FAMILIES.map((family) => (
              <option key={family.value} value={family.value}>
                {family.label}
              </option>
            ))}
          </select>
        </Field>

        <Text
          label="Note"
          name="note"
          defaultValue={group?.note ?? ''}
          hint="One italic line under the heading, if it needs one."
        />

        {group ? (
          <Text
            label="Web address"
            name="slug"
            defaultValue={group.slug}
            className="tabular"
            hint={`Links to this category use /menu#${group.slug}. Changing it breaks any link already out there.`}
            error={errorFor(state, 'slug')}
          />
        ) : null}

        <Toggle
          name="isActive"
          defaultChecked={group?.isActive ?? true}
          label="On the menu"
          hint="Turn off to take the whole category off the card. Its items are kept."
        />

        <Footer onCancel={onClose} label={group ? 'Save category' : 'Add category'} />
      </form>
    </Modal>
  );
}

/* ──────────────────────────────────────────────────────────── section ──── */

export function SectionDialog({ section, onClose, onSaved }) {
  const [state, action] = useActionState(saveSection, IDLE);
  useCloseOnSave(state, onSaved, section ? 'Saved' : 'Part of the menu added');

  return (
    <Modal
      open
      onClose={onClose}
      title={section ? section.title : 'New part of the menu'}
      description={
        section
          ? 'A whole column of the card.'
          : 'This adds a column to the printed card. It is not something to do often.'
      }
    >
      <form action={action} className="flex flex-col gap-5">
        {section ? <input type="hidden" name="id" value={section.id} /> : null}

        <FormError state={state} />

        <Text
          label="Name"
          name="title"
          required
          defaultValue={section?.title ?? ''}
          autoFocus
          error={errorFor(state, 'title')}
        />

        <Text label="Kicker" name="kicker" defaultValue={section?.kicker ?? ''} hint="A small line above the heading." />

        <Text
          label="Blurb"
          name="blurb"
          defaultValue={section?.blurb ?? ''}
          hint="One sentence. The Barista Special plate is the one that prints it."
        />

        {section ? (
          <Text
            label="Web address"
            name="slug"
            defaultValue={section.slug}
            className="tabular"
            hint={
              section.slug === 'barista' || section.slug === 'cold'
                ? `The public page recognises "${section.slug}" by name and lays it out specially. Renaming it here turns that off.`
                : 'Used by links into the menu page.'
            }
            error={errorFor(state, 'slug')}
          />
        ) : null}

        <Toggle
          name="isActive"
          defaultChecked={section?.isActive ?? true}
          label="On the menu"
          hint="Turn off to take the whole column off the card."
        />

        <Footer onCancel={onClose} label={section ? 'Save' : 'Add it'} />
      </form>
    </Modal>
  );
}
