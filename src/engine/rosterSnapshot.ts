/**
 * Applies a full-roster snapshot (src/data/rosterSnapshots.ts) to the current
 * member list. Pure: returns the new member list plus a summary of what changed.
 */
import type { Member } from '../domain/types';
import type { RosterSnapshot } from '../data/rosterSnapshots';

export interface RosterSyncSummary {
  as_of: string;
  updated: number;
  unchanged: number;
  renamed: { id: string; from: string; to: string }[];
  added: string[];
  deactivated: string[];
  reactivated: string[];
}

export function applyRosterSnapshot(existing: Member[], snapshot: RosterSnapshot): { members: Member[]; changed: Member[]; summary: RosterSyncSummary } {
  const byId = new Map(existing.map((m) => [m.id, m]));
  const seen = new Set<string>();
  const summary: RosterSyncSummary = { as_of: snapshot.as_of, updated: 0, unchanged: 0, renamed: [], added: [], deactivated: [], reactivated: [] };
  const changed: Member[] = [];
  const next = new Map<string, Member>();
  for (const s of snapshot.members) {
    if (seen.has(s.id)) throw new Error(`Snapshot lists ${s.id} twice.`);
    seen.add(s.id);
    const m = byId.get(s.id);
    if (!m) {
      const added: Member = { id: s.id, username: s.username, aliases: [], rank: s.rank, origin_alliance: s.origin_alliance, level: s.level, arena_power_m: s.arena_power_m, power_as_of: snapshot.as_of, active: true, tracking_start: snapshot.as_of };
      next.set(s.id, added);
      changed.push(added);
      summary.added.push(s.username);
      continue;
    }
    const renamed = m.username !== s.username;
    const aliases = renamed && !m.aliases.includes(m.username) ? [...m.aliases, m.username] : m.aliases;
    const updated: Member = { ...m, username: s.username, aliases, rank: s.rank, origin_alliance: s.origin_alliance, level: s.level, arena_power_m: s.arena_power_m, power_as_of: snapshot.as_of, active: true };
    const same = !renamed && m.rank === s.rank && m.origin_alliance === s.origin_alliance && m.level === s.level && m.arena_power_m === s.arena_power_m && m.power_as_of === snapshot.as_of && m.active;
    if (renamed) summary.renamed.push({ id: m.id, from: m.username, to: s.username });
    if (!m.active) summary.reactivated.push(s.username);
    if (same) summary.unchanged++;
    else {
      summary.updated++;
      changed.push(updated);
    }
    next.set(s.id, same ? m : updated);
  }
  const members: Member[] = [];
  for (const m of existing) {
    if (seen.has(m.id)) {
      members.push(next.get(m.id)!);
      continue;
    }
    if (m.active) {
      const gone = { ...m, active: false };
      summary.deactivated.push(m.username);
      changed.push(gone);
      members.push(gone);
    } else members.push(m);
  }
  for (const s of snapshot.members) if (!byId.has(s.id)) members.push(next.get(s.id)!);
  return { members, changed, summary };
}
