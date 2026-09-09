/**
 * App store. Two modes:
 *
 * - demo: state lives in React and is persisted to localStorage under a
 *   clearly labelled key. Nothing is shared between devices.
 * - api: state is loaded from the STRY alliance API (server/) and every
 *   mutation is applied optimistically with the same pure engine function,
 *   sent to the server, then replaced by the server's authoritative copy or
 *   rolled back when the server rejects it.
 *
 * All mutations go through src/engine so invariants are identical on both
 * sides.
 */
import { applyLineupImport, type LineupRecord } from '../engine/lineupImport';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Assignment, AttendanceOutcome, AuditEntry, AvailabilityChoice, CanyonEvent, Member, MemberId, OrganizationState, ResponsibilityId, ResponsibilitySlot, Session, Settings, SlotPriorities, TeamId } from '../domain/types';
import { loadSeedMembers, loadSeedOrganization, PACKAGE_DATE, seedEventDraft, SERIES_ID } from '../data/seed';
import * as L from '../engine/lifecycle';
import * as O from '../engine/organization';
import { computeHistory, type MemberHistory } from '../engine/history';
import { APOCALYPSE_TIME_ZONE, deviceTimeZone, nextFriday, todayInZone } from '../engine/recurrence';
import { useFeedback, type SaveState } from '../motion';
import { ApiClient, ApiError, apiBaseUrl, type ApiAccount, type ApiState } from '../api/client';

export const STORAGE_KEY = 'stry-alliance-demo-v1';
export const API_CACHE_KEY = 'stry-alliance-api-cache-v1';
export const DEVICE_SETTINGS_KEY = 'stry-device-settings-v1';
const STATE_VERSION = 1;

export type StoreMode = 'demo' | 'api';
export type AuthState = 'loading' | 'signed_out' | 'signed_in';

export interface PersistedState {
  version: number;
  members: Member[];
  events: CanyonEvent[];
  organization: OrganizationState;
  settings: Settings;
  session: Session;
  audit: AuditEntry[];
}

export type ActionResult = { ok: true } | { ok: false; code: string; message: string };

const DEFAULT_SETTINGS: Settings = { timezone: APOCALYPSE_TIME_ZONE, motion: 'system', haptics: false, default_team_times: { team1: '18:00', team2: '23:00' } };

function initialDemoState(): PersistedState {
  const tz = deviceTimeZone();
  const today = todayInZone(tz);
  const firstFriday = today <= PACKAGE_DATE ? nextFriday(PACKAGE_DATE) : nextFriday(today, true);
  const event = L.createDraftEvent({ series_id: SERIES_ID, date: firstFriday, timezone: seedEventDraft.timezone ?? APOCALYPSE_TIME_ZONE });
  return {
    version: STATE_VERSION,
    members: loadSeedMembers(),
    events: [event],
    organization: loadSeedOrganization(),
    settings: DEFAULT_SETTINGS,
    session: { role: 'leader', member_id: null },
    audit: [],
  };
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

function loadDemo(): { state: PersistedState; restored: boolean } {
  const parsed = readJson<PersistedState>(STORAGE_KEY);
  if (parsed && parsed.version === STATE_VERSION && Array.isArray(parsed.members) && parsed.members.length === 100) return { state: parsed, restored: true };
  return { state: initialDemoState(), restored: false };
}

interface DeviceSettings {
  motion: Settings['motion'];
  haptics: boolean;
}

function loadDeviceSettings(): DeviceSettings {
  return readJson<DeviceSettings>(DEVICE_SETTINGS_KEY) ?? { motion: 'system', haptics: false };
}

function stateFromApi(api: ApiState, device: DeviceSettings): PersistedState {
  return {
    version: STATE_VERSION,
    members: api.members,
    events: api.events,
    organization: api.organization,
    settings: { ...DEFAULT_SETTINGS, ...api.settings, motion: device.motion, haptics: device.haptics },
    session: { role: api.account.role, member_id: api.account.member_id },
    audit: api.audit,
  };
}

interface UndoAssignments {
  assignments: Assignment[];
  revision: number;
  label: string;
}
interface UndoOrg {
  inverse: O.SlotEdit[];
  revision: number;
  label: string;
}

export interface StoreValue {
  mode: StoreMode;
  api: ApiClient | null;
  authState: AuthState;
  account: ApiAccount | null;
  loadError: string | null;
  lastSyncedAt: string | null;
  state: PersistedState;
  saveState: SaveState;
  restored: boolean;
  isLeader: boolean;
  me: Member | null;
  membersById: Map<MemberId, Member>;
  currentEvent: CanyonEvent | null;
  finalizedEvents: CanyonEvent[];
  history: Record<MemberId, MemberHistory>;
  eventById: (id: string) => CanyonEvent | undefined;
  canUndoAssignments: (eventId: string) => boolean;
  canUndoOrganization: boolean;
  actions: {
    signIn: (username: string, password: string) => Promise<ActionResult>;
    register: (input: { username: string; password: string; invite_code: string; member_id: string | null }) => Promise<ActionResult>;
    signOut: () => Promise<void>;
    refresh: () => Promise<void>;
    linkSelf: (memberId: MemberId) => Promise<ActionResult>;
    updateSettings: (patch: Partial<Settings>) => ActionResult;
    setSession: (session: Session) => void;
    setAvailability: (eventId: string, memberId: MemberId, choice: AvailabilityChoice, slots?: SlotPriorities) => ActionResult;
    fillMissingAvailability: (eventId: string, choice: AvailabilityChoice) => ActionResult & { count?: number };
    generate: (eventId: string) => ActionResult;
    importLineup: (eventId: string, records: LineupRecord[], source?: string) => ActionResult;
    lock: (eventId: string, memberId: MemberId, teamId: TeamId, reason: string) => ActionResult;
    unlock: (eventId: string, memberId: MemberId) => ActionResult;
    move: (eventId: string, memberId: MemberId, target: L.MoveTarget) => ActionResult;
    swap: (eventId: string, a: MemberId, b: MemberId) => ActionResult;
    undoAssignments: (eventId: string) => ActionResult;
    publish: (eventId: string) => ActionResult;
    confirm: (eventId: string, memberId: MemberId) => ActionResult;
    recordAttendance: (eventId: string, memberId: MemberId, outcome: AttendanceOutcome, opts?: { team_id?: TeamId | null; substitute?: boolean }) => ActionResult;
    finalize: (eventId: string) => ActionResult;
    cancel: (eventId: string, reason: string) => ActionResult;
    updateSchedule: (eventId: string, patch: Parameters<typeof L.updateSchedule>[1]) => ActionResult;
    createNextWeek: () => ActionResult & { eventId?: string };
    /** Opens drafts for the next N Fridays (max 4). */
    openUpcomingWeeks: (weeks?: number) => ActionResult & { created?: number };
    setSlot: (id: ResponsibilityId, position: ResponsibilitySlot['position'], value: O.SlotValue) => ActionResult;
    moveSlot: (from: ResponsibilityId, fromPos: ResponsibilitySlot['position'], to: ResponsibilityId, toPos: ResponsibilitySlot['position']) => ActionResult;
    swapSlots: (a: ResponsibilityId, aPos: ResponsibilitySlot['position'], b: ResponsibilityId, bPos: ResponsibilitySlot['position']) => ActionResult;
    undoOrganization: () => ActionResult;
    addTask: (title: string) => ActionResult;
    renameTask: (id: ResponsibilityId, title: string) => ActionResult;
    archiveTask: (id: ResponsibilityId, archived: boolean) => ActionResult;
    reorderTask: (id: ResponsibilityId, direction: -1 | 1) => ActionResult;
    mapName: (sourceName: string, memberId: MemberId | null) => ActionResult;
    setMechanicalNote: (memberId: MemberId, note: string) => ActionResult;
    setMemberActive: (memberId: MemberId, active: boolean) => ActionResult;
    resetDemo: () => void;
    exportJson: () => Promise<string>;
  };
}

const StoreContext = createContext<StoreValue | null>(null);

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}

type RemoteEvent = (api: ApiClient, before: CanyonEvent) => Promise<{ event: CanyonEvent }>;
type RemoteOrg = (api: ApiClient, before: OrganizationState) => Promise<{ organization: OrganizationState }>;

export function StoreProvider({ children }: { children: ReactNode }) {
  const base = useMemo(() => apiBaseUrl(), []);
  const mode: StoreMode = base ? 'api' : 'demo';
  const api = useMemo(() => (base ? new ApiClient(base) : null), [base]);
  const device = useMemo(loadDeviceSettings, []);
  const [{ state: initial, restored }] = useState(() => {
    if (mode === 'demo') return loadDemo();
    const cached = readJson<ApiState>(API_CACHE_KEY);
    if (cached && api?.hasToken()) return { state: stateFromApi(cached, device), restored: true };
    return { state: { ...initialDemoState(), settings: { ...DEFAULT_SETTINGS, ...device } }, restored: false };
  });
  const [state, setState] = useState<PersistedState>(initial);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [authState, setAuthState] = useState<AuthState>(mode === 'api' ? (api?.hasToken() ? 'loading' : 'signed_out') : 'signed_in');
  const [account, setAccount] = useState<ApiAccount | null>(() => (mode === 'api' && api?.hasToken() ? (readJson<ApiState>(API_CACHE_KEY)?.account ?? null) : null));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const { toast } = useFeedback();
  const assignmentUndo = useRef<Map<string, UndoAssignments[]>>(new Map());
  const orgUndo = useRef<UndoOrg[]>([]);
  const [undoTick, setUndoTick] = useState(0);
  const firstRender = useRef(true);
  const saveTimer = useRef<number | null>(null);
  const pendingWrites = useRef(0);

  const stateRef = useRef(state);
  stateRef.current = state;
  const accountRef = useRef(account);
  accountRef.current = account;
  const commit = useCallback((updater: (s: PersistedState) => PersistedState) => {
    const next = updater(stateRef.current);
    stateRef.current = next;
    setState(next);
  }, []);

  const flashSave = useCallback((s: SaveState) => {
    setSaveState(s);
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    if (s === 'saved' || s === 'failed') saveTimer.current = window.setTimeout(() => setSaveState('idle'), s === 'saved' ? 1800 : 2500);
  }, []);

  // Demo persistence with visible save feedback.
  useEffect(() => {
    if (mode !== 'demo') return;
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setSaveState('saving');
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      flashSave('saved');
    } catch (err) {
      setSaveState('failed');
      toast({ kind: 'error', text: `Could not save locally: ${(err as Error).message}` });
    }
  }, [state, toast, mode, flashSave]);

  // Device-only settings persist locally in both modes.
  useEffect(() => {
    writeJson(DEVICE_SETTINGS_KEY, { motion: state.settings.motion, haptics: state.settings.haptics });
  }, [state.settings.motion, state.settings.haptics]);

  const applyApiState = useCallback(
    (s: ApiState) => {
      writeJson(API_CACHE_KEY, s);
      setAccount(s.account);
      setLastSyncedAt(s.server_time);
      setLoadError(null);
      commit((prev) => stateFromApi(s, { motion: prev.settings.motion, haptics: prev.settings.haptics }));
      setAuthState('signed_in');
    },
    [commit],
  );

  const signOutLocally = useCallback(() => {
    api?.setToken(null);
    try {
      localStorage.removeItem(API_CACHE_KEY);
    } catch {
      /* ignore */
    }
    assignmentUndo.current.clear();
    orgUndo.current = [];
    setAccount(null);
    setAuthState('signed_out');
  }, [api]);

  const refresh = useCallback(async () => {
    if (!api || !api.hasToken()) return;
    // Do not overwrite optimistic edits that are still in flight.
    if (pendingWrites.current > 0) return;
    try {
      applyApiState(await api.state());
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        signOutLocally();
      } else {
        setLoadError(err instanceof Error ? err.message : String(err));
        // Keep showing cached data if we have it; otherwise fall back to the sign-in screen.
        setAuthState(accountRef.current ? 'signed_in' : 'signed_out');
      }
    }
  }, [api, applyApiState, signOutLocally]);

  // Initial load, periodic refresh while visible, refresh on focus.
  useEffect(() => {
    if (!api) return;
    api.onUnauthorized = () => {
      signOutLocally();
      toast({ kind: 'error', text: 'Your session ended. Sign in again.' });
    };
    void refresh();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 30_000);
    // Navigating between screens also picks up other people's changes (throttled).
    let lastNav = 0;
    const onNavigate = () => {
      const now = Date.now();
      if (now - lastNav < 4000) return;
      lastNav = now;
      void refresh();
    };
    window.addEventListener('hashchange', onNavigate);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('hashchange', onNavigate);
      window.clearInterval(interval);
    };
  }, [api, refresh, signOutLocally, toast]);

  const isLeader = state.session.role === 'leader';
  const membersById = useMemo(() => new Map(state.members.map((m) => [m.id, m])), [state.members]);
  const me = state.session.member_id ? (membersById.get(state.session.member_id) ?? null) : null;

  const currentEvent = useMemo(() => {
    const open = state.events.filter((e) => e.status === 'draft' || e.status === 'published').sort((a, b) => (a.date < b.date ? -1 : 1));
    return open[0] ?? null;
  }, [state.events]);
  const finalizedEvents = useMemo(() => state.events.filter((e) => e.status === 'finalized').sort((a, b) => (a.date < b.date ? 1 : -1)), [state.events]);
  const history = useMemo(() => computeHistory(state.events, state.members), [state.events, state.members]);

  const ctx = useCallback((): L.Context => {
    const acct = accountRef.current;
    return { actor: stateRef.current.session.member_id ?? (acct ? `account:${acct.id}` : stateRef.current.session.role === 'leader' ? 'leader-demo' : 'system'), now: new Date().toISOString() };
  }, []);

  const fail = useCallback(
    (err: unknown): ActionResult => {
      const code = err instanceof L.LifecycleError || err instanceof ApiError ? err.code : 'error';
      const message = err instanceof Error ? err.message : String(err);
      toast({ kind: 'error', text: message });
      return { ok: false, code, message };
    },
    [toast],
  );

  const requireLeader = useCallback((): ActionResult | null => {
    if (stateRef.current.session.role === 'leader') return null;
    const message = mode === 'demo' ? 'Leaders only. Switch to the leader role in Settings (demo).' : 'Leaders only.';
    toast({ kind: 'error', text: message });
    return { ok: false, code: 'forbidden', message };
  }, [toast, mode]);

  /** Sends a mutation to the server; on failure rolls back and, on conflicts, reloads. */
  const sync = useCallback(
    (label: string, rollback: () => void, run: () => Promise<void>) => {
      if (!api) return;
      pendingWrites.current++;
      setSaveState('saving');
      run()
        .then(() => flashSave('saved'))
        .catch(async (err) => {
          rollback();
          flashSave('failed');
          const message = err instanceof Error ? err.message : String(err);
          toast({ kind: 'error', text: `${label} was not saved: ${message}` });
          if (err instanceof ApiError && (err.status === 409 || err.status === 404)) {
            pendingWrites.current--;
            await refresh();
            pendingWrites.current++;
          }
        })
        .finally(() => {
          pendingWrites.current--;
        });
    },
    [api, flashSave, toast, refresh],
  );

  /** Applies a lifecycle function to one event: role check, local apply, undo capture, then server sync. */
  const runEvent = useCallback(
    (eventId: string, fn: (event: CanyonEvent) => L.Result, opts?: { pushUndo?: string; leader?: boolean }, remote?: RemoteEvent): ActionResult => {
      if (opts?.leader !== false) {
        const denied = requireLeader();
        if (denied) return denied;
      }
      const before = stateRef.current.events.find((e) => e.id === eventId);
      if (!before) return fail(new L.LifecycleError('not_found', 'Event not found.'));
      try {
        const res = fn(before);
        if (opts?.pushUndo) {
          const stack = assignmentUndo.current.get(eventId) ?? [];
          stack.push({ assignments: before.assignments, revision: res.event.revision, label: opts.pushUndo });
          assignmentUndo.current.set(eventId, stack.slice(-20));
          setUndoTick((t) => t + 1);
        }
        commit((s) => ({ ...s, events: s.events.map((e) => (e.id === eventId ? res.event : e)), audit: [...s.audit, ...res.audit].slice(-500) }));
        if (api && remote) {
          sync(
            opts?.pushUndo ?? 'Change',
            () => commit((s) => ({ ...s, events: s.events.map((e) => (e.id === eventId ? before : e)) })),
            async () => {
              const r = await remote(api, before);
              commit((s) => ({ ...s, events: s.events.map((e) => (e.id === eventId ? r.event : e)) }));
            },
          );
        }
        return { ok: true };
      } catch (err) {
        return fail(err);
      }
    },
    [api, commit, fail, requireLeader, sync],
  );

  const runOrg = useCallback(
    (fn: (org: OrganizationState) => O.OrgResult, label?: string, remote?: RemoteOrg): ActionResult => {
      const denied = requireLeader();
      if (denied) return denied;
      const before = stateRef.current.organization;
      try {
        const res = fn(before);
        if (res.inverse.length && label) {
          orgUndo.current.push({ inverse: res.inverse, revision: res.state.revision, label });
          orgUndo.current = orgUndo.current.slice(-20);
          setUndoTick((t) => t + 1);
        }
        commit((s) => ({ ...s, organization: res.state, audit: [...s.audit, ...res.audit].slice(-500) }));
        if (api && remote) {
          sync(
            label ?? 'Change',
            () => commit((s) => ({ ...s, organization: before })),
            async () => {
              const r = await remote(api, before);
              commit((s) => ({ ...s, organization: r.organization }));
            },
          );
        }
        return { ok: true };
      } catch (err) {
        return fail(err);
      }
    },
    [api, commit, fail, requireLeader, sync],
  );

  const actions: StoreValue['actions'] = useMemo(
    () => ({
      signIn: async (username, password) => {
        if (!api) return { ok: false, code: 'demo', message: 'Demo mode has no accounts.' };
        try {
          const r = await api.login(username, password);
          api.setToken(r.token);
          setAccount(r.account);
          applyApiState(await api.state());
          return { ok: true };
        } catch (err) {
          return fail(err);
        }
      },
      register: async (input) => {
        if (!api) return { ok: false, code: 'demo', message: 'Demo mode has no accounts.' };
        try {
          const r = await api.register(input);
          api.setToken(r.token);
          setAccount(r.account);
          applyApiState(await api.state());
          return { ok: true };
        } catch (err) {
          return fail(err);
        }
      },
      signOut: async () => {
        if (!api) return;
        try {
          await api.logout();
        } catch {
          /* token may already be invalid */
        }
        signOutLocally();
      },
      refresh,
      linkSelf: async (memberId) => {
        if (!api) return { ok: false, code: 'demo', message: 'Demo mode: pick your member in Settings.' };
        try {
          const r = await api.linkSelf(memberId);
          setAccount(r.account);
          await refresh();
          return { ok: true };
        } catch (err) {
          return fail(err);
        }
      },
      updateSettings: (patch) => {
        const before = stateRef.current.settings;
        const serverKeys = (['timezone', 'default_team_times'] as const).filter((k) => k in patch);
        if (api && serverKeys.length && stateRef.current.session.role !== 'leader') return fail(new L.LifecycleError('forbidden', 'Leaders only.'));
        commit((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
        if (api && serverKeys.length) {
          const serverPatch: Partial<Pick<Settings, 'timezone' | 'default_team_times'>> = {};
          if ('timezone' in patch) serverPatch.timezone = patch.timezone ?? null;
          if (patch.default_team_times) serverPatch.default_team_times = patch.default_team_times;
          sync(
            'Settings',
            () => commit((s) => ({ ...s, settings: { ...s.settings, timezone: before.timezone, default_team_times: before.default_team_times } })),
            async () => {
              const r = await api.updateSettings(serverPatch);
              commit((s) => ({ ...s, settings: { ...s.settings, timezone: r.settings.timezone, default_team_times: r.settings.default_team_times } }));
            },
          );
        }
        return { ok: true };
      },
      setSession: (session) => {
        if (mode === 'api') return;
        commit((s) => ({ ...s, session }));
      },
      setAvailability: (eventId, memberId, choice, slots) => {
        const self = stateRef.current.session.member_id === memberId;
        if (!self && stateRef.current.session.role !== 'leader') return fail(new L.LifecycleError('forbidden', 'You can only change your own availability.'));
        const recorder = self ? 'self' : (stateRef.current.session.member_id ?? 'leader-demo');
        return runEvent(eventId, (e) => L.setAvailability(e, memberId, choice, ctx(), recorder, slots), { leader: false }, (a) => a.setAvailability(eventId, self ? null : memberId, choice, slots));
      },
      fillMissingAvailability: (eventId, choice) => {
        const denied = requireLeader();
        if (denied) return denied;
        const recorder = stateRef.current.session.member_id ?? 'leader-demo';
        let count = 0;
        const res = runEvent(
          eventId,
          (e) => {
            let next = e;
            const audit: L.Result['audit'] = [];
            for (const m of stateRef.current.members) {
              if (!m.active || next.availability[m.id]) continue;
              const r = L.setAvailability(next, m.id, choice, ctx(), recorder);
              next = r.event;
              audit.push(...r.audit);
              count++;
            }
            return { event: next, audit };
          },
          undefined,
          (a) => a.fillAvailability(eventId, choice),
        );
        return res.ok ? { ok: true, count } : res;
      },
      generate: (eventId) => runEvent(eventId, (e) => L.applySuggestions(e, stateRef.current.members, stateRef.current.events, ctx(), e.revision), { pushUndo: 'Generate suggestions' }, (a, before) => a.generate(eventId, before.revision)),
      importLineup: (eventId, records, source) => runEvent(eventId, (e) => applyLineupImport(e, records, stateRef.current.members, stateRef.current.organization.name_mapping, ctx(), { expectedRevision: e.revision, source }), { pushUndo: 'Import lineup' }, (a, before) => a.importLineup(eventId, records, source, before.revision)),
      lock: (eventId, memberId, teamId, reason) => runEvent(eventId, (e) => L.lockMember(e, memberId, teamId, reason, ctx(), e.revision), { pushUndo: 'Lock' }, (a, before) => a.lock(eventId, memberId, teamId, reason, before.revision)),
      unlock: (eventId, memberId) => runEvent(eventId, (e) => L.unlockMember(e, memberId, ctx(), e.revision), { pushUndo: 'Unlock' }, (a, before) => a.unlock(eventId, memberId, before.revision)),
      move: (eventId, memberId, target) => runEvent(eventId, (e) => L.moveMember(e, memberId, target, ctx(), e.revision), { pushUndo: 'Move' }, (a, before) => a.move(eventId, memberId, target, before.revision)),
      swap: (eventId, a, b) => runEvent(eventId, (e) => L.swapMembers(e, a, b, ctx(), e.revision), { pushUndo: 'Swap' }, (c, before) => c.swap(eventId, a, b, before.revision)),
      undoAssignments: (eventId) => {
        const stack = assignmentUndo.current.get(eventId) ?? [];
        const last = stack[stack.length - 1];
        if (!last) return fail(new L.LifecycleError('nothing', 'Nothing to undo.'));
        const res = runEvent(eventId, (e) => L.replaceAssignments(e, last.assignments, ctx(), last.revision), undefined, (a, before) => a.restore(eventId, last.assignments, before.revision));
        if (res.ok) {
          stack.pop();
          setUndoTick((t) => t + 1);
        }
        return res;
      },
      publish: (eventId) => runEvent(eventId, (e) => L.publishEvent(e, ctx(), e.revision), undefined, (a, before) => a.publish(eventId, before.revision)),
      confirm: (eventId, memberId) => {
        const self = stateRef.current.session.member_id === memberId;
        if (!self && stateRef.current.session.role !== 'leader') return fail(new L.LifecycleError('forbidden', 'You can only confirm your own assignment.'));
        return runEvent(eventId, (e) => L.confirmAssignment(e, memberId, ctx()), { leader: false }, (a) => a.confirm(eventId, self ? null : memberId));
      },
      recordAttendance: (eventId, memberId, outcome, opts) => runEvent(eventId, (e) => L.recordAttendance(e, memberId, outcome, ctx(), opts), undefined, (a) => a.attendance(eventId, memberId, outcome, opts)),
      finalize: (eventId) => {
        const res = runEvent(
          eventId,
          (e) => L.finalizeEvent(e, ctx()),
          undefined,
          async (a) => {
            const r = await a.finalize(eventId);
            const nextEvent = r.next_event;
            if (nextEvent) commit((s) => (s.events.some((e) => e.id === nextEvent.id) ? { ...s, events: s.events.map((e) => (e.id === nextEvent.id ? nextEvent : e)) } : { ...s, events: [...s.events, nextEvent] }));
            return r;
          },
        );
        if (res.ok) {
          const events = stateRef.current.events;
          const finalized = events.find((e) => e.id === eventId)!;
          const next = L.ensureNextWeekDraft(events, { series_id: SERIES_ID, afterDate: finalized.date, timezone: finalized.timezone ?? stateRef.current.settings.timezone, team_times: stateRef.current.settings.default_team_times });
          if (next.created) commit((s) => ({ ...s, events: [...s.events, next.event] }));
        }
        return res;
      },
      cancel: (eventId, reason) => runEvent(eventId, (e) => L.cancelEvent(e, ctx(), reason), undefined, (a) => a.cancel(eventId, reason)),
      updateSchedule: (eventId, patch) => runEvent(eventId, (e) => L.updateSchedule(e, patch, ctx()), undefined, (a) => a.schedule(eventId, patch as Record<string, unknown>)),
      createNextWeek: () => {
        const denied = requireLeader();
        if (denied) return denied;
        const events = stateRef.current.events;
        const latest = [...events].filter((e) => e.status !== 'canceled').sort((a, b) => (a.date < b.date ? 1 : -1))[0];
        const afterDate = latest ? latest.date : todayInZone(deviceTimeZone());
        const next = L.ensureNextWeekDraft(events, { series_id: SERIES_ID, afterDate, timezone: stateRef.current.settings.timezone, team_times: stateRef.current.settings.default_team_times });
        if (next.created) {
          commit((s) => ({ ...s, events: [...s.events, next.event] }));
          if (api) {
            sync(
              'Next week draft',
              () => commit((s) => ({ ...s, events: s.events.filter((e) => e.id !== next.event.id) })),
              async () => {
                const r = await api.nextWeek();
                commit((s) => ({ ...s, events: s.events.map((e) => (e.id === r.event.id ? r.event : e)) }));
              },
            );
          }
        }
        return { ok: true, eventId: next.event.id };
      },
      openUpcomingWeeks: (weeks = L.MAX_WEEKS_AHEAD) => {
        const denied = requireLeader();
        if (denied) return denied;
        const settings = stateRef.current.settings;
        const fromDate = todayInZone(settings.timezone ?? deviceTimeZone());
        const res = L.ensureUpcomingDrafts(stateRef.current.events, { series_id: SERIES_ID, fromDate, weeks, timezone: settings.timezone, team_times: settings.default_team_times });
        if (res.created.length) {
          const ids = new Set(res.created.map((e) => e.id));
          commit((s) => ({ ...s, events: [...s.events, ...res.created] }));
          if (api) {
            sync(
              'Upcoming weeks',
              () => commit((s) => ({ ...s, events: s.events.filter((e) => !ids.has(e.id)) })),
              async () => {
                const r = await api.ensureUpcoming(weeks);
                commit((s) => ({ ...s, events: r.events }));
              },
            );
          }
        }
        return { ok: true, created: res.created.length };
      },
      setSlot: (id, position, value) => {
        const edits: O.SlotEdit[] = [{ responsibility_id: id, position, value }];
        return runOrg((org) => O.applySlotEdits(org, edits, ctx(), org.revision), 'Slot change', (a, before) => a.slotEdits(edits, before.revision));
      },
      moveSlot: (from, fromPos, to, toPos) => {
        let edits: O.SlotEdit[] = [];
        return runOrg(
          (org) => {
            const src = org.responsibilities.find((x) => x.id === from)?.slots.find((s) => s.position === fromPos);
            if (!src) throw new L.LifecycleError('not_found', 'Slot not found.');
            edits = [
              { responsibility_id: to, position: toPos, value: O.slotValue(src) },
              { responsibility_id: from, position: fromPos, value: { kind: 'empty' } },
            ];
            return O.moveSlot(org, { responsibility_id: from, position: fromPos }, { responsibility_id: to, position: toPos }, ctx(), org.revision);
          },
          'Move',
          (a, before) => a.slotEdits(edits, before.revision),
        );
      },
      swapSlots: (aId, aPos, bId, bPos) => {
        let edits: O.SlotEdit[] = [];
        return runOrg(
          (org) => {
            const sa = org.responsibilities.find((x) => x.id === aId)?.slots.find((s) => s.position === aPos);
            const sb = org.responsibilities.find((x) => x.id === bId)?.slots.find((s) => s.position === bPos);
            if (!sa || !sb) throw new L.LifecycleError('not_found', 'Slot not found.');
            edits = [
              { responsibility_id: aId, position: aPos, value: O.slotValue(sb) },
              { responsibility_id: bId, position: bPos, value: O.slotValue(sa) },
            ];
            return O.swapSlots(org, { responsibility_id: aId, position: aPos }, { responsibility_id: bId, position: bPos }, ctx(), org.revision);
          },
          'Swap',
          (a, before) => a.slotEdits(edits, before.revision),
        );
      },
      undoOrganization: () => {
        const last = orgUndo.current[orgUndo.current.length - 1];
        if (!last) return fail(new L.LifecycleError('nothing', 'Nothing to undo.'));
        const res = runOrg((org) => O.applySlotEdits(org, last.inverse, ctx(), last.revision), undefined, (a) => a.slotEdits(last.inverse, last.revision));
        if (res.ok) {
          orgUndo.current.pop();
          setUndoTick((t) => t + 1);
        }
        return res;
      },
      addTask: (title) => runOrg((org) => O.addTask(org, title, ctx(), org.revision), undefined, (a, before) => a.taskOp({ op: 'add', title, expected_revision: before.revision })),
      renameTask: (id, title) => runOrg((org) => O.renameTask(org, id, title, ctx(), org.revision), undefined, (a, before) => a.taskOp({ op: 'rename', id, title, expected_revision: before.revision })),
      archiveTask: (id, archived) => runOrg((org) => O.setTaskArchived(org, id, archived, ctx(), org.revision), undefined, (a, before) => a.taskOp({ op: 'archive', id, archived, expected_revision: before.revision })),
      reorderTask: (id, direction) => runOrg((org) => O.reorderTask(org, id, direction, ctx(), org.revision), undefined, (a, before) => a.taskOp({ op: 'reorder', id, direction, expected_revision: before.revision })),
      mapName: (sourceName, memberId) => runOrg((org) => O.setNameMapping(org, sourceName, memberId, ctx(), org.revision), undefined, (a, before) => a.mapping(sourceName, memberId, before.revision)),
      setMechanicalNote: (memberId, note) => {
        const denied = requireLeader();
        if (denied) return denied;
        const before = stateRef.current.members;
        commit((s) => ({ ...s, members: s.members.map((m) => (m.id === memberId ? L.withMechanicalNote(m, note) : m)) }));
        if (api) {
          sync(
            'Note',
            () => commit((s) => ({ ...s, members: before })),
            async () => {
              const r = await api.updateMember(memberId, { mechanical_notes: note });
              commit((s) => ({ ...s, members: s.members.map((m) => (m.id === memberId ? r.member : m)) }));
            },
          );
        }
        return { ok: true };
      },
      setMemberActive: (memberId, active) => {
        const denied = requireLeader();
        if (denied) return denied;
        const before = stateRef.current.members;
        commit((s) => ({ ...s, members: s.members.map((m) => (m.id === memberId ? { ...m, active } : m)) }));
        if (api) {
          sync(
            'Member status',
            () => commit((s) => ({ ...s, members: before })),
            async () => {
              const r = await api.updateMember(memberId, { active });
              commit((s) => ({ ...s, members: s.members.map((m) => (m.id === memberId ? r.member : m)) }));
            },
          );
        }
        return { ok: true };
      },
      resetDemo: () => {
        if (mode !== 'demo') return;
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {
          /* ignore */
        }
        assignmentUndo.current.clear();
        orgUndo.current = [];
        commit(() => initialDemoState());
      },
      exportJson: async () => {
        if (api) return JSON.stringify(await api.exportAll(), null, 2);
        return JSON.stringify(stateRef.current, null, 2);
      },
    }),
    [api, applyApiState, commit, ctx, fail, mode, refresh, requireLeader, runEvent, runOrg, signOutLocally, sync],
  );

  const value: StoreValue = useMemo(
    () => ({
      mode,
      api,
      authState,
      account,
      loadError,
      lastSyncedAt,
      state,
      saveState,
      restored,
      isLeader,
      me,
      membersById,
      currentEvent,
      finalizedEvents,
      history,
      eventById: (id) => state.events.find((e) => e.id === id),
      canUndoAssignments: (eventId) => (assignmentUndo.current.get(eventId)?.length ?? 0) > 0 && undoTick >= 0,
      canUndoOrganization: orgUndo.current.length > 0 && undoTick >= 0,
      actions,
    }),
    [mode, api, authState, account, loadError, lastSyncedAt, state, saveState, restored, isLeader, me, membersById, currentEvent, finalizedEvents, history, actions, undoTick],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

/** Formats arena power in millions, e.g. 301.3M. */
export function fmtPower(m: number): string {
  return `${m.toFixed(1)}M`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '?';
  const second = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + second).toUpperCase();
}
