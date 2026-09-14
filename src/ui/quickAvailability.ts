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

export type Preference = 'team1' | 'team2' | 'none';

/** Which time an "either" answer puts first, from its saved priorities. */
export function preferenceFromSlots(slots: SlotPriorities | null): Preference {
  if (!slots || slots.team1 === 0 || slots.team2 === 0) return 'none';
  if (slots.team1 === 1 && slots.team2 === 2) return 'team1';
  if (slots.team2 === 1 && slots.team1 === 2) return 'team2';
  return 'none';
}

/** Slots for an "either" answer with the given preference; `undefined` means no priorities (plain either). */
export function slotsForPreference(pref: Preference): SlotPriorities | undefined {
  if (pref === 'team1') return { team1: 1, team2: 2 };
  if (pref === 'team2') return { team1: 2, team2: 1 };
  return undefined;
}
