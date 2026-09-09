/**
 * Domain model for the STRY alliance app.
 *
 * These types are shared by the pure engine (src/engine), the demo store
 * (src/store) and the UI. They intentionally contain no UI or storage
 * concerns so that a later server implementation (milestone 4) can reuse them
 * verbatim.
 */

export type MemberId = string;
export type EventId = string;
export type TeamId = string;
export type ResponsibilityId = string;

export type AllianceRank = 'R1' | 'R2' | 'R3' | 'R4' | 'R5';
export type OriginAlliance = 'CAPO' | 'ROYL' | 'STRY' | string;

export interface Member {
  id: MemberId;
  username: string;
  /** Alternative display names (renames, source spreadsheet labels). */
  aliases: string[];
  rank: AllianceRank;
  origin_alliance: OriginAlliance;
  level: number;
  /** Arena power in millions (e.g. 301.3 means 301.3M). */
  arena_power_m: number;
  /** ISO date the power figure was captured. */
  power_as_of: string;
  active: boolean;
  /** ISO date from which Canyon history is tracked for this member. */
  tracking_start: string;
  /** Leader-only free text. Never rendered for members. */
  mechanical_notes?: string;
}

export type AppRole = 'leader' | 'member';

export type AvailabilityChoice = 'team1' | 'team2' | 'either' | 'unavailable';

/** Per-slot answer: 1 = first choice, 2 = second choice, 0 = cannot play that slot. */
export type SlotPriority = 0 | 1 | 2;
export interface SlotPriorities {
  team1: SlotPriority;
  team2: SlotPriority;
}

export interface Availability {
  event_id: EventId;
  member_id: MemberId;
  /** Derived from `slots` when present; kept for the engine and older records. */
  choice: AvailabilityChoice;
  /** Priority per time slot as answered by the player or a leader. */
  slots?: SlotPriorities;
  /** Who recorded it: the member themselves or a leader on their behalf. */
  recorded_by: MemberId | 'self';
  updated_at: string; // ISO timestamp
}

export interface Team {
  id: TeamId;
  event_id: EventId;
  name: string;
  /** Wall-clock start in the event timezone, "HH:MM". */
  local_time: string;
  capacity: number;
}

export type AssignmentRole = 'starter' | 'reserve';

export interface Assignment {
  event_id: EventId;
  member_id: MemberId;
  /** Team the member starts in, or the team they are a reserve for (null = general reserve). */
  team_id: TeamId | null;
  role: AssignmentRole;
  locked: boolean;
  lock_reason?: string;
  locked_by?: MemberId;
  locked_at?: string;
  /** Short human explanation produced by the engine or by a leader action. */
  reason: string;
  /** Draft revision the assignment was written in. */
  revision: number;
}

export type AttendanceOutcome = 'played' | 'no_show' | 'withdrew' | 'unused_reserve' | 'unknown';

export interface Attendance {
  event_id: EventId;
  member_id: MemberId;
  team_id: TeamId | null;
  outcome: AttendanceOutcome;
  confirmed_by: MemberId | null;
  confirmed_at: string | null;
  /** True when the member was not in the published lineup but played as a replacement. */
  substitute?: boolean;
}

export type EventStatus = 'draft' | 'published' | 'finalized' | 'canceled';

export interface PublishedRevision {
  revision: number;
  published_at: string;
  published_by: MemberId;
  assignments: Assignment[];
}

export interface AuditEntry {
  id: string;
  event_id: EventId | null;
  actor_id: MemberId | 'system';
  action: string;
  before: unknown;
  after: unknown;
  reason?: string;
  timestamp: string;
}

export interface CanyonEvent {
  id: EventId;
  series_id: string;
  /** ISO date (YYYY-MM-DD) in the event timezone. */
  date: string;
  /** IANA timezone name, or null while unconfirmed. */
  timezone: string | null;
  /** Whether a leader has explicitly confirmed the derived date. */
  date_confirmed: boolean;
  status: EventStatus;
  algorithm_version: string;
  selection_seed: string;
  /** Monotonic draft revision used for optimistic concurrency. */
  revision: number;
  teams: Team[];
  availability: Record<MemberId, Availability>;
  assignments: Assignment[];
  attendance: Record<MemberId, Attendance>;
  published_revisions: PublishedRevision[];
  /** Members who confirmed their published assignment. */
  confirmations: Record<MemberId, { revision: number; confirmed_at: string }>;
  finalized_at: string | null;
  finalized_by: MemberId | null;
  /** Free-form note shown on the overview (e.g. why a time was changed). */
  note?: string;
}

export interface ResponsibilitySlot {
  position: 1 | 2 | 3 | 4;
  label: string;
  /** Label straight from the source spreadsheet, kept until mapped to a member. */
  source_name: string | null;
  member_id: MemberId | null;
  /** Placeholder such as TBD, TBD/Rotation, TBD/Capo. */
  placeholder?: string | null;
}

export interface Responsibility {
  id: ResponsibilityId;
  title: string;
  order: number;
  archived: boolean;
  slots: ResponsibilitySlot[];
}

export interface OrganizationState {
  responsibilities: Responsibility[];
  /** Source dropdown names as given by the leadership spreadsheet. */
  dropdown_names: string[];
  /** Explicit alias -> member mapping decided by a leader. */
  name_mapping: Record<string, MemberId | null>;
  /** Members granted Organize access on top of R4/R5 and leader accounts. */
  designated_editors?: MemberId[];
  revision: number;
}

/** Alliance mascot progress, shared by everyone. */
export interface MascotFeeder {
  name: string;
  count: number;
  last_at: string;
  /** UTC day (YYYY-MM-DD) of `day_count`. */
  day: string;
  day_count: number;
}

export interface MascotState {
  feeds: number;
  /** Keyed by account id (connected) or member id / 'demo' (demo mode). */
  feeders: Record<string, MascotFeeder>;
  last_feed_at: string | null;
  last_feeder_name: string | null;
  created_at: string;
  revision: number;
}

export type SuggestionStatus = 'new' | 'planned' | 'done' | 'declined';

/** A member's suggestion or feature request (Ideas tab). */
export interface Suggestion {
  id: string;
  /** Account id in connected mode; member id or 'demo' in demo mode. */
  account_id: string;
  member_id: MemberId | null;
  author_name: string;
  title: string;
  body: string;
  status: SuggestionStatus;
  /** Account ids that upvoted. */
  votes: string[];
  leader_reply: string | null;
  created_at: string;
  updated_at: string;
}

export type MotionPreference = 'system' | 'full' | 'reduced' | 'off';

export interface Settings {
  timezone: string | null;
  motion: MotionPreference;
  haptics: boolean;
  /** Default team times used when the next weekly draft is created. */
  default_team_times: { team1: string; team2: string };
}

export interface Session {
  role: AppRole;
  member_id: MemberId | null;
}
