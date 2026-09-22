'use client';

import { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { Empty, Modal } from '@/components/ui';
import { cx } from '@/lib/utils';
import { EMPTY_FILTER, filterMedia } from './constants';
import FilterBar from './FilterBar';
import Thumb from './Thumb';

/**
 * Pick one photograph. The same contact sheet as the library, so an operator
 * who has learned to find things in `/media` already knows how to fill a slot.
 */
export default function MediaPicker({ open, onClose, onPick, items, current, title, description }) {
  const [filter, setFilter] = useState({ ...EMPTY_FILTER });
  const visible = useMemo(() => filterMedia(items, filter), [items, filter]);

  return (
    <Modal open={open} onClose={onClose} title={title} description={description} wide>
      <FilterBar
        filter={filter}
        onChange={setFilter}
        total={items.length}
        shown={visible.length}
      />

      <div className="mt-5">
        {visible.length ? (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2">
            {visible.map((photo) => {
              const chosen = photo.slug === current;
              return (
                <li key={photo.id}>
                  <button
                    type="button"
                    onClick={() => onPick(photo)}
                    aria-pressed={chosen}
                    title={photo.slug}
                    className={cx(
                      'group relative block w-full text-left',
                      chosen ? 'outline outline-2 outline-offset-[-2px] outline-stamp' : ''
                    )}
                  >
                    <Thumb photo={photo} />
                    {chosen ? (
                      <span className="absolute right-0 top-0 flex h-6 w-6 items-center justify-center bg-stamp text-paper">
                        <Check size={13} strokeWidth={2.4} />
                      </span>
                    ) : null}
                    <span className="mt-1 block truncate text-[0.6875rem] text-pencil">
                      {photo.slug.split('/').pop()}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty
            title="Nothing matches"
            body="No photograph in the library matches those filters. Widen the search, or add one from the Photographs screen."
          />
        )}
      </div>
    </Modal>
  );
}
