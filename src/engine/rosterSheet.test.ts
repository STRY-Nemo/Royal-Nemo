import { describe, expect, it } from 'vitest';
import { loadSeedMembers } from '../data/seed';
import { BUNDLED_SHEETS } from '../data/trackingSheets';
import { applyTrackingEntries, createDraftEvent, setAvailability } from './lifecycle';
import { planSheetImport, sheetCounts, sheetLineupRecords, sheetRows, sheetText } from './rosterSheet';
import { applyLineupImport } from './lineupImport';
import { APOCALYPSE_TIME_ZONE } from './recurrence';

const ctx = { actor: 'stry-001', now: '2026-09-12T10:00:00.000Z' } as const;
const members = loadSeedMembers();
const draft = () => createDraftEvent({ series_id: 'canyon-friday', date: '2026-09-11', timezone: APOCALYPSE_TIME_ZONE, team_times: { team1: '18:00', team2: '23:00' } });

describe('roster sheet', () => {
  it('derives the sheet columns from availability, lineup and tracking', () => {
    let event = draft();
    event = setAvailability(event, 'stry-001', 'team2', ctx, 'self').event;
    event = setAvailability(event, 'stry-002', 'unavailable', ctx, 'self').event;
    event = applyTrackingEntries(event, [{ member_id: 'stry-003', ready: 'ready', joined: 'mvp', note: 'MVP' }], ctx).event;
    const rows = sheetRows(event, members);
    const byId = new Map(rows.map((r) => [r.member.id, r]));
    expect(byId.get('stry-001')?.votedLabel).toBe('23:00');
    expect(byId.get('stry-001')?.section).toBe('ready');
    expect(byId.get('stry-002')?.section).toBe('declined');
    expect(byId.get('stry-003')?.joined).toBe('mvp');
    expect(byId.get('stry-003')?.ready).toBe('ready');
    expect(byId.get('stry-004')?.section).toBe('no_response');
    const counts = sheetCounts(rows);
    expect(counts.joined).toBe(1);
    expect(counts.no_response).toBe(rows.length - 3);
    expect(sheetText(event, rows).split('\n')[1]).toBe('Section\tJoined?\tVoted\tFamily Member\tReady?\tStarter\tSub\tNotes');
  });

  it('applies tracking entries, clears columns with null, and never overwrites an existing vote', () => {
    let event = draft();
    event = setAvailability(event, 'stry-010', 'team1', ctx, 'self').event;
    event = applyTrackingEntries(event, [{ member_id: 'stry-010', joined: 'yes', voted: 'team2' }, { member_id: 'stry-011', voted: 'either', ready: 'declined' }], ctx).event;
    expect(event.availability['stry-010'].choice).toBe('team1');
    expect(event.availability['stry-011'].choice).toBe('either');
    expect(event.tracking?.['stry-010']?.joined).toBe('yes');
    event = applyTrackingEntries(event, [{ member_id: 'stry-010', joined: null }], ctx).event;
    expect(event.tracking?.['stry-010']).toBeUndefined();
  });

  it('matches the bundled 2026-09-11 sheet to the roster with one known unmatched name', () => {
    const sheet = BUNDLED_SHEETS.find((b) => b.event_date === '2026-09-11')!;
    const plan = planSheetImport(draft(), members, sheet.rows);
    expect(plan.unmatched).toEqual(['Rockysaurus']);
    expect(plan.entries.length).toBe(sheet.rows.length - 1);
    const applied = applyTrackingEntries(draft(), plan.entries, ctx).event;
    const rows = sheetRows(applied, members);
    expect(rows.filter((r) => r.joined === 'mvp').map((r) => r.member.username).sort()).toEqual(['Chika Strike', 'Mario AK47']);
    expect(rows.find((r) => r.member.username === 'RosolinoFriddi')?.joined).toBe('other_alliance');
    expect(rows.find((r) => r.member.username === 'Rrrrrrrrrd')?.flag).toBe('removed');
    expect(rows.find((r) => r.member.username === 'Galihad')?.votedLabel).toBe('23:00');
  });

  it('places the sheet\'s starters and substitutes on both teams through the lineup import', () => {
    const sheet = BUNDLED_SHEETS.find((b) => b.event_date === '2026-09-11')!;
    const week = createDraftEvent({ series_id: 'canyon-friday', date: '2026-09-18', timezone: APOCALYPSE_TIME_ZONE, team_times: { team1: '18:00', team2: '23:00' } });
    const records = sheetLineupRecords(sheet.rows, week.date);
    expect(records.team1.filter((r) => r.starter)).toHaveLength(20); // 19 listed + crumbum271 added, Rrrrrrrrrd removed
    expect(records.team1.filter((r) => r.substitute)).toHaveLength(11);
    expect(records.team2.filter((r) => r.starter)).toHaveLength(20);
    expect(records.team2.filter((r) => r.substitute)).toHaveLength(9);
    let event = applyTrackingEntries(week, planSheetImport(week, members, sheet.rows).entries, ctx).event;
    event = applyLineupImport(event, records.team1, members, {}, ctx, { source: 'sheet' }).event;
    event = applyLineupImport(event, records.team2, members, {}, ctx, { source: 'sheet' }).event;
    const rows = sheetRows(event, members);
    const counts = sheetCounts(rows);
    expect(counts.team1_starters).toBe(20);
    expect(counts.team2_starters).toBe(20);
    expect(counts.team1_subs).toBe(11);
    expect(counts.team2_subs).toBe(9);
    expect(rows.find((r) => r.member.username === 'crumbum271')?.starter).toBe('Team 1');
    expect(rows.find((r) => r.member.username === 'Rrrrrrrrrd')?.starter).toBeNull();
    expect(rows.find((r) => r.member.username === 'Captain Cake')?.starter).toBe('Team 2');
  });
});
