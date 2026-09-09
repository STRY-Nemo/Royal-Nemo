import { describe, expect, it } from 'vitest';
import type { CanyonEvent } from '../domain/types';
import { loadSeedMembers } from '../data/seed';
import { createDraftEvent, LifecycleError, setAvailability, starters } from './lifecycle';
import { choiceFromSlots, describeAvailability, generateSuggestions, preferredTeamId } from './suggest';
import { applySlotTap } from '../ui/SlotPicker';

const members = loadSeedMembers();
const ctx = { actor: 'stry-003', now: '2026-09-09T12:00:00Z' } as const;
const draft = () => createDraftEvent({ series_id: 'canyon-friday', date: '2026-09-11', timezone: 'Etc/GMT+2', date_confirmed: true, seed: 'slots' });

describe('slot priorities', () => {
  it('derives the engine choice from 1st / 2nd / cannot answers', () => {
    expect(choiceFromSlots({ team1: 1, team2: 2 })).toBe('either');
    expect(choiceFromSlots({ team1: 2, team2: 1 })).toBe('either');
    expect(choiceFromSlots({ team1: 1, team2: 0 })).toBe('team1');
    expect(choiceFromSlots({ team1: 0, team2: 1 })).toBe('team2');
    expect(choiceFromSlots({ team1: 0, team2: 0 })).toBe('unavailable');
  });

  it('keeps the picker consistent: one 1st, the other 2nd, a lone answer is 1st', () => {
    expect(applySlotTap(null, 'team2', 1)).toEqual({ team1: 0, team2: 1 });
    expect(applySlotTap({ team1: 1, team2: 0 }, 'team2', 1)).toEqual({ team1: 2, team2: 1 });
    expect(applySlotTap({ team1: 1, team2: 2 }, 'team2', 2)).toEqual({ team1: 1, team2: 2 });
    expect(applySlotTap({ team1: 1, team2: 2 }, 'team1', 2)).toEqual({ team1: 2, team2: 1 });
    expect(applySlotTap(null, 'team1', 2)).toEqual({ team1: 1, team2: 0 });
    expect(applySlotTap({ team1: 1, team2: 2 }, 'team1', 0)).toEqual({ team1: 0, team2: 1 });
  });

  it('stores slots on the availability record and describes them', () => {
    const ev = setAvailability(draft(), 'stry-001', 'either', ctx, 'self', { team1: 2, team2: 1 }).event;
    const av = ev.availability['stry-001'];
    expect(av.choice).toBe('either');
    expect(av.slots).toEqual({ team1: 2, team2: 1 });
    expect(preferredTeamId(av, ev.teams)).toBe(ev.teams[1].id);
    expect(describeAvailability(av, ev.teams)).toBe('1st 23:00, 2nd 18:00');
    expect(describeAvailability({ choice: 'team1' }, ev.teams)).toMatch(/Team 1/);
    expect(() => setAvailability(draft(), 'stry-001', 'either', ctx, 'self', { team1: 1, team2: 1 })).toThrow(LifecycleError);
    expect(() => setAvailability(draft(), 'stry-001', 'either', ctx, 'self', { team1: 3 as never, team2: 0 })).toThrow(/1, 2 or 0/);
  });

  it('gives flexible players their first choice when there is room, without changing who is selected', () => {
    let ev: CanyonEvent = draft();
    // 30 players want 18:00 first, 30 want 23:00 first, 40 can only do 18:00.
    members.forEach((m, i) => {
      const slots = i < 30 ? { team1: 1 as const, team2: 2 as const } : i < 60 ? { team1: 2 as const, team2: 1 as const } : { team1: 1 as const, team2: 0 as const };
      ev = setAvailability(ev, m.id, 'either', ctx, 'self', slots).event;
    });
    const history = Object.fromEntries(members.map((m) => [m.id, { member_id: m.id, played_count: 0, eligible_benches: 0, last_played_at: null, waiting_since: null, history_incomplete: true, window_events: 0 }]));
    const res = generateSuggestions({ event: ev, members, history: history as never, locks: [] });
    expect(res.ok).toBe(true);
    const t2 = new Set(starters({ ...ev, assignments: res.assignments }, ev.teams[1].id).map((a) => a.member_id));
    const t1 = new Set(starters({ ...ev, assignments: res.assignments }, ev.teams[0].id).map((a) => a.member_id));
    expect(t1.size).toBe(20);
    expect(t2.size).toBe(20);
    // Nobody who asked for 18:00 first plays at 23:00 while a 23:00-first player sits at 18:00.
    const selected = (from: number, to: number, set: Set<string>) => members.slice(from, to).filter((m) => set.has(m.id)).length;
    const first18at23 = selected(0, 30, t2);
    const first23at18 = selected(30, 60, t1);
    expect(first18at23 === 0 || first23at18 === 0).toBe(true);
    // 18:00-first players only overflow to 23:00 when 18:00 is full of 18:00-first and 18:00-only players.
    const selA = selected(0, 30, t1) + selected(0, 30, t2);
    const selC = selected(60, 100, t1);
    expect(first18at23).toBe(Math.max(0, selA + selC - 20));
    // Selection itself is fairness-only: the 40 chosen are exactly the 40 best-ranked candidates.
    const chosen = new Set([...t1, ...t2]);
    const ranked = res.candidates.filter((c) => c.decision !== 'locked').sort((a, b) => a.rank - b.rank).slice(0, 40);
    expect(ranked.every((c) => chosen.has(c.member_id))).toBe(true);
  });
});
