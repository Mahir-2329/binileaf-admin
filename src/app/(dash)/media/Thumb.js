'use client';

import Image from 'next/image';
import { cx } from '@/lib/utils';

/**
 * One frame of the contact sheet.
 *
 * Deliberately small and always square, whatever shape the photograph is: the
 * point of the sheet is to find a picture, not to admire it. The intrinsic
 * width/height come off the row, so `next/image` never has to guess, and
 * `sizes` keeps the optimiser from fetching a 1600px plate for a 120px box.
 */
export default function Thumb({ photo, size = 'grid', className, priority = false }) {
  const sizes =
    size === 'row'
      ? '56px'
      : size === 'slot'
        ? '(max-width: 640px) 92vw, 320px'
        : '(max-width: 640px) 45vw, 160px';

  return (
    <span
      className={cx(
        'relative block overflow-hidden bg-paper-shade',
        size === 'grid' && 'aspect-square',
        className
      )}
    >
      <Image
        src={photo.url ?? photo.path}
        alt=""
        width={photo.width}
        height={photo.height}
        sizes={sizes}
        priority={priority}
        className="h-full w-full object-cover"
      />
      {photo.isActive === false ? (
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-paper/60 mix-blend-luminosity"
        />
      ) : null}
    </span>
  );
}
