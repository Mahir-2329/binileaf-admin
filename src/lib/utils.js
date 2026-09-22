/** Join class names, dropping anything falsy. */
export function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

/** 240 -> "240". Prices are whole rupees on this menu; keep it plain. */
export function rupees(n) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n);
}

/** Deterministic pseudo-random in [0,1) from a string — used for static jitter. */
export function seeded(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}
