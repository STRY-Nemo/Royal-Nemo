import { describe, expect, it } from 'vitest';
import { loadSeedMembers } from '../data/seed';
import { ROSTER_ADDITIONS } from '../data/rosterAdditions';
import { ROSTER_SNAPSHOTS } from '../data/rosterSnapshots';
import { applyRosterSnapshot } from './rosterSnapshot';

describe('roster snapshot', () => {
  const snapshot = ROSTER_SNAPSHOTS.find((s) => s.as_of === '2026-09-20')!;
  const roster = [...loadSeedMembers(), ...ROSTER_ADDITIONS];

  it('bundles the 2026-09-20 roster with 100 unique members', () => {
    expect(snapshot.members).toHaveLength(100);
    expect(new Set(snapshot.members.map((m) => m.id)).size).toBe(100);
    expect(snapshot.members.filter((m) => m.rank === 'R5').map((m) => m.username)).toEqual(['Queen Rouge']);
  });

  it('updates stats, keeps ids through renames, adds newcomers and retires the missing', () => {
    const { members, changed, summary } = applyRosterSnapshot(roster, snapshot);
    const byName = new Map(members.map((m) => [m.username, m]));
    expect(byName.get('Mario AK47')?.arena_power_m).toBe(866);
    expect(byName.get('Mario AK47')?.power_as_of).toBe('2026-09-20');
    expect(summary.renamed.map((r) => `${r.from}>${r.to}`).sort()).toEqual(['Azale>Azale Manu1604', 'Black-wolff>Black-Wolff', 'King of goats>Sun goat Nika', 'RockyNoSpeedUps>Rockysaurus', 'hausshavoc>daddy hauss']);
    expect(byName.get('Rockysaurus')?.id).toBe(roster.find((m) => m.username === 'RockyNoSpeedUps')!.id);
    expect(byName.get('Rockysaurus')?.aliases).toContain('RockyNoSpeedUps');
    expect(summary.added.sort()).toEqual(['DemonKingg2', 'Ελισάβετ']);
    expect(summary.deactivated.sort()).toEqual(['Bigfor86', 'Hamos1otus', 'Luigi Banana', 'MathSic', 'fivos tech']);
    expect(byName.get('MathSic')?.active).toBe(false);
    expect(byName.get('Vodkashot')?.rank).toBe('R3');
    expect(byName.get('Black-Wolff')).toBeDefined();
    expect(members.filter((m) => m.active)).toHaveLength(100);
    expect(members).toHaveLength(roster.length + 2);
    expect(changed.length).toBe(summary.updated + summary.added.length + summary.deactivated.length);
    // Applying the same snapshot again changes nothing.
    const again = applyRosterSnapshot(members, snapshot);
    expect(again.changed).toHaveLength(0);
    expect(again.summary.unchanged).toBe(100);
  });
});
