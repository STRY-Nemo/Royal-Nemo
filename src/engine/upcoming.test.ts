import { describe, expect, it } from 'vitest';
import { createDraftEvent, ensureUpcomingDrafts, MAX_WEEKS_AHEAD } from './lifecycle';
import { APOCALYPSE_TIME_ZONE } from './recurrence';

const opts = { series_id: 'canyon-friday', timezone: APOCALYPSE_TIME_ZONE, team_times: { team1: '18:00', team2: '23:00' } };

describe('planning weeks ahead', () => {
  it('opens drafts for the next four Fridays, counting a Friday as its own week', () => {
    const res = ensureUpcomingDrafts([], { ...opts, fromDate: '2026-09-09' });
    expect(res.dates).toEqual(['2026-09-11', '2026-09-18', '2026-09-25', '2026-10-02']);
    expect(res.created.map((e) => e.date)).toEqual(res.dates);
    expect(res.created.every((e) => e.status === 'draft' && e.timezone === APOCALYPSE_TIME_ZONE && e.teams[1].local_time === '23:00')).toBe(true);
    const friday = ensureUpcomingDrafts([], { ...opts, fromDate: '2026-09-11' });
    expect(friday.dates[0]).toBe('2026-09-11');
  });

  it('is idempotent, leaves existing weeks alone and caps at four weeks', () => {
    const existing = createDraftEvent({ ...opts, date: '2026-09-18' });
    const res = ensureUpcomingDrafts([existing], { ...opts, fromDate: '2026-09-09' });
    expect(res.created.map((e) => e.date)).toEqual(['2026-09-11', '2026-09-25', '2026-10-02']);
    const again = ensureUpcomingDrafts([existing, ...res.created], { ...opts, fromDate: '2026-09-09' });
    expect(again.created).toEqual([]);
    expect(ensureUpcomingDrafts([], { ...opts, fromDate: '2026-09-09', weeks: 10 }).created).toHaveLength(MAX_WEEKS_AHEAD);
    expect(ensureUpcomingDrafts([], { ...opts, fromDate: '2026-09-09', weeks: 1 }).created).toHaveLength(1);
  });
});
