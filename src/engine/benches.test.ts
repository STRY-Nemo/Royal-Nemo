import { describe, expect, it } from 'vitest';
import type { CanyonEvent } from '../domain/types';
import { loadSeedMembers } from '../data/seed';
import { applySuggestions, createDraftEvent, LifecycleError, moveMember, reserveTarget, setAvailability, starters, swapMembers, teamReserves, waitingList } from './lifecycle';

const members = loadSeedMembers();
const ctx = { actor: 'stry-003', now: '2026-09-09T12:00:00Z' } as const;

function filled(): CanyonEvent {
  let e = createDraftEvent({ series_id: 'canyon-friday', date: '2026-09-11', timezone: 'Etc/GMT+2', date_confirmed: true, seed: 'bench' });
  members.forEach((m, i) => {
    const c = i % 4 === 0 ? 'team1' : i % 4 === 1 ? 'team2' : 'either';
    e = setAvailability(e, m.id, c, ctx).event;
  });
  return applySuggestions(e, members, [e], ctx).event;
}

describe('separate benches per team', () => {
  it('Generate puts every waiting player on one team bench and balances the flexible ones', () => {
    const e = filled();
    const [t1, t2] = e.teams.map((t) => t.id);
    expect(starters(e, t1)).toHaveLength(20);
    expect(starters(e, t2)).toHaveLength(20);
    expect(waitingList(e)).toHaveLength(0);
    const b1 = teamReserves(e, t1).length;
    const b2 = teamReserves(e, t2).length;
    expect(b1 + b2).toBe(60);
    expect(Math.abs(b1 - b2)).toBeLessThanOrEqual(1);
    // A team1-only player never lands on the Team 2 bench.
    for (const a of teamReserves(e, t2)) expect(e.availability[a.member_id].choice).not.toBe('team1');
  });

  it('moves a player between benches, the waiting list and starters with availability enforced', () => {
    let e = filled();
    const [t1, t2] = e.teams.map((t) => t.id);
    const sub = teamReserves(e, t1).find((a) => e.availability[a.member_id].choice === 'either')!;
    e = moveMember(e, sub.member_id, reserveTarget(t2), ctx).event;
    expect(teamReserves(e, t2).some((a) => a.member_id === sub.member_id)).toBe(true);
    expect(teamReserves(e, t1).some((a) => a.member_id === sub.member_id)).toBe(false);
    e = moveMember(e, sub.member_id, 'reserve', ctx).event;
    expect(waitingList(e).map((a) => a.member_id)).toEqual([sub.member_id]);
    const team1Only = teamReserves(e, t1).find((a) => e.availability[a.member_id].choice === 'team1')!;
    expect(() => moveMember(e, team1Only.member_id, reserveTarget(t2), ctx)).toThrow(LifecycleError);
    expect(() => moveMember(e, team1Only.member_id, 'reserve:nope', ctx)).toThrow(/Unknown team/);
  });

  it('swapping a starter with a substitute keeps the bench, and two subs can trade benches', () => {
    let e = filled();
    const [t1, t2] = e.teams.map((t) => t.id);
    const starter = starters(e, t1)[0];
    const sub = teamReserves(e, t1)[0];
    e = swapMembers(e, starter.member_id, sub.member_id, ctx).event;
    expect(starters(e, t1).some((a) => a.member_id === sub.member_id)).toBe(true);
    expect(teamReserves(e, t1).some((a) => a.member_id === starter.member_id)).toBe(true);
    const flex1 = teamReserves(e, t1).find((a) => e.availability[a.member_id].choice === 'either')!;
    const flex2 = teamReserves(e, t2).find((a) => e.availability[a.member_id].choice === 'either')!;
    e = swapMembers(e, flex1.member_id, flex2.member_id, ctx).event;
    expect(teamReserves(e, t2).some((a) => a.member_id === flex1.member_id)).toBe(true);
    expect(teamReserves(e, t1).some((a) => a.member_id === flex2.member_id)).toBe(true);
    expect(() => swapMembers(e, flex1.member_id, teamReserves(e, t2)[0].member_id === flex1.member_id ? teamReserves(e, t2)[1].member_id : teamReserves(e, t2)[0].member_id, ctx)).toThrow(/same place/);
  });
});
