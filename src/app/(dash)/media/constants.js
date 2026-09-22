/**
 * The vocabulary both screens share. Plain module, no directive: the library,
 * the picker and the placement board all read it, and none of it needs a server.
 */

/** The folders the seed uses. Free entry is not offered — a typo here is a lost photograph. */
export const CATEGORIES = ['brand', 'drinks', 'exterior', 'food', 'interior', 'misc', 'sketch'];

/** The tags the public gallery filters on. Anything else is allowed, but these are the ones that do something. */
export const GALLERY_TAGS = ['drinks', 'food', 'space', 'street'];

export const ORIENTATIONS = ['landscape', 'portrait', 'square'];

export const SORTS = [
  { value: 'new', label: 'Newest first' },
  { value: 'name', label: 'Name (A–Z)' },
  { value: 'size', label: 'Largest file' },
];

export const EMPTY_FILTER = {
  q: '',
  category: '',
  gallery: '',
  orientation: '',
  sort: 'new',
};

export function formatBytes(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

/** Aspect strings are stored as '16/9'; turn one into a number, tolerantly. */
export function aspectRatio(aspect) {
  const [w, h] = String(aspect || '4/5').split('/').map(Number);
  if (!w || !h) return 0.8;
  return w / h;
}

/** Which screen edits the thing that points at a photograph. */
export const USAGE_KINDS = {
  placement: { label: 'Slot', href: (ref) => `/placements#slot-${ref}` },
  section: { label: 'Menu section', href: () => '/menu' },
  group: { label: 'Menu category', href: () => '/menu' },
  item: { label: 'Menu item', href: () => '/menu' },
  offer: { label: 'Offer', href: () => '/offers' },
};

/**
 * Filtering and sorting run on the client over the whole list.
 *
 * 93 rows is nothing, and doing it here means typing in the search box is
 * instant and the placement picker reuses the same code as the library without
 * a second trip to Postgres.
 */
export function filterMedia(items, filter) {
  const q = filter.q.trim().toLowerCase();

  const matched = items.filter((item) => {
    if (filter.category && item.category !== filter.category) return false;
    if (filter.gallery === 'in' && !item.inGallery) return false;
    if (filter.gallery === 'out' && item.inGallery) return false;
    if (filter.orientation && item.orientation !== filter.orientation) return false;
    if (!q) return true;
    return (
      item.slug.toLowerCase().includes(q) ||
      item.alt.toLowerCase().includes(q) ||
      item.caption.toLowerCase().includes(q)
    );
  });

  const sorted = [...matched];
  if (filter.sort === 'name') sorted.sort((a, b) => a.slug.localeCompare(b.slug));
  else if (filter.sort === 'size') sorted.sort((a, b) => b.bytes - a.bytes);
  else sorted.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));

  return sorted;
}
