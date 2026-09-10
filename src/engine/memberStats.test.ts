import { describe, expect, it } from 'vitest';
import { loadSeedMembers } from '../data/seed';
import { LifecycleError } from './lifecycle';
import { applyStats, validateStats } from './memberStats';

const m = loadSeedMembers()[0];

describe('member stats', () => {
  it('rounds power to one decimal, stamps the date only when power changes, and keeps other fields', () => {
    const next = applyStats(m, { arena_power_m: 312.34, level: 88 }, '2026-09-10');
    expect(next.arena_power_m).toBe(312.3);
    expect(next.level).toBe(88);
    expect(next.power_as_of).toBe('2026-09-10');
    expect(next.rank).toBe(m.rank);
    const same = applyStats(m, { arena_power_m: m.arena_power_m }, '2026-09-11');
    expect(same.power_as_of).toBe(m.power_as_of);
    expect(applyStats(m, { rank: 'R4' }, '2026-09-10').rank).toBe('R4');
  });

  it('rejects out-of-range or empty patches', () => {
    expect(() => validateStats({ arena_power_m: -1 })).toThrow(LifecycleError);
    expect(() => validateStats({ arena_power_m: 99999 })).toThrow(/between 0 and/);
    expect(() => validateStats({ level: 0 })).toThrow(/Level/);
    expect(() => validateStats({ level: 12.5 })).toThrow(/whole number/);
    expect(() => validateStats({ rank: 'R9' as never })).toThrow(/R1 to R5/);
    expect(() => validateStats({})).toThrow(/Nothing/);
  });
});
