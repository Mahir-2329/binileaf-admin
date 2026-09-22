'use client';

import { useCallback, useState } from 'react';

/**
 * The things the editor and the preview both have to agree about.
 *
 * The layout rules below are a copy of what the public menu page does, not a
 * guess at it. If `web/src/components/menu/MenuBrowser.js` changes, this file
 * changes with it — that is the price of a preview that keeps working when the
 * site is not running.
 */

/* ────────────────────────────────────────────────────────── families ──── */

export const FAMILIES = [
  { value: 'bean', label: 'Coffee — brass rule' },
  { value: 'leaf', label: 'Tea — green rule' },
  { value: 'ink', label: 'Plain — ink rule' },
];

export const FAMILY_NAME = { bean: 'Coffee', leaf: 'Tea', ink: 'Plain' };

/** The rule colour a category is printed with on the card. */
export const FAMILY_RULE = {
  bean: 'border-brass',
  leaf: 'border-leaf',
  ink: 'border-ink',
};

export const FAMILY_TAG = { bean: 'tag--brass', leaf: 'tag--leaf', ink: 'tag--muted' };

/* ───────────────────────────────────────────── the public page's rules ──── */

/** The one section printed as a second, inverted plate below the card. */
export const PLATE_SECTION = 'barista';

/** Cold Beverages carries a third more items, so it takes a double column. */
export const WIDE_SECTIONS = new Set(['cold']);

/** The one category that sits on a tinted field. */
export const SHADED_GROUPS = new Set(['lemonade']);

/** Not given a chip in the public page's jump rail. */
export const NO_CHIP_GROUPS = new Set(['add-ons']);

export const WIDTHS = [
  { value: 390, label: 'Phone', note: '390px' },
  { value: 768, label: 'Tablet', note: '768px' },
  { value: 1280, label: 'Desktop', note: '1280px' },
];

/**
 * How many columns the card is set in at a given viewport width.
 *
 * The public grid is `md:grid-cols-2 xl:grid-cols-4` with no base class, so it
 * is one column below Tailwind's `md` (768px) and four from `xl` (1280px).
 */
export const columnCount = (width) => (width >= 1280 ? 4 : width >= 768 ? 2 : 1);

/**
 * Lay the sections out the way CSS grid would.
 *
 * Every section is one grid item placed in document order. `cold` carries
 * `xl:col-span-2`, so at four columns it occupies two of them — which is why
 * the order of the sections decides where everything lands: auto-placement is
 * not `dense`, so a two-wide section that will not fit in what is left of a
 * row moves to the next row whole and leaves the remainder of the old row
 * empty. Nothing after it backfills that hole. Move Cold Beverages to the end
 * of the list and the operator can watch a third of the card go blank, which
 * is exactly the thing this preview exists to show.
 *
 * Inside a two-wide section the categories are split into two stacks of
 * roughly equal depth and read down the first, then the second — the way a
 * printed card is read. They are stacks, not grid rows, so a short category
 * never waits for a tall neighbour. Everywhere else the groups are a plain
 * stack too.
 */

/**
 * The same split the public page makes — see `splitStacks` in
 * `web/src/components/menu/MenuBrowser.js`. Weight, not count, so the two
 * stacks end at about the same depth.
 */
export function splitStacks(groups) {
  const weigh = (group) => 1 + (group.items?.length ?? 0);
  const total = groups.reduce((sum, group) => sum + weigh(group), 0);

  const left = [];
  const right = [];
  let filled = 0;

  for (const group of groups) {
    const weight = weigh(group);
    const room = filled + weight / 2 <= total / 2 || left.length === 0;
    const last = right.length === 0 && groups.indexOf(group) === groups.length - 1;

    if (room && !last) {
      left.push(group);
      filled += weight;
    } else {
      right.push(group);
    }
  }

  return [left, right];
}
export function planCard(sections, width) {
  const total = columnCount(width);
  const rows = [];
  let row = null;
  let cursor = 0;

  for (const section of sections) {
    const span = total === 4 && WIDE_SECTIONS.has(section.slug) ? 2 : 1;

    if (!row || cursor + span > total) {
      row = { cells: [], filled: 0 };
      rows.push(row);
      cursor = 0;
    }

    const start = cursor;
    const columns =
      span === 2
        ? // Two stacks, split by depth, read down one and then the other.
          (() => {
            const [left, right] = splitStacks(section.groups);
            return [
              { index: start + 1, groups: left },
              { index: start + 2, groups: right },
            ];
          })()
        : [{ index: start + 1, groups: section.groups }];

    row.cells.push({ section, span, start, columns });
    row.filled = start + span;
    cursor += span;
    if (cursor >= total) row = null;
  }

  return { total, rows };
}

/**
 * The plate below the card runs its categories in `lg:grid-cols-2` — Tailwind's
 * `lg` is 1024px, so the tablet preset still stacks them.
 */
export const plateColumns = (width) => (width >= 1024 ? 2 : 1);

/* ─────────────────────────────────────────────────────────── counting ──── */

export const activeItems = (group) => group.items.filter((item) => item.isActive);

export const countItems = (groups) =>
  groups.reduce((sum, group) => sum + activeItems(group).length, 0);

export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/* ───────────────────────────────────────────────────── array movement ──── */

/** Move one id one place. Returns the same array when it cannot move. */
export function shift(ids, id, delta) {
  const from = ids.indexOf(id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= ids.length) return ids;

  const next = ids.slice();
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}

/** Drop `id` immediately before or after `target`. */
export function place(ids, id, target, edge) {
  if (id === target) return ids;

  const without = ids.filter((value) => value !== id);
  const at = without.indexOf(target);
  if (at < 0) return ids;

  without.splice(edge === 'after' ? at + 1 : at, 0, id);
  return without;
}

/* ─────────────────────────────────────────────────────────── dragging ──── */

/**
 * Pointer dragging, added on top of the up/down buttons rather than instead of
 * them: the buttons are the path that works with a keyboard, on a phone and
 * with a screen reader, so the handle is `aria-hidden` and carries no state
 * anyone needs to reach.
 *
 * `scope` keeps a drag inside the list it began in — otherwise dragging an
 * item over a category header in another section would look like a legal drop.
 */
export function useDrag(scope, order, commit) {
  const [dragging, setDragging] = useState(null);
  const [over, setOver] = useState(null);

  const end = useCallback(() => {
    setDragging(null);
    setOver(null);
  }, []);

  const handleProps = (id) => ({
    draggable: true,
    className: 'grab',
    'aria-hidden': true,
    onDragStart: (event) => {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', `${scope}:${id}`);
      setDragging(id);
    },
    onDragEnd: end,
  });

  const zoneProps = (id) => ({
    onDragOver: (event) => {
      if (!dragging || dragging === id) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';

      const box = event.currentTarget.getBoundingClientRect();
      setOver({ id, edge: event.clientY > box.top + box.height / 2 ? 'after' : 'before' });
    },
    onDragLeave: () => setOver((current) => (current?.id === id ? null : current)),
    onDrop: (event) => {
      event.preventDefault();
      if (!dragging || !event.dataTransfer.getData('text/plain').startsWith(`${scope}:`)) return end();

      const edge = over?.id === id ? over.edge : 'before';
      const next = place(order, dragging, id, edge);

      // Dropping something back where it was is not an edit, and should not
      // cost a round trip or a line in the audit log.
      if (next.some((value, index) => value !== order[index])) commit(next);
      return end();
    },
    className:
      dragging === id ? 'dragging' : over?.id === id ? `drop-${over.edge}` : undefined,
  });

  return { handleProps, zoneProps, dragging };
}
