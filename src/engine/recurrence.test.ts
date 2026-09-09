import { describe, expect, it } from 'vitest';
import { addDays, APOCALYPSE_TIME_ZONE, COMMON_TIME_ZONES, eventIdFor, isValidTimeZone, nextFriday, timeZoneLabel, tzOffsetMs, weekday, zoneAbbreviation, zonedParts, zonedWallTimeToUtc } from './recurrence';

describe('recurrence', () => {
  it('derives the next Friday after September 9, 2026 as September 11', () => {
    expect(weekday('2026-09-09')).toBe(3);
    expect(nextFriday('2026-09-09')).toBe('2026-09-11');
    expect(nextFriday('2026-09-11')).toBe('2026-09-18');
    expect(nextFriday('2026-09-11', true)).toBe('2026-09-11');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('builds deterministic event ids', () => {
    expect(eventIdFor('canyon-friday', '2026-09-11')).toBe('canyon-friday:2026-09-11');
  });

  it('converts wall-clock times in a named zone and preserves hours across DST', () => {
    // Berlin: CEST (+2) in September, CET (+1) in November.
    const sep = zonedWallTimeToUtc('2026-09-11', '18:00', 'Europe/Berlin');
    expect(sep.toISOString()).toBe('2026-09-11T16:00:00.000Z');
    const nov = zonedWallTimeToUtc('2026-11-06', '18:00', 'Europe/Berlin');
    expect(nov.toISOString()).toBe('2026-11-06T17:00:00.000Z');
    expect(zonedParts(sep.getTime(), 'Europe/Berlin').hour).toBe(18);
    expect(zonedParts(nov.getTime(), 'Europe/Berlin').hour).toBe(18);
    // New York 23:00 Friday is Saturday 03:00 UTC (EDT).
    const ny = zonedWallTimeToUtc('2026-09-11', '23:00', 'America/New_York');
    expect(ny.toISOString()).toBe('2026-09-12T03:00:00.000Z');
    expect(tzOffsetMs(ny.getTime(), 'America/New_York')).toBe(-4 * 3600_000);
  });
});

describe('Apocalypse Time', () => {
  it('is a fixed UTC-2 clock where 00:00 AT is 7 pm US Pacific', () => {
    expect(isValidTimeZone(APOCALYPSE_TIME_ZONE)).toBe(true);
    expect(COMMON_TIME_ZONES[0]).toBe(APOCALYPSE_TIME_ZONE);
    const midnight = zonedWallTimeToUtc('2026-09-12', '00:00', APOCALYPSE_TIME_ZONE);
    expect(midnight.toISOString()).toBe('2026-09-12T02:00:00.000Z');
    const pacific = zonedParts(midnight.getTime(), 'America/Los_Angeles');
    expect([pacific.day, pacific.hour]).toEqual([11, 19]);
    // Team 2 at 23:00 AT on Friday is 6 pm Pacific the same Friday, 01:00 UTC Saturday.
    const team2 = zonedWallTimeToUtc('2026-09-11', '23:00', APOCALYPSE_TIME_ZONE);
    expect(team2.toISOString()).toBe('2026-09-12T01:00:00.000Z');
    expect(zonedParts(team2.getTime(), 'America/Los_Angeles').hour).toBe(18);
    expect(zoneAbbreviation(team2, APOCALYPSE_TIME_ZONE)).toBe('AT');
    expect(timeZoneLabel(APOCALYPSE_TIME_ZONE)).toMatch(/Apocalypse Time/);
    expect(timeZoneLabel('Europe/Berlin')).toBe('Europe/Berlin');
  });
});
