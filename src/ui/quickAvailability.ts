import type { AvailabilityChoice, SlotPriorities, Team } from '../domain/types';

export type QuickKey = 'either' | 'team1' | 'team2' | 'none';

/**
 * One-tap answers: either time, one time only, or can't. "Either" carries no
 * priorities (the engine reserves 1st/2nd for the detailed picker), so `slots`
 * is undefined there and the plain choice is saved.
 */
export function quickOptions(teams: Team[]): { key: QuickKey; label: string; choice: AvailabilityChoice; slots?: SlotPriorities }[] {
  return [
    { key: 'either', label: 'Either', choice: 'either' },
    { key: 'team1', label: teams[0]?.local_time ?? 'Team 1', choice: 'team1', slots: { team1: 1, team2: 0 } },
    { key: 'team2', label: teams[1]?.local_time ?? 'Team 2', choice: 'team2', slots: { team1: 0, team2: 1 } },
    { key: 'none', label: "Can't", choice: 'unavailable', slots: { team1: 0, team2: 0 } },
  ];
}

/** Which quick option a saved answer corresponds to (priorities collapse to "either"). */
export function quickFromSlots(slots: SlotPriorities | null): QuickKey | null {
  if (!slots) return null;
  const t1 = slots.team1 > 0;
  const t2 = slots.team2 > 0;
  if (t1 && t2) return 'either';
  if (t1) return 'team1';
  if (t2) return 'team2';
  return 'none';
}
