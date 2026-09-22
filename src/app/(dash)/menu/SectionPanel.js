'use client';

import { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { Confirm } from '@/components/ui';
import { cx } from '@/lib/utils';
import ItemRow from './ItemRow';
import RowSheet, { SheetRow } from './RowSheet';
import { FAMILY_NAME, FAMILY_TAG, activeItems, countItems, plural, useDrag } from './shared';

/**
 * One part of the menu, its categories, and their items.
 *
 * The three levels are drawn as three depths of the same panel rather than as
 * three screens: the café's question is almost always "where does this sit and
 * what is next to it", and that is only answerable with the neighbours in view.
 */

/*
  Bare glyphs, not boxed buttons: see `.iconb` in globals.css. `quiet` keeps a
  control in the DOM but out of sight until the row it belongs to is pointed at.
*/

/* ─────────────────────────────────────────────────────────── category ──── */

function Category({ section, group, first, last, open, selected, handlers }) {
  const [sheet, setSheet] = useState(false);
  const items = group.items;
  const ids = items.map((item) => item.id);
  const live = activeItems(group).length;
  const off = items.filter((item) => item.isActive && !item.isAvailable).length;

  const drag = useDrag(`items:${group.id}`, ids, (next) => handlers.reorderItems(group.id, next));

  const allSelected = ids.length > 0 && ids.every((id) => selected.has(id));
  const zone = handlers.groupZone(group.id);
  const handle = handlers.groupHandle(group.id);

  const run = (action) => () => {
    setSheet(false);
    action();
  };

  const deleteBody = items.length
    ? `This deletes the category and the ${plural(
        items.length,
        'item',
        'items'
      )} in it. To take it off the card without losing the prices, edit it and turn "On the menu" off instead.`
    : 'The category is empty, so only the heading goes.';

  return (
    <div id={`group-${group.id}`} className="border-b border-ink/15 last:border-b-0">
      <div
        {...zone}
        className={cx(
          'hit group/cat flex flex-wrap items-center gap-x-2 gap-y-1 border-y border-ink/10 bg-paper-shade/45 py-1 pl-1 pr-2 lg:pl-2 lg:pr-3',
          !group.isActive && 'opacity-70',
          zone.className
        )}
      >
        {/* Handle then checkbox, in the same two columns the item rows use. */}
        <span
          {...handle}
          className={cx(
            handle.className,
            'hidden w-4 shrink-0 text-pencil/0 transition-colors group-hover/cat:text-pencil/70 lg:block'
          )}
        >
          <GripVertical size={15} strokeWidth={1.6} />
        </span>

        <label className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center">
          <span className="sr-only">Select every item in {group.title}</span>
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(event) => handlers.selectMany(ids, event.target.checked)}
            className="h-[15px] w-[15px] accent-[var(--color-ink)]"
            disabled={!ids.length}
          />
        </label>

        <button
          type="button"
          onClick={() => handlers.toggleOpen(group.id)}
          aria-expanded={open}
          aria-controls={`items-${group.id}`}
          className="flex min-w-0 flex-1 basis-[min(100%,10rem)] items-center gap-2 py-2 text-left lg:basis-[min(100%,12rem)]"
        >
          {open ? (
            <ChevronDown size={15} strokeWidth={1.7} className="shrink-0 text-pencil" />
          ) : (
            <ChevronRight size={15} strokeWidth={1.7} className="shrink-0 text-pencil" />
          )}
          <span className="t-h2 truncate text-[1rem]">{group.title}</span>
          <span className={cx('tag hidden shrink-0 lg:inline-flex', FAMILY_TAG[group.family])}>
            {FAMILY_NAME[group.family]}
          </span>
          {group.isActive ? null : <span className="tag tag--muted shrink-0">Retired</span>}
        </button>

        <span className="t-meta tabular shrink-0 px-1">
          {plural(live, 'item', 'items')}
          {off ? ` · ${off} off` : ''}
        </span>

        <div className="actions ml-auto shrink-0">
          <button
            type="button"
            className="iconb"
            aria-label={`Add an item to ${group.title}`}
            title="Add an item"
            onClick={() => handlers.addItem(group.id)}
          >
            <Plus size={16} strokeWidth={1.8} />
          </button>

          <span className="quiet mx-1 hidden h-4 w-px bg-ink/15 lg:block" aria-hidden="true" />

          {/* Phone: one button in place of the four below. */}
          <button
            type="button"
            className="iconb lg:hidden"
            aria-label={`More for ${group.title}`}
            aria-haspopup="dialog"
            onClick={() => setSheet(true)}
          >
            <MoreHorizontal size={16} strokeWidth={1.8} />
          </button>

          <button
            type="button"
            className="iconb quiet hidden lg:inline-flex"
            disabled={first}
            aria-label={`Move ${group.title} up`}
            onClick={() => handlers.moveGroup(section.id, group.id, -1)}
          >
            <ChevronUp size={15} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            className="iconb quiet hidden lg:inline-flex"
            disabled={last}
            aria-label={`Move ${group.title} down`}
            onClick={() => handlers.moveGroup(section.id, group.id, 1)}
          >
            <ChevronDown size={15} strokeWidth={1.8} />
          </button>

          <button
            type="button"
            className="iconb quiet hidden lg:inline-flex"
            aria-label={`Edit ${group.title}`}
            title="Edit the category"
            onClick={() => handlers.editGroup(group)}
          >
            <Pencil size={14} strokeWidth={1.7} />
          </button>

          <span className="hidden lg:inline-flex">
            <Confirm
              title={`Delete ${group.title}?`}
              body={deleteBody}
              confirmLabel="Delete category"
              onConfirm={() => handlers.deleteGroup(group)}
            >
              <button
                type="button"
                className="iconb iconb--danger quiet"
                aria-label={`Delete ${group.title}`}
                title="Delete the category"
              >
                <Trash2 size={14} strokeWidth={1.7} />
              </button>
            </Confirm>
          </span>
        </div>

        <RowSheet title={group.title} open={sheet} onClose={() => setSheet(false)}>
          <SheetRow
            icon={Plus}
            label="Add an item here"
            onClick={run(() => handlers.addItem(group.id))}
          />
          <SheetRow
            icon={Pencil}
            label="Edit this category"
            hint="Name, rule colour, whether it prints"
            onClick={run(() => handlers.editGroup(group))}
          />
          <SheetRow
            icon={ChevronUp}
            label="Move up"
            disabled={first}
            onClick={run(() => handlers.moveGroup(section.id, group.id, -1))}
          />
          <SheetRow
            icon={ChevronDown}
            label="Move down"
            disabled={last}
            onClick={run(() => handlers.moveGroup(section.id, group.id, 1))}
          />

          <Confirm
            title={`Delete ${group.title}?`}
            body={deleteBody}
            confirmLabel="Delete category"
            onConfirm={() => {
              setSheet(false);
              handlers.deleteGroup(group);
            }}
          >
            <SheetRow icon={Trash2} label="Delete this category" tone="danger" />
          </Confirm>
        </RowSheet>
      </div>

      {group.note ? <p className="t-meta px-3 pb-2 italic lg:px-4">{group.note}</p> : null}

      {open ? (
        <ul id={`items-${group.id}`}>
          {items.map((item, index) => (
            <ItemRow
              key={item.id}
              item={item}
              first={index === 0}
              last={index === items.length - 1}
              selected={selected.has(item.id)}
              onSelect={handlers.selectOne}
              onMove={(id, delta) => handlers.moveItem(group.id, id, delta)}
              onEdit={handlers.editItem}
              onDelete={handlers.deleteItem}
              onFlag={handlers.flagItem}
              drag={{ handle: drag.handleProps(item.id), zone: drag.zoneProps(item.id) }}
            />
          ))}

          {items.length ? null : (
            <li className="px-4 py-4">
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => handlers.addItem(group.id)}
              >
                <Plus size={13} strokeWidth={1.8} />
                Add the first item
              </button>
            </li>
          )}
        </ul>
      ) : null}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── section ──── */

export default function SectionPanel({ section, first, last, open, selected, handlers, drag }) {
  const groups = section.groups;
  const groupIds = groups.map((group) => group.id);
  const groupDrag = useDrag(`groups:${section.id}`, groupIds, (next) =>
    handlers.reorderGroups(section.id, next)
  );

  const items = countItems(groups);

  const inner = {
    ...handlers,
    groupHandle: groupDrag.handleProps,
    groupZone: groupDrag.zoneProps,
  };

  return (
    <section
      {...drag.zone}
      className={cx('panel', !section.isActive && 'opacity-80', drag.zone.className)}
    >
      <header className="panel-head hit flex-wrap gap-x-3 gap-y-2">
        <span {...drag.handle} className={cx(drag.handle.className, 'hidden text-pencil lg:block')}>
          <GripVertical size={16} strokeWidth={1.6} />
        </span>

        <div className="min-w-0 flex-1 basis-[min(100%,14rem)]">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="t-h2 truncate">{section.title}</h2>
            <span className="tag tag--muted tabular">#{section.slug}</span>
            {section.isActive ? null : <span className="tag tag--stamp">Hidden</span>}
          </div>
          <p className="t-meta mt-1">
            {plural(groups.length, 'category', 'categories')} · {plural(items, 'item', 'items')}
            {section.kicker ? ` · ${section.kicker}` : ''}
          </p>
        </div>

        <div className="actions shrink-0 gap-1">
          <button
            type="button"
            className="iconb quiet"
            disabled={first}
            aria-label={`Move ${section.title} up`}
            title="Move this part up"
            onClick={() => handlers.moveSection(section.id, -1)}
          >
            <ChevronUp size={16} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            className="iconb quiet"
            disabled={last}
            aria-label={`Move ${section.title} down`}
            title="Move this part down"
            onClick={() => handlers.moveSection(section.id, 1)}
          >
            <ChevronDown size={16} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            className="iconb quiet"
            aria-label={`Edit ${section.title}`}
            title="Edit this part"
            onClick={() => handlers.editSection(section)}
          >
            <Pencil size={14} strokeWidth={1.7} />
          </button>

          <button
            type="button"
            className="btn btn--ghost btn--sm ml-1"
            onClick={() => handlers.addGroup(section.id)}
          >
            <Plus size={13} strokeWidth={1.8} />
            Category
          </button>
        </div>
      </header>

      {groups.length ? (
        groups.map((group, index) => (
          <Category
            key={group.id}
            section={section}
            group={group}
            first={index === 0}
            last={index === groups.length - 1}
            open={open.has(group.id)}
            selected={selected}
            handlers={inner}
          />
        ))
      ) : (
        <p className="t-meta p-5">Nothing in this part of the menu yet.</p>
      )}

      {/*
        Deleting a whole column of the card is the heaviest thing on this
        screen, so it sits at the bottom of the panel in a footer of its own
        rather than in the row of icons everything else uses.
      */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink/15 px-4 py-3">
        <p className="t-meta">
          {section.isActive
            ? 'Shown on the public menu.'
            : 'Hidden — the whole column is off the public menu.'}
        </p>

        <Confirm
          title={`Delete ${section.title}?`}
          body={`This deletes the whole column: ${plural(
            groups.length,
            'category',
            'categories'
          )} and ${plural(items, 'item', 'items')}. Hiding it instead keeps everything and takes it off the card.`}
          confirmLabel="Delete the column"
          onConfirm={() => handlers.deleteSection(section)}
        >
          <button type="button" className="btn btn--danger btn--sm">
            <Trash2 size={13} strokeWidth={1.8} />
            Delete this part
          </button>
        </Confirm>
      </div>
    </section>
  );
}
