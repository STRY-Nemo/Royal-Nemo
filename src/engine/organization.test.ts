import { describe, expect, it } from 'vitest';
import { loadSeedMembers, loadSeedOrganization } from '../data/seed';
import { LifecycleError } from './lifecycle';
import { applySlotEdits, canOrganize, moveSlot, setDesignatedEditor, setNameMapping, setSlot, slotDisplay, suggestMatches, swapSlots } from './organization';

const members = loadSeedMembers();
const byId = new Map(members.map((m) => [m.id, m]));
const ctx = { actor: 'stry-003', now: '2026-09-09T12:00:00Z' } as const;

describe('organization seed', () => {
  it('round-trips all 16 tasks and four slots with names and order intact', () => {
    const org = loadSeedOrganization();
    expect(org.responsibilities).toHaveLength(16);
    const gw = org.responsibilities.find((r) => r.title === 'Glory Wars (GW)')!;
    expect(gw.slots.map((s) => s.source_name)).toEqual(['Appins', 'Rouge', 'Paju', null]);
    const mail = org.responsibilities.find((r) => r.title.startsWith('Alliance Mail'))!;
    expect(mail.slots.map((s) => s.source_name)).toEqual(['Rouge', 'Nemo', 'Roso', 'Appins']);
    const svs = org.responsibilities.find((r) => r.title === 'SVS')!;
    expect(svs.slots.map((s) => s.source_name)).toEqual(['Nemo', 'Rouge', null, null]);
    expect(org.responsibilities.map((r) => r.order)).toEqual([...Array(16).keys()]);
    expect(org.dropdown_names).toContain('TBD');
    expect(org.dropdown_names).toContain('TBD/Rotation');
    for (const r of org.responsibilities) expect(r.slots.map((s) => s.label)).toEqual(['Lead', 'Assigned 2', 'Assigned 3', 'Assigned 4']);
  });
});

describe('slot editing', () => {
  it('sets, clears, uses TBD, and moves a member who already holds another slot in the task', () => {
    let org = loadSeedOrganization();
    const canyon = org.responsibilities.find((r) => r.title === 'Canyon')!;
    org = setSlot(org, canyon.id, 3, { kind: 'member', member_id: 'stry-003' }, ctx).state;
    expect(slotDisplay(org.responsibilities.find((r) => r.id === canyon.id)!.slots[2], byId)).toBe('Appins');
    // Assigning the same member to another slot of the same task moves them: the old slot is cleared.
    const moved = setSlot(org, canyon.id, 4, { kind: 'member', member_id: 'stry-003' }, ctx);
    const task = moved.state.responsibilities.find((r) => r.id === canyon.id)!;
    expect(task.slots[3].member_id).toBe('stry-003');
    expect(task.slots[2].member_id).toBeNull();
    expect(moved.displaced).toEqual([{ responsibility_id: canyon.id, position: 3, value: { kind: 'empty' } }]);
    // Undo restores both slots.
    const restored = applySlotEdits(moved.state, moved.inverse, ctx).state.responsibilities.find((r) => r.id === canyon.id)!;
    expect(restored.slots[2].member_id).toBe('stry-003');
    expect(restored.slots[3].member_id).toBeNull();
    org = setSlot(org, canyon.id, 4, { kind: 'placeholder', label: 'TBD' }, ctx).state;
    expect(org.responsibilities.find((r) => r.id === canyon.id)!.slots[3].placeholder).toBe('TBD');
    const cleared = setSlot(org, canyon.id, 1, { kind: 'empty' }, ctx);
    expect(cleared.state.responsibilities.find((r) => r.id === canyon.id)!.slots[0].source_name).toBeNull();
    // Undo restores the source label.
    const undone = applySlotEdits(cleared.state, cleared.inverse, ctx, cleared.state.revision).state;
    expect(undone.responsibilities.find((r) => r.id === canyon.id)!.slots[0].source_name).toBe('Apparition');
  });

  it('moves a source label within a task but lets placeholders repeat', () => {
    let org = loadSeedOrganization();
    const gw = org.responsibilities[0]; // Appins, Rouge, Paju, Paju-style source labels in slots 1-4
    const moved = setSlot(org, gw.id, 4, { kind: 'source', label: 'Appins' }, ctx);
    expect(moved.state.responsibilities[0].slots.map((s) => s.source_name)).toEqual([null, 'Rouge', 'Paju', 'Appins']);
    expect(moved.displaced).toHaveLength(1);
    org = setSlot(moved.state, gw.id, 1, { kind: 'placeholder', label: 'TBD' }, ctx).state;
    org = setSlot(org, gw.id, 2, { kind: 'placeholder', label: 'TBD' }, ctx).state;
    expect(org.responsibilities[0].slots.map((s) => s.placeholder)).toEqual(['TBD', 'TBD', null, null]);
  });

  it('allows the same member across different tasks', () => {
    let org = loadSeedOrganization();
    const [a, b] = org.responsibilities;
    org = setSlot(org, a.id, 4, { kind: 'member', member_id: 'stry-010' }, ctx).state;
    org = setSlot(org, b.id, 3, { kind: 'member', member_id: 'stry-010' }, ctx).state;
    expect(org.responsibilities[1].slots[2].member_id).toBe('stry-010');
  });

  it('moves into blank slots, swaps occupied slots atomically, and detects stale revisions', () => {
    let org = loadSeedOrganization();
    const gw = org.responsibilities[0];
    expect(() => moveSlot(org, { responsibility_id: gw.id, position: 1 }, { responsibility_id: gw.id, position: 2 }, ctx)).toThrow(/occupied/);
    org = moveSlot(org, { responsibility_id: gw.id, position: 3 }, { responsibility_id: gw.id, position: 4 }, ctx).state;
    expect(org.responsibilities[0].slots.map((s) => s.source_name)).toEqual(['Appins', 'Rouge', null, 'Paju']);
    const rev = org.revision;
    const swapped = swapSlots(org, { responsibility_id: gw.id, position: 1 }, { responsibility_id: gw.id, position: 2 }, ctx, rev);
    expect(swapped.state.responsibilities[0].slots.map((s) => s.source_name)).toEqual(['Rouge', 'Appins', null, 'Paju']);
    expect(() => swapSlots(org, { responsibility_id: gw.id, position: 1 }, { responsibility_id: gw.id, position: 2 }, ctx, rev - 1)).toThrow(/reload/i);
    const undone = applySlotEdits(swapped.state, swapped.inverse, ctx).state;
    expect(undone.responsibilities[0].slots.map((s) => s.source_name)).toEqual(['Appins', 'Rouge', null, 'Paju']);
  });

  it('suggests alias matches without silently merging, and mapping fills matching slots', () => {
    const rouge = suggestMatches('Rouge', members);
    expect(rouge.map((m) => m.username)).toContain('Queen Rouge');
    const nemo = suggestMatches('Nemo', members);
    expect(nemo.map((m) => m.username)).toContain('Nemo Hoes');
    let org = loadSeedOrganization();
    const nemoId = members.find((m) => m.username === 'Nemo Hoes')!.id;
    org = setNameMapping(org, 'Nemo', nemoId, ctx).state;
    const svs = org.responsibilities.find((r) => r.title === 'SVS')!;
    expect(svs.slots[0].member_id).toBe(nemoId);
    expect(svs.slots[0].source_name).toBe('Nemo');
  });
});

describe('Organize access', () => {
  it('is open to leaders, R4/R5 and designated members, and to nobody unverified', () => {
    let org = loadSeedOrganization();
    const r5 = members.find((m) => m.rank === 'R5')!;
    const r4 = members.find((m) => m.rank === 'R4')!;
    const r1 = members.find((m) => m.rank === 'R1' || m.rank === 'R2' || m.rank === 'R3')!;
    expect(canOrganize('leader', null, org)).toBe(true);
    expect(canOrganize('member', r5, org)).toBe(true);
    expect(canOrganize('member', r4, org)).toBe(true);
    expect(canOrganize('member', r1, org)).toBe(false);
    expect(canOrganize('member', r5, org, false)).toBe(false);
    org = setDesignatedEditor(org, r1.id, true, ctx, org.revision).state;
    expect(org.designated_editors).toEqual([r1.id]);
    expect(canOrganize('member', r1, org)).toBe(true);
    expect(setDesignatedEditor(org, r1.id, true, ctx).audit).toEqual([]);
    org = setDesignatedEditor(org, r1.id, false, ctx).state;
    expect(canOrganize('member', r1, org)).toBe(false);
    expect(() => setDesignatedEditor(org, r1.id, true, ctx, org.revision - 1)).toThrow(LifecycleError);
  });
});
