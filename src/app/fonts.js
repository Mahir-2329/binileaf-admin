import { Fraunces, Newsreader, Space_Grotesk } from 'next/font/google';

/**
 * Three faces, three jobs.
 *   Fraunces  — display, headings, menu item names, prices.
 *   Newsreader — everything that is a sentence.
 *   Space Grotesk — uppercase signage: labels, nav, buttons, chips.
 */

export const fraunces = Fraunces({
  subsets: ['latin'],
  axes: ['SOFT', 'WONK', 'opsz'],
  display: 'swap',
  variable: '--font-fraunces',
});

export const newsreader = Newsreader({
  subsets: ['latin'],
  axes: ['opsz'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-newsreader',
});

export const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-ui-face',
});

export const fontVariables = `${fraunces.variable} ${newsreader.variable} ${spaceGrotesk.variable}`;
