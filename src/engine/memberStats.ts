/**
 * Editable player stats (arena power, level, rank). Shared validation so the
 * client (optimistic) and the server (authoritative) agree.
 */
import type { AllianceRank, Member } from '../domain/types';
import { LifecycleError } from './lifecycle';

export const RANKS: AllianceRank[] = ['R1', 'R2', 'R3', 'R4', 'R5'];
export const POWER_MAX_M = 5000;
export const LEVEL_MAX = 500;

export interface StatsPatch {
  arena_power_m?: number;
  level?: number;
  rank?: AllianceRank;
}

/** Fields a member may change on their own record (leaders may change all three). */
export const SELF_EDITABLE: (keyof StatsPatch)[] = ['arena_power_m', 'level'];

export function validateStats(patch: StatsPatch): StatsPatch {
  const out: StatsPatch = {};
  if (patch.arena_power_m !== undefined) {
    const p = Number(patch.arena_power_m);
    if (!Number.isFinite(p) || p < 0 || p > POWER_MAX_M) throw new LifecycleError('bad_power', `Arena power must be between 0 and ${POWER_MAX_M} million.`);
    out.arena_power_m = Math.round(p * 10) / 10;
  }
  if (patch.level !== undefined) {
    const l = Number(patch.level);
    if (!Number.isInteger(l) || l < 1 || l > LEVEL_MAX) throw new LifecycleError('bad_level', `Level must be a whole number between 1 and ${LEVEL_MAX}.`);
    out.level = l;
  }
  if (patch.rank !== undefined) {
    if (!RANKS.includes(patch.rank)) throw new LifecycleError('bad_rank', 'Rank must be R1 to R5.');
    out.rank = patch.rank;
  }
  if (Object.keys(out).length === 0) throw new LifecycleError('bad_request', 'Nothing to update.');
  return out;
}

/** Applies a validated patch; a power change stamps `power_as_of` with today's date. */
export function applyStats(member: Member, patch: StatsPatch, today: string): Member {
  const p = validateStats(patch);
  const next: Member = { ...member, ...p };
  if (p.arena_power_m !== undefined && p.arena_power_m !== member.arena_power_m) next.power_as_of = today;
  return next;
}
