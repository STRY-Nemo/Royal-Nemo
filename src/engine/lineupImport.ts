/**
 * Import of an in-game Canyon Clash team screen (one row per member, as
 * captured from a screen recording) into a draft event.
 *
 * Pure: takes rows/records plus the roster and returns a plan or a new event.
 * The client previews the plan, then client and server both run
 * `applyLineupImport` so every rule (capacity, one team per member, revision)
 * is enforced in both places.
 */
import type { Assignment, AuditEntry, AvailabilityChoice, CanyonEvent, Member, MemberId, Team, TeamId } from '../domain/types';
import { LifecycleError, type Context, type Result } from './lifecycle';
import { normalizeName } from './organization';
import { APOCALYPSE_TIME_ZONE } from './recurrence';
import { allowedTeamIds } from './suggest';

export type TeamNumber = 1 | 2;

export interface LineupRecord {
  username: string;
  /** Which team screen was recorded. */
  team: TeamNumber;
  starter: boolean;
  substitute: boolean;
  ready: boolean;
  declined: boolean;
  /** Team the game showed the member assigned to instead (null = none shown). */
  other_team: TeamNumber | null;
  /** ISO date from the file, when present. */
  event_date: string | null;
}

export interface ParsedLineup {
  records: LineupRecord[];
  event_date: string | null;
  team: TeamNumber | null;
  warnings: string[];
}

const HEADER_KEYS: Record<string, keyof LineupRecord | 'skip'> = {
  eventdate: 'event_date',
  date: 'event_date',
  teamscope: 'team',
  team: 'team',
  username: 'username',
  name: 'username',
  member: 'username',
  starterconfirmed: 'starter',
  starter: 'starter',
  substitute: 'substitute',
  sub: 'substitute',
  ready: 'ready',
  declined: 'declined',
  decline: 'declined',
  otherteamshown: 'other_team',
  otherteam: 'other_team',
};

function headerKey(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function yesNo(v: string | undefined): boolean | 'unknown' {
  const s = (v ?? '').trim().toLowerCase();
  if (['yes', 'y', 'true', '1', 'x'].includes(s)) return true;
  if (['no', 'n', 'false', '0', ''].includes(s)) return false;
  return 'unknown';
}

function teamNumber(v: string | undefined): TeamNumber | null {
  const m = /([12])\s*$/.exec((v ?? '').trim());
  return m ? (Number(m[1]) as TeamNumber) : null;
}

function isoDate(v: string | undefined): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec((v ?? '').trim());
  return m ? m[1] : null;
}

/** Parses the header + rows of a team screen table. Throws on a missing header. */
export function parseLineupRows(rows: string[][]): ParsedLineup {
  if (!rows.length) throw new LifecycleError('empty_file', 'The file has no rows.');
  const header = rows[0].map(headerKey);
  const col = new Map<keyof LineupRecord, number>();
  header.forEach((h, i) => {
    const key = HEADER_KEYS[h];
    if (key && key !== 'skip' && !col.has(key)) col.set(key, i);
  });
  for (const required of ['username', 'starter'] as const) {
    if (!col.has(required)) throw new LifecycleError('bad_header', `Missing a "${required === 'username' ? 'Username' : 'Starter confirmed'}" column. Expected the Canyon Clash team screen table.`);
  }
  const get = (row: string[], key: keyof LineupRecord) => (col.has(key) ? row[col.get(key)!] : undefined);
  const warnings: string[] = [];
  const records: LineupRecord[] = [];
  let unknowns = 0;
  const teams = new Set<TeamNumber>();
  const dates = new Set<string>();
  for (const row of rows.slice(1)) {
    const username = (get(row, 'username') ?? '').trim();
    if (!username) continue;
    const flags = { starter: yesNo(get(row, 'starter')), substitute: yesNo(get(row, 'substitute')), ready: yesNo(get(row, 'ready')), declined: yesNo(get(row, 'declined')) };
    for (const k of Object.keys(flags) as (keyof typeof flags)[]) {
      if (flags[k] === 'unknown') {
        unknowns++;
        flags[k] = false;
      }
    }
    const team = teamNumber(get(row, 'team')) ?? 2;
    const date = isoDate(get(row, 'event_date'));
    if (date) dates.add(date);
    teams.add(team);
    records.push({
      username,
      team,
      starter: flags.starter as boolean,
      substitute: flags.substitute as boolean,
      ready: flags.ready as boolean,
      declined: flags.declined as boolean,
      other_team: teamNumber(get(row, 'other_team')),
      event_date: date,
    });
  }
  if (!records.length) throw new LifecycleError('empty_file', 'No member rows found under the header.');
  if (unknowns) warnings.push(`${unknowns} "Unknown" marker${unknowns === 1 ? '' : 's'} treated as No.`);
  if (teams.size > 1) warnings.push('Rows come from more than one team screen; each row is imported to its own team.');
  if (dates.size > 1) warnings.push('Rows carry more than one event date.');
  return { records, event_date: dates.size === 1 ? [...dates][0] : null, team: teams.size === 1 ? [...teams][0] : null, warnings };
}

function strictKey(s: string): string {
  return normalizeName(s);
}
function looseKey(s: string): string {
  return normalizeName(s).replace(/[^a-z0-9]/g, '');
}

export interface LineupMatch {
  record: LineupRecord;
  member: Member | null;
}

/** Matches file names to roster members: exact (normalized) username or alias, leader name mapping, then a unique loose match. */
export function matchLineup(records: LineupRecord[], members: Member[], nameMapping: Record<string, MemberId | null> = {}): LineupMatch[] {
  const byId = new Map(members.map((m) => [m.id, m]));
  const strict = new Map<string, Member>();
  const loose = new Map<string, Member[]>();
  for (const m of members) {
    for (const n of [m.username, ...m.aliases]) {
      strict.set(strictKey(n), m);
      const k = looseKey(n);
      loose.set(k, [...(loose.get(k) ?? []), m]);
    }
  }
  const mapping = new Map<string, MemberId | null>();
  for (const [name, id] of Object.entries(nameMapping)) mapping.set(strictKey(name), id);
  return records.map((record) => {
    const key = strictKey(record.username);
    const mapped = mapping.get(key);
    if (mapped) return { record, member: byId.get(mapped) ?? null };
    const exact = strict.get(key);
    if (exact) return { record, member: exact };
    const candidates = loose.get(looseKey(record.username)) ?? [];
    const unique = new Set(candidates.map((m) => m.id));
    return { record, member: unique.size === 1 ? candidates[0] : null };
  });
}

export interface AvailabilityChange {
  member: Member;
  from: AvailabilityChoice | null;
  to: AvailabilityChoice;
}

export interface LineupPlan {
  team: Team;
  team_index: TeamNumber;
  starters: Member[];
  reserves: Member[];
  declined: Member[];
  /** Members the game showed on the other team (not starters or subs here). */
  other_team: Member[];
  unmatched: LineupRecord[];
  /** Matched rows with no marker at all (nothing changes for them). */
  no_marker: number;
  availability: AvailabilityChange[];
  /** Members currently assigned in the app somewhere else who move into this team. */
  moved_from_elsewhere: Member[];
  /** Existing app assignments on this team that will be replaced. */
  replaced: number;
  sets_timezone: string | null;
  errors: string[];
}

const NO_CHOICE: AvailabilityChoice | null = null;

function otherTeamChoice(team: TeamNumber): AvailabilityChoice {
  return team === 1 ? 'team2' : 'team1';
}
function ownChoice(team: TeamNumber): AvailabilityChoice {
  return team === 1 ? 'team1' : 'team2';
}

/** Computes what an import would change without touching the event. */
export function planLineupImport(event: CanyonEvent, records: LineupRecord[], members: Member[], nameMapping: Record<string, MemberId | null> = {}): LineupPlan {
  const matches = matchLineup(records, members, nameMapping);
  const teamIndex: TeamNumber = (records.find((r) => r.team)?.team ?? 2) as TeamNumber;
  const team = event.teams[teamIndex - 1];
  const errors: string[] = [];
  if (!team) errors.push(`This event has no ${teamIndex === 1 ? 'Team 1' : 'Team 2'}.`);
  const fileDate = records.find((r) => r.event_date)?.event_date ?? null;
  if (fileDate && fileDate !== event.date) errors.push(`The file is for ${fileDate}, but this event is on ${event.date}.`);
  if (event.status === 'finalized' || event.status === 'canceled') errors.push('This event can no longer be edited.');
  if (records.some((r) => r.team !== teamIndex)) errors.push('All rows must come from the same team screen.');

  const plan: LineupPlan = {
    team: team ?? event.teams[0],
    team_index: teamIndex,
    starters: [],
    reserves: [],
    declined: [],
    other_team: [],
    unmatched: [],
    no_marker: 0,
    availability: [],
    moved_from_elsewhere: [],
    replaced: 0,
    sets_timezone: event.timezone ? null : APOCALYPSE_TIME_ZONE,
    errors,
  };
  if (!team) return plan;

  const seen = new Set<MemberId>();
  for (const { record, member } of matches) {
    if (!member) {
      if (record.starter || record.substitute || record.declined || record.other_team) plan.unmatched.push(record);
      continue;
    }
    if (seen.has(member.id)) {
      errors.push(`${member.username} appears twice in the file.`);
      continue;
    }
    seen.add(member.id);
    if (!member.active) {
      errors.push(`${member.username} is inactive in the roster; reactivate them in Members before importing.`);
      continue;
    }
    const current = event.availability[member.id]?.choice ?? NO_CHOICE;
    const setChoice = (to: AvailabilityChoice) => {
      if (current !== to) plan.availability.push({ member, from: current, to });
    };
    if (record.starter || record.substitute) {
      if (record.starter) plan.starters.push(member);
      else plan.reserves.push(member);
      const allowed = current ? allowedTeamIds(current, event.teams) : [];
      if (!allowed.includes(team.id)) setChoice(current === otherTeamChoice(teamIndex) ? 'either' : ownChoice(teamIndex));
      const existing = event.assignments.find((a) => a.member_id === member.id);
      if (existing && existing.team_id !== team.id) plan.moved_from_elsewhere.push(member);
      continue;
    }
    if (record.declined) {
      plan.declined.push(member);
      if (current === 'either') setChoice(otherTeamChoice(teamIndex));
      else if (current === ownChoice(teamIndex)) setChoice('unavailable');
      else if (!current && record.other_team && record.other_team !== teamIndex) setChoice(ownChoice(record.other_team));
      continue;
    }
    if (record.other_team && record.other_team !== teamIndex) {
      plan.other_team.push(member);
      if (!current) setChoice(ownChoice(record.other_team));
      continue;
    }
    plan.no_marker++;
  }
  if (plan.starters.length > team.capacity) errors.push(`${team.name} has ${plan.starters.length} starters in the file but only ${team.capacity} slots.`);
  if (!plan.starters.length && !plan.reserves.length) errors.push('No starters or substitutes were marked for any roster member.');
  plan.replaced = event.assignments.filter((a) => a.team_id === team.id).length;
  return plan;
}

export interface ImportOptions {
  expectedRevision?: number;
  /** Where the rows came from (file name); kept in lock reasons and audit. */
  source?: string;
}

/** Applies a team screen import: availability, locked starters, locked substitutes, and (if unset) the game timezone. */
export function applyLineupImport(
  event: CanyonEvent,
  records: LineupRecord[],
  members: Member[],
  nameMapping: Record<string, MemberId | null>,
  ctx: Context,
  opts: ImportOptions = {},
): Result & { plan: LineupPlan } {
  if (opts.expectedRevision !== undefined && opts.expectedRevision !== event.revision) {
    throw new LifecycleError('stale_revision', `Someone else changed this event (revision ${event.revision}, you had ${opts.expectedRevision}). Reload to compare.`);
  }
  const plan = planLineupImport(event, records, members, nameMapping);
  if (plan.errors.length) throw new LifecycleError('import_blocked', plan.errors.join(' '));
  const team = plan.team;
  const rev = event.revision + 1;
  const availability = { ...event.availability };
  for (const change of plan.availability) {
    availability[change.member.id] = { event_id: event.id, member_id: change.member.id, choice: change.to, recorded_by: ctx.actor === 'system' ? 'self' : ctx.actor, updated_at: ctx.now };
  }
  const imported = new Set([...plan.starters, ...plan.reserves].map((m) => m.id));
  const kept = event.assignments.filter((a) => a.team_id !== team.id && !imported.has(a.member_id));
  const label = `In-game ${team.name} lineup${opts.source ? ` (${opts.source})` : ''}`;
  const mk = (m: Member, role: Assignment['role']): Assignment => ({
    event_id: event.id,
    member_id: m.id,
    team_id: team.id as TeamId,
    role,
    locked: true,
    lock_reason: label,
    locked_by: ctx.actor === 'system' ? undefined : ctx.actor,
    locked_at: ctx.now,
    reason: role === 'starter' ? `Starter on the in-game ${team.name} screen` : `Substitute on the in-game ${team.name} screen`,
    revision: rev,
  });
  const assignments = [...kept, ...plan.starters.map((m) => mk(m, 'starter')), ...plan.reserves.map((m) => mk(m, 'reserve'))];
  const next: CanyonEvent = {
    ...event,
    timezone: event.timezone ?? plan.sets_timezone,
    availability,
    assignments,
    revision: rev,
  };
  const entry: AuditEntry = {
    id: `${ctx.now}-import-${rev}`,
    event_id: event.id,
    actor_id: ctx.actor,
    action: 'lineup.import',
    before: { team: team.id, assignments: event.assignments.filter((a) => a.team_id === team.id).map((a) => a.member_id), timezone: event.timezone },
    after: { team: team.id, starters: plan.starters.map((m) => m.id), reserves: plan.reserves.map((m) => m.id), availability_changes: plan.availability.length, unmatched: plan.unmatched.map((r) => r.username), timezone: next.timezone },
    reason: opts.source,
    timestamp: ctx.now,
  };
  return { event: next, audit: [entry], plan };
}
