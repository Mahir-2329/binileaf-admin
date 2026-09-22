'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';
import { ChevronsDownUp, ChevronsUpDown, LayoutPanelTop, Plus, X } from 'lucide-react';
import { Empty, Page, PageHead, Section, useToast } from '@/components/ui';
import { cx } from '@/lib/utils';
import {
  deleteGroup,
  deleteItem,
  deleteSection,
  moveItems,
  reorderGroups,
  reorderItems,
  reorderSections,
  setItemFlag,
  setItemsAvailability,
} from '@/server/menu';
import MenuPreview from './MenuPreview';
import ResetPanel from './ResetPanel';
import SectionPanel from './SectionPanel';
import { GroupDialog, ItemDialog, SectionDialog } from './dialogs';
import { countItems, plural, shift, useDrag } from './shared';

/**
 * The menu editor.
 *
 * The page is a Server Component that hands this one the whole menu, and every
 * write is a Server Action that ends in `revalidatePath('/menu')` — so the
 * source of truth is always the database, and this component's job is to make
 * the wait invisible.
 *
 * It does that by keeping its own copy of the tree. A reorder or a switch is
 * applied to that copy immediately, the action is sent, and the next render
 * from the server replaces the copy wholesale. If the action fails the copy is
 * thrown away and the server's version comes back, which is a cheaper and more
 * honest undo than trying to invert the edit.
 */

/* ────────────────────────────────────────────────────── tree surgery ──── */

const reorderBy = (rows, ids) => ids.map((id) => rows.find((row) => row.id === id)).filter(Boolean);

const onSection = (tree, id, fn) => tree.map((section) => (section.id === id ? fn(section) : section));

const onGroup = (tree, id, fn) =>
  tree.map((section) => ({
    ...section,
    groups: section.groups.map((group) => (group.id === id ? fn(group) : group)),
  }));

const onItem = (tree, id, fn) =>
  tree.map((section) => ({
    ...section,
    groups: section.groups.map((group) => ({
      ...group,
      items: group.items.map((item) => (item.id === id ? fn(item) : item)),
    })),
  }));

/* ─────────────────────────────────────────────────────────────── page ──── */

export default function MenuEditor({ data }) {
  const toast = useToast();
  const [saving, startTransition] = useTransition();

  // The server's last word, and the copy the screen is drawing. Resetting the
  // copy while rendering — rather than in an effect — means a revalidated tree
  // never flashes the stale one first.
  const [fromServer, setFromServer] = useState(data);
  const [tree, setTree] = useState(data);
  if (fromServer !== data) {
    setFromServer(data);
    setTree(data);
  }

  const allGroupIds = useMemo(
    () => tree.flatMap((section) => section.groups.map((group) => group.id)),
    [tree]
  );

  const [open, setOpen] = useState(() => new Set(allGroupIds));
  const [selected, setSelected] = useState(() => new Set());
  const [dialog, setDialog] = useState(null);
  const [width, setWidth] = useState(1280);

  // Two states, not one, because the preview is two different things. On a
  // wide screen it is a column that sits beside the work and is on by default;
  // on a phone it is a sheet over the work, and a sheet that opened itself on
  // load would be a screen the operator has to dismiss before they can start.
  const [previewOpen, setPreviewOpen] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);

  /**
   * Send a change, and put the server's version back if it is refused. The
   * optimistic edit has already been applied by the caller, so the only thing
   * left to do on failure is stop lying about it.
   */
  const run = useCallback(
    (call, message) => {
      startTransition(async () => {
        const reply = await call();
        if (reply?.ok) {
          if (message) toast(message);
        } else {
          setTree(data);
          toast(reply?.error ?? 'That did not save. Try again.', 'error');
        }
      });
    },
    [data, toast]
  );

  /* ── ordering ─────────────────────────────────────────────────────── */

  const sectionIds = tree.map((section) => section.id);

  const commitSections = useCallback(
    (ids) => {
      setTree((current) => reorderBy(current, ids));
      run(() => reorderSections({ ids }));
    },
    [run]
  );

  const commitGroups = useCallback(
    (sectionId, ids) => {
      setTree((current) =>
        onSection(current, sectionId, (section) => ({
          ...section,
          groups: reorderBy(section.groups, ids),
        }))
      );
      run(() => reorderGroups({ sectionId, ids }));
    },
    [run]
  );

  const commitItems = useCallback(
    (groupId, ids) => {
      setTree((current) =>
        onGroup(current, groupId, (group) => ({ ...group, items: reorderBy(group.items, ids) }))
      );
      run(() => reorderItems({ groupId, ids }));
    },
    [run]
  );

  const sectionDrag = useDrag('sections', sectionIds, commitSections);

  /* ── handlers passed down ─────────────────────────────────────────── */

  const handlers = useMemo(
    () => ({
      toggleOpen: (id) =>
        setOpen((current) => {
          const next = new Set(current);
          if (!next.delete(id)) next.add(id);
          return next;
        }),

      selectOne: (id, on) =>
        setSelected((current) => {
          const next = new Set(current);
          if (on) next.add(id);
          else next.delete(id);
          return next;
        }),

      selectMany: (ids, on) =>
        setSelected((current) => {
          const next = new Set(current);
          ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
          return next;
        }),

      moveSection: (id, delta) => commitSections(shift(sectionIds, id, delta)),

      moveGroup: (sectionId, id, delta) => {
        const section = tree.find((row) => row.id === sectionId);
        commitGroups(sectionId, shift(section.groups.map((group) => group.id), id, delta));
      },

      moveItem: (groupId, id, delta) => {
        const group = tree.flatMap((section) => section.groups).find((row) => row.id === groupId);
        commitItems(groupId, shift(group.items.map((item) => item.id), id, delta));
      },

      reorderGroups: commitGroups,
      reorderItems: commitItems,

      flagItem: (id, field, value) => {
        setTree((current) => onItem(current, id, (item) => ({ ...item, [field]: value })));
        run(() => setItemFlag({ id, field, value }));
      },

      deleteItem: (item) => {
        setTree((current) =>
          onGroup(current, item.groupId, (group) => ({
            ...group,
            items: group.items.filter((row) => row.id !== item.id),
          }))
        );
        run(() => deleteItem({ id: item.id }), `${item.name} deleted`);
      },

      deleteGroup: (group) => {
        setTree((current) =>
          onSection(current, group.sectionId, (section) => ({
            ...section,
            groups: section.groups.filter((row) => row.id !== group.id),
          }))
        );
        run(() => deleteGroup({ id: group.id }), `${group.title} deleted`);
      },

      deleteSection: (section) => {
        setTree((current) => current.filter((row) => row.id !== section.id));
        run(() => deleteSection({ id: section.id }), `${section.title} deleted`);
      },

      addItem: (groupId) => setDialog({ kind: 'item', groupId }),
      editItem: (item) => setDialog({ kind: 'item', item }),
      addGroup: (sectionId) => setDialog({ kind: 'group', sectionId }),
      editGroup: (group) => setDialog({ kind: 'group', group }),
      editSection: (section) => setDialog({ kind: 'section', section }),
    }),
    [commitGroups, commitItems, commitSections, run, sectionIds, tree]
  );

  /* ── bulk ─────────────────────────────────────────────────────────── */

  const chosen = [...selected];

  const bulkAvailability = (available) => {
    setTree((current) =>
      current.map((section) => ({
        ...section,
        groups: section.groups.map((group) => ({
          ...group,
          items: group.items.map((item) =>
            selected.has(item.id) ? { ...item, isAvailable: available } : item
          ),
        })),
      }))
    );
    run(
      () => setItemsAvailability({ ids: chosen, available }),
      `${plural(chosen.length, 'item', 'items')} marked ${available ? 'available' : 'unavailable'}`
    );
    setSelected(new Set());
  };

  const bulkMove = (groupId) => {
    if (!groupId) return;
    // No optimistic move here: pulling rows out of one category and appending
    // them to another is exactly the shape the server already computes, and
    // guessing at it locally would only have to be corrected a moment later.
    run(
      () => moveItems({ ids: chosen, groupId }),
      `${plural(chosen.length, 'item', 'items')} moved`
    );
    setSelected(new Set());
  };

  /* ── preview ──────────────────────────────────────────────────────── */

  const jumpTo = (groupId) => {
    setOpen((current) => new Set(current).add(groupId));
    setSheetOpen(false);

    // The category has to be expanded before there is a row to scroll to.
    requestAnimationFrame(() => {
      document.getElementById(`group-${groupId}`)?.scrollIntoView({ block: 'center' });
    });
  };

  const preview = <MenuPreview sections={tree} width={width} onWidth={setWidth} onPick={jumpTo} />;

  const totals = `${plural(tree.length, 'part', 'parts')} · ${plural(
    allGroupIds.length,
    'category',
    'categories'
  )} · ${plural(
    tree.reduce((sum, section) => sum + countItems(section.groups), 0),
    'item',
    'items'
  )}`;

  const everythingOpen = open.size >= allGroupIds.length;

  return (
    <Page>
      <PageHead title="Menu" meta={totals}>
        {/* The screen has already moved; this only says the database is
            catching up, and it says it quietly. */}
        <span className="t-meta" role="status" aria-live="polite">
          {saving ? 'Saving…' : ''}
        </span>

        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => setOpen(everythingOpen ? new Set() : new Set(allGroupIds))}
        >
          {everythingOpen ? (
            <ChevronsDownUp size={14} strokeWidth={1.8} />
          ) : (
            <ChevronsUpDown size={14} strokeWidth={1.8} />
          )}
          {everythingOpen ? 'Collapse all' : 'Expand all'}
        </button>

        <button
          type="button"
          className="btn btn--ghost xl:hidden"
          aria-expanded={sheetOpen}
          onClick={() => setSheetOpen(true)}
        >
          <LayoutPanelTop size={14} strokeWidth={1.8} />
          Preview
        </button>

        <button
          type="button"
          className="btn btn--ghost hidden xl:inline-flex"
          aria-expanded={previewOpen}
          onClick={() => setPreviewOpen((value) => !value)}
        >
          <LayoutPanelTop size={14} strokeWidth={1.8} />
          {previewOpen ? 'Hide preview' : 'Preview'}
        </button>

        <button type="button" className="btn btn--primary" onClick={() => setDialog({ kind: 'section' })}>
          <Plus size={14} strokeWidth={1.8} />
          New part
        </button>
      </PageHead>

      <Section>
        <div
          className={cx(
            'grid items-start gap-5',
            previewOpen && 'xl:grid-cols-[minmax(0,1fr)_minmax(360px,440px)]'
          )}
        >
          {/* ── the editor ───────────────────────────────────────────── */}
          <div className="flex min-w-0 flex-col gap-5">
            {tree.length ? (
              tree.map((section, index) => (
                <SectionPanel
                  key={section.id}
                  section={section}
                  first={index === 0}
                  last={index === tree.length - 1}
                  open={open}
                  selected={selected}
                  handlers={handlers}
                  drag={{
                    handle: sectionDrag.handleProps(section.id),
                    zone: sectionDrag.zoneProps(section.id),
                  }}
                />
              ))
            ) : (
              <Empty
                title="The menu is empty"
                body="Start with a part of the menu — Hot Beverages, Food — then add categories inside it."
              >
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => setDialog({ kind: 'section' })}
                >
                  <Plus size={14} strokeWidth={1.8} />
                  New part
                </button>
              </Empty>
            )}
          </div>

          {/* ── the preview ──────────────────────────────────────────
              A column beside the editor on a wide screen, a sheet over it
              below that. Either way it is never in the way of the work. */}
          {previewOpen ? (
            <aside
              aria-label="Where each category lands"
              className="panel hidden xl:sticky xl:top-5 xl:block xl:max-h-[calc(100svh-2.5rem)] xl:overflow-y-auto"
            >
              <div className="panel-head sticky top-0 z-10 bg-paper-bright">
                <div className="min-w-0">
                  <h2 className="t-h2">Where it lands</h2>
                  <p className="t-meta mt-1">The public menu page, as a map.</p>
                </div>
                <button
                  type="button"
                  className="btn btn--ghost h-11 w-11 p-0"
                  aria-label="Hide the preview"
                  onClick={() => setPreviewOpen(false)}
                >
                  <X size={15} strokeWidth={1.8} />
                </button>
              </div>

              {preview}
            </aside>
          ) : null}
        </div>
      </Section>

      {/* ── the heaviest thing on the screen, kept at the bottom ───── */}
      <Section className="pt-0">
        <ResetPanel revision={data} />
      </Section>

      {/* ── the preview, as a sheet on anything narrower ───────────── */}
      {sheetOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Where each category lands"
          className="fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-paper-bright xl:hidden"
        >
          <div className="panel-head sticky top-0 z-10 bg-paper-bright">
            <div className="min-w-0">
              <h2 className="t-h2">Where it lands</h2>
              <p className="t-meta mt-1">The public menu page, as a map.</p>
            </div>
            <button
              type="button"
              className="btn btn--ghost h-11 w-11 p-0"
              aria-label="Close the preview"
              onClick={() => setSheetOpen(false)}
            >
              <X size={15} strokeWidth={1.8} />
            </button>
          </div>

          {preview}
        </div>
      ) : null}

      {/* ── bulk bar ───────────────────────────────────────────────── */}
      {chosen.length ? (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-ink/20 bg-paper-bright px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="t-label tabular mr-auto">
              {plural(chosen.length, 'item', 'items')} selected
            </p>

            <button type="button" className="btn btn--ghost btn--sm" onClick={() => bulkAvailability(false)}>
              Mark unavailable
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => bulkAvailability(true)}>
              Mark available
            </button>

            <label className="flex items-center gap-2">
              <span className="sr-only">Move the selected items to a category</span>
              <select
                className="input h-[38px] w-auto"
                value=""
                onChange={(event) => bulkMove(event.target.value)}
              >
                <option value="">Move to…</option>
                {tree.map((section) => (
                  <optgroup key={section.id} label={section.title}>
                    {section.groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.title}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>

            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => setSelected(new Set())}
            >
              Clear
            </button>
          </div>
        </div>
      ) : null}

      {/* ── dialogs ────────────────────────────────────────────────── */}
      {dialog?.kind === 'item' ? (
        <ItemDialog
          key={dialog.item?.id ?? `new-${dialog.groupId}`}
          item={dialog.item ?? null}
          groupId={dialog.groupId ?? dialog.item?.groupId}
          sections={tree}
          onClose={() => setDialog(null)}
          onSaved={(message) => {
            setDialog(null);
            toast(message);
          }}
        />
      ) : null}

      {dialog?.kind === 'group' ? (
        <GroupDialog
          key={dialog.group?.id ?? `new-${dialog.sectionId}`}
          group={dialog.group ?? null}
          sectionId={dialog.sectionId ?? dialog.group?.sectionId}
          sections={tree}
          onClose={() => setDialog(null)}
          onSaved={(message, createdId) => {
            setDialog(null);
            toast(message);
            if (createdId) setOpen((current) => new Set(current).add(createdId));
          }}
        />
      ) : null}

      {dialog?.kind === 'section' ? (
        <SectionDialog
          key={dialog.section?.id ?? 'new-section'}
          section={dialog.section ?? null}
          onClose={() => setDialog(null)}
          onSaved={(message) => {
            setDialog(null);
            toast(message);
          }}
        />
      ) : null}
    </Page>
  );
}
