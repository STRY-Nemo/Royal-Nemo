import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';

describe('App shell', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.location.hash = '#/home';
  });
  afterEach(() => cleanup());

  it('renders the four bottom tabs and the demo banner', () => {
    render(<App />);
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('button', { name: 'Home' })).toBeTruthy();
    expect(within(nav).getByRole('button', { name: 'Canyon' })).toBeTruthy();
    expect(within(nav).getByRole('button', { name: 'Organize' })).toBeTruthy();
    expect(within(nav).getByRole('button', { name: 'Members' })).toBeTruthy();
    expect(screen.getAllByText(/Demo mode/).length).toBeGreaterThan(0);
  });

  it('seeds a draft for the next Friday with 18:00 and 23:00 and no fabricated data', () => {
    render(<App />);
    const raw = window.localStorage.getItem('stry-alliance-demo-v1');
    // Nothing is persisted until the first change; the initial state is derived.
    expect(raw).toBeNull();
    expect(screen.getByText(/Team 1 · 18:00/)).toBeTruthy();
    expect(screen.getByText(/Team 2 · 23:00/)).toBeTruthy();
    expect(screen.getAllByText('0/20', { exact: false })).toHaveLength(2);
  });

  it('lists all 100 members', () => {
    window.location.hash = '#/members';
    render(<App />);
    expect(screen.getAllByRole('listitem')).toHaveLength(100);
    expect(screen.getByText('Mario AK47')).toBeTruthy();
    expect(screen.getByText('836.8M')).toBeTruthy();
  });
});
