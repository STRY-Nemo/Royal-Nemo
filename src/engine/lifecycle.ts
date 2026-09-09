/**
 * Pure event lifecycle operations. Each function returns a new event (never
 * mutating its input) plus audit entries, and throws a LifecycleError with a
 * stable code when an invariant would be violated. The demo store and tests
 * both use these; a future server can run the same functions inside a
 * transaction.
 */
import type {
  Assignment,
  Attendance,
  AttendanceOutcome,
  AuditEntry,
  Availability,
  AvailabilityChoice,
  CanyonEvent,
  Member,
  MemberId,
  Team,
  TeamId,
} from '../domain/types';
import { computeHistory } from './history';
import { eventIdFor, isValidTimeZone, nextFriday, weekday } from './recurrence';
import { newSeed } from './seed';
import { ALGORITHM_VERSION, allowedTeamIds, generateSuggestions, type LockRequest, type SuggestResult } from './suggest';

export class LifecycleError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export interface Context {
  actor: MemberId | 'system';
  now: string; // ISO timestamp
}

export interface Result<T = CanyonEvent> {
  event: T;
  audit: AuditEntry[];
}

let auditCounter = 0;
function audit(ctx: Context, event_id: string | null, action: string, before: unknown, after: unknown, reason?: string): AuditEntry {
  auditCounter++;
  return { id: `${ctx.now}-${auditCounter}`, event_id, actor_id: ctx.actor, action, before, after, reason, timestamp: ctx.now };
}

export interface DraftOptions {
  series_id: string;
  date: string;
  timezone: string | null;
  date_confirmed?: boolean;
  team_times?: { team1: string; team2: string };
  capacity?: number;
  seed?: string;
}

export function createDraftEvent(opts: DraftOptions): CanyonEvent {
  if (weekday(opts.date) !== 5) {
    throw new LifecycleError('not_friday', `Canyon Clash must be on a Friday; ${opts.date} is not.`);
  }
  const id = eventIdFor(opts.series_id, opts.date);
  const times = opts.team_times ?? { team1: '18:00', team2: '23:00' };
  const cap = opts.capacity ?? 20;
  const teams: Team[] = [
    { id: `${id}:team1`, event_id: id, name: 'Team 1', local_time: times.team1, capacity: cap },
    { id: `${id}:team2`, event_id: id, name: 'Team 2', local_time: times.team2, capacity: cap },
  ];
  return {
    id,
    series_id: opts.series_id,
    date: opts.date,
    timezone: opts.timezone,
    date_confirmed: opts.date_confirmed ?? false,
    status: 'draft',
    algorithm_version: ALGORITHM_VERSION,
    selection_seed: opts.seed ?? newSeed(),
    revision: 1,
    teams,
    availability: {},
    assignments: [],
    attendance: {},
    published_revisions: [],
    confirmations: {},
    finalized_at: null,
    finalized_by: null,
  };
}

/**
 * Idempotently derives the draft for the Friday after `afterDate`. Returns the
 * existing event if one already exists for series + date.
 */
export function ensureNextWeekDraft(
  events: CanyonEvent[],
  opts: Omit<DraftOptions, 'date'> & { afterDate: string },
): { event: CanyonEvent; created: boolean } {
  const date = nextFriday(opts.afterDate);
  const id = eventIdFor(opts.series_id, date);
  const existing = events.find((e) => e.id === id);
  if (existing) return { event: existing, created: false };
  return { event: createDraftEvent({ ...opts, date }), created: true };
}

function assertEditable(event: CanyonEvent, allowPublished = true): void {
  if (event.status === 'finalized') throw new LifecycleError('finalized', 'This event is finalized. Use attendance corrections instead.');
  if (event.status === 'canceled') throw new LifecycleError('canceled', 'This event is canceled.');
  if (!allowPublished && event.status === 'published') throw new LifecycleError('published', 'This lineup is published; edits create a new revision.');
}

function assertRevision(event: CanyonEvent, expected: number | undefined): void {
  if (expected !== undefined && expected !== event.revision) {
    throw new LifecycleError('stale_revision', `Someone else changed this event (revision ${event.revision}, you had ${expected}). Reload to compare.`);
  }
}

export function setAvailability(
  event: CanyonEvent,
  memberId: MemberId,
  choice: AvailabilityChoice,
  ctx: Context,
  recordedBy: MemberId | 'self' = 'self',
): Result {
  assertEditable(event);
  const before = event.availability[memberId] ?? null;
  const next: Availability = { event_id: event.id, member_id: memberId, choice, recorded_by: recordedBy, updated_at: ctx.now };
  const availability = { ...event.availability, [memberId]: next };
  // If a starter's availability no longer allows their team, drop the assignment.
  let assignments = event.assignments;
  const allowed = allowedTeamIds(choice, event.teams);
  const current = assignments.find((a) => a.member_id === memberId && a.role === 'starter');
  if (current && current.team_id && !allowed.includes(current.team_id)) {
    assignments = assignments.filter((a) => a.member_id !== memberId);
  }
  return {
    event: { ...event, availability, assignments },
    audit: [audit(ctx, event.id, 'availability.set', before, next)],
  };
}

export function clearAvailability(event: CanyonEvent, memberId: MemberId, ctx: Context): Result {
  assertEditable(event);
  const before = event.availability[memberId] ?? null;
  const availability = { ...event.availability };
  delete availability[memberId];
  const assignments = event.assignments.filter((a) => a.member_id !== memberId);
  return { event: { ...event, availability, assignments }, audit: [audit(ctx, event.id, 'availability.clear', before, null)] };
}

export function currentLocks(event: CanyonEvent): LockRequest[] {
  return event.assignments
    .filter((a) => a.locked && a.role === 'starter' && a.team_id)
    .map((a) => ({ member_id: a.member_id, team_id: a.team_id as TeamId, reason: a.lock_reason ?? 'Leader lock', locked_by: a.locked_by, locked_at: a.locked_at }));
}

export function suggest(event: CanyonEvent, members: Member[], allEvents: CanyonEvent[]): SuggestResult {
  const history = computeHistory(allEvents.filter((e) => e.id !== event.id), members);
  return generateSuggestions({ event, members, history, locks: currentLocks(event) });
}

/** Runs the engine and stores the result as the draft assignment set. */
export function applySuggestions(event: CanyonEvent, members: Member[], allEvents: CanyonEvent[], ctx: Context, expectedRevision?: number): Result<CanyonEvent> & { result: SuggestResult } {
  assertEditable(event);
  assertRevision(event, expectedRevision);
  const result = suggest(event, members, allEvents);
  if (!result.ok) {
    throw new LifecycleError('locks_conflict', result.errors.map((e) => e.message).join(' '));
  }
  const next: CanyonEvent = { ...event, assignments: result.assignments, revision: event.revision + 1 };
  return { event: next, result, audit: [audit(ctx, event.id, 'suggestions.generate', summarize(event.assignments), summarize(next.assignments))] };
}

function summarize(assignments: Assignment[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const a of assignments) {
    const key = a.role === 'starter' ? (a.team_id ?? 'starter') : 'reserve';
    (out[key] ??= []).push(a.member_id);
  }
  return out;
}

export function starters(event: CanyonEvent, teamId: TeamId): Assignment[] {
  return event.assignments.filter((a) => a.role === 'starter' && a.team_id === teamId);
}

export function reserves(event: CanyonEvent): Assignment[] {
  return event.assignments.filter((a) => a.role === 'reserve');
}

export function teamPower(event: CanyonEvent, members: Member[], teamId: TeamId): number {
  const byId = new Map(members.map((m) => [m.id, m.arena_power_m]));
  const sum = starters(event, teamId).reduce((s, a) => s + (byId.get(a.member_id) ?? 0), 0);
  return Math.round(sum * 10) / 10;
}

function memberAllowed(event: CanyonEvent, memberId: MemberId, teamId: TeamId): boolean {
  const av = event.availability[memberId];
  return !!av && allowedTeamIds(av.choice, event.teams).includes(teamId);
}

function replaceAssignment(list: Assignment[], next: Assignment): Assignment[] {
  const without = list.filter((a) => a.member_id !== next.member_id);
  return [...without, next];
}

/** Locks a member into a team as a starter, with a required reason. */
export function lockMember(event: CanyonEvent, memberId: MemberId, teamId: TeamId, reason: string, ctx: Context, expectedRevision?: number): Result {
  assertEditable(event);
  assertRevision(event, expectedRevision);
  if (!reason.trim()) throw new LifecycleError('reason_required', 'A short reason is required to lock a player.');
  if (!memberAllowed(event, memberId, teamId)) throw new LifecycleError('unavailable', 'This member is not available for that team time.');
  const team = event.teams.find((t) => t.id === teamId)!;
  const existing = event.assignments.find((a) => a.member_id === memberId);
  const others = starters(event, teamId).filter((a) => a.member_id !== memberId);
  if (others.length >= team.capacity) throw new LifecycleError('capacity', `${team.name} is full (${team.capacity}/${team.capacity}). Swap with a player instead.`);
  const next: Assignment = {
    event_id: event.id,
    member_id: memberId,
    team_id: teamId,
    role: 'starter',
    locked: true,
    lock_reason: reason.trim(),
    locked_by: ctx.actor === 'system' ? undefined : ctx.actor,
    locked_at: ctx.now,
    reason: `Leader lock: ${reason.trim()}`,
    revision: event.revision + 1,
  };
  return {
    event: { ...event, assignments: replaceAssignment(event.assignments, next), revision: event.revision + 1 },
    audit: [audit(ctx, event.id, 'assignment.lock', existing ?? null, next, reason)],
  };
}

export function unlockMember(event: CanyonEvent, memberId: MemberId, ctx: Context, expectedRevision?: number): Result {
  assertEditable(event);
  assertRevision(event, expectedRevision);
  const existing = event.assignments.find((a) => a.member_id === memberId);
  if (!existing || !existing.locked) throw new LifecycleError('not_locked', 'This member is not locked.');
  const next: Assignment = { ...existing, locked: false, lock_reason: undefined, locked_by: undefined, locked_at: undefined, reason: 'Unlocked by leader; kept in team until regenerated', revision: event.revision + 1 };
  return {
    event: { ...event, assignments: replaceAssignment(event.assignments, next), revision: event.revision + 1 },
    audit: [audit(ctx, event.id, 'assignment.unlock', existing, next)],
  };
}

/** Moves a member to a team's starters if there is room, or to reserves. */
export function moveMember(event: CanyonEvent, memberId: MemberId, target: TeamId | 'reserve', ctx: Context, expectedRevision?: number): Result {
  assertEditable(event);
  assertRevision(event, expectedRevision);
  const existing = event.assignments.find((a) => a.member_id === memberId) ?? null;
  let next: Assignment;
  if (target === 'reserve') {
    const av = event.availability[memberId];
    const allowed = av ? allowedTeamIds(av.choice, event.teams) : [];
    if (!allowed.length) throw new LifecycleError('unavailable', 'This member has not marked themselves available.');
    next = {
      event_id: event.id,
      member_id: memberId,
      team_id: allowed.length === 1 ? allowed[0] : null,
      role: 'reserve',
      locked: false,
      reason: 'Moved to reserves by leader',
      revision: event.revision + 1,
    };
  } else {
    if (!memberAllowed(event, memberId, target)) throw new LifecycleError('unavailable', 'This member is not available for that team time.');
    const team = event.teams.find((t) => t.id === target)!;
    const others = starters(event, target).filter((a) => a.member_id !== memberId);
    if (others.length >= team.capacity) throw new LifecycleError('capacity', `${team.name} is full (${team.capacity}/${team.capacity}). Use swap instead.`);
    next = {
      event_id: event.id,
      member_id: memberId,
      team_id: target,
      role: 'starter',
      locked: existing?.locked ?? false,
      lock_reason: existing?.lock_reason,
      locked_by: existing?.locked_by,
      locked_at: existing?.locked_at,
      reason: existing?.locked ? existing.reason : `Moved to ${team.name} by leader`,
      revision: event.revision + 1,
    };
  }
  return {
    event: { ...event, assignments: replaceAssignment(event.assignments, next), revision: event.revision + 1 },
    audit: [audit(ctx, event.id, 'assignment.move', existing, next)],
  };
}

/** Exchanges the positions of two members (starter/reserve/team) atomically. */
export function swapMembers(event: CanyonEvent, aId: MemberId, bId: MemberId, ctx: Context, expectedRevision?: number): Result {
  assertEditable(event);
  assertRevision(event, expectedRevision);
  if (aId === bId) throw new LifecycleError('same_member', 'Choose two different players.');
  const a = event.assignments.find((x) => x.member_id === aId);
  const b = event.assignments.find((x) => x.member_id === bId);
  if (!a || !b) throw new LifecycleError('not_assigned', 'Both players must be in the lineup or reserves.');
  const targetForA = b.role === 'starter' ? b.team_id : 'reserve';
  const targetForB = a.role === 'starter' ? a.team_id : 'reserve';
  if (targetForA !== 'reserve' && targetForA && !memberAllowed(event, aId, targetForA)) {
    throw new LifecycleError('unavailable', `${aId} is not available for the other team's time.`);
  }
  if (targetForB !== 'reserve' && targetForB && !memberAllowed(event, bId, targetForB)) {
    throw new LifecycleError('unavailable', `${bId} is not available for the other team's time.`);
  }
  const rev = event.revision + 1;
  const nextA: Assignment = { ...a, team_id: b.team_id, role: b.role, reason: `Swapped with ${bId} by leader`, revision: rev };
  const nextB: Assignment = { ...b, team_id: a.team_id, role: a.role, reason: `Swapped with ${aId} by leader`, revision: rev };
  if (nextA.role === 'reserve' && nextA.team_id === null) {
    const av = event.availability[aId];
    nextA.team_id = av && allowedTeamIds(av.choice, event.teams).length === 1 ? allowedTeamIds(av.choice, event.teams)[0] : null;
  }
  if (nextB.role === 'reserve' && nextB.team_id === null) {
    const av = event.availability[bId];
    nextB.team_id = av && allowedTeamIds(av.choice, event.teams).length === 1 ? allowedTeamIds(av.choice, event.teams)[0] : null;
  }
  const assignments = replaceAssignment(replaceAssignment(event.assignments, nextA), nextB);
  return {
    event: { ...event, assignments, revision: rev },
    audit: [audit(ctx, event.id, 'assignment.swap', [a, b], [nextA, nextB])],
  };
}

export interface PublishBlocker {
  code: string;
  message: string;
}

export function publishBlockers(event: CanyonEvent): PublishBlocker[] {
  const out: PublishBlocker[] = [];
  if (!event.timezone || !isValidTimeZone(event.timezone)) out.push({ code: 'timezone', message: 'Set the event timezone before publishing.' });
  if (!event.date_confirmed) out.push({ code: 'date', message: 'Confirm the event date before publishing.' });
  if (event.status === 'finalized' || event.status === 'canceled') out.push({ code: 'status', message: 'This event can no longer be published.' });
  for (const t of event.teams) {
    if (starters(event, t.id).length > t.capacity) out.push({ code: 'capacity', message: `${t.name} exceeds ${t.capacity} starters.` });
  }
  const seen = new Set<MemberId>();
  for (const a of event.assignments) {
    if (seen.has(a.member_id)) out.push({ code: 'duplicate', message: `${a.member_id} appears twice in the lineup.` });
    seen.add(a.member_id);
    if (a.role === 'starter' && a.team_id && !memberAllowed(event, a.member_id, a.team_id)) {
      out.push({ code: 'unavailable', message: `${a.member_id} is assigned to a time they are not available for.` });
    }
  }
  if (!event.assignments.some((a) => a.role === 'starter')) out.push({ code: 'empty', message: 'Generate or assign at least one starter first.' });
  return out;
}

export function publishEvent(event: CanyonEvent, ctx: Context, expectedRevision?: number): Result {
  assertRevision(event, expectedRevision);
  const blockers = publishBlockers(event);
  if (blockers.length) throw new LifecycleError('blocked', blockers.map((b) => b.message).join(' '));
  const rev = event.revision + 1;
  const snapshot = event.assignments.map((a) => ({ ...a, revision: rev }));
  const published = { revision: rev, published_at: ctx.now, published_by: ctx.actor === 'system' ? 'system' : ctx.actor, assignments: snapshot };
  const next: CanyonEvent = {
    ...event,
    status: 'published',
    revision: rev,
    assignments: snapshot,
    published_revisions: [...event.published_revisions, published],
    // Confirmations from earlier revisions are invalidated on republish.
    confirmations: {},
  };
  return { event: next, audit: [audit(ctx, event.id, 'lineup.publish', { revision: event.revision }, { revision: rev, starters: snapshot.filter((a) => a.role === 'starter').length })] };
}

export function confirmAssignment(event: CanyonEvent, memberId: MemberId, ctx: Context): Result {
  if (event.status !== 'published') throw new LifecycleError('not_published', 'Nothing has been published yet.');
  const a = event.assignments.find((x) => x.member_id === memberId);
  if (!a) throw new LifecycleError('not_assigned', 'You are not in this lineup.');
  const confirmations = { ...event.confirmations, [memberId]: { revision: event.revision, confirmed_at: ctx.now } };
  return { event: { ...event, confirmations }, audit: [audit(ctx, event.id, 'assignment.confirm', null, { member_id: memberId, revision: event.revision })] };
}

/** Records one attendance outcome. Allowed while published or finalized (corrections). */
export function recordAttendance(
  event: CanyonEvent,
  memberId: MemberId,
  outcome: AttendanceOutcome,
  ctx: Context,
  opts: { team_id?: TeamId | null; substitute?: boolean } = {},
): Result {
  if (event.status !== 'published' && event.status !== 'finalized') {
    throw new LifecycleError('not_published', 'Publish the lineup before recording attendance.');
  }
  const before = event.attendance[memberId] ?? null;
  const assignment = event.assignments.find((a) => a.member_id === memberId);
  const teamId = opts.team_id !== undefined ? opts.team_id : (assignment?.team_id ?? before?.team_id ?? null);
  const substitute = opts.substitute ?? before?.substitute ?? (assignment ? assignment.role !== 'starter' : true);
  const next: Attendance = {
    event_id: event.id,
    member_id: memberId,
    team_id: teamId,
    outcome,
    confirmed_by: ctx.actor === 'system' ? null : ctx.actor,
    confirmed_at: outcome === 'unknown' ? null : ctx.now,
    substitute,
  };
  const attendance = { ...event.attendance, [memberId]: next };
  return { event: { ...event, attendance }, audit: [audit(ctx, event.id, event.status === 'finalized' ? 'attendance.correct' : 'attendance.record', before, next)] };
}

/** Attendance list for review: every published member plus any substitutes, default unknown. */
export function attendanceRows(event: CanyonEvent): Attendance[] {
  const rows = new Map<MemberId, Attendance>();
  for (const a of event.assignments) {
    rows.set(a.member_id, {
      event_id: event.id,
      member_id: a.member_id,
      team_id: a.team_id,
      outcome: 'unknown',
      confirmed_by: null,
      confirmed_at: null,
      substitute: a.role !== 'starter',
    });
  }
  for (const att of Object.values(event.attendance)) rows.set(att.member_id, att);
  return [...rows.values()];
}

/** Finalizes attendance. Idempotent: history is derived from records, never incremented. */
export function finalizeEvent(event: CanyonEvent, ctx: Context): Result {
  if (event.status === 'finalized') return { event, audit: [] };
  if (event.status !== 'published') throw new LifecycleError('not_published', 'Publish the lineup and record attendance before finalizing.');
  const next: CanyonEvent = { ...event, status: 'finalized', finalized_at: ctx.now, finalized_by: ctx.actor === 'system' ? null : ctx.actor };
  const summary = attendanceSummary(next);
  return { event: next, audit: [audit(ctx, event.id, 'attendance.finalize', null, summary)] };
}

export function attendanceSummary(event: CanyonEvent): Record<AttendanceOutcome, number> {
  const out: Record<AttendanceOutcome, number> = { played: 0, no_show: 0, withdrew: 0, unused_reserve: 0, unknown: 0 };
  for (const row of attendanceRows(event)) out[row.outcome]++;
  return out;
}

export function cancelEvent(event: CanyonEvent, ctx: Context, reason: string): Result {
  if (event.status === 'finalized') throw new LifecycleError('finalized', 'Finalized events cannot be canceled.');
  return { event: { ...event, status: 'canceled', note: reason }, audit: [audit(ctx, event.id, 'event.cancel', event.status, 'canceled', reason)] };
}

export function updateSchedule(
  event: CanyonEvent,
  patch: { date?: string; timezone?: string | null; date_confirmed?: boolean; team_times?: { team1?: string; team2?: string } },
  ctx: Context,
): Result {
  if (event.status === 'finalized' || event.status === 'canceled') throw new LifecycleError('finalized', 'This event can no longer be rescheduled.');
  if (patch.date !== undefined && weekday(patch.date) !== 5) throw new LifecycleError('not_friday', 'Canyon Clash must be on a Friday in the event timezone.');
  if (patch.timezone !== undefined && patch.timezone !== null && !isValidTimeZone(patch.timezone)) throw new LifecycleError('bad_timezone', 'Unknown timezone name.');
  const teams = event.teams.map((t, i) => {
    const key = i === 0 ? 'team1' : 'team2';
    const time = patch.team_times?.[key as 'team1' | 'team2'];
    return time ? { ...t, local_time: time } : t;
  });
  const timesChanged = teams.some((t, i) => t.local_time !== event.teams[i].local_time);
  const next: CanyonEvent = {
    ...event,
    date: patch.date ?? event.date,
    timezone: patch.timezone !== undefined ? patch.timezone : event.timezone,
    date_confirmed: patch.date_confirmed ?? (patch.date !== undefined ? false : event.date_confirmed),
    teams,
    // A time change invalidates existing availability responses.
    availability: timesChanged ? {} : event.availability,
    assignments: timesChanged ? [] : event.assignments,
    confirmations: timesChanged ? {} : event.confirmations,
    revision: event.revision + 1,
  };
  return { event: next, audit: [audit(ctx, event.id, 'event.schedule', { date: event.date, timezone: event.timezone, teams: event.teams }, { date: next.date, timezone: next.timezone, teams: next.teams })] };
}

/** Restores a full assignment set (used by Undo). Validates revision and invariants. */
export function replaceAssignments(event: CanyonEvent, assignments: Assignment[], ctx: Context, expectedRevision?: number): Result {
  assertEditable(event);
  assertRevision(event, expectedRevision);
  const seen = new Set<MemberId>();
  for (const a of assignments) {
    if (seen.has(a.member_id)) throw new LifecycleError('duplicate', 'A member appears twice.');
    seen.add(a.member_id);
    if (a.role === 'starter' && a.team_id && !memberAllowed(event, a.member_id, a.team_id)) {
      throw new LifecycleError('unavailable', 'A restored assignment conflicts with current availability.');
    }
  }
  for (const t of event.teams) {
    if (assignments.filter((a) => a.role === 'starter' && a.team_id === t.id).length > t.capacity) {
      throw new LifecycleError('capacity', `${t.name} would exceed ${t.capacity} starters.`);
    }
  }
  const rev = event.revision + 1;
  const next = assignments.map((a) => ({ ...a, revision: rev }));
  return { event: { ...event, assignments: next, revision: rev }, audit: [audit(ctx, event.id, 'assignment.restore', summarize(event.assignments), summarize(next))] };
}

/** Records or clears a leader-only mechanical note on a member. */
export function withMechanicalNote(member: Member, note: string): Member {
  return { ...member, mechanical_notes: note.trim() ? note.trim() : undefined };
}
