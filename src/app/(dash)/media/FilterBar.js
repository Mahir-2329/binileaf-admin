'use client';

import { Search, X } from 'lucide-react';
import { CATEGORIES, EMPTY_FILTER, ORIENTATIONS, SORTS } from './constants';

/**
 * The one set of controls over the contact sheet — used by the library and by
 * the placement picker, so "find me the portrait shots of drinks" works the
 * same in both places.
 */
export default function FilterBar({ filter, onChange, total, shown, showSort = true }) {
  const set = (patch) => onChange({ ...filter, ...patch });
  const dirty =
    filter.q || filter.category || filter.gallery || filter.orientation || filter.sort !== 'new';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-[220px]">
          <Search
            size={14}
            strokeWidth={1.8}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-pencil"
          />
          <input
            type="search"
            className="input pl-9"
            value={filter.q}
            placeholder="Search slug, alt text, caption"
            aria-label="Search photographs"
            onChange={(event) => set({ q: event.target.value })}
          />
        </div>

        <select
          className="input w-auto min-w-[112px] flex-none"
          value={filter.category}
          aria-label="Filter by category"
          onChange={(event) => set({ category: event.target.value })}
        >
          <option value="">All folders</option>
          {CATEGORIES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>

        <select
          className="input w-auto min-w-[112px] flex-none"
          value={filter.gallery}
          aria-label="Filter by gallery"
          onChange={(event) => set({ gallery: event.target.value })}
        >
          <option value="">Gallery: any</option>
          <option value="in">In the gallery</option>
          <option value="out">Not in the gallery</option>
        </select>

        <select
          className="input w-auto min-w-[112px] flex-none"
          value={filter.orientation}
          aria-label="Filter by orientation"
          onChange={(event) => set({ orientation: event.target.value })}
        >
          <option value="">Any shape</option>
          {ORIENTATIONS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>

        {showSort ? (
          <select
            className="input w-auto min-w-[128px] flex-none"
            value={filter.sort}
            aria-label="Sort photographs"
            onChange={(event) => set({ sort: event.target.value })}
          >
            {SORTS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <p className="t-meta tabular" aria-live="polite">
          {shown === total ? `${total} photographs` : `${shown} of ${total} photographs`}
        </p>
        {dirty ? (
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => onChange({ ...EMPTY_FILTER })}
          >
            <X size={12} strokeWidth={2} />
            Clear filters
          </button>
        ) : null}
      </div>
    </div>
  );
}
