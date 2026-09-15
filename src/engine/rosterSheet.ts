/**
 * The leaders' roster sheet, derived from the event: one row per active member
 * with the columns the organizers track by hand (Joined? · Voted · Family Member ·
 * Ready? · Starter · Sub), grouped into the sheet's sections.
 */
import type { AvailabilityChoice, CanyonEvent, Member, MemberId, SlotPriorities, TrackingEntry, TrackingEntryInput, TrackingJoined, TrackingReady } from '../domain/types';
import { describeAvailability } from './suggest';
import { applyLineupImport, type LineupRecord, type TeamNumber } from './lineupImport';
import { applyTrackingEntries, finalizeEvent, LifecycleError, setAvailability, type Context, type Result } from './lifecycle';

export type SheetSection = 'team1_starters' | 'team1_subs' | 'team2_starters' | 'team2_subs' | 'declined' | 'ready' | 'no_response';

export interface SheetRow {
  member: Member;
  section: SheetSection;
  /** "Voted" column: the time they asked for, or null for no vote. */
  voted: AvailabilityChoice | null;
  votedLabel: string;
  joined: TrackingJoined | null;
  ready: TrackingReady | null;
  /** Rank shown in the sheet's Ready? column for leadership (R4/R5). */
  rank: string;
  starter: string | null;
  sub: string | null;
  flag: 'removed' | 'added' | null;
  note: string | null;
  confirmed: boolean;
  entry: TrackingEntry | null;
}

export const SECTION_LABELS: Record<SheetSection, string> = {
  team1_starters: 'Team 1 starters',
  team1_subs: 'Team 1 substitutes',
  team2_starters: 'Team 2 starters',
  team2_subs: 'Team 2 substitutes',
  declined: 'Declined / offline',
  ready: 'Ready, not placed',
  no_response: "Didn't vote or respond",
};

export const JOINED_LABELS: Record<TrackingJoined, string> = { yes: 'Yes', mvp: 'MVP', other_alliance: 'Played elsewhere', no: 'No' };
export const READY_LABELS: Record<TrackingReady, string> = { ready: 'Ready', declined: 'Declined', offline: 'Offline' };

export function votedLabel(choice: AvailabilityChoice | null, event: CanyonEvent): string {
  if (!choice) return 'No vote';
  if (choice === 'team1') return event.teams[0]?.local_time ?? 'Team 1';
  if (choice === 'team2') return event.teams[1]?.local_time ?? 'Team 2';
  if (choice === 'either') return 'Any time';
  return "Can't";
}

export function sheetRows(event: CanyonEvent, members: Member[]): SheetRow[] {
  const t1 = event.teams[0]?.id;
  const t2 = event.teams[1]?.id;
  const rows: SheetRow[] = [];
  for (const m of members) {
    if (!m.active) continue;
    const av = event.availability[m.id];
    const a = event.assignments.find((x) => x.member_id === m.id);
    const entry = event.tracking?.[m.id] ?? null;
    const att = event.attendance[m.id];
    const joined: TrackingJoined | null = entry?.joined ?? (att?.outcome === 'played' ? 'yes' : att?.outcome === 'no_show' ? 'no' : null);
    const ready: TrackingReady | null = entry?.ready ?? (att?.outcome === 'withdrew' ? 'declined' : null);
    const teamLabel = (id: string | null | undefined) => (id === t1 ? 'Team 1' : id === t2 ? 'Team 2' : null);
    const starter = a?.role === 'starter' ? teamLabel(a.team_id) : null;
    const sub = a?.role === 'reserve' ? (teamLabel(a.team_id) ?? 'Waiting') : null;
    let section: SheetSection;
    if (starter === 'Team 1') section = 'team1_starters';
    else if (starter === 'Team 2') section = 'team2_starters';
    else if (sub === 'Team 1') section = 'team1_subs';
    else if (sub === 'Team 2') section = 'team2_subs';
    else if (ready === 'declined' || ready === 'offline' || av?.choice === 'unavailable') section = 'declined';
    else if (av || ready === 'ready' || sub) section = 'ready';
    else section = 'no_response';
    rows.push({
      member: m,
      section,
      voted: av ? av.choice : null,
      votedLabel: av ? (av.slots && av.choice === 'either' ? describeAvailability(av, event.teams) : votedLabel(av.choice, event)) : 'No vote',
      joined,
      ready,
      rank: m.rank,
      starter,
      sub,
      flag: entry?.flag ?? null,
      note: entry?.note ?? null,
      confirmed: !!event.confirmations[m.id],
      entry,
    });
  }
  const order: SheetSection[] = ['team1_starters', 'team1_subs', 'team2_starters', 'team2_subs', 'declined', 'ready', 'no_response'];
  return rows.sort((a, b) => order.indexOf(a.section) - order.indexOf(b.section) || a.member.username.localeCompare(b.member.username, undefined, { sensitivity: 'base' }));
}

export function sheetCounts(rows: SheetRow[]): Record<SheetSection, number> & { joined: number; ready: number } {
  const out = { team1_starters: 0, team1_subs: 0, team2_starters: 0, team2_subs: 0, declined: 0, ready: 0, no_response: 0, joined: 0 } as Record<SheetSection, number> & { joined: number; ready: number };
  for (const r of rows) {
    out[r.section]++;
    if (r.joined === 'yes' || r.joined === 'mvp') out.joined++;
  }
  out.ready = rows.filter((r) => r.ready === 'ready').length;
  return out;
}

/** Plain-text version of the sheet for the alliance chat or a spreadsheet paste (tab separated). */
export function sheetText(event: CanyonEvent, rows: SheetRow[]): string {
  const lines = [`Canyon Clash ${event.date} roster sheet`, ['Section', 'Joined?', 'Voted', 'Family Member', 'Ready?', 'Starter', 'Sub', 'Notes'].join('\t')];
  for (const r of rows) {
    lines.push(
      [
        SECTION_LABELS[r.section],
        r.joined ? JOINED_LABELS[r.joined] : '',
        r.votedLabel === 'No vote' ? 'No Vote' : r.votedLabel,
        r.member.username,
        r.ready ? READY_LABELS[r.ready] : r.rank === 'R4' || r.rank === 'R5' ? r.rank : '',
        r.starter ?? '',
        r.flag === 'removed' ? 'REMOVED' : r.flag === 'added' ? 'ADDED' : (r.sub ?? ''),
        r.note ?? '',
      ].join('\t'),
    );
  }
  return lines.join('\n');
}

/** A bundled roster sheet transcribed from the leaders' spreadsheet, keyed by roster username. */
export interface BundledSheetRow {
  username: string;
  section: string;
  voted: AvailabilityChoice | null;
  /** First/second choice between the two times when the sheet says so (e.g. "can do both, prefers 18:00"). */
  slots?: SlotPriorities;
  joined?: TrackingJoined;
  ready?: TrackingReady;
  flag?: 'removed' | 'added';
  starter?: string;
  sub?: string;
  note?: string;
}

export interface SheetImportPlan {
  entries: TrackingEntryInput[];
  /** Sheet names that match no active roster member. */
  unmatched: string[];
  /** Members the sheet places on a team that differs from the app lineup. */
  mismatches: { member: Member; sheet: string; app: string }[];
  /** Members who will receive a vote from the sheet because they had no answer. */
  votesFilled: number;
}

/** Matches sheet rows to active roster members by normalized username; duplicate source rows keep their first. */
export function matchSheetRows(members: Member[], rows: BundledSheetRow[]): { matched: { row: BundledSheetRow; member: Member }[]; unmatched: string[] } {
  const byName = new Map(members.filter((m) => m.active).map((m) => [normalize(m.username), m]));
  const matched: { row: BundledSheetRow; member: Member }[] = [];
  const unmatched: string[] = [];
  const seen = new Set<MemberId>();
  for (const row of rows) {
    const m = byName.get(normalize(row.username));
    if (!m) {
      unmatched.push(row.username);
      continue;
    }
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    matched.push({ row, member: m });
  }
  return { matched, unmatched };
}

/** Matches sheet rows to roster members and lists what an import would change. */
export function planSheetImport(event: CanyonEvent, members: Member[], rows: BundledSheetRow[]): SheetImportPlan {
  const entries: TrackingEntryInput[] = [];
  const mismatches: SheetImportPlan['mismatches'] = [];
  let votesFilled = 0;
  const current = sheetRows(event, members);
  const { matched, unmatched } = matchSheetRows(members, rows);
  for (const { row, member: m } of matched) {
    const entry: TrackingEntryInput = { member_id: m.id };
    if (row.joined) entry.joined = row.joined;
    if (row.ready) entry.ready = row.ready;
    if (row.flag) entry.flag = row.flag;
    if (row.note) entry.note = row.note;
    if (row.voted) {
      entry.voted = row.voted;
      if (!event.availability[m.id]) votesFilled++;
    }
    entries.push(entry);
    const appRow = current.find((r) => r.member.id === m.id);
    const sheetTeam = row.starter ? `${row.starter} starter` : row.sub && /Team/.test(row.sub) ? `${row.sub} sub` : null;
    const appTeam = appRow?.starter ? `${appRow.starter} starter` : appRow?.sub && /Team/.test(appRow.sub) ? `${appRow.sub} sub` : null;
    if (sheetTeam && appTeam !== sheetTeam) mismatches.push({ member: m, sheet: sheetTeam, app: appTeam ?? 'not placed' });
  }
  return { entries, unmatched, mismatches, votesFilled };
}

/**
 * The sheet's Starter / Sub columns as lineup import records, one list per team,
 * so the same rules as the in-game screen import apply (capacity, one team per
 * member, availability adjusted to match). REMOVED rows are skipped; a "Team 1?"
 * placement counts as Team 1.
 */
export function sheetLineupRecords(rows: BundledSheetRow[], eventDate: string): { team1: LineupRecord[]; team2: LineupRecord[] } {
  const out = { team1: [] as LineupRecord[], team2: [] as LineupRecord[] };
  const seen = new Set<string>();
  for (const row of rows) {
    if (row.flag === 'removed') continue;
    const teamOf = (label: string | undefined): TeamNumber | null => (label && /Team 1/.test(label) ? 1 : label && /Team 2/.test(label) ? 2 : null);
    const starterTeam = teamOf(row.starter);
    const subTeam = starterTeam ? null : teamOf(row.sub);
    const team = starterTeam ?? subTeam;
    if (!team) continue;
    const key = normalize(row.username);
    if (seen.has(key)) continue;
    seen.add(key);
    const record: LineupRecord = {
      username: row.username,
      team,
      starter: !!starterTeam,
      substitute: !!subTeam,
      ready: row.ready === 'ready',
      declined: row.ready === 'declined',
      other_team: null,
      event_date: eventDate,
    };
    (team === 1 ? out.team1 : out.team2).push(record);
  }
  return out;
}

export interface ApplySheetOptions {
  /** Overwrite votes members gave themselves and re-place the teams; a finalized week is reopened for the apply and finalized again. */
  force?: boolean;
  source?: string;
  recordedBy?: MemberId | 'self';
}

export interface ApplySheetSummary {
  matched: number;
  unmatched: string[];
  votes_set: number;
  votes_kept: number;
  tracked: number;
  team1: { starters: number; reserves: number } | null;
  team2: { starters: number; reserves: number } | null;
  refinalized: boolean;
}

/**
 * Applies a whole bundled sheet to its week in one step: votes (overwriting
 * existing ones when `force`), the tracking columns, and the Starter / Sub
 * placements for both teams. Used server-side to populate a week without
 * anyone tapping through the app.
 */
export function applyBundledSheet(event: CanyonEvent, rows: BundledSheetRow[], members: Member[], nameMapping: Record<string, MemberId | null>, ctx: Context, opts: ApplySheetOptions = {}): Result & { summary: ApplySheetSummary } {
  if (event.status === 'canceled') throw new LifecycleError('canceled', 'This event is canceled.');
  const wasFinalized = event.status === 'finalized';
  if (wasFinalized && !opts.force) throw new LifecycleError('finalized', 'This event is finalized; pass force to reopen it for the sheet.');
  let working: CanyonEvent = wasFinalized ? { ...event, status: 'published' } : event;
  const audit: Result['audit'] = [];
  const recordedBy = opts.recordedBy ?? 'self';
  const { matched, unmatched } = matchSheetRows(members, rows);
  let votesSet = 0;
  let votesKept = 0;
  const entries: TrackingEntryInput[] = [];
  for (const { row, member } of matched) {
    if (row.voted) {
      if (opts.force || !working.availability[member.id]) {
        const r = setAvailability(working, member.id, row.voted, ctx, recordedBy, row.slots);
        working = r.event;
        audit.push(...r.audit);
        votesSet++;
      } else votesKept++;
    }
    const entry: TrackingEntryInput = { member_id: member.id };
    if (row.joined) entry.joined = row.joined;
    if (row.ready) entry.ready = row.ready;
    if (row.flag) entry.flag = row.flag;
    if (row.note) entry.note = row.note;
    if (entry.joined || entry.ready || entry.flag || entry.note) entries.push(entry);
  }
  if (entries.length) {
    const r = applyTrackingEntries(working, entries, ctx, recordedBy);
    working = r.event;
    audit.push(...r.audit);
  }
  const records = sheetLineupRecords(rows, working.date);
  const teams: { team1: ApplySheetSummary['team1']; team2: ApplySheetSummary['team2'] } = { team1: null, team2: null };
  for (const key of ['team1', 'team2'] as const) {
    if (!records[key].length) continue;
    const r = applyLineupImport(working, records[key], members, nameMapping, ctx, { source: opts.source });
    working = r.event;
    audit.push(...r.audit);
    teams[key] = { starters: r.plan.starters.length, reserves: r.plan.reserves.length };
  }
  if (wasFinalized) {
    const r = finalizeEvent(working, ctx);
    working = r.event;
    audit.push(...r.audit);
  }
  return { event: working, audit, summary: { matched: matched.length, unmatched, votes_set: votesSet, votes_kept: votesKept, tracked: entries.length, ...teams, refinalized: wasFinalized } };
}

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}
