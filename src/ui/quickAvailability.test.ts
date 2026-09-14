import { describe, expect, it } from 'vitest';
import { preferenceFromSlots, quickFromSlots, slotsForPreference } from './quickAvailability';

describe('quick availability answers', () => {
  it('maps saved priorities to the quick answer and the preferred time', () => {
    expect(quickFromSlots({ team1: 1, team2: 2 })).toBe('either');
    expect(preferenceFromSlots({ team1: 1, team2: 2 })).toBe('team1');
    expect(preferenceFromSlots({ team1: 2, team2: 1 })).toBe('team2');
    expect(preferenceFromSlots({ team1: 1, team2: 1 })).toBe('none');
    expect(quickFromSlots({ team1: 0, team2: 1 })).toBe('team2');
    expect(preferenceFromSlots({ team1: 0, team2: 1 })).toBe('none');
    expect(quickFromSlots({ team1: 0, team2: 0 })).toBe('none');
    expect(quickFromSlots(null)).toBeNull();
  });

  it('turns a preference back into priorities the engine accepts', () => {
    expect(slotsForPreference('team1')).toEqual({ team1: 1, team2: 2 });
    expect(slotsForPreference('team2')).toEqual({ team1: 2, team2: 1 });
    expect(slotsForPreference('none')).toBeUndefined();
  });
});
