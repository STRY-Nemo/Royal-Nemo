/**
 * Pure operations on the responsibilities board (Organize page).
 */
import type { AuditEntry, Member, MemberId, OrganizationState, Responsibility, ResponsibilityId, ResponsibilitySlot } from '../domain/types';
import { LifecycleError, type Context } from './lifecycle';

export type SlotValue =
  | { kind: 'empty' }
  | { kind: 'member'; member_id: MemberId }
  | { kind: 'placeholder'; label: string }
  | { kind: 'source'; label: string };

export function slotValue(slot: ResponsibilitySlot): SlotValue {
  if (slot.member_id) return { kind: 'member', member_id: slot.member_id };
  if (slot.placeholder) return { kind: 'placeholder', label: slot.placeholder };
  if (slot.source_name) return { kind: 'source', label: slot.source_name };
  return { kind: 'empty' };
}

export function slotDisplay(slot: ResponsibilitySlot, members: Map<MemberId, Member>): string {
  const v = slotValue(slot);
  switch (v.kind) {
    case 'member':
      return members.get(v.member_id)?.username ?? v.member_id;
    case 'placeholder':
      return v.label;
    case 'source':
      return v.label;
    default:
      return '';
  }
}

export function isSameValue(a: SlotValue, b: SlotValue): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'member' && b.kind === 'member') return a.member_id === b.member_id;
  if ((a.kind === 'source' && b.kind === 'source') || (a.kind === 'placeholder' && b.kind === 'placeholder')) return a.label === b.label;
  return a.kind === 'empty';
}

function applyValue(slot: ResponsibilitySlot, value: SlotValue): ResponsibilitySlot {
  switch (value.kind) {
    case 'empty':
      return { ...slot, member_id: null, source_name: null, placeholder: null };
    case 'member':
      return { ...slot, member_id: value.member_id, source_name: null, placeholder: null };
    case 'placeholder':
      return { ...slot, member_id: null, source_name: value.label, placeholder: value.label };
    case 'source':
      return { ...slot, member_id: null, source_name: value.label, placeholder: null };
  }
}

let counter = 0;
function audit(ctx: Context, action: string, before: unknown, after: unknown): AuditEntry {
  counter++;
  return { id: `${ctx.now}-org-${counter}`, event_id: null, actor_id: ctx.actor, action, before, after, timestamp: ctx.now };
}

export interface OrgResult {
  state: OrganizationState;
  audit: AuditEntry[];
  /** Inverse edits that restore the previous slot values (for Undo). */
  inverse: SlotEdit[];
}

export interface SlotEdit {
  responsibility_id: ResponsibilityId;
  position: ResponsibilitySlot['position'];
  value: SlotValue;
}

function assertRevision(state: OrganizationState, expected?: number): void {
  if (expected !== undefined && expected !== state.revision) {
    throw new LifecycleError('stale_revision', `Another leader changed the organization board (revision ${state.revision}, you had ${expected}). Reload to compare.`);
  }
}

/** Real member appearing twice in one task is rejected; placeholders and source labels may repeat. */
function assertNoDuplicate(task: Responsibility): void {
  const seen = new Set<MemberId>();
  for (const s of task.slots) {
    if (s.member_id) {
      if (seen.has(s.member_id)) throw new LifecycleError('duplicate', 'The same member cannot hold two slots in one task.');
      seen.add(s.member_id);
    }
  }
}

/** Applies one or more slot edits atomically with revision validation. */
export function applySlotEdits(state: OrganizationState, edits: SlotEdit[], ctx: Context, expectedRevision?: number): OrgResult {
  assertRevision(state, expectedRevision);
  const inverse: SlotEdit[] = [];
  const responsibilities = state.responsibilities.map((r) => ({ ...r, slots: r.slots.map((s) => ({ ...s })) }));
  const beforeSnapshot: SlotEdit[] = [];
  for (const edit of edits) {
    const task = responsibilities.find((r) => r.id === edit.responsibility_id);
    if (!task) throw new LifecycleError('not_found', 'Task not found.');
    const idx = task.slots.findIndex((s) => s.position === edit.position);
    if (idx < 0) throw new LifecycleError('not_found', 'Slot not found.');
    const before = slotValue(task.slots[idx]);
    beforeSnapshot.push({ responsibility_id: task.id, position: edit.position, value: before });
    task.slots[idx] = applyValue(task.slots[idx], edit.value);
  }
  for (const task of responsibilities) assertNoDuplicate(task);
  // Inverse restores in reverse order.
  for (let i = beforeSnapshot.length - 1; i >= 0; i--) inverse.push(beforeSnapshot[i]);
  const next: OrganizationState = { ...state, responsibilities, revision: state.revision + 1 };
  return { state: next, inverse, audit: [audit(ctx, 'organization.slots', beforeSnapshot, edits)] };
}

export function setSlot(state: OrganizationState, responsibilityId: ResponsibilityId, position: ResponsibilitySlot['position'], value: SlotValue, ctx: Context, expectedRevision?: number): OrgResult {
  return applySlotEdits(state, [{ responsibility_id: responsibilityId, position, value }], ctx, expectedRevision);
}

/** Move source slot value into destination (destination must be empty); clears the source. */
export function moveSlot(state: OrganizationState, from: { responsibility_id: ResponsibilityId; position: ResponsibilitySlot['position'] }, to: { responsibility_id: ResponsibilityId; position: ResponsibilitySlot['position'] }, ctx: Context, expectedRevision?: number): OrgResult {
  const fromTask = state.responsibilities.find((r) => r.id === from.responsibility_id);
  const toTask = state.responsibilities.find((r) => r.id === to.responsibility_id);
  if (!fromTask || !toTask) throw new LifecycleError('not_found', 'Task not found.');
  const fromSlot = fromTask.slots.find((s) => s.position === from.position)!;
  const toSlot = toTask.slots.find((s) => s.position === to.position)!;
  if (slotValue(toSlot).kind !== 'empty') throw new LifecycleError('occupied', 'Destination slot is occupied; use swap.');
  return applySlotEdits(
    state,
    [
      { responsibility_id: to.responsibility_id, position: to.position, value: slotValue(fromSlot) },
      { responsibility_id: from.responsibility_id, position: from.position, value: { kind: 'empty' } },
    ],
    ctx,
    expectedRevision,
  );
}

export function swapSlots(state: OrganizationState, a: { responsibility_id: ResponsibilityId; position: ResponsibilitySlot['position'] }, b: { responsibility_id: ResponsibilityId; position: ResponsibilitySlot['position'] }, ctx: Context, expectedRevision?: number): OrgResult {
  const aTask = state.responsibilities.find((r) => r.id === a.responsibility_id);
  const bTask = state.responsibilities.find((r) => r.id === b.responsibility_id);
  if (!aTask || !bTask) throw new LifecycleError('not_found', 'Task not found.');
  const aSlot = aTask.slots.find((s) => s.position === a.position)!;
  const bSlot = bTask.slots.find((s) => s.position === b.position)!;
  return applySlotEdits(
    state,
    [
      { responsibility_id: a.responsibility_id, position: a.position, value: slotValue(bSlot) },
      { responsibility_id: b.responsibility_id, position: b.position, value: slotValue(aSlot) },
    ],
    ctx,
    expectedRevision,
  );
}

export function addTask(state: OrganizationState, title: string, ctx: Context, expectedRevision?: number): OrgResult {
  assertRevision(state, expectedRevision);
  if (!title.trim()) throw new LifecycleError('title_required', 'Task title is required.');
  const id = `responsibility-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
  const labels = ['Lead', 'Assigned 2', 'Assigned 3', 'Assigned 4'];
  const task: Responsibility = {
    id,
    title: title.trim(),
    order: state.responsibilities.length,
    archived: false,
    slots: labels.map((label, i) => ({ position: (i + 1) as ResponsibilitySlot['position'], label, source_name: null, member_id: null, placeholder: null })),
  };
  return { state: { ...state, responsibilities: [...state.responsibilities, task], revision: state.revision + 1 }, inverse: [], audit: [audit(ctx, 'organization.task.add', null, task)] };
}

export function renameTask(state: OrganizationState, id: ResponsibilityId, title: string, ctx: Context, expectedRevision?: number): OrgResult {
  assertRevision(state, expectedRevision);
  if (!title.trim()) throw new LifecycleError('title_required', 'Task title is required.');
  const before = state.responsibilities.find((r) => r.id === id);
  if (!before) throw new LifecycleError('not_found', 'Task not found.');
  const responsibilities = state.responsibilities.map((r) => (r.id === id ? { ...r, title: title.trim() } : r));
  return { state: { ...state, responsibilities, revision: state.revision + 1 }, inverse: [], audit: [audit(ctx, 'organization.task.rename', before.title, title.trim())] };
}

export function setTaskArchived(state: OrganizationState, id: ResponsibilityId, archived: boolean, ctx: Context, expectedRevision?: number): OrgResult {
  assertRevision(state, expectedRevision);
  const responsibilities = state.responsibilities.map((r) => (r.id === id ? { ...r, archived } : r));
  return { state: { ...state, responsibilities, revision: state.revision + 1 }, inverse: [], audit: [audit(ctx, 'organization.task.archive', !archived, archived)] };
}

export function reorderTask(state: OrganizationState, id: ResponsibilityId, direction: -1 | 1, ctx: Context, expectedRevision?: number): OrgResult {
  assertRevision(state, expectedRevision);
  const sorted = [...state.responsibilities].sort((a, b) => a.order - b.order);
  const idx = sorted.findIndex((r) => r.id === id);
  const target = idx + direction;
  if (idx < 0 || target < 0 || target >= sorted.length) return { state, inverse: [], audit: [] };
  [sorted[idx], sorted[target]] = [sorted[target], sorted[idx]];
  const responsibilities = sorted.map((r, i) => ({ ...r, order: i }));
  return { state: { ...state, responsibilities, revision: state.revision + 1 }, inverse: [], audit: [audit(ctx, 'organization.task.reorder', idx, target)] };
}

export function setNameMapping(state: OrganizationState, sourceName: string, memberId: MemberId | null, ctx: Context, expectedRevision?: number): OrgResult {
  assertRevision(state, expectedRevision);
  const mapping = { ...state.name_mapping, [sourceName]: memberId };
  // Apply mapping to every slot still showing that source label.
  const responsibilities = state.responsibilities.map((r) => ({
    ...r,
    slots: r.slots.map((s) => (s.source_name === sourceName && !s.placeholder && !s.member_id && memberId ? { ...s, member_id: memberId } : s)),
  }));
  for (const task of responsibilities) assertNoDuplicate(task);
  return { state: { ...state, name_mapping: mapping, responsibilities, revision: state.revision + 1 }, inverse: [], audit: [audit(ctx, 'organization.mapping', { [sourceName]: state.name_mapping[sourceName] ?? null }, { [sourceName]: memberId })] };
}

/** Suggested member matches for a source label: exact, then prefix/contains on normalized names. */
export function suggestMatches(sourceName: string, members: Member[]): Member[] {
  const norm = normalizeName(sourceName);
  const exact = members.filter((m) => normalizeName(m.username) === norm || m.aliases.some((a) => normalizeName(a) === norm));
  const partial = members.filter((m) => !exact.includes(m) && (normalizeName(m.username).includes(norm) || norm.includes(normalizeName(m.username))));
  return [...exact, ...partial];
}

export function normalizeName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
