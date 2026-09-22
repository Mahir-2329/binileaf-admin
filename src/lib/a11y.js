'use client';

import { useEffect, useRef } from 'react';

/**
 * Shared behaviour for the three overlays — drawer, lightbox, index sheet —
 * so they cannot drift apart.
 */

/**
 * `overflow: hidden` on the body does not hold the scroll position on iOS
 * Safari: open an overlay from halfway down an 8,000px page, close it, and you
 * are at the top. Pinning the body and restoring the offset does hold it.
 *
 * Also sets `data-lock`, which the action bar and the jump-to-top button watch.
 */
export function useBodyLock(locked) {
  const scrollY = useRef(0);
  const lockedPath = useRef('');

  useEffect(() => {
    const body = document.body;

    if (!locked) {
      body.dataset.lock = 'false';
      return;
    }

    scrollY.current = window.scrollY;
    lockedPath.current = window.location.pathname;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
    };

    body.dataset.lock = 'true';
    body.style.position = 'fixed';
    body.style.top = `-${scrollY.current}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';

    return () => {
      body.dataset.lock = 'false';
      Object.assign(body.style, previous);

      // Restoring the offset is right when the overlay closes on the page it
      // opened on. It is wrong when a link inside it navigated somewhere else
      // — the new page would open halfway down.
      if (window.location.pathname === lockedPath.current) {
        window.scrollTo(0, scrollY.current);
      }
    };
  }, [locked]);
}

/**
 * The global `prefers-reduced-motion` CSS block sets `scroll-behavior: auto`,
 * which has no effect on a JS `scrollTo({ behavior: 'smooth' })` argument.
 * Every call site reads this instead.
 */
export function prefersReducedMotion() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export const scrollBehavior = () => (prefersReducedMotion() ? 'auto' : 'smooth');

/**
 * Cycle Tab within a set of elements. Pass the elements in the order they
 * should be reached — the drawer's close button lives in the header, outside
 * the drawer, so it has to be appended by hand.
 */
export function trapTab(event, elements) {
  if (event.key !== 'Tab') return;

  const focusable = elements.filter(Boolean);
  if (!focusable.length) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const current = document.activeElement;

  if (event.shiftKey && (current === first || !focusable.includes(current))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && current === last) {
    event.preventDefault();
    first.focus();
  }
}
