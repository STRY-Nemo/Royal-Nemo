/**
 * Members who joined after the verified seed roster (src/data/members.json).
 * The "Apply roster sheet" API route adds anyone listed here to the database if
 * missing, so bundled sheets can place them. Stats are unknown until a leader
 * fills them in on the Members page.
 */
import type { Member } from '../domain/types';

const ADDED_ON = '2026-09-18';

function newcomer(id: string, username: string): Member {
  return { id, username, aliases: [], rank: 'R1', origin_alliance: 'STRY', level: 0, arena_power_m: 0, power_as_of: ADDED_ON, active: true, tracking_start: ADDED_ON };
}

export const ROSTER_ADDITIONS: Member[] = [newcomer('stry-101', 'Azale'), newcomer('stry-102', 'Vodkashot'), newcomer('stry-103', 'Hamos1otus')];
