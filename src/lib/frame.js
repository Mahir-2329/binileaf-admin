/**
 * How a photograph sits in a slot.
 *
 * `media_placements.crop` holds a focal point and a zoom, not a cut: the bytes
 * are never re-encoded, so the same photograph can be framed one way in the
 * hero and another in a contact strip, and swapping the photograph keeps the
 * slot's shape. The café sets it on "Where they appear"; this turns it into the
 * two CSS properties that make it true.
 *
 * `object-position` decides which part of an over-wide or over-tall photograph
 * survives `object-fit: cover`. Zoom is a transform about the same point, so
 * pushing in never slides the subject out of the frame.
 *
 * The admin's cropper renders with these exact numbers. If this changes, the
 * preview there changes with it — that is the point of one function.
 */

export const DEFAULT_CROP = { x: 50, y: 50, zoom: 1 };

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** Accepts whatever is in the column — null, a partial object, junk — and copes. */
export function readCrop(crop) {
  if (!crop || typeof crop !== 'object') return null;

  const x = Number(crop.x);
  const y = Number(crop.y);
  const zoom = Number(crop.zoom);

  const read = {
    x: Number.isFinite(x) ? clamp(x, 0, 100) : 50,
    y: Number.isFinite(y) ? clamp(y, 0, 100) : 50,
    zoom: Number.isFinite(zoom) ? clamp(zoom, 1, 3) : 1,
  };

  return read;
}

/**
 * Style for the <Image> in a slot.
 *
 * `fallback` is the framing the code chose before the café could: pass the
 * `{x, y}` a component used to hard-code, and it applies until somebody sets a
 * crop in the admin.
 */
export function frameStyle(placement, fallback = DEFAULT_CROP) {
  const crop = readCrop(placement?.crop) ?? { ...DEFAULT_CROP, ...fallback };
  const origin = `${crop.x}% ${crop.y}%`;

  return {
    objectPosition: origin,
    ...(crop.zoom > 1 ? { transform: `scale(${crop.zoom})`, transformOrigin: origin } : null),
  };
}
