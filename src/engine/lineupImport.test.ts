import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadSeedMembers } from '../data/seed';
import { parseCsv, parseXlsx } from '../import/tables';
import { applySuggestions, createDraftEvent, LifecycleError, lockMember, publishBlockers, reserves, setAvailability, starters, swapMembers, teamReserves } from './lifecycle';
import { applyLineupImport, matchLineup, parseLineupRows, planLineupImport, type LineupRecord } from './lineupImport';
import { APOCALYPSE_TIME_ZONE } from './recurrence';

const FILE = join(__dirname, '..', '..', 'public', 'imports', 'STRY_Canyon_Clash_Team2_20260911.xlsx');
const FILE1 = join(__dirname, '..', '..', 'public', 'imports', 'STRY_Canyon_Clash_Team1_20260911.xlsx');
const members = loadSeedMembers();
const ctx = { actor: 'stry-003', now: '2026-09-09T12:00:00Z' } as const;
const rows = parseXlsx(readFileSync(FILE));
const parsed = parseLineupRows(rows);
const parsed1 = parseLineupRows(parseXlsx(readFileSync(FILE1)));

function draft() {
  return createDraftEvent({ series_id: 'canyon-friday', date: '2026-09-11', timezone: null, seed: 'test' });
}

describe('team screen file parsing', () => {
  it('reads the Team 2 workbook: header, dates as ISO, numbers as text', () => {
    expect(rows).toHaveLength(101);
    expect(rows[0]).toEqual(['Event date', 'Team scope', 'Username', 'Starter confirmed', 'Substitute', 'Ready', 'Declined', 'Other team shown', 'Source badge', 'Video second']);
    expect(rows[1].slice(0, 4)).toEqual(['2026-09-11', '2', 'Queen Rouge', 'Yes']);
    expect(rows[4][7]).toBe('Team 1');
  });

  it('turns rows into records with the documented counts', () => {
    expect(parsed.records).toHaveLength(100);
    expect(parsed.event_date).toBe('2026-09-11');
    expect(parsed.team).toBe(2);
    expect(parsed.warnings).toEqual([]);
    const count = (k: keyof LineupRecord) => parsed.records.filter((r) => r[k] === true).length;
    expect(count('starter')).toBe(20);
    expect(count('substitute')).toBe(9);
    expect(count('ready')).toBe(13);
    expect(count('declined')).toBe(8);
    expect(parsed.records.filter((r) => r.other_team === 1)).toHaveLength(30);
    expect(parsed.records.find((r) => r.username === 'Tẽmujïn')?.other_team).toBe(1);
  });

  it('reads the Team 1 workbook, taking Decline from the Source badge column', () => {
    expect(parsed1.records).toHaveLength(100);
    expect(parsed1.team).toBe(1);
    expect(parsed1.event_date).toBe('2026-09-11');
    expect(parsed1.records.filter((r) => r.starter)).toHaveLength(20);
    expect(parsed1.records.filter((r) => r.substitute)).toHaveLength(10);
    expect(parsed1.records.filter((r) => r.declined)).toHaveLength(11);
    expect(parsed1.records.filter((r) => r.ready)).toHaveLength(35);
    expect(parsed1.records.filter((r) => r.other_team === 2)).toHaveLength(29);
    expect(parsed1.records.find((r) => r.username === 'Mada')?.starter).toBe(true);
  });

  it('parses the same table from CSV, including quoted names and Unknown markers', () => {
    const csv = 'Event date,Team scope,Username,Starter confirmed,Substitute,Ready,Declined,Other team shown\r\n2026-09-11,2,"Kane •",Yes,No,No,No,\r\n2026-09-11,2,"Twist, of Fate",No,Yes,Unknown,No,\r\n2026-09-11,2,Mada,No,No,No,No,Team 1\r\n';
    const p = parseLineupRows(parseCsv(csv));
    expect(p.records.map((r) => r.username)).toEqual(['Kane •', 'Twist, of Fate', 'Mada']);
    expect(p.records[1].substitute).toBe(true);
    expect(p.records[2].other_team).toBe(1);
    expect(p.warnings[0]).toMatch(/Unknown/);
  });

  it('rejects tables without the expected columns', () => {
    expect(() => parseLineupRows([['Name', 'Power'], ['Appins', '300']])).toThrow(LifecycleError);
    expect(() => parseLineupRows([])).toThrow(/no rows/);
  });
});

describe('matching and planning', () => {
  it('matches 98 of 100 names to the roster despite case and accents, and reports the rest', () => {
    const matches = matchLineup(parsed.records, members);
    const unmatched = matches.filter((m) => !m.member).map((m) => m.record.username);
    expect(unmatched).toEqual(['Bigtor86', 'Rockysaurus']);
    expect(matches.find((m) => m.record.username === 'Sats0mNlaK')?.member?.username).toBe('Sats0mNlak');
    expect(matches.find((m) => m.record.username === 'ElmO')?.member?.username).toBe('Elmo');
  });

  it('uses the leader name mapping before fuzzy matching', () => {
    const rocky = members.find((m) => m.username === 'RockyNoSpeedUps')!;
    const matches = matchLineup(parsed.records, members, { Rockysaurus: rocky.id });
    expect(matches.find((m) => m.record.username === 'Rockysaurus')?.member?.id).toBe(rocky.id);
  });

  it('plans 20 starters, 9 substitutes, availability for everyone marked, and the game timezone', () => {
    const plan = planLineupImport(draft(), parsed.records, members);
    expect(plan.errors).toEqual([]);
    expect(plan.team.name).toBe('Team 2');
    expect(plan.starters).toHaveLength(20);
    expect(plan.reserves).toHaveLength(9);
    expect(plan.declined).toHaveLength(7); // Rockysaurus is not in the roster
    expect(plan.unmatched.map((r) => r.username)).toEqual(['Rockysaurus']);
    expect(plan.sets_timezone).toBe(APOCALYPSE_TIME_ZONE);
    // Starters + subs become team2, "Team 1" rows become team1, the declined member shown on Team 1 becomes team1.
    expect(plan.availability).toHaveLength(plan.starters.length + plan.reserves.length + plan.other_team.length + 1);
    expect(plan.availability.every((c) => c.from === null)).toBe(true);
    expect(plan.replaced).toBe(0);
  });

  it('refuses a file for a different date or with more starters than slots', () => {
    const other = createDraftEvent({ series_id: 'canyon-friday', date: '2026-09-18', timezone: null });
    expect(planLineupImport(other, parsed.records, members).errors[0]).toMatch(/2026-09-11/);
    const extra: LineupRecord = { ...parsed.records.find((r) => !r.starter && !r.substitute && !r.declined && !r.other_team)!, starter: true };
    const tooMany = planLineupImport(draft(), [...parsed.records.filter((r) => r.username !== extra.username), extra], members);
    expect(tooMany.errors[0]).toMatch(/21 starters/);
    expect(() => applyLineupImport(draft(), parsed.records, members, {}, ctx, { expectedRevision: 5 })).toThrow(/revision/);
  });
});

describe('both team screens together', () => {
  it('fills Team 1 and Team 2 exactly from the two files with nobody in two places', () => {
    let ev = applyLineupImport(draft(), parsed.records, members, {}, ctx, { source: 'Team2.xlsx' }).event;
    const res1 = applyLineupImport(ev, parsed1.records, members, {}, ctx, { source: 'Team1.xlsx' });
    expect(res1.plan.errors).toEqual([]);
    expect(res1.plan.starters).toHaveLength(20);
    expect(res1.plan.reserves).toHaveLength(10);
    expect(res1.plan.moved_from_elsewhere).toEqual([]);
    ev = res1.event;
    expect(starters(ev, ev.teams[0].id)).toHaveLength(20);
    expect(starters(ev, ev.teams[1].id)).toHaveLength(20);
    expect(reserves(ev)).toHaveLength(19);
    expect(new Set(ev.assignments.map((a) => a.member_id)).size).toBe(59);
    expect(ev.assignments.every((a) => !a.locked)).toBe(true);
    const blockers = publishBlockers(ev).map((b) => b.code);
    expect(blockers).toEqual(['date']);
    // Importing Team 1 first gives the same lineup.
    let ev2 = applyLineupImport(draft(), parsed1.records, members, {}, ctx).event;
    ev2 = applyLineupImport(ev2, parsed.records, members, {}, ctx).event;
    const key = (e: typeof ev) => e.assignments.map((a) => `${a.member_id}:${a.team_id}:${a.role}`).sort();
    expect(key(ev2)).toEqual(key(ev));
  });
});

describe('applying the import', () => {
  it('writes editable starters and substitutes, records availability, sets the timezone and bumps the revision', () => {
    const before = draft();
    const { event, audit, plan } = applyLineupImport(before, parsed.records, members, {}, ctx, { source: 'Team2.xlsx' });
    const team2 = event.teams[1].id;
    expect(event.revision).toBe(before.revision + 1);
    expect(event.timezone).toBe(APOCALYPSE_TIME_ZONE);
    expect(starters(event, team2)).toHaveLength(20);
    expect(reserves(event)).toHaveLength(9);
    expect(event.assignments.every((a) => !a.locked && a.team_id === team2 && /on the in-game Team 2 screen \(Team2.xlsx\)/.test(a.reason ?? ''))).toBe(true);
    // Opt-in locking is still available for leaders who want the game lineup pinned.
    const pinned = applyLineupImport(before, parsed.records, members, {}, ctx, { source: 'Team2.xlsx', lock: true }).event;
    expect(pinned.assignments.every((a) => a.locked && a.lock_reason === 'In-game Team 2 lineup (Team2.xlsx)')).toBe(true);
    for (const m of [...plan.starters, ...plan.reserves]) expect(event.availability[m.id].choice).toBe('team2');
    const mada = members.find((m) => m.username === 'Mada')!;
    expect(event.availability[mada.id].choice).toBe('team1');
    expect(audit).toHaveLength(1);
    expect(audit[0].action).toBe('lineup.import');
    const queen = members.find((m) => m.username === 'Queen Rouge')!;
    expect(starters(event, team2).some((a) => a.member_id === queen.id)).toBe(true);
  });

  it('widens conflicting availability instead of dropping in-game starters', () => {
    let ev = draft();
    const queen = members.find((m) => m.username === 'Queen Rouge')!;
    const mario = members.find((m) => m.username === 'Mario AK47')!;
    ev = setAvailability(ev, queen.id, 'team1', ctx).event;
    ev = setAvailability(ev, mario.id, 'unavailable', ctx).event;
    const { event, plan } = applyLineupImport(ev, parsed.records, members, {}, ctx);
    expect(event.availability[queen.id].choice).toBe('either');
    expect(event.availability[mario.id].choice).toBe('team2');
    expect(plan.availability.find((c) => c.member.id === queen.id)?.from).toBe('team1');
  });

  it('stays editable: leaders can move imported players without unlocking; Regenerate replaces it unless locked', () => {
    let ev = applyLineupImport(draft(), parsed.records, members, {}, ctx).event;
    for (const m of members) if (!ev.availability[m.id]) ev = setAvailability(ev, m.id, 'either', ctx, 'stry-003').event;
    const team2 = ev.teams[1].id;
    const importedStarters = starters(ev, team2).map((a) => a.member_id).sort();
    const sub = teamReserves(ev, team2)[0].member_id;
    const starter = importedStarters[0];
    // Swap an imported starter with an imported substitute: no unlock needed.
    const swapped = swapMembers(ev, starter, sub, ctx).event;
    expect(starters(swapped, team2).some((a) => a.member_id === sub)).toBe(true);
    expect(teamReserves(swapped, team2).some((a) => a.member_id === starter)).toBe(true);
    // A leader can pin one player; Regenerate keeps that one and re-ranks the rest.
    const pinned = lockMember(ev, starter, team2, 'shot caller', ctx).event;
    const gen = applySuggestions(pinned, members, [pinned], ctx, pinned.revision);
    expect(gen.result.ok).toBe(true);
    expect(starters(gen.event, team2).some((a) => a.member_id === starter && a.locked)).toBe(true);
    expect(starters(gen.event, ev.teams[0].id)).toHaveLength(20);
    expect(starters(gen.event, team2)).toHaveLength(20);
    // Importing again replaces only Team 2 and leaves Team 1 alone.
    const again = applyLineupImport(gen.event, parsed.records, members, {}, ctx);
    expect(starters(again.event, ev.teams[0].id)).toHaveLength(20);
    expect(starters(again.event, team2).map((a) => a.member_id).sort()).toEqual(importedStarters);
  });
});
