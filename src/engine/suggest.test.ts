import { describe, expect, it } from 'vitest';
import type { CanyonEvent, Member } from '../domain/types';
import { loadSeedMembers } from '../data/seed';
import { computeHistory } from './history';
import { applySuggestions, createDraftEvent, ensureNextWeekDraft, finalizeEvent, lockMember, moveMember, publishEvent, recordAttendance, setAvailability, starters, swapMembers, updateSchedule, LifecycleError } from './lifecycle';
import { generateSuggestions } from './suggest';

const members = loadSeedMembers();
const ctx = { actor: 'stry-003', now: '2026-09-09T12:00:00Z' } as const;

function draft(date = '2026-09-11', seed = 'seed-1'): CanyonEvent {
  return createDraftEvent({ series_id: 'canyon-friday', date, timezone: 'Europe/Berlin', date_confirmed: true, seed });
}

function withAvailability(event: CanyonEvent, chooser: (m: Member, i: number) => 'team1' | 'team2' | 'either' | 'unavailable' | null): CanyonEvent {
  let e = event;
  members.forEach((m, i) => {
    const c = chooser(m, i);
    if (c) e = setAvailability(e, m.id, c, ctx).event;
  });
  return e;
}

function team1(e: CanyonEvent) {
  return e.teams[0].id;
}
function team2(e: CanyonEvent) {
  return e.teams[1].id;
}

describe('seed data', () => {
  it('imports exactly 100 members with exact names and numeric power', () => {
    expect(members).toHaveLength(100);
    const byName = new Map(members.map((m) => [m.username, m]));
    expect(byName.get('Mario AK47')?.arena_power_m).toBe(836.8);
    expect(byName.get('Appins')?.arena_power_m).toBe(301.3);
    expect(byName.get('Nemo Hoes')?.arena_power_m).toBe(278.0);
    expect(new Set(members.map((m) => m.id)).size).toBe(100);
    expect(members[0].id).toBe('stry-001');
    expect(members[99].id).toBe('stry-100');
  });
});

describe('generateSuggestions', () => {
  it('never exceeds 20 starters per team and never assigns a member twice', () => {
    const e = withAvailability(draft(), () => 'either');
    const r = generateSuggestions({ event: e, members, history: {} });
    expect(r.ok).toBe(true);
    const s1 = r.assignments.filter((a) => a.role === 'starter' && a.team_id === team1(e));
    const s2 = r.assignments.filter((a) => a.role === 'starter' && a.team_id === team2(e));
    expect(s1).toHaveLength(20);
    expect(s2).toHaveLength(20);
    const ids = r.assignments.map((a) => a.member_id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(r.assignments.filter((a) => a.role === 'reserve')).toHaveLength(60);
  });

  it('excludes unavailable and no-response members', () => {
    const e = withAvailability(draft(), (_, i) => (i < 10 ? 'either' : i < 20 ? 'unavailable' : null));
    const r = generateSuggestions({ event: e, members, history: {} });
    expect(r.eligible_count).toBe(10);
    expect(r.assignments.filter((a) => a.role === 'starter')).toHaveLength(10);
    expect(r.open_slots[team1(e)] + r.open_slots[team2(e)]).toBe(30);
    expect(r.warnings.join(' ')).toMatch(/no response/i);
  });

  it('reassigns flexible players so a naive first-team greedy pass does not underfill team 2', () => {
    // 25 players available for either, 15 only for team 1, 5 only for team 2.
    // Greedy filling team 1 first with flexible players would leave team 2 short.
    const e = withAvailability(draft(), (_, i) => (i < 25 ? 'either' : i < 40 ? 'team1' : i < 45 ? 'team2' : null));
    const r = generateSuggestions({ event: e, members, history: {} });
    expect(r.ok).toBe(true);
    expect(r.assignments.filter((a) => a.role === 'starter' && a.team_id === team1(e))).toHaveLength(20);
    expect(r.assignments.filter((a) => a.role === 'starter' && a.team_id === team2(e))).toHaveLength(20);
    // 45 eligible for 40 slots -> exactly 5 waiting.
    expect(r.assignments.filter((a) => a.role === 'reserve')).toHaveLength(5);
  });

  it('explains a time constraint when one time is oversubscribed', () => {
    const e = withAvailability(draft(), (_, i) => (i < 30 ? 'team1' : i < 35 ? 'team2' : null));
    const r = generateSuggestions({ event: e, members, history: {} });
    expect(r.open_slots[team2(e)]).toBe(15);
    const waiting = r.candidates.filter((c) => c.decision === 'waiting');
    expect(waiting).toHaveLength(10);
    expect(waiting[0].reason).toMatch(/only available for 18:00/i);
    expect(r.warnings.some((w) => w.includes('only available for the other time'))).toBe(true);
  });

  it('is deterministic: generating twice with the same seed gives identical results', () => {
    const e = withAvailability(draft(), () => 'either');
    const a = generateSuggestions({ event: e, members, history: {} });
    const b = generateSuggestions({ event: e, members, history: {} });
    expect(a.assignments).toEqual(b.assignments);
    expect(a.team_power).toEqual(b.team_power);
  });

  it('a different seed can change tie-breaks but never the fairness ordering', () => {
    const e1 = withAvailability(draft('2026-09-11', 'alpha'), () => 'either');
    const e2 = withAvailability(draft('2026-09-11', 'beta'), () => 'either');
    const a = generateSuggestions({ event: e1, members, history: {} });
    const b = generateSuggestions({ event: e2, members, history: {} });
    const sa = new Set(a.assignments.filter((x) => x.role === 'starter').map((x) => x.member_id));
    const sb = new Set(b.assignments.filter((x) => x.role === 'starter').map((x) => x.member_id));
    expect(sa.size).toBe(40);
    expect(sb.size).toBe(40);
    // With identical histories everyone ties, so seeds may pick different players.
    expect(sa).not.toEqual(sb);
  });

  it('lower-power players remain eligible with identical histories (power is not admission ranking)', () => {
    const e = withAvailability(draft(), () => 'either');
    const r = generateSuggestions({ event: e, members, history: {} });
    const selected = r.assignments.filter((a) => a.role === 'starter').map((a) => a.member_id);
    const powers = selected.map((id) => members.find((m) => m.id === id)!.arena_power_m);
    const top40 = [...members].sort((a, b) => b.arena_power_m - a.arena_power_m).slice(0, 40).map((m) => m.arena_power_m);
    expect(Math.min(...powers)).toBeLessThan(Math.min(...top40));
  });

  it('balances team power only by moving flexible players', () => {
    const e = withAvailability(draft(), () => 'either');
    const balanced = generateSuggestions({ event: e, members, history: {} });
    const raw = generateSuggestions({ event: e, members, history: {}, balancePower: false });
    const gap = (r: typeof balanced) => Math.abs(r.team_power[team1(e)] - r.team_power[team2(e)]);
    expect(gap(balanced)).toBeLessThanOrEqual(gap(raw));
    const set = (r: typeof balanced) => new Set(r.assignments.filter((a) => a.role === 'starter').map((a) => a.member_id));
    expect(set(balanced)).toEqual(set(raw));
  });

  it('honours locks and reports conflicting locks with actionable errors', () => {
    const e = withAvailability(draft(), (_, i) => (i < 50 ? 'either' : 'team2'));
    const target = members[80]; // team2 only
    const ok = generateSuggestions({ event: e, members, history: {}, locks: [{ member_id: target.id, team_id: team2(e), reason: 'shot caller' }] });
    expect(ok.ok).toBe(true);
    const locked = ok.assignments.find((a) => a.member_id === target.id);
    expect(locked?.locked).toBe(true);
    expect(locked?.team_id).toBe(team2(e));
    expect(locked?.reason).toContain('shot caller');

    const bad = generateSuggestions({ event: e, members, history: {}, locks: [{ member_id: target.id, team_id: team1(e), reason: 'shot caller' }] });
    expect(bad.ok).toBe(false);
    expect(bad.errors[0].code).toBe('lock_unavailable');
    expect(bad.errors[0].message).toContain(target.username);
    expect(bad.assignments).toHaveLength(0);
  });

  it('ranks by fewer plays, then more benches, then longest since last play, then seeded lottery', () => {
    const e = withAvailability(draft(), (_, i) => (i < 4 ? 'either' : null));
    const [a, b, c, d] = members;
    const base = { eligible_benches: 0, last_played_at: null, lifetime_played: 0, lifetime_benches: 0, events_in_window: 8, unknown_count: 0, no_show_count: 0, withdrew_count: 0, history_incomplete: false, waiting_since: null };
    const history = {
      [a.id]: { ...base, member_id: a.id, played_count: 2 },
      [b.id]: { ...base, member_id: b.id, played_count: 1, eligible_benches: 1, last_played_at: '2026-08-28' },
      [c.id]: { ...base, member_id: c.id, played_count: 1, eligible_benches: 3, last_played_at: '2026-08-21' },
      [d.id]: { ...base, member_id: d.id, played_count: 1, eligible_benches: 3, last_played_at: '2026-08-14' },
    };
    const r = generateSuggestions({ event: e, members, history });
    const order = r.candidates.filter((x) => x.decision !== 'locked').sort((x, y) => x.rank - y.rank).map((x) => x.member_id);
    expect(order).toEqual([d.id, c.id, b.id, a.id]);
  });
});

describe('rotation over five weeks', () => {
  it('gives everyone exactly two plays with 100 always-available members and full attendance', () => {
    const events: CanyonEvent[] = [];
    let date = '2026-09-11';
    for (let week = 0; week < 5; week++) {
      let e = draft(date, `week-${week}`);
      e = withAvailability(e, () => 'either');
      const gen = applySuggestions(e, members, events, ctx);
      e = gen.event;
      e = publishEvent(e, ctx).event;
      for (const s of e.assignments.filter((a) => a.role === 'starter')) e = recordAttendance(e, s.member_id, 'played', ctx).event;
      for (const r of e.assignments.filter((a) => a.role === 'reserve')) e = recordAttendance(e, r.member_id, 'unused_reserve', ctx).event;
      e = finalizeEvent(e, ctx).event;
      events.push(e);
      date = ensureNextWeekDraft(events, { series_id: 'canyon-friday', afterDate: date, timezone: 'Europe/Berlin' }).event.date;
    }
    const history = computeHistory(events, members);
    for (const m of members) {
      expect(history[m.id].played_count).toBe(2);
      expect(history[m.id].lifetime_played).toBe(2);
    }
  });
});

describe('lifecycle invariants', () => {
  it('publish does not create plays; finalizing twice does not double count; corrections recalculate', () => {
    let e = withAvailability(draft(), () => 'either');
    e = applySuggestions(e, members, [], ctx).event;
    e = publishEvent(e, ctx).event;
    expect(computeHistory([e], members)[members[0].id].lifetime_played).toBe(0);
    const first = starters(e, team1(e))[0].member_id;
    e = recordAttendance(e, first, 'played', ctx).event;
    e = finalizeEvent(e, ctx).event;
    const again = finalizeEvent(e, ctx);
    expect(again.audit).toHaveLength(0);
    expect(computeHistory([e, again.event], members)[first].lifetime_played).toBe(1);
    expect(computeHistory([e], members)[first].played_count).toBe(1);
    e = recordAttendance(e, first, 'no_show', ctx).event;
    const h = computeHistory([e], members)[first];
    expect(h.played_count).toBe(0);
    expect(h.no_show_count).toBe(1);
    expect(h.eligible_benches).toBe(0);
  });

  it('a replacement who plays gains a play; an unused reserve gains none; a benched available player gains bench credit', () => {
    let e = withAvailability(draft(), () => 'either');
    e = applySuggestions(e, members, [], ctx).event;
    e = publishEvent(e, ctx).event;
    const reserveList = e.assignments.filter((a) => a.role === 'reserve');
    const sub = reserveList[0].member_id;
    const unused = reserveList[1].member_id;
    const benched = reserveList[2].member_id;
    e = recordAttendance(e, sub, 'played', ctx, { team_id: team1(e), substitute: true }).event;
    e = recordAttendance(e, unused, 'unused_reserve', ctx).event;
    e = finalizeEvent(e, ctx).event;
    const h = computeHistory([e], members);
    expect(h[sub].played_count).toBe(1);
    expect(h[unused].played_count).toBe(0);
    expect(h[unused].eligible_benches).toBe(1);
    expect(h[benched].eligible_benches).toBe(1);
    expect(h[benched].played_count).toBe(0);
  });

  it('canceled events do not affect fairness', () => {
    let e = withAvailability(draft(), () => 'either');
    e = applySuggestions(e, members, [], ctx).event;
    e = { ...e, status: 'canceled' };
    const h = computeHistory([e], members);
    expect(h[members[0].id].events_in_window).toBe(0);
  });

  it('missing timezone or unconfirmed date blocks publishing', () => {
    let e = createDraftEvent({ series_id: 's', date: '2026-09-11', timezone: null, seed: 'x' });
    e = withAvailability(e, () => 'either');
    e = applySuggestions(e, members, [], ctx).event;
    expect(() => publishEvent(e, ctx)).toThrow(/timezone/i);
    e = updateSchedule(e, { timezone: 'America/New_York' }, ctx).event;
    expect(() => publishEvent(e, ctx)).toThrow(/confirm the event date/i);
    e = updateSchedule(e, { date_confirmed: true }, ctx).event;
    expect(publishEvent(e, ctx).event.status).toBe('published');
  });

  it('availability constrains locks and swaps; stale revisions are rejected', () => {
    let e = withAvailability(draft(), (_, i) => (i < 20 ? 'team1' : i < 40 ? 'team2' : null));
    e = applySuggestions(e, members, [], ctx).event;
    const t1 = starters(e, team1(e))[0].member_id;
    const t2 = starters(e, team2(e))[0].member_id;
    expect(() => swapMembers(e, t1, t2, ctx)).toThrow(LifecycleError);
    expect(() => lockMember(e, t1, team2(e), 'shot caller', ctx)).toThrow(/not available/);
    expect(() => lockMember(e, t1, team1(e), '', ctx)).toThrow(/reason/);
    const rev = e.revision;
    const locked = lockMember(e, t1, team1(e), 'shot caller', ctx, rev).event;
    expect(() => lockMember(locked, t1, team1(e), 'again', ctx, rev)).toThrow(/reload/i);
  });

  it('regeneration preserves valid locks', () => {
    let e = withAvailability(draft(), () => 'either');
    e = applySuggestions(e, members, [], ctx).event;
    const waiting = e.assignments.find((a) => a.role === 'reserve')!.member_id;
    // Locks never bypass capacity: a full team rejects the lock until a slot is freed.
    expect(() => lockMember(e, waiting, team2(e), 'strong objective play', ctx)).toThrow(/full/);
    e = moveMember(e, starters(e, team2(e))[0].member_id, 'reserve', ctx).event;
    e = lockMember(e, waiting, team2(e), 'strong objective play', ctx).event;
    e = applySuggestions(e, members, [], ctx).event;
    const a = e.assignments.find((x) => x.member_id === waiting)!;
    expect(a.role).toBe('starter');
    expect(a.locked).toBe(true);
    expect(a.team_id).toBe(team2(e));
    expect(starters(e, team2(e))).toHaveLength(20);
  });

  it('generating a next-week draft is idempotent and starts empty', () => {
    const first = ensureNextWeekDraft([], { series_id: 'canyon-friday', afterDate: '2026-09-09', timezone: null });
    expect(first.created).toBe(true);
    expect(first.event.date).toBe('2026-09-11');
    const again = ensureNextWeekDraft([first.event], { series_id: 'canyon-friday', afterDate: '2026-09-09', timezone: null });
    expect(again.created).toBe(false);
    expect(again.event).toBe(first.event);
    const next = ensureNextWeekDraft([first.event], { series_id: 'canyon-friday', afterDate: '2026-09-11', timezone: null });
    expect(next.event.date).toBe('2026-09-18');
    expect(Object.keys(next.event.availability)).toHaveLength(0);
    expect(next.event.assignments).toHaveLength(0);
    expect(Object.keys(next.event.attendance)).toHaveLength(0);
  });

  it('changing one week\'s time leaves others unchanged and invalidates availability', () => {
    let a = withAvailability(draft('2026-09-11'), () => 'either');
    const b = withAvailability(draft('2026-09-18'), () => 'either');
    a = updateSchedule(a, { team_times: { team1: '19:00' } }, ctx).event;
    expect(a.teams[0].local_time).toBe('19:00');
    expect(Object.keys(a.availability)).toHaveLength(0);
    expect(b.teams[0].local_time).toBe('18:00');
    expect(Object.keys(b.availability)).toHaveLength(100);
  });
});
