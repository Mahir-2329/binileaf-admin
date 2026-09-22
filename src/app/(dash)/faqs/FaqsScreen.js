'use client';

import { useMemo, useState, useTransition } from 'react';
import { ChevronDown, ChevronUp, Eye, EyeOff, Plus, SquarePen, Trash2 } from 'lucide-react';
import { Area, Confirm, Empty, Modal, Page, PageHead, Section, SubmitButton, Text, Toggle, useToast } from '@/components/ui';
import { cx } from '@/lib/utils';
import { deleteFaq, moveFaq, saveFaq, setFaqActive } from '@/server/faqs';

/**
 * FAQs.
 *
 * The order in this list is the order on the site and the order in the
 * structured data, so reordering is a first-class action rather than a
 * setting. Up and down buttons, not a drag: they work with a thumb, with a
 * keyboard and with a screen reader. A drag handle would be the nicer gesture
 * on a desktop and the only gesture that fails everywhere else.
 */

const blank = { id: null, question: '', answer: '', topic: 'general', is_active: true };

function FaqForm({ faq, topics, onSave, onCancel }) {
  const [form, setForm] = useState(() => ({ ...blank, ...(faq ?? {}) }));
  const [errors, setErrors] = useState({});

  const set = (patch) => setForm((current) => ({ ...current, ...patch }));

  async function submit() {
    const next = {};
    if (!form.question.trim()) next.question = 'Type the question the way someone would ask it.';
    if (!form.answer.trim()) next.answer = 'An answer is needed — this is what gets quoted.';

    setErrors(next);
    if (Object.keys(next).length) return;

    const result = await onSave({
      id: form.id,
      question: form.question,
      answer: form.answer,
      topic: form.topic,
      is_active: form.is_active,
    });

    if (result && result.ok === false) setErrors({ form: result.error });
  }

  return (
    <form action={submit} className="flex flex-col gap-5">
      <Text
        label="Question"
        required
        value={form.question}
        error={errors.question}
        maxLength={500}
        onChange={(event) => set({ question: event.target.value })}
        placeholder="What are Binileaf's opening hours?"
      />

      <Area
        label="Answer"
        required
        rows={5}
        value={form.answer}
        error={errors.answer}
        hint="Write it as a complete sentence that stands on its own. A search result or an assistant will show this line with no question next to it."
        onChange={(event) => set({ answer: event.target.value })}
      />

      <Text
        label="Topic"
        list="faq-topics"
        hint="Groups questions together. Lower case, one word, like visiting or franchise."
        value={form.topic}
        maxLength={40}
        onChange={(event) => set({ topic: event.target.value })}
      />
      <datalist id="faq-topics">
        {topics.map((topic) => (
          <option key={topic} value={topic} />
        ))}
      </datalist>

      <Toggle
        label="Shown on the site"
        hint="Hidden questions keep their wording and their place in the order."
        checked={form.is_active}
        onChange={(event) => set({ is_active: event.target.checked })}
      />

      {errors.form ? <p className="field__error">{errors.form}</p> : null}

      <div className="flex flex-wrap justify-end gap-2 border-t border-ink/15 pt-5">
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          Cancel
        </button>
        <SubmitButton>{form.id ? 'Save question' : 'Add question'}</SubmitButton>
      </div>
    </form>
  );
}

export default function FaqsScreen({ faqs }) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(null);

  const topics = useMemo(
    () => Array.from(new Set(faqs.map((faq) => faq.topic).filter(Boolean))).sort(),
    [faqs]
  );

  const shown = faqs.filter((faq) => faq.is_active).length;

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
    const result = await saveFaq(payload);
    if (result.ok) {
      toast(payload.id ? 'Question saved.' : 'Question added to the bottom of the list.');
      setEditing(null);
    }
    return result;
  }

  return (
    <Page>
      <PageHead
        title="FAQs"
        meta={`${shown} shown on the site · ${faqs.length} written`}
      >
        <button type="button" className="btn btn--primary" onClick={() => setEditing({})}>
          <Plus size={14} strokeWidth={1.8} aria-hidden="true" />
          New question
        </button>
      </PageHead>

      <Section className="pb-0">
        {/* Why the wording matters, said once, where it is read — not in a
            tooltip somebody has to go looking for. */}
        <div className="panel border-l-2 border-l-stamp p-5">
          <h2 className="t-label text-stamp">Written for machines as well as people</h2>
          <p className="t-serif mt-3 max-w-[64ch] text-[0.9375rem]">
            These answers are published three times over: on the site, inside the page&rsquo;s{' '}
            <span className="tabular">FAQPage</span> structured data, and in{' '}
            <span className="tabular">/llms.txt</span>. Search engines and AI assistants quote them
            back word for word, with no page around them. Write each answer as a full sentence that
            makes sense on its own — name the café, give the actual number, the actual address, the
            actual hours.
          </p>
          <p className="t-meta mt-3">
            The order below is the order they are published in.
          </p>
        </div>
      </Section>

      <Section>
        {!faqs.length ? (
          <Empty
            title="No questions yet"
            body="Start with the questions the café is asked on the phone: where it is, when it opens, whether the food is vegetarian."
          >
            <button type="button" className="btn btn--primary" onClick={() => setEditing({})}>
              <Plus size={14} strokeWidth={1.8} aria-hidden="true" />
              New question
            </button>
          </Empty>
        ) : (
          <ol className={cx('panel', pending && 'opacity-70')}>
            {faqs.map((faq, index) => (
              <li
                key={faq.id}
                className={cx(
                  'flex flex-wrap items-start gap-x-4 gap-y-3 border-b border-ink/15 p-4 last:border-b-0 lg:p-5',
                  !faq.is_active && 'bg-paper-shade/25'
                )}
              >
                <div className="flex shrink-0 flex-col gap-1">
                  <button
                    type="button"
                    className="btn btn--ghost btn--icon h-11 w-11"
                    disabled={index === 0}
                    aria-label={`Move “${faq.question}” up`}
                    onClick={() => run(() => moveFaq(faq.id, 'up'), 'Moved up.')}
                  >
                    <ChevronUp size={14} strokeWidth={1.8} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost btn--icon h-11 w-11"
                    disabled={index === faqs.length - 1}
                    aria-label={`Move “${faq.question}” down`}
                    onClick={() => run(() => moveFaq(faq.id, 'down'), 'Moved down.')}
                  >
                    <ChevronDown size={14} strokeWidth={1.8} aria-hidden="true" />
                  </button>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="t-meta tabular">{index + 1}</span>
                    <span className="tag tag--muted">{faq.topic}</span>
                    {faq.is_active ? null : <span className="tag tag--stamp">Hidden</span>}
                  </div>

                  <h3 className="t-h2 mt-2 break-words text-[1rem]">{faq.question}</h3>
                  <p className="t-serif mt-2 max-w-[70ch] break-words text-[0.875rem] text-pencil">
                    {faq.answer}
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm min-h-[44px]"
                    onClick={() => setEditing(faq)}
                  >
                    <SquarePen size={13} strokeWidth={1.8} aria-hidden="true" />
                    Edit
                  </button>

                  <button
                    type="button"
                    className="btn btn--ghost btn--sm min-h-[44px]"
                    onClick={() =>
                      run(
                        () => setFaqActive(faq.id, !faq.is_active),
                        faq.is_active ? 'Hidden from the site.' : 'Shown on the site.'
                      )
                    }
                  >
                    {faq.is_active ? (
                      <EyeOff size={13} strokeWidth={1.8} aria-hidden="true" />
                    ) : (
                      <Eye size={13} strokeWidth={1.8} aria-hidden="true" />
                    )}
                    {faq.is_active ? 'Hide' : 'Show'}
                  </button>

                  <Confirm
                    title="Delete this question?"
                    body="It comes off the site, out of the page's structured data and out of /llms.txt. Nothing is erased — it is archived. If you only want it off the site, hide it instead."
                    confirmLabel="Delete question"
                    onConfirm={() => run(() => deleteFaq(faq.id), 'Question deleted.')}
                  >
                    <button
                      type="button"
                      className="btn btn--danger btn--sm min-h-[44px]"
                      aria-label={`Delete “${faq.question}”`}
                    >
                      <Trash2 size={13} strokeWidth={1.8} aria-hidden="true" />
                    </button>
                  </Confirm>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Edit question' : 'New question'}
        description="Written the way it will be quoted."
      >
        {editing !== null ? (
          <FaqForm
            key={editing.id ?? 'new'}
            faq={editing.id ? editing : null}
            topics={topics}
            onSave={handleSave}
            onCancel={() => setEditing(null)}
          />
        ) : null}
      </Modal>
    </Page>
  );
}
