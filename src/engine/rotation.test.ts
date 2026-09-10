import { describe, expect, it } from 'vitest';
import type { CanyonEvent } from '../domain/types';
import { loadSeedMembers } from '../data/seed';
import { computeHistory } from './history';
import { applySuggestions, carryOverAvailability, createDraftEvent, LifecycleError, lockMember, previousEventWithAvailability, setAvailability, starters, suggest, unlockAll } from './lifecycle';

const members = loadSeedMembers();
const ctx = { actor: 'stry-003', now: '2026-09-09T12:00:00Z' } as const;

/** This week's event as the game screen import leaves it: 40 locked starters, everyone else ready on the bench. */
function importedWeek(): CanyonEvent {
  let e = createDraftEvent({ series_id: 'canyon-friday', date: '2026-09-11', timezone: 'Etc/GMT+2', date_confirmed: true, seed: 'rotation' });
  members.forEach((m) => {
    e = setAvailability(e, m.id, 'either', ctx).event;
  });
  members.slice(0, 20).forEach((m) => {
    e = lockMember(e, m.id, e.teams[0].id, 'Team 1 screen', ctx).event;
  });
  members.slice(20, 40).forEach((m) => {
    e = lockMember(e, m.id, e.teams[1].id, 'Team 2 screen', ctx).event;
  });
  return e;
}

describe('rotation across weeks', () => {
  it('counts an imported (not finalized) lineup as plays and benches for the next week', () => {
    const thisWeek = importedWeek();
    const h = computeHistory([thisWeek], members, { before: '2026-09-18' });
    expect(h[members[0].id].played_count).toBe(1);
    expect(h[members[0].id].provisional_count).toBe(1);
    expect(h[members[0].id].last_played_at).toBe('2026-09-11');
    expect(h[members[45].id].played_count).toBe(0);
    expect(h[members[45].id].eligible_benches).toBe(1);
    // The week being planned never counts itself, and later weeks never count either.
    expect(computeHistory([thisWeek], members, { before: '2026-09-11' })[members[0].id].events_in_window).toBe(0);
  });

  it('next week starts the players who waited this week and benches this week\'s starters', () => {
    const thisWeek = importedWeek();
    let next = createDraftEvent({ series_id: 'canyon-friday', date: '2026-09-18', timezone: 'Etc/GMT+2', date_confirmed: true, seed: 'rotation-2' });
    members.forEach((m) => {
      next = setAvailability(next, m.id, 'either', ctx).event;
    });
    const res = suggest(next, members, [thisWeek, next]);
    expect(res.ok).toBe(true);
    const thisWeekStarters = new Set([...starters(thisWeek, 'team1'), ...starters(thisWeek, 'team2')].map((a) => a.member_id));
    const nextStarters = res.assignments.filter((a) => a.role === 'starter').map((a) => a.member_id);
    expect(nextStarters).toHaveLength(40);
    // 100 members, 40 played this week: all 60 who waited rank ahead, so no repeat starters.
    expect(nextStarters.filter((id) => thisWeekStarters.has(id))).toHaveLength(0);
    const explained = res.candidates.find((c) => c.member_id === members[0].id)!;
    expect(explained.decision).toBe('waiting');
    expect(explained.reason).toMatch(/1 play in last 1 week \(1 from a lineup not finalized yet\)/);
  });

  it('copies last week\'s answers only for members who have not answered, keeping "can\'t" answers', () => {
    let last = createDraftEvent({ series_id: 'canyon-friday', date: '2026-09-11', timezone: 'Etc/GMT+2', seed: 'c1' });
    last = setAvailability(last, members[0].id, 'team1', ctx, 'self', { team1: 1, team2: 2 }).event;
    last = setAvailability(last, members[1].id, 'unavailable', ctx).event;
    last = setAvailability(last, members[2].id, 'either', ctx).event;
    let next = createDraftEvent({ series_id: 'canyon-friday', date: '2026-09-18', timezone: 'Etc/GMT+2', seed: 'c2' });
    next = setAvailability(next, members[2].id, 'team2', ctx).event;
    expect(previousEventWithAvailability(next, [last, next])?.id).toBe(last.id);
    const r = carryOverAvailability(next, last, members, ctx, 'stry-003');
    expect(r.count).toBe(2);
    // Slots are copied exactly; the derived choice follows the slots (both times possible, team 1 preferred).
    expect(r.event.availability[members[0].id]).toMatchObject({ choice: 'either', slots: { team1: 1, team2: 2 }, recorded_by: 'stry-003' });
    expect(r.event.availability[members[1].id].choice).toBe('unavailable');
    expect(r.event.availability[members[2].id].choice).toBe('team2');
    expect(previousEventWithAvailability(last, [last, next])).toBeNull();
  });

  it('unlock-all removes every lock so Generate can reshuffle, and refuses when nothing is locked', () => {
    const e = importedWeek();
    const r = unlockAll(e, ctx, e.revision);
    expect(r.count).toBe(40);
    expect(r.event.assignments.some((a) => a.locked)).toBe(false);
    expect(() => unlockAll(r.event, ctx)).toThrow(LifecycleError);
    const regenerated = applySuggestions(r.event, members, [r.event], ctx).event;
    expect(regenerated.assignments.filter((a) => a.role === 'starter')).toHaveLength(40);
  });
});
