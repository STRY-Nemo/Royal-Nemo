import type { Assignment, CanyonEvent, Member, MemberId } from '../domain/types';

export const DEFAULT_WINDOW_SIZE = 8;

export interface MemberHistory {
  member_id: MemberId;
  /** Finalized events in the window where the member actually played. */
  played_count: number;
  /** Finalized events in the window where the member was available, not a starter, and did not play. */
  eligible_benches: number;
  /** Date (YYYY-MM-DD) of the most recent finalized played record, or null. */
  last_played_at: string | null;
  /** Lifetime plays across all finalized events since tracking start. */
  lifetime_played: number;
  lifetime_benches: number;
  /** Finalized events counted for this member inside the window. */
  events_in_window: number;
  /** Events in the window where the member's outcome was unknown. */
  unknown_count: number;
  no_show_count: number;
  withdrew_count: number;
  /** Events in the window counted from a lineup that is not finalized yet (imported or published). */
  provisional_count: number;
  /** True while fewer events than the window size exist for the member. */
  history_incomplete: boolean;
  /** Date since which the member has been waiting (last play, or tracking start). */
  waiting_since: string | null;
}

/** Starters in the last published revision of an event (falls back to the working lineup). */
export function finalStarters(event: CanyonEvent): Assignment[] {
  const last = event.published_revisions[event.published_revisions.length - 1];
  const source = last ? last.assignments : event.assignments;
  return source.filter((a) => a.role === 'starter');
}

/**
 * An event counts towards history when it is finalized, or when it already has a
 * lineup (imported from the game screen, generated or published) and is not
 * canceled. The second kind is provisional: starters count as plays and
 * substitutes as waits until attendance is confirmed and the event finalized.
 */
export function countsTowardsHistory(event: CanyonEvent): boolean {
  if (event.status === 'finalized') return true;
  if (event.status === 'canceled') return false;
  return finalStarters(event).length > 0;
}

function wasExplicitlyAvailable(event: CanyonEvent, memberId: MemberId): boolean {
  const a = event.availability[memberId];
  return !!a && a.choice !== 'unavailable';
}

/**
 * Derives per-member Canyon history from finalized events, plus provisional
 * records from earlier events that have a lineup but are not finalized yet
 * (so next week's suggestions already know who started this week).
 *
 * Counts are always derived from unique records, never incremented, so
 * finalizing twice or correcting an outcome recalculates cleanly.
 * `before` limits history to events dated strictly earlier (the week being planned).
 */
export function computeHistory(
  events: CanyonEvent[],
  members: Member[],
  options: { windowSize?: number; before?: string } = {},
): Record<MemberId, MemberHistory> {
  const windowSize = options.windowSize ?? DEFAULT_WINDOW_SIZE;
  // Dedupe by id (last occurrence wins) so callers can pass overlapping lists safely.
  const unique = new Map<string, CanyonEvent>();
  for (const e of events) unique.set(e.id, e);
  const finalized = [...unique.values()]
    .filter((e) => countsTowardsHistory(e) && (!options.before || e.date < options.before))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : 1));

  const result: Record<MemberId, MemberHistory> = {};

  for (const member of members) {
    const tracked = finalized.filter((e) => e.date >= member.tracking_start);
    const windowEvents = tracked.slice(Math.max(0, tracked.length - windowSize));

    let lifetimePlayed = 0;
    let lifetimeBenches = 0;
    let lastPlayed: string | null = null;

    const classify = (event: CanyonEvent): 'played' | 'bench' | 'unknown' | 'no_show' | 'withdrew' | 'none' => {
      const att = event.attendance[member.id];
      const outcome = att?.outcome ?? null;
      if (outcome === 'played') return 'played';
      if (outcome === 'no_show') return 'no_show';
      if (outcome === 'withdrew') return 'withdrew';
      const starter = finalStarters(event).some((a) => a.member_id === member.id);
      if (event.status !== 'finalized') {
        // Provisional: the lineup stands in for attendance until the match is confirmed.
        if (starter) return 'played';
        const onBench = event.assignments.some((a) => a.member_id === member.id && a.role === 'reserve');
        return onBench || wasExplicitlyAvailable(event, member.id) ? 'bench' : 'none';
      }
      if (starter && (outcome === null || outcome === 'unknown')) return 'unknown';
      if (wasExplicitlyAvailable(event, member.id) && !starter) return 'bench';
      if (outcome === 'unknown') return 'unknown';
      return 'none';
    };

    for (const event of tracked) {
      const c = classify(event);
      if (c === 'played') {
        lifetimePlayed++;
        if (!lastPlayed || event.date > lastPlayed) lastPlayed = event.date;
      } else if (c === 'bench') {
        lifetimeBenches++;
      }
    }

    let played = 0;
    let benches = 0;
    let unknown = 0;
    let noShow = 0;
    let withdrew = 0;
    let provisional = 0;
    for (const event of windowEvents) {
      const c = classify(event);
      if (event.status !== 'finalized' && (c === 'played' || c === 'bench')) provisional++;
      if (c === 'played') played++;
      else if (c === 'bench') benches++;
      else if (c === 'unknown') unknown++;
      else if (c === 'no_show') noShow++;
      else if (c === 'withdrew') withdrew++;
    }

    result[member.id] = {
      member_id: member.id,
      played_count: played,
      eligible_benches: benches,
      last_played_at: lastPlayed,
      lifetime_played: lifetimePlayed,
      lifetime_benches: lifetimeBenches,
      events_in_window: windowEvents.length,
      unknown_count: unknown,
      no_show_count: noShow,
      withdrew_count: withdrew,
      provisional_count: provisional,
      history_incomplete: windowEvents.length < windowSize,
      waiting_since: lastPlayed ?? member.tracking_start,
    };
  }

  return result;
}

export function emptyHistory(member: Member): MemberHistory {
  return {
    member_id: member.id,
    played_count: 0,
    eligible_benches: 0,
    last_played_at: null,
    lifetime_played: 0,
    lifetime_benches: 0,
    events_in_window: 0,
    unknown_count: 0,
    no_show_count: 0,
    withdrew_count: 0,
    provisional_count: 0,
    history_incomplete: true,
    waiting_since: member.tracking_start,
  };
}
