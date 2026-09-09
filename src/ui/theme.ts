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
  { id: 'rose-nebula', label: 'Rose Nebula', blurb: 'A pink crystal citadel drifting in a nebula.', swatch: ['#1a0a12', '#ff7fa3'] },
  { id: 'jedi-sanctuary', label: 'Jedi Sanctuary', blurb: 'Blue-lit sanctuary under twin moons.', swatch: ['#07111c', '#7fc3ff'] },
  { id: 'sith-eclipse', label: 'Sith Eclipse', blurb: 'A red eclipse over the dark fortress.', swatch: ['#140505', '#ff5b4a'] },
  { id: 'leviathan-depths', label: 'Leviathan Depths', blurb: 'A sea dragon circling the sunken gate.', swatch: ['#03101f', '#5fd6ee'] },
  { id: 'solar-phoenix', label: 'Solar Phoenix', blurb: 'A phoenix rising in gold fire.', swatch: ['#1a0d10', '#ffb84d'] },
  { id: 'frost-crown', label: 'Frost Crown', blurb: 'A white wolf under the aurora.', swatch: ['#0b1728', '#8ecde5'] },
  { id: 'neon-ronin', label: 'Neon Ronin', blurb: 'A ronin above the neon skyline.', swatch: ['#0b0b16', '#a9a3ff'] },
  { id: 'emerald-dream', label: 'Emerald Dream', blurb: 'A glowing stag in the deep green forest.', swatch: ['#061209', '#6fe3a0'] },
  { id: 'astral-dunes', label: 'Astral Dunes', blurb: 'Star dunes and a golden gate.', swatch: ['#0e0b10', '#f5c98a'] },
  { id: 'event-horizon', label: 'Event Horizon', blurb: 'A lone ship at the edge of a black hole.', swatch: ['#0a0713', '#c9a8ff'] },
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
