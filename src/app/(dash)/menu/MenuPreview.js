'use client';

import { Fragment } from 'react';
import { cx } from '@/lib/utils';
import {
  FAMILY_NAME,
  FAMILY_RULE,
  NO_CHIP_GROUPS,
  PLATE_SECTION,
  SHADED_GROUPS,
  WIDTHS,
  activeItems,
  planCard,
  plateColumns,
} from './shared';

/**
 * Where each category lands on the public menu page.
 *
 * This is a layout map, not a rendering of the card: no prices, no photographs,
 * no type set the way the site sets it. What it is faithful about is position —
 * which column a category falls in at a given width, which sub-column inside
 * Cold Beverages, which categories share a row, and what is left empty. Those
 * are the things that change when the operator moves something, and the things
 * they cannot otherwise see without publishing and looking.
 *
 * It is built from the same rows the editor is holding, so it moves the instant
 * an edit does and stays right whether or not the site is running.
 */

/** Only what the public page would actually print. */
function live(sections) {
  return sections
    .filter((section) => section.isActive)
    .map((section) => ({ ...section, groups: section.groups.filter((group) => group.isActive) }));
}

function GroupBlock({ group, onPick }) {
  const items = activeItems(group);
  const off = items.filter((item) => !item.isAvailable).length;

  return (
    <button
      type="button"
      onClick={() => onPick(group.id)}
      className={cx(
        'block w-full border-t-2 px-2 pb-2 pt-[6px] text-left transition-colors hover:bg-paper-shade/60',
        FAMILY_RULE[group.family] ?? FAMILY_RULE.ink,
        SHADED_GROUPS.has(group.slug) && 'bg-paper-shade'
      )}
      title={`${group.title} — ${FAMILY_NAME[group.family] ?? 'Plain'} rule${
        SHADED_GROUPS.has(group.slug) ? ', on a tinted field' : ''
      }`}
    >
      <span className="block truncate font-[family-name:var(--font-display)] text-[0.8125rem] leading-tight">
        {group.title}
      </span>
      <span className="t-meta tabular mt-1 block">
        {items.length} item{items.length === 1 ? '' : 's'}
        {off ? ` · ${off} off` : ''}
      </span>
      {NO_CHIP_GROUPS.has(group.slug) ? (
        <span className="t-meta mt-1 block italic">no jump chip</span>
      ) : null}
    </button>
  );
}

function SectionCell({ cell, total, onPick }) {
  const { section, span, columns } = cell;

  return (
    <div style={{ gridColumn: `span ${span}` }} className="min-w-0">
      <p className="truncate font-[family-name:var(--font-display)] text-[0.9375rem] leading-tight">
        {section.title}
      </p>
      <div className="mt-2 border-t-2 border-ink" />

      <div
        className="mt-3 grid gap-x-3 gap-y-3"
        style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
      >
        {columns.map((column) => (
          <div key={column.index} className="flex min-w-0 flex-col gap-3">
            {total > 1 ? (
              <p className="t-label tabular text-pencil">Column {column.index}</p>
            ) : null}

            {column.groups.length ? (
              column.groups.map((group) => (
                <GroupBlock key={group.id} group={group} onPick={onPick} />
              ))
            ) : (
              <p className="t-meta italic">No categories.</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MenuPreview({ sections, width, onWidth, onPick }) {
  const shown = live(sections);
  const card = shown.filter((section) => section.slug !== PLATE_SECTION);
  const plate = shown.find((section) => section.slug === PLATE_SECTION) ?? null;

  const { total, rows } = planCard(card, width);
  const plateCols = plateColumns(width);

  // Retired sections, plus retired categories inside the sections that are
  // still printed — a retired category inside a retired section is already
  // counted once and should not be counted twice.
  const hidden =
    sections.filter((section) => !section.isActive).length +
    sections
      .filter((section) => section.isActive)
      .reduce((n, section) => n + section.groups.filter((group) => !group.isActive).length, 0);

  return (
    <div className="flex flex-col">
      {/* ── widths ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-ink/15 px-4 py-3">
        <span className="t-label text-pencil">Width</span>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Preview width">
          {WIDTHS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              className="chip"
              aria-pressed={width === preset.value}
              onClick={() => onWidth(preset.value)}
            >
              {preset.label}
              <span className="tabular opacity-60">{preset.note}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4">
        <p className="t-meta">
          The card is set in {total} column{total === 1 ? '' : 's'} at {width}px. Categories are
          placed in the order they are listed in the editor.
        </p>

        {/* ── the card ───────────────────────────────────────────────── */}
        <div className="mt-4 flex flex-col gap-6 border border-ink/15 bg-paper p-3">
          {rows.map((row, index) => (
            <Fragment key={index}>
              <div
                className="grid gap-x-3"
                style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}
              >
                {row.cells.map((cell) => (
                  <SectionCell key={cell.section.id} cell={cell} total={total} onPick={onPick} />
                ))}

                {/*
                  A row that does not fill is worth printing, not hiding. It is
                  what happens when a two-column-wide section will not fit in
                  what is left of a row: grid moves it down whole and nothing
                  backfills the gap, so the card ends up with blank paper.
                */}
                {row.filled < total ? (
                  <div
                    style={{ gridColumn: `span ${total - row.filled}` }}
                    className="flex items-center justify-center border border-dashed border-ink/25 p-3"
                  >
                    <span className="t-meta italic">empty paper</span>
                  </div>
                ) : null}
              </div>

              {index < rows.length - 1 ? <div className="border-t border-ink/15" /> : null}
            </Fragment>
          ))}

          {rows.length ? null : <p className="t-meta italic">Nothing is on the card.</p>}
        </div>

        {/* ── the second plate ───────────────────────────────────────── */}
        {plate ? (
          <div className="mt-4 bg-ink-deep p-3 text-paper">
            <p className="truncate font-[family-name:var(--font-display)] text-[0.9375rem] leading-tight">
              {plate.title}
            </p>
            <div className="mt-2 border-t-2 border-brass" />
            <p className="t-meta mt-2 text-paper-dim">
              Full width, below the card, on its own navy plate.
            </p>

            <div
              className="mt-3 grid gap-3"
              style={{ gridTemplateColumns: `repeat(${plateCols}, minmax(0, 1fr))` }}
            >
              {plate.groups.map((group) => {
                const items = activeItems(group);
                const off = items.filter((item) => !item.isAvailable).length;

                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => onPick(group.id)}
                    className="block w-full border-t-2 border-brass px-2 pb-2 pt-[6px] text-left transition-colors hover:bg-ink-wash/40"
                  >
                    <span className="block truncate font-[family-name:var(--font-display)] text-[0.8125rem] leading-tight">
                      {group.title}
                    </span>
                    <span className="tabular mt-1 block text-[0.75rem] text-paper-dim">
                      {items.length} item{items.length === 1 ? '' : 's'}
                      {off ? ` · ${off} off` : ''}
                    </span>
                    {NO_CHIP_GROUPS.has(group.slug) ? (
                      <span className="mt-1 block text-[0.75rem] italic text-paper-dim">
                        no jump chip
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* ── legend ─────────────────────────────────────────────────── */}
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-ink/15 pt-3">
          <span className="tag tag--brass">Coffee</span>
          <span className="tag tag--leaf">Tea</span>
          <span className="tag tag--muted">Plain</span>
          <span className="t-meta inline-flex items-center gap-2">
            <span className="inline-block h-3 w-5 bg-paper-shade" aria-hidden="true" />
            tinted field
          </span>
          <span className="t-meta inline-flex items-center gap-2">
            <span className="inline-block h-3 w-5 bg-ink-deep" aria-hidden="true" />
            navy plate
          </span>
        </div>

        {hidden ? (
          <p className="t-meta mt-3">
            {hidden} retired {hidden === 1 ? 'thing is' : 'things are'} not drawn here — retired
            means off the public card.
          </p>
        ) : null}
      </div>
    </div>
  );
}
