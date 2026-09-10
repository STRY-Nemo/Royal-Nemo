/**
 * Thin fetch client for the STRY alliance API (server/). Used only when the
 * build has VITE_API_URL set; otherwise the app runs in local demo mode.
 */
import type { MoveTarget } from '../engine/lifecycle';
import type { LineupRecord } from '../engine/lineupImport';
import type { AttendanceOutcome, AvailabilityChoice, CanyonEvent, MascotState, Member, MemberId, OrganizationState, Settings, SlotPriorities, Suggestion, SuggestionStatus, TeamId } from '../domain/types';
import type { SlotEdit } from '../engine/organization';

export const TOKEN_KEY = 'stry-api-token';

export interface ApiAccount {
  id: string;
  username: string;
  role: 'leader' | 'member';
  member_id: MemberId | null;
  verified: boolean;
  disabled: boolean;
  created_at: string;
}

export interface ApiState {
  members: Member[];
  events: CanyonEvent[];
  organization: OrganizationState;
  settings: Settings;
  audit: import('../domain/types').AuditEntry[];
  mascot?: MascotState;
  suggestions?: Suggestion[];
  account: ApiAccount;
  server_time: string;
}

export interface Invite {
  code: string;
  role: 'leader' | 'member';
  uses_left: number;
  expires_at: string;
}

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function apiBaseUrl(): string | null {
  const raw = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, '');
}

export class ApiClient {
  readonly baseUrl: string;
  private token: string | null;
  onUnauthorized: (() => void) | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(TOKEN_KEY);
    } catch {
      /* private mode */
    }
    this.token = stored;
  }

  hasToken(): boolean {
    return !!this.token;
  }

  setToken(token: string | null): void {
    this.token = token;
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: { 'content-type': 'application/json', ...(this.token ? { authorization: `Bearer ${this.token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError(0, 'offline', 'Could not reach the server. Check your connection and try again.');
    }
    let data: Record<string, unknown> = {};
    try {
      data = (await res.json()) as Record<string, unknown>;
    } catch {
      /* empty body */
    }
    if (!res.ok) {
      if (res.status === 401 && path !== '/auth/login' && path !== '/auth/register') this.onUnauthorized?.();
      throw new ApiError(res.status, String(data.error ?? 'error'), String(data.message ?? `Request failed (${res.status})`));
    }
    return data as T;
  }

  // ---- auth ----
  register(input: { username: string; password: string; invite_code: string; member_id?: string | null }) {
    return this.request<{ token: string; account: ApiAccount }>('POST', '/auth/register', input);
  }
  login(username: string, password: string) {
    return this.request<{ token: string; account: ApiAccount }>('POST', '/auth/login', { username, password });
  }
  logout() {
    return this.request<{ ok: true }>('POST', '/auth/logout');
  }
  changePassword(current_password: string, new_password: string) {
    return this.request<{ ok: true }>('POST', '/auth/password', { current_password, new_password });
  }
  roster() {
    return this.request<{ roster: { id: MemberId; username: string; taken?: boolean }[] }>('GET', '/roster');
  }
  me() {
    return this.request<{ account: ApiAccount }>('GET', '/me');
  }
  linkSelf(member_id: MemberId) {
    return this.request<{ account: ApiAccount }>('POST', '/me/link', { member_id });
  }
  state() {
    return this.request<ApiState>('GET', '/state');
  }
  exportAll() {
    return this.request<Record<string, unknown>>('GET', '/export');
  }

  // ---- events ----
  private ev(id: string, action: string, body: Record<string, unknown> = {}) {
    return this.request<{ event: CanyonEvent; count?: number; next_event?: CanyonEvent }>('POST', `/events/${encodeURIComponent(id)}/${action}`, body);
  }
  setAvailability(eventId: string, memberId: MemberId | null, choice: AvailabilityChoice, slots?: SlotPriorities) {
    return this.ev(eventId, 'availability', { ...(memberId ? { member_id: memberId } : {}), choice, ...(slots ? { slots } : {}) });
  }
  fillAvailability(eventId: string, choice: AvailabilityChoice) {
    return this.ev(eventId, 'availability/fill', { choice });
  }
  generate(eventId: string, expected_revision: number) {
    return this.ev(eventId, 'generate', { expected_revision });
  }
  importLineup(eventId: string, records: LineupRecord[], source: string | undefined, expected_revision: number) {
    return this.ev(eventId, 'import-lineup', { records, source, expected_revision });
  }
  lock(eventId: string, member_id: MemberId, team_id: TeamId, reason: string, expected_revision: number) {
    return this.ev(eventId, 'lock', { member_id, team_id, reason, expected_revision });
  }
  unlock(eventId: string, member_id: MemberId, expected_revision: number) {
    return this.ev(eventId, 'unlock', { member_id, expected_revision });
  }
  move(eventId: string, member_id: MemberId, target: MoveTarget, expected_revision: number) {
    return this.ev(eventId, 'move', { member_id, target, expected_revision });
  }
  swap(eventId: string, a: MemberId, b: MemberId, expected_revision: number) {
    return this.ev(eventId, 'swap', { a, b, expected_revision });
  }
  restore(eventId: string, assignments: CanyonEvent['assignments'], expected_revision: number) {
    return this.ev(eventId, 'restore', { assignments, expected_revision });
  }
  publish(eventId: string, expected_revision: number) {
    return this.ev(eventId, 'publish', { expected_revision });
  }
  confirm(eventId: string, memberId: MemberId | null) {
    return this.ev(eventId, 'confirm', memberId ? { member_id: memberId } : {});
  }
  attendance(eventId: string, member_id: MemberId, outcome: AttendanceOutcome, opts: { team_id?: TeamId | null; substitute?: boolean } = {}) {
    return this.ev(eventId, 'attendance', { member_id, outcome, ...opts });
  }
  finalize(eventId: string) {
    return this.ev(eventId, 'finalize');
  }
  cancel(eventId: string, reason: string) {
    return this.ev(eventId, 'cancel', { reason });
  }
  schedule(eventId: string, patch: Record<string, unknown>) {
    return this.ev(eventId, 'schedule', patch);
  }
  suggestions() {
    return this.request<{ suggestions: Suggestion[] }>('GET', '/suggestions');
  }
  createSuggestion(title: string, body: string) {
    return this.request<{ suggestion: Suggestion }>('POST', '/suggestions', { title, body });
  }
  voteSuggestion(id: string) {
    return this.request<{ suggestion: Suggestion }>('POST', `/suggestions/${encodeURIComponent(id)}/vote`);
  }
  setSuggestionStatus(id: string, status: SuggestionStatus, reply: string | null) {
    return this.request<{ suggestion: Suggestion }>('POST', `/suggestions/${encodeURIComponent(id)}/status`, { status, reply });
  }
  feedBear() {
    return this.request<{ mascot: MascotState; stage: { n: number; name: string }; evolved: boolean }>('POST', '/mascot/feed');
  }
  nextWeek() {
    return this.request<{ event: CanyonEvent; created: boolean }>('POST', '/events/next-week');
  }
  ensureUpcoming(weeks: number) {
    return this.request<{ events: CanyonEvent[]; created: number; dates: string[] }>('POST', '/events/upcoming', { weeks });
  }

  // ---- organization ----
  slotEdits(edits: SlotEdit[], expected_revision: number) {
    return this.request<{ organization: OrganizationState; inverse: SlotEdit[] }>('POST', '/organization/slots', { edits, expected_revision });
  }
  taskOp(body: Record<string, unknown>) {
    return this.request<{ organization: OrganizationState }>('POST', '/organization/tasks', body);
  }
  setDesignatedEditor(member_id: MemberId, on: boolean, expected_revision: number) {
    return this.request<{ organization: OrganizationState; inverse: SlotEdit[] }>('POST', '/organization/editors', { member_id, on, expected_revision });
  }
  mapping(source_name: string, member_id: MemberId | null, expected_revision: number) {
    return this.request<{ organization: OrganizationState }>('POST', '/organization/mapping', { source_name, member_id, expected_revision });
  }

  // ---- members / settings ----
  updateMember(id: MemberId, patch: { mechanical_notes?: string; active?: boolean; arena_power_m?: number; level?: number; rank?: Member['rank'] }) {
    return this.request<{ member: Member }>('POST', `/members/${encodeURIComponent(id)}`, patch);
  }
  updateSettings(patch: Partial<Pick<Settings, 'timezone' | 'default_team_times'>>) {
    return this.request<{ settings: Settings }>('POST', '/settings', patch);
  }

  // ---- accounts / invites ----
  accounts() {
    return this.request<{ accounts: ApiAccount[] }>('GET', '/accounts');
  }
  updateAccount(id: string, patch: { role?: 'leader' | 'member'; member_id?: MemberId | null; verified?: boolean; disabled?: boolean }) {
    return this.request<{ account: ApiAccount }>('POST', `/accounts/${encodeURIComponent(id)}`, patch);
  }
  invites() {
    return this.request<{ invites: Invite[] }>('GET', '/invites');
  }
  checkInvite(code: string) {
    return this.request<{ valid: boolean; reason?: 'unknown' | 'used_up' | 'expired'; role?: 'leader' | 'member'; uses_left?: number; expires_at?: string }>('GET', `/invites/${encodeURIComponent(code)}/check`);
  }
  resetPassword(id: string, newPassword: string) {
    return this.request<{ ok: true }>('POST', `/accounts/${encodeURIComponent(id)}/password`, { new_password: newPassword });
  }
  createInvite(input: { role: 'leader' | 'member'; uses?: number; days?: number }) {
    return this.request<{ invite: Invite }>('POST', '/invites', input);
  }
  deleteInvite(code: string) {
    return this.request<{ ok: true }>('DELETE', `/invites/${encodeURIComponent(code)}`);
  }
}
