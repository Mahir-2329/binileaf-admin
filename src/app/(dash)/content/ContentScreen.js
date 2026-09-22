'use client';

import { useState } from 'react';
import { Area, SubmitButton, Text, useToast } from '@/components/ui';
import { saveContentBlock } from '@/server/content';
import Repeater from './Repeater';

/**
 * Page copy, as fields.
 *
 * These four rows are JSON in the database and prose on the site. Nobody is
 * going to hand-write a `paragraphs` array at eleven at night, so every shape
 * is broken into the things it actually is: lines to type and lists to
 * reorder. The shapes are re-imposed in `src/server/content.js` before they
 * are written, so nothing here can produce a row the site cannot read.
 *
 * Each block saves on its own. One giant save would mean an error in the
 * franchise copy losing an edit to the story.
 */

function BlockPanel({ title, where, hint, onSave, children }) {
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
      <div className="panel-head flex-wrap">
        <div className="min-w-0">
          <h2 className="t-h2">{title}</h2>
          <p className="t-meta mt-1">
            Appears on <span className="tabular">{where}</span>
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-5 p-5 lg:p-6">
        {hint ? <p className="t-serif text-[0.875rem] text-pencil">{hint}</p> : null}
        {children}

        {error ? <p className="field__error">{error}</p> : null}

        <div className="flex justify-end border-t border-ink/15 pt-5">
          <SubmitButton>Save {title.toLowerCase()}</SubmitButton>
        </div>
      </div>
    </form>
  );
}

const MARKDOWN_NOTE =
  'The site renders **bold** and *italic* in these paragraphs, so a pair of asterisks around a word emboldens it and a single pair italicises it. Everything else is printed exactly as typed.';

/* ─────────────────────────────────────────────────────────────── story ──── */

function StoryBlock({ initial }) {
  const [form, setForm] = useState({
    kicker: initial?.kicker ?? '',
    heading: initial?.heading ?? '',
    lede: initial?.lede ?? '',
    paragraphs: initial?.paragraphs ?? [],
    quoteText: initial?.quote?.text ?? '',
    quoteAttribution: initial?.quote?.attribution ?? '',
  });

  const set = (patch) => setForm((current) => ({ ...current, ...patch }));

  return (
    <BlockPanel
      title="The story"
      where="/about"
      onSave={() =>
        saveContentBlock('story', {
          kicker: form.kicker,
          heading: form.heading,
          lede: form.lede,
          paragraphs: form.paragraphs,
          quote: { text: form.quoteText, attribution: form.quoteAttribution },
        })
      }
    >
      <Text
        label="Kicker"
        hint="The small uppercase line above the heading."
        value={form.kicker}
        onChange={(event) => set({ kicker: event.target.value })}
      />
      <Text
        label="Heading"
        required
        value={form.heading}
        onChange={(event) => set({ heading: event.target.value })}
      />
      <Area
        label="Lede"
        hint="The opening sentence, set larger than the rest."
        rows={3}
        value={form.lede}
        onChange={(event) => set({ lede: event.target.value })}
      />

      <Repeater
        label="Paragraphs"
        hint={MARKDOWN_NOTE}
        items={form.paragraphs}
        onChange={(paragraphs) => set({ paragraphs })}
        createItem={() => ''}
        addLabel="Add a paragraph"
        emptyLabel="No paragraphs yet. The story reads as just a heading and a lede."
        rowLabel={(index) => `paragraph ${index + 1}`}
        renderRow={(item, index, update) => (
          <Area
            label={`Paragraph ${index + 1}`}
            rows={4}
            value={item}
            onChange={(event) => update(event.target.value)}
          />
        )}
      />

      <div className="border-l-2 border-stamp pl-4">
        <Area
          label="Pull quote"
          rows={3}
          hint="Set large and centred, near the end of the page."
          value={form.quoteText}
          onChange={(event) => set({ quoteText: event.target.value })}
        />
        <Text
          className="mt-4"
          label="Attribution"
          value={form.quoteAttribution}
          onChange={(event) => set({ quoteAttribution: event.target.value })}
          placeholder="The six of us"
        />
      </div>
    </BlockPanel>
  );
}

/* ────────────────────────────────────────────────────────────── values ──── */

function ValuesBlock({ initial }) {
  const [rows, setRows] = useState(Array.isArray(initial) ? initial : []);

  return (
    <BlockPanel
      title="What we stand for"
      where="/about"
      hint="Four short promises, printed as a numbered list. Each one needs a title and a sentence or two under it."
      onSave={() => saveContentBlock('values', rows)}
    >
      <Repeater
        label="Values"
        items={rows}
        onChange={setRows}
        createItem={() => ({ id: '', title: '', body: '' })}
        addLabel="Add a value"
        emptyLabel="No values yet."
        rowLabel={(index) => `value ${index + 1}`}
        renderRow={(item, index, update) => (
          <div className="flex flex-col gap-3">
            <Text
              label="Title"
              value={item.title}
              onChange={(event) => update({ ...item, title: event.target.value })}
            />
            <Area
              label="Body"
              rows={3}
              value={item.body}
              onChange={(event) => update({ ...item, body: event.target.value })}
            />
          </div>
        )}
      />

      <p className="t-meta">
        Each value keeps a short id used for its link on the page. An existing id is kept when you
        reword the title; a new value takes one from its title.
      </p>
    </BlockPanel>
  );
}

/* ─────────────────────────────────────────────────────────── franchise ──── */

function FranchiseBlock({ initial }) {
  const [form, setForm] = useState({
    kicker: initial?.kicker ?? '',
    heading: initial?.heading ?? '',
    lede: initial?.lede ?? '',
    reasons: initial?.reasons ?? [],
    included: initial?.included ?? [],
  });

  const set = (patch) => setForm((current) => ({ ...current, ...patch }));

  return (
    <BlockPanel
      title="The franchise pitch"
      where="/franchise"
      onSave={() => saveContentBlock('franchise', form)}
    >
      <Text
        label="Kicker"
        value={form.kicker}
        onChange={(event) => set({ kicker: event.target.value })}
      />
      <Text
        label="Heading"
        required
        value={form.heading}
        onChange={(event) => set({ heading: event.target.value })}
      />
      <Area
        label="Lede"
        rows={3}
        value={form.lede}
        onChange={(event) => set({ lede: event.target.value })}
      />

      <Repeater
        label="Reasons"
        hint="Why someone would open one. Title and a sentence each."
        items={form.reasons}
        onChange={(reasons) => set({ reasons })}
        createItem={() => ({ title: '', body: '' })}
        addLabel="Add a reason"
        emptyLabel="No reasons yet."
        rowLabel={(index) => `reason ${index + 1}`}
        renderRow={(item, index, update) => (
          <div className="flex flex-col gap-3">
            <Text
              label="Title"
              value={item.title}
              onChange={(event) => update({ ...item, title: event.target.value })}
            />
            <Area
              label="Body"
              rows={3}
              value={item.body}
              onChange={(event) => update({ ...item, body: event.target.value })}
            />
          </div>
        )}
      />

      <Repeater
        label="What is included"
        hint="One line per thing. Printed as a ticked list."
        items={form.included}
        onChange={(included) => set({ included })}
        createItem={() => ''}
        addLabel="Add a line"
        emptyLabel="Nothing listed yet."
        rowLabel={(index) => `line ${index + 1}`}
        renderRow={(item, index, update) => (
          <Text
            label={`Line ${index + 1}`}
            value={item}
            onChange={(event) => update(event.target.value)}
          />
        )}
      />
    </BlockPanel>
  );
}

/* ────────────────────────────────────────────────────────── quickFacts ──── */

function QuickFactsBlock({ initial }) {
  const [rows, setRows] = useState(Array.isArray(initial) ? initial : []);

  return (
    <BlockPanel
      title="Quick facts"
      where="/llms.txt"
      hint="Short factual lines. These feed the plain-text summary that answer engines read, so keep them literal — a label and the fact, nothing more."
      onSave={() => saveContentBlock('quickFacts', rows)}
    >
      <Repeater
        label="Facts"
        items={rows}
        onChange={setRows}
        createItem={() => ({ label: '', value: '' })}
        addLabel="Add a fact"
        emptyLabel="No facts yet."
        rowLabel={(index) => `fact ${index + 1}`}
        renderRow={(item, index, update) => (
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <Text
              label="Label"
              value={item.label}
              onChange={(event) => update({ ...item, label: event.target.value })}
              placeholder="Opened"
            />
            <Text
              label="Value"
              value={item.value}
              onChange={(event) => update({ ...item, value: event.target.value })}
              placeholder="2025"
            />
          </div>
        )}
      />
    </BlockPanel>
  );
}

/* ──────────────────────────────────────────────────────────── the screen ──── */

export default function ContentScreen({ blocks }) {
  return (
    <div className="flex flex-col gap-5">
      <StoryBlock initial={blocks.story} />
      <ValuesBlock initial={blocks.values} />
      <FranchiseBlock initial={blocks.franchise} />
      <QuickFactsBlock initial={blocks.quickFacts} />
    </div>
  );
}
