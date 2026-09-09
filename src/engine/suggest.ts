import type {
  Assignment,
  Availability,
  AvailabilityChoice,
  CanyonEvent,
  Member,
  MemberId,
  Team,
  TeamId,
} from '../domain/types';
import { MinCostFlow } from './flow';
import type { MemberHistory } from './history';
import { emptyHistory } from './history';
import { lotteryValue } from './seed';

export const ALGORITHM_VERSION = 'rotation-v1';

export interface LockRequest {
  member_id: MemberId;
  team_id: TeamId;
  reason: string;
  locked_by?: MemberId;
  locked_at?: string;
}

export interface SuggestInput {
  event: Pick<CanyonEvent, 'id' | 'teams' | 'availability' | 'selection_seed' | 'revision'>;
  members: Member[];
  history: Record<MemberId, MemberHistory>;
  locks?: LockRequest[];
  /** Balance arena power between teams by moving flexible players only. Default true. */
  balancePower?: boolean;
}

export interface SuggestError {
  code: 'lock_unavailable' | 'lock_duplicate' | 'lock_capacity' | 'lock_unknown_team' | 'lock_inactive';
  member_id?: MemberId;
  team_id?: TeamId;
  message: string;
}

export type CandidateDecision = 'locked' | 'selected' | 'waiting';

export interface CandidateView {
  member_id: MemberId;
  username: string;
  arena_power_m: number;
  allowed_team_ids: TeamId[];
  rank: number;
  lottery: number;
  history: MemberHistory;
  decision: CandidateDecision;
  team_id: TeamId | null;
  reason: string;
  reliability_note: string | null;
}

export interface SuggestResult {
  ok: boolean;
  algorithm_version: string;
  seed: string;
  errors: SuggestError[];
  warnings: string[];
  assignments: Assignment[];
  candidates: CandidateView[];
  team_power: Record<TeamId, number>;
  open_slots: Record<TeamId, number>;
  eligible_count: number;
}

/** Which teams a member may join for a given availability choice. */
export function allowedTeamIds(choice: AvailabilityChoice, teams: Team[]): TeamId[] {
  const sorted = [...teams];
  switch (choice) {
    case 'team1':
      return sorted[0] ? [sorted[0].id] : [];
    case 'team2':
      return sorted[1] ? [sorted[1].id] : [];
    case 'either':
      return sorted.map((t) => t.id);
    case 'unavailable':
    default:
      return [];
  }
}

export function describeChoice(choice: AvailabilityChoice, teams: Team[]): string {
  switch (choice) {
    case 'team1':
      return `${teams[0]?.name ?? 'Team 1'} (${teams[0]?.local_time ?? ''}) only`;
    case 'team2':
      return `${teams[1]?.name ?? 'Team 2'} (${teams[1]?.local_time ?? ''}) only`;
    case 'either':
      return 'Either time';
    default:
      return 'Unavailable';
  }
}

interface Candidate {
  member: Member;
  allowed: TeamId[];
  history: MemberHistory;
  lottery: number;
}

/** Lexicographic fairness comparator. Lower value means higher priority. */
export function compareCandidates(a: Candidate, b: Candidate): number {
  if (a.history.played_count !== b.history.played_count) return a.history.played_count - b.history.played_count;
  if (a.history.eligible_benches !== b.history.eligible_benches) return b.history.eligible_benches - a.history.eligible_benches;
  const la = a.history.last_played_at;
  const lb = b.history.last_played_at;
  if (la !== lb) {
    if (la === null) return -1;
    if (lb === null) return 1;
    return la < lb ? -1 : 1;
  }
  if (a.lottery !== b.lottery) return a.lottery - b.lottery;
  return a.member.id < b.member.id ? -1 : a.member.id > b.member.id ? 1 : 0;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function reliabilityNote(h: MemberHistory): string | null {
  const parts: string[] = [];
  if (h.no_show_count) parts.push(`${h.no_show_count} no-show${h.no_show_count > 1 ? 's' : ''}`);
  if (h.withdrew_count) parts.push(`${h.withdrew_count} withdrawal${h.withdrew_count > 1 ? 's' : ''}`);
  if (h.unknown_count) parts.push(`${h.unknown_count} unknown`);
  return parts.length ? `Reliability: ${parts.join(', ')} in recent events` : null;
}

function historyPhrase(h: MemberHistory): string {
  const plays = `${h.played_count} play${h.played_count === 1 ? '' : 's'} in last ${h.events_in_window} finalized`;
  const bench = h.eligible_benches ? `, benched ${h.eligible_benches}× while available` : '';
  const last = h.last_played_at ? `, last played ${h.last_played_at}` : ', never recorded';
  const incomplete = h.history_incomplete ? ' · history incomplete' : '';
  return `${plays}${bench}${last}${incomplete}`;
}

/**
 * Generates a fair, deterministic lineup for both team times jointly.
 *
 * 1. Validate locks (availability, uniqueness, capacity) and pin them.
 * 2. Rank remaining eligible candidates lexicographically with a persisted
 *    seeded lottery for exact ties.
 * 3. Min-cost max-flow: maximise filled slots, then pick the lowest-rank
 *    (fairest) feasible set. Flexible players are never consumed greedily.
 * 4. Optionally rebalance arena power by moving/swapping flexible players
 *    only; the selected set never changes.
 */
export function generateSuggestions(input: SuggestInput): SuggestResult {
  const benchCount: Record<TeamId, number> = {};
  const { event, members } = input;
  const teams = [...event.teams];
  const seed = event.selection_seed;
  const errors: SuggestError[] = [];
  const warnings: string[] = [];
  const balance = input.balancePower ?? true;

  const memberById = new Map(members.map((m) => [m.id, m]));
  const capacityLeft: Record<TeamId, number> = {};
  for (const t of teams) capacityLeft[t.id] = t.capacity;

  // ---- Locks -------------------------------------------------------------
  const locks = input.locks ?? [];
  const lockedIds = new Set<MemberId>();
  const lockedAssignments: Assignment[] = [];
  for (const lock of locks) {
    const member = memberById.get(lock.member_id);
    const team = teams.find((t) => t.id === lock.team_id);
    const name = member?.username ?? lock.member_id;
    if (!team) {
      errors.push({ code: 'lock_unknown_team', member_id: lock.member_id, team_id: lock.team_id, message: `${name} is locked to a team that no longer exists.` });
      continue;
    }
    if (!member || !member.active) {
      errors.push({ code: 'lock_inactive', member_id: lock.member_id, team_id: lock.team_id, message: `${name} is locked but is not an active member.` });
      continue;
    }
    if (lockedIds.has(lock.member_id)) {
      errors.push({ code: 'lock_duplicate', member_id: lock.member_id, team_id: lock.team_id, message: `${name} is locked to more than one team.` });
      continue;
    }
    const availability = event.availability[lock.member_id];
    const allowed = availability ? allowedTeamIds(availability.choice, teams) : [];
    if (!allowed.includes(team.id)) {
      errors.push({
        code: 'lock_unavailable',
        member_id: lock.member_id,
        team_id: lock.team_id,
        message: `${name} is locked to ${team.name} (${team.local_time}) but is ${availability ? describeChoice(availability.choice, teams).toLowerCase() : 'no response (unknown)'}. Unlock or update availability.`,
      });
      continue;
    }
    if (capacityLeft[team.id] <= 0) {
      errors.push({ code: 'lock_capacity', member_id: lock.member_id, team_id: lock.team_id, message: `${team.name} already has ${team.capacity} locked players; ${name} cannot be locked there.` });
      continue;
    }
    capacityLeft[team.id]--;
    lockedIds.add(lock.member_id);
    lockedAssignments.push({
      event_id: event.id,
      member_id: lock.member_id,
      team_id: team.id,
      role: 'starter',
      locked: true,
      lock_reason: lock.reason,
      locked_by: lock.locked_by,
      locked_at: lock.locked_at,
      reason: `Leader lock: ${lock.reason}`,
      revision: event.revision,
    });
  }

  // ---- Candidates --------------------------------------------------------
  const candidates: Candidate[] = [];
  for (const member of members) {
    if (!member.active) continue;
    if (lockedIds.has(member.id)) continue;
    const availability: Availability | undefined = event.availability[member.id];
    if (!availability) continue;
    const allowed = allowedTeamIds(availability.choice, teams);
    if (allowed.length === 0) continue;
    candidates.push({
      member,
      allowed,
      history: input.history[member.id] ?? emptyHistory(member),
      lottery: lotteryValue(seed, member.id),
    });
  }
  candidates.sort(compareCandidates);

  // ---- Flow --------------------------------------------------------------
  // Nodes: 0 = source, 1 = sink, candidates 2..n+1, teams after that.
  const SOURCE = 0;
  const SINK = 1;
  const candNode = (i: number) => 2 + i;
  const teamNode = (j: number) => 2 + candidates.length + j;
  const flow = new MinCostFlow(2 + candidates.length + teams.length);
  const candEdgeIndex: number[] = [];
  candidates.forEach((c, i) => {
    // Cost grows with rank so the min-cost max-flow picks the fairest set.
    candEdgeIndex.push(flow.outEdges(SOURCE).length);
    flow.addEdge(SOURCE, candNode(i), 1, i + 1);
    c.allowed.forEach((teamId) => {
      const j = teams.findIndex((t) => t.id === teamId);
      flow.addEdge(candNode(i), teamNode(j), 1, 0);
    });
  });
  teams.forEach((t, j) => flow.addEdge(teamNode(j), SINK, Math.max(0, capacityLeft[t.id]), 0));
  flow.run(SOURCE, SINK);

  const placement = new Map<MemberId, TeamId>();
  candidates.forEach((c, i) => {
    for (const e of flow.outEdges(candNode(i))) {
      const j = e.to - teamNode(0);
      if (j >= 0 && j < teams.length && e.cost === 0) {
        const rev = flow.outEdges(e.to)[e.rev];
        if (rev.cap > 0) placement.set(c.member.id, teams[j].id);
      }
    }
  });

  // ---- Power balancing (flexible players only) ---------------------------
  if (balance && teams.length === 2) {
    rebalance(candidates, placement, teams, capacityLeft, lockedAssignments, memberById);
  }

  // ---- Build outputs -----------------------------------------------------
  const teamPower: Record<TeamId, number> = {};
  const filled: Record<TeamId, number> = {};
  for (const t of teams) {
    teamPower[t.id] = 0;
    filled[t.id] = 0;
  }
  for (const a of lockedAssignments) {
    if (a.team_id) {
      teamPower[a.team_id] += memberById.get(a.member_id)?.arena_power_m ?? 0;
      filled[a.team_id]++;
    }
  }
  const assignments: Assignment[] = [...lockedAssignments];
  const views: CandidateView[] = [];

  for (const a of lockedAssignments) {
    const member = memberById.get(a.member_id)!;
    const h = input.history[member.id] ?? emptyHistory(member);
    views.push({
      member_id: member.id,
      username: member.username,
      arena_power_m: member.arena_power_m,
      allowed_team_ids: allowedTeamIds(event.availability[member.id].choice, teams),
      rank: 0,
      lottery: lotteryValue(seed, member.id),
      history: h,
      decision: 'locked',
      team_id: a.team_id,
      reason: a.reason,
      reliability_note: reliabilityNote(h),
    });
  }

  const selectedByTeam: Record<TeamId, Candidate[]> = {};
  for (const t of teams) selectedByTeam[t.id] = [];
  candidates.forEach((c) => {
    const teamId = placement.get(c.member.id);
    if (teamId) selectedByTeam[teamId].push(c);
  });

  candidates.forEach((c, i) => {
    const teamId = placement.get(c.member.id) ?? null;
    const h = c.history;
    if (teamId) {
      teamPower[teamId] += c.member.arena_power_m;
      filled[teamId]++;
      const reason = selectionReason(c, candidates, placement, teams);
      assignments.push({
        event_id: event.id,
        member_id: c.member.id,
        team_id: teamId,
        role: 'starter',
        locked: false,
        reason,
        revision: event.revision,
      });
      views.push({
        member_id: c.member.id,
        username: c.member.username,
        arena_power_m: c.member.arena_power_m,
        allowed_team_ids: c.allowed,
        rank: i + 1,
        lottery: c.lottery,
        history: h,
        decision: 'selected',
        team_id: teamId,
        reason,
        reliability_note: reliabilityNote(h),
      });
    } else {
      const reason = waitingReason(c, candidates, placement, teams, capacityLeft);
      // Each team keeps its own bench. Single-time players sit on that team's bench; flexible
      // players go to whichever bench is shorter so both teams have substitutes.
      let reserveTeam: TeamId | null = null;
      if (c.allowed.length === 1) reserveTeam = c.allowed[0];
      else if (c.allowed.length > 1) {
        reserveTeam = [...c.allowed].sort((x, y) => (benchCount[x] ?? 0) - (benchCount[y] ?? 0) || teams.findIndex((t) => t.id === x) - teams.findIndex((t) => t.id === y))[0];
      }
      if (reserveTeam) benchCount[reserveTeam] = (benchCount[reserveTeam] ?? 0) + 1;
      assignments.push({
        event_id: event.id,
        member_id: c.member.id,
        team_id: reserveTeam,
        role: 'reserve',
        locked: false,
        reason,
        revision: event.revision,
      });
      views.push({
        member_id: c.member.id,
        username: c.member.username,
        arena_power_m: c.member.arena_power_m,
        allowed_team_ids: c.allowed,
        rank: i + 1,
        lottery: c.lottery,
        history: h,
        decision: 'waiting',
        team_id: reserveTeam,
        reason,
        reliability_note: reliabilityNote(h),
      });
    }
  });

  const openSlots: Record<TeamId, number> = {};
  for (const t of teams) {
    openSlots[t.id] = t.capacity - filled[t.id];
    teamPower[t.id] = round1(teamPower[t.id]);
    if (openSlots[t.id] > 0) {
      const waitingForOther = candidates.filter((c) => !placement.has(c.member.id)).length;
      if (waitingForOther > 0) {
        warnings.push(`${t.name} (${t.local_time}) has ${openSlots[t.id]} open slot${openSlots[t.id] === 1 ? '' : 's'}; ${waitingForOther} waiting player${waitingForOther === 1 ? ' is' : 's are'} only available for the other time.`);
      } else {
        warnings.push(`${t.name} (${t.local_time}) has ${openSlots[t.id]} open slot${openSlots[t.id] === 1 ? '' : 's'} because not enough players are available.`);
      }
    }
  }
  const totalCapacity = teams.reduce((s, t) => s + t.capacity, 0);
  const eligible = candidates.length + lockedAssignments.length;
  if (eligible < totalCapacity) {
    warnings.push(`Only ${eligible} eligible players for ${totalCapacity} slots. Members with no response are treated as unknown, not available.`);
  }
  const incomplete = views.filter((v) => v.history.history_incomplete).length;
  if (incomplete > 0) {
    warnings.push(`${incomplete} candidate${incomplete === 1 ? ' has' : 's have'} incomplete Canyon history (fewer than 8 finalized events tracked).`);
  }

  return {
    ok: errors.length === 0,
    algorithm_version: ALGORITHM_VERSION,
    seed,
    errors,
    warnings,
    assignments: errors.length ? [] : assignments,
    candidates: views,
    team_power: teamPower,
    open_slots: openSlots,
    eligible_count: eligible,
  };
}

function selectionReason(c: Candidate, all: Candidate[], placement: Map<MemberId, TeamId>, teams: Team[]): string {
  const waiting = all.filter((o) => !placement.has(o.member.id));
  const h = c.history;
  let lead = '';
  if (h.played_count === 0 && h.events_in_window === 0) lead = 'No Canyon history yet';
  else if (h.played_count === 0) lead = 'No recent plays';
  else if (waiting.some((w) => w.history.played_count > h.played_count)) lead = 'Fewer recent plays than waiting players';
  else if (waiting.some((w) => w.history.eligible_benches < h.eligible_benches)) lead = 'Waited while available more often';
  else if (waiting.length && h.last_played_at) lead = `Waiting since ${h.last_played_at}`;
  else if (waiting.length === 0) lead = 'Everyone available fits';
  else lead = 'Won seeded tie-break';
  const team = teams.find((t) => t.id === placement.get(c.member.id));
  const flex = c.allowed.length > 1 && team ? ` · flexible, placed in ${team.name}` : '';
  return `${lead} · ${historyPhrase(h)}${flex}`;
}

function waitingReason(
  c: Candidate,
  all: Candidate[],
  placement: Map<MemberId, TeamId>,
  teams: Team[],
  capacityLeft: Record<TeamId, number>,
): string {
  const h = c.history;
  const allowedTeams = teams.filter((t) => c.allowed.includes(t.id));
  let lead: string;
  if (allowedTeams.length === 1) {
    const t = allowedTeams[0];
    const other = teams.find((o) => o.id !== t.id);
    const otherHasRoom = other ? countPlaced(placement, other.id) < capacityLeft[other.id] : false;
    lead = otherHasRoom
      ? `Only available for ${t.local_time}, which is full; ${other!.local_time} still has open slots`
      : `${t.name} (${t.local_time}) is full`;
  } else {
    lead = 'Both teams are full';
  }
  const selectedAhead = all.filter((o) => placement.has(o.member.id) && compareCandidates(o, c) < 0).length;
  const detail = selectedAhead ? `; ${selectedAhead} selected player${selectedAhead === 1 ? ' has' : 's have'} equal or higher priority` : '';
  return `${lead}${detail} · ${historyPhrase(h)}`;
}

function countPlaced(placement: Map<MemberId, TeamId>, teamId: TeamId): number {
  let n = 0;
  for (const v of placement.values()) if (v === teamId) n++;
  return n;
}

/**
 * Deterministic local search that reduces the arena-power gap between the two
 * teams by moving a flexible player into an open slot or swapping two flexible
 * players across teams. Membership of the selected set is never changed.
 */
function rebalance(
  candidates: Candidate[],
  placement: Map<MemberId, TeamId>,
  teams: Team[],
  capacityLeft: Record<TeamId, number>,
  locked: Assignment[],
  memberById: Map<MemberId, Member>,
): void {
  const [t1, t2] = teams;
  const power = (id: MemberId) => memberById.get(id)?.arena_power_m ?? 0;
  const total: Record<TeamId, number> = { [t1.id]: 0, [t2.id]: 0 };
  const count: Record<TeamId, number> = { [t1.id]: 0, [t2.id]: 0 };
  for (const a of locked) if (a.team_id) total[a.team_id] += power(a.member_id);
  for (const [id, team] of placement) {
    total[team] += power(id);
    count[team]++;
  }
  const flexible = candidates.filter((c) => c.allowed.length === 2 && placement.has(c.member.id));
  const gap = () => Math.abs(total[t1.id] - total[t2.id]);

  for (let iter = 0; iter < 200; iter++) {
    let best: { apply: () => void; gap: number } | null = null;
    const current = gap();
    // Single moves into open capacity.
    for (const c of flexible) {
      const from = placement.get(c.member.id)!;
      const to = from === t1.id ? t2.id : t1.id;
      if (count[to] >= capacityLeft[to]) continue;
      const p = power(c.member.id);
      const g = Math.abs(total[t1.id] - total[t2.id] + (from === t1.id ? -2 * p : 2 * p));
      if (g < current - 1e-9 && (!best || g < best.gap - 1e-9)) {
        best = {
          gap: g,
          apply: () => {
            placement.set(c.member.id, to);
            total[from] -= p;
            total[to] += p;
            count[from]--;
            count[to]++;
          },
        };
      }
    }
    // Pair swaps between flexible players on different teams.
    for (let i = 0; i < flexible.length; i++) {
      for (let j = i + 1; j < flexible.length; j++) {
        const a = flexible[i];
        const b = flexible[j];
        const ta = placement.get(a.member.id)!;
        const tb = placement.get(b.member.id)!;
        if (ta === tb) continue;
        const pa = power(a.member.id);
        const pb = power(b.member.id);
        const delta = pa - pb;
        const t1Delta = ta === t1.id ? -delta : delta;
        const g = Math.abs(total[t1.id] + t1Delta - (total[t2.id] - t1Delta));
        if (g < current - 1e-9 && (!best || g < best.gap - 1e-9)) {
          best = {
            gap: g,
            apply: () => {
              placement.set(a.member.id, tb);
              placement.set(b.member.id, ta);
              total[ta] += pb - pa;
              total[tb] += pa - pb;
            },
          };
        }
      }
    }
    if (!best) break;
    best.apply();
  }
}
