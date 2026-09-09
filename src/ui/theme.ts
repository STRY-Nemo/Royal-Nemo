/**
 * App themes: a full-screen background (public/art/themes/<id>.jpg) plus a
 * colour palette applied through CSS tokens ([data-theme] in tokens.css).
 * The choice is per device (localStorage) so everyone can pick their own.
 */
import { useEffect, useState } from 'react';

export interface Theme {
  id: string;
  label: string;
  blurb: string;
  /** Two colours for the fallback swatch and gradient when the artwork is missing. */
  swatch: [string, string];
}

export const THEMES: Theme[] = [
  { id: 'canyon-night', label: 'Canyon Night', blurb: 'The original: starry sky over the canyon.', swatch: ['#07111f', '#168cff'] },
  { id: 'dawn', label: 'Dawn', blurb: 'Warm gold light breaking over the ridge.', swatch: ['#1a1208', '#ffb347'] },
  { id: 'storm', label: 'Storm', blurb: 'Teal lightning and rolling grey clouds.', swatch: ['#0a1416', '#3fd1c4'] },
  { id: 'ember', label: 'Ember', blurb: 'Red skies, smoke and glowing coals.', swatch: ['#170808', '#ff6b4a'] },
  { id: 'frost', label: 'Frost', blurb: 'Ice-blue moonlight on a frozen canyon.', swatch: ['#0b1622', '#9fd8ff'] },
  { id: 'void', label: 'Void', blurb: 'Deep violet nebula and drifting stars.', swatch: ['#0d0716', '#b388ff'] },
];

export const DEFAULT_THEME = THEMES[0].id;
const KEY = 'stry-theme';
const EVENT = 'stry-theme';

export function currentTheme(): string {
  try {
    const v = localStorage.getItem(KEY);
    return v && THEMES.some((t) => t.id === v) ? v : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function applyTheme(id: string): void {
  if (typeof document === 'undefined') return;
  if (id === DEFAULT_THEME) delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = id;
}

export function setTheme(id: string): void {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* ignore */
  }
  applyTheme(id);
  window.dispatchEvent(new Event(EVENT));
}

/** Path of the background image for a theme (the default keeps the original file name). */
export function themeBackground(id: string): string {
  const base = import.meta.env.BASE_URL || '/';
  return id === DEFAULT_THEME ? `${base}art/app-background.jpg` : `${base}art/themes/${id}.jpg`;
}

export function useTheme(): string {
  const [id, setId] = useState(currentTheme);
  useEffect(() => {
    const onChange = () => setId(currentTheme());
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);
  return id;
}
