import { act, cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../App';
import { belongsToTab } from './router';

function parseRoute(hash: string) {
  window.location.hash = hash;
  const raw = hash.replace(/^#\/?/, '');
  const segments = raw.split('/').filter(Boolean);
  const first = segments[0] ?? 'home';
  const tab = first === 'canyon' || first === 'organize' || first === 'members' || first === 'ideas' ? first : 'home';
  return { path: '/' + segments.join('/'), segments, query: new URLSearchParams(), tab } as const;
}

async function setHash(hash: string) {
  await act(async () => {
    window.location.hash = hash;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

function tab(name: string) {
  const nav = screen.getByRole('navigation', { name: 'Main' });
  return within(nav).getByRole('button', { name });
}

describe('router tabs', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.location.hash = '#/home';
    window.scrollTo = () => {};
  });
  afterEach(() => cleanup());

  it('knows which pages live inside a tab', () => {
    expect(belongsToTab(parseRoute('#/home'))).toBe(true);
    expect(belongsToTab(parseRoute('#/'))).toBe(true);
    expect(belongsToTab(parseRoute('#/bear'))).toBe(false);
    expect(belongsToTab(parseRoute('#/settings'))).toBe(false);
    expect(belongsToTab(parseRoute('#/canyon/history'))).toBe(true);
    expect(belongsToTab(parseRoute('#/members/m1'))).toBe(true);
  });

  it('returns to the overview from the Home tab after visiting the den and another tab', async () => {
    render(<App />);
    await setHash('#/bear');
    expect(screen.getByRole('heading', { name: 'STRY Bear' })).toBeTruthy();
    await act(async () => tab('Canyon').click());
    await setHash(window.location.hash); // jsdom does not always fire hashchange for programmatic sets
    expect(window.location.hash).toBe('#/canyon');
    await act(async () => tab('Home').click());
    await setHash(window.location.hash);
    expect(window.location.hash).toBe('#/home');
  });

  it('remembers where you were inside Canyon, and tapping Canyon again goes to its root', async () => {
    render(<App />);
    await setHash('#/canyon/history');
    await act(async () => tab('Members').click());
    await setHash(window.location.hash);
    expect(window.location.hash).toBe('#/members');
    await act(async () => tab('Canyon').click());
    await setHash(window.location.hash);
    expect(window.location.hash).toBe('#/canyon/history');
    await act(async () => tab('Canyon').click());
    await setHash(window.location.hash);
    expect(window.location.hash).toBe('#/canyon');
  });
});
