/**
 * Demo store. State lives in React and is persisted to localStorage under a
 * clearly labeled demo key. It is NOT shared between devices or users; a
 * server with authentication and transactional checks replaces this layer in
 * milestone 4. All mutations go through the pure engine functions so the
 * invariants are identical on both sides.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Assignment, AttendanceOutcome, AuditEntry, AvailabilityChoice, CanyonEvent, Member, MemberId, OrganizationState, ResponsibilityId, ResponsibilitySlot, Session, Settings, TeamId } from '../domain/types';
import { loadSeedMembers, loadSeedOrganization, PACKAGE_DATE, SERIES_ID } from '../data/seed';
import * as L from '../engine/lifecycle';
import * as O from '../engine/organization';
import { computeHistory, type MemberHistory } from '../engine/history';
import { deviceTimeZone, nextFriday, todayInZone } from '../engine/recurrence';
import { useFeedback, type SaveState } from '../motion';

export const STORAGE_KEY = 'stry-alliance-demo-v1';
const STATE_VERSION = 1;

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

function initialState(): PersistedState {
  const tz = deviceTimeZone();
  const today = todayInZone(tz);
  const firstFriday = today <= PACKAGE_DATE ? nextFriday(PACKAGE_DATE) : nextFriday(today, true);
  const event = L.createDraftEvent({ series_id: SERIES_ID, date: firstFriday, timezone: null });
  return {
    version: STATE_VERSION,
    members: loadSeedMembers(),
    events: [event],
    organization: loadSeedOrganization(),
    settings: { timezone: null, motion: 'system', haptics: false, default_team_times: { team1: '18:00', team2: '23:00' } },
    session: { role: 'leader', member_id: null },
    audit: [],
  };
}

function load(): { state: PersistedState; restored: boolean } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PersistedState;
      if (parsed && parsed.version === STATE_VERSION && Array.isArray(parsed.members) && parsed.members.length === 100) {
        return { state: parsed, restored: true };
      }
    }
  } catch {
    /* fall through to fresh state */
  }
  return { state: initialState(), restored: false };
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
    updateSettings: (patch: Partial<Settings>) => ActionResult;
    setSession: (session: Session) => void;
    setAvailability: (eventId: string, memberId: MemberId, choice: AvailabilityChoice) => ActionResult;
    /** Leader-only: records a choice for every active member who has not responded yet, attributed to the leader. Returns how many were recorded. */
    fillMissingAvailability: (eventId: string, choice: AvailabilityChoice) => ActionResult & { count?: number };
    generate: (eventId: string) => ActionResult;
    lock: (eventId: string, memberId: MemberId, teamId: TeamId, reason: string) => ActionResult;
    unlock: (eventId: string, memberId: MemberId) => ActionResult;
    move: (eventId: string, memberId: MemberId, target: TeamId | 'reserve') => ActionResult;
    swap: (eventId: string, a: MemberId, b: MemberId) => ActionResult;
    undoAssignments: (eventId: string) => ActionResult;
    publish: (eventId: string) => ActionResult;
    confirm: (eventId: string, memberId: MemberId) => ActionResult;
    recordAttendance: (eventId: string, memberId: MemberId, outcome: AttendanceOutcome, opts?: { team_id?: TeamId | null; substitute?: boolean }) => ActionResult;
    finalize: (eventId: string) => ActionResult;
    cancel: (eventId: string, reason: string) => ActionResult;
    updateSchedule: (eventId: string, patch: Parameters<typeof L.updateSchedule>[1]) => ActionResult;
    createNextWeek: () => ActionResult & { eventId?: string };
    setSlot: (id: ResponsibilityId, position: ResponsibilitySlot['position'], value: O.SlotValue) => ActionResult;
    moveSlot: (from: O.SlotEdit['responsibility_id'], fromPos: ResponsibilitySlot['position'], to: ResponsibilityId, toPos: ResponsibilitySlot['position']) => ActionResult;
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
    exportJson: () => string;
  };
}

const StoreContext = createContext<StoreValue | null>(null);

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [{ state: initial, restored }] = useState(load);
  const [state, setState] = useState<PersistedState>(initial);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const { toast } = useFeedback();
  const assignmentUndo = useRef<Map<string, UndoAssignments[]>>(new Map());
  const orgUndo = useRef<UndoOrg[]>([]);
  const [undoTick, setUndoTick] = useState(0);
  const firstRender = useRef(true);

  // Persist on every change with visible save feedback.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setSaveState('saving');
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      setSaveState('saved');
      const t = window.setTimeout(() => setSaveState('idle'), 1800);
      return () => window.clearTimeout(t);
    } catch (err) {
      setSaveState('failed');
      toast({ kind: 'error', text: `Could not save locally: ${(err as Error).message}` });
    }
  }, [state, toast]);

  const isLeader = state.session.role === 'leader';
  const membersById = useMemo(() => new Map(state.members.map((m) => [m.id, m])), [state.members]);
  const me = state.session.member_id ? (membersById.get(state.session.member_id) ?? null) : null;

  const currentEvent = useMemo(() => {
    const open = state.events.filter((e) => e.status === 'draft' || e.status === 'published').sort((a, b) => (a.date < b.date ? -1 : 1));
    return open[0] ?? null;
  }, [state.events]);
  const finalizedEvents = useMemo(() => state.events.filter((e) => e.status === 'finalized').sort((a, b) => (a.date < b.date ? 1 : -1)), [state.events]);
  const history = useMemo(() => computeHistory(state.events, state.members), [state.events, state.members]);

  const ctx = useCallback((): L.Context => ({ actor: state.session.member_id ?? (isLeader ? 'leader-demo' : 'system'), now: new Date().toISOString() }), [state.session.member_id, isLeader]);

  const fail = useCallback(
    (err: unknown): ActionResult => {
      const code = err instanceof L.LifecycleError ? err.code : 'error';
      const message = err instanceof Error ? err.message : String(err);
      toast({ kind: 'error', text: message });
      return { ok: false, code, message };
    },
    [toast],
  );

  const requireLeader = useCallback((): ActionResult | null => {
    if (isLeader) return null;
    const message = 'Leaders only. Switch to the leader role in the account menu (demo).';
    toast({ kind: 'error', text: message });
    return { ok: false, code: 'forbidden', message };
  }, [isLeader, toast]);

  const stateRef = useRef(state);
  stateRef.current = state;
  const commit = useCallback((updater: (s: PersistedState) => PersistedState) => {
    const next = updater(stateRef.current);
    stateRef.current = next;
    setState(next);
  }, []);

  /** Applies a lifecycle function to one event, with role check, undo capture and error toast. */
  const runEvent = useCallback(
    (eventId: string, fn: (event: CanyonEvent) => L.Result, opts?: { pushUndo?: string; leader?: boolean }): ActionResult => {
      if (opts?.leader !== false) {
        const denied = requireLeader();
        if (denied) return denied;
      }
      const event = stateRef.current.events.find((e) => e.id === eventId);
      if (!event) return fail(new L.LifecycleError('not_found', 'Event not found.'));
      try {
        const res = fn(event);
        if (opts?.pushUndo) {
          const stack = assignmentUndo.current.get(eventId) ?? [];
          stack.push({ assignments: event.assignments, revision: res.event.revision, label: opts.pushUndo });
          assignmentUndo.current.set(eventId, stack.slice(-20));
          setUndoTick((t) => t + 1);
        }
        commit((s) => ({ ...s, events: s.events.map((e) => (e.id === eventId ? res.event : e)), audit: [...s.audit, ...res.audit].slice(-500) }));
        return { ok: true };
      } catch (err) {
        return fail(err);
      }
    },
    [commit, fail, requireLeader],
  );

  const runOrg = useCallback(
    (fn: (org: OrganizationState) => O.OrgResult, label?: string): ActionResult => {
      const denied = requireLeader();
      if (denied) return denied;
      try {
        const res = fn(stateRef.current.organization);
        if (res.inverse.length && label) {
          orgUndo.current.push({ inverse: res.inverse, revision: res.state.revision, label });
          orgUndo.current = orgUndo.current.slice(-20);
          setUndoTick((t) => t + 1);
        }
        commit((s) => ({ ...s, organization: res.state, audit: [...s.audit, ...res.audit].slice(-500) }));
        return { ok: true };
      } catch (err) {
        return fail(err);
      }
    },
    [commit, fail, requireLeader],
  );

  const actions: StoreValue['actions'] = useMemo(
    () => ({
      updateSettings: (patch) => {
        commit((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
        return { ok: true };
      },
      setSession: (session) => commit((s) => ({ ...s, session })),
      setAvailability: (eventId, memberId, choice) => {
        const self = stateRef.current.session.member_id === memberId;
        if (!self && !isLeader) return fail(new L.LifecycleError('forbidden', 'You can only change your own availability.'));
        return runEvent(eventId, (e) => L.setAvailability(e, memberId, choice, ctx(), self ? 'self' : (stateRef.current.session.member_id ?? 'leader-demo')), { leader: false });
      },
      fillMissingAvailability: (eventId, choice) => {
        const denied = requireLeader();
        if (denied) return denied;
        const recorder = stateRef.current.session.member_id ?? 'leader-demo';
        let count = 0;
        const res = runEvent(eventId, (e) => {
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
        });
        return res.ok ? { ok: true, count } : res;
      },
      generate: (eventId) => runEvent(eventId, (e) => L.applySuggestions(e, stateRef.current.members, stateRef.current.events, ctx(), e.revision), { pushUndo: 'Generate suggestions' }),
      lock: (eventId, memberId, teamId, reason) => runEvent(eventId, (e) => L.lockMember(e, memberId, teamId, reason, ctx(), e.revision), { pushUndo: 'Lock' }),
      unlock: (eventId, memberId) => runEvent(eventId, (e) => L.unlockMember(e, memberId, ctx(), e.revision), { pushUndo: 'Unlock' }),
      move: (eventId, memberId, target) => runEvent(eventId, (e) => L.moveMember(e, memberId, target, ctx(), e.revision), { pushUndo: 'Move' }),
      swap: (eventId, a, b) => runEvent(eventId, (e) => L.swapMembers(e, a, b, ctx(), e.revision), { pushUndo: 'Swap' }),
      undoAssignments: (eventId) => {
        const stack = assignmentUndo.current.get(eventId) ?? [];
        const last = stack[stack.length - 1];
        if (!last) return fail(new L.LifecycleError('nothing', 'Nothing to undo.'));
        const res = runEvent(eventId, (e) => L.replaceAssignments(e, last.assignments, ctx(), last.revision));
        if (res.ok) {
          stack.pop();
          setUndoTick((t) => t + 1);
        }
        return res;
      },
      publish: (eventId) => runEvent(eventId, (e) => L.publishEvent(e, ctx(), e.revision)),
      confirm: (eventId, memberId) => {
        if (stateRef.current.session.member_id !== memberId && !isLeader) return fail(new L.LifecycleError('forbidden', 'You can only confirm your own assignment.'));
        return runEvent(eventId, (e) => L.confirmAssignment(e, memberId, ctx()), { leader: false });
      },
      recordAttendance: (eventId, memberId, outcome, opts) => runEvent(eventId, (e) => L.recordAttendance(e, memberId, outcome, ctx(), opts)),
      finalize: (eventId) => {
        const res = runEvent(eventId, (e) => L.finalizeEvent(e, ctx()));
        if (res.ok) {
          // Idempotently make sure next week's draft exists.
          const events = stateRef.current.events;
          const finalized = events.find((e) => e.id === eventId)!;
          const next = L.ensureNextWeekDraft(events, { series_id: SERIES_ID, afterDate: finalized.date, timezone: finalized.timezone, team_times: stateRef.current.settings.default_team_times });
          if (next.created) commit((s) => ({ ...s, events: [...s.events, next.event] }));
        }
        return res;
      },
      cancel: (eventId, reason) => runEvent(eventId, (e) => L.cancelEvent(e, ctx(), reason)),
      updateSchedule: (eventId, patch) => runEvent(eventId, (e) => L.updateSchedule(e, patch, ctx())),
      createNextWeek: () => {
        const denied = requireLeader();
        if (denied) return denied;
        const events = stateRef.current.events;
        const latest = [...events].filter((e) => e.status !== 'canceled').sort((a, b) => (a.date < b.date ? 1 : -1))[0];
        const afterDate = latest ? latest.date : todayInZone(deviceTimeZone());
        const next = L.ensureNextWeekDraft(events, { series_id: SERIES_ID, afterDate, timezone: stateRef.current.settings.timezone, team_times: stateRef.current.settings.default_team_times });
        if (next.created) commit((s) => ({ ...s, events: [...s.events, next.event] }));
        return { ok: true, eventId: next.event.id };
      },
      setSlot: (id, position, value) => runOrg((org) => O.setSlot(org, id, position, value, ctx(), org.revision), 'Slot change'),
      moveSlot: (from, fromPos, to, toPos) => runOrg((org) => O.moveSlot(org, { responsibility_id: from, position: fromPos }, { responsibility_id: to, position: toPos }, ctx(), org.revision), 'Move'),
      swapSlots: (a, aPos, b, bPos) => runOrg((org) => O.swapSlots(org, { responsibility_id: a, position: aPos }, { responsibility_id: b, position: bPos }, ctx(), org.revision), 'Swap'),
      undoOrganization: () => {
        const last = orgUndo.current[orgUndo.current.length - 1];
        if (!last) return fail(new L.LifecycleError('nothing', 'Nothing to undo.'));
        const res = runOrg((org) => O.applySlotEdits(org, last.inverse, ctx(), last.revision));
        if (res.ok) {
          orgUndo.current.pop();
          setUndoTick((t) => t + 1);
        }
        return res;
      },
      addTask: (title) => runOrg((org) => O.addTask(org, title, ctx(), org.revision)),
      renameTask: (id, title) => runOrg((org) => O.renameTask(org, id, title, ctx(), org.revision)),
      archiveTask: (id, archived) => runOrg((org) => O.setTaskArchived(org, id, archived, ctx(), org.revision)),
      reorderTask: (id, direction) => runOrg((org) => O.reorderTask(org, id, direction, ctx(), org.revision)),
      mapName: (sourceName, memberId) => runOrg((org) => O.setNameMapping(org, sourceName, memberId, ctx(), org.revision)),
      setMechanicalNote: (memberId, note) => {
        const denied = requireLeader();
        if (denied) return denied;
        commit((s) => ({ ...s, members: s.members.map((m) => (m.id === memberId ? L.withMechanicalNote(m, note) : m)) }));
        return { ok: true };
      },
      setMemberActive: (memberId, active) => {
        const denied = requireLeader();
        if (denied) return denied;
        commit((s) => ({ ...s, members: s.members.map((m) => (m.id === memberId ? { ...m, active } : m)) }));
        return { ok: true };
      },
      resetDemo: () => {
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {
          /* ignore */
        }
        assignmentUndo.current.clear();
        orgUndo.current = [];
        commit(() => initialState());
      },
      exportJson: () => JSON.stringify(stateRef.current, null, 2),
    }),
    [commit, ctx, fail, isLeader, requireLeader, runEvent, runOrg],
  );

  const value: StoreValue = useMemo(
    () => ({
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
    [state, saveState, restored, isLeader, me, membersById, currentEvent, finalizedEvents, history, actions, undoTick],
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
