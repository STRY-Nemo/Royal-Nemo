import { Art } from '../ui/Art';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { Responsibility, ResponsibilitySlot } from '../domain/types';
import { slotDisplay, slotValue, type SlotValue } from '../engine/organization';
import { PLACEHOLDER_NAMES } from '../data/seed';
import { BottomSheet, ConfirmSheet, useFeedback, useFlash } from '../motion';
import { useRouter } from '../store/router';
import { useStore } from '../store/store';
import { useUiState } from '../store/ui';
import { DemoBanner, EmptyState, Header, MemberPickerSheet, SearchInput, type PickerOption } from '../ui/common';
import { ChevronDown, GripIcon, UndoIcon } from '../ui/icons';
import { useLongPressDrag } from '../ui/useLongPressDrag';
import { normalizeName } from '../engine/organization';

type Filter = 'all' | 'mine' | 'unassigned';
type SlotRef = { taskId: string; position: ResponsibilitySlot['position'] };
type DragPayload = SlotRef & { label: string };

function refKey(r: SlotRef): string {
  return `${r.taskId}|${r.position}`;
}
function parseKey(key: string): SlotRef {
  const [taskId, pos] = key.split('|');
  return { taskId, position: Number(pos) as ResponsibilitySlot['position'] };
}

export function OrganizeScreen() {
  const { state, canOrganize, actions, membersById, me, canUndoOrganization, mode, account } = useStore();
  const [editorsOpen, setEditorsOpen] = useState(false);
  const [editorPicker, setEditorPicker] = useState(false);
  const router = useRouter();
  const { toast, announce } = useFeedback();
  const [query, setQuery] = useUiState('organize.query', '');
  const [filter, setFilter] = useUiState<Filter>('organize.filter', 'all');
  const [expanded, setExpanded] = useUiState<Record<string, boolean>>('organize.expanded', {});
  const [recent, setRecent] = useUiState<string[]>('organize.recent', []);
  const [editing, setEditing] = useState<SlotRef | null>(null);
  const [tapMode, setTapMode] = useState<{ source: SlotRef; kind: 'move' | 'swap' } | null>(null);
  const [swapPreview, setSwapPreview] = useState<{ from: SlotRef; to: SlotRef } | null>(null);
  const [taskMenu, setTaskMenu] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [flashing, flash] = useFlash();
  const returnFocus = useRef<HTMLElement | null>(null);

  const tasks = useMemo(() => {
    const q = normalizeName(query);
    return [...state.organization.responsibilities]
      .filter((r) => !r.archived)
      .sort((a, b) => a.order - b.order)
      .filter((r) => {
        if (q && !normalizeName(r.title).includes(q) && !r.slots.some((s) => normalizeName(slotDisplay(s, membersById)).includes(q))) return false;
        if (filter === 'unassigned') return r.slots.every((s) => slotValue(s).kind === 'empty' || slotValue(s).kind === 'placeholder');
        if (filter === 'mine') return !!me && r.slots.some((s) => s.member_id === me.id);
        return true;
      });
  }, [state.organization.responsibilities, query, filter, me, membersById]);

  const findSlot = (ref: SlotRef) => state.organization.responsibilities.find((r) => r.id === ref.taskId)?.slots.find((s) => s.position === ref.position);

  const canDrop = useCallback(
    (payload: DragPayload, targetKey: string) => {
      const target = parseKey(targetKey);
      if (target.taskId === payload.taskId && target.position === payload.position) return false;
      const source = findSlot(payload);
      const task = state.organization.responsibilities.find((r) => r.id === target.taskId);
      if (!source || !task) return false;
      const v = slotValue(source);
      if (v.kind === 'member' && target.taskId !== payload.taskId && task.slots.some((s) => s.member_id === v.member_id)) return false;
      return true;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.organization.responsibilities],
  );

  const commitMove = (from: SlotRef, to: SlotRef) => {
    const target = findSlot(to);
    if (!target) return;
    if (slotValue(target).kind === 'empty') {
      const res = actions.moveSlot(from.taskId, from.position, to.taskId, to.position);
      if (res.ok) {
        flash(refKey(to));
        toast({ kind: 'ok', text: 'Moved', action: { label: 'Undo', onClick: () => actions.undoOrganization() } });
        announce('Assignment moved.');
      }
    } else {
      setSwapPreview({ from, to });
    }
  };

  const { drag, gripProps } = useLongPressDrag<DragPayload>({
    hitTest: (x, y) => {
      const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-slot-key]');
      return el?.dataset.slotKey ?? null;
    },
    canDrop,
    onDrop: (payload, targetKey) => commitMove(payload, parseKey(targetKey)),
    onStart: (p) => announce(`Dragging ${p.label}. Drop on a slot, or press Escape to cancel.`),
  });

  const pickerOptions = (ref: SlotRef): PickerOption[] => {
    const slot = findSlot(ref);
    const current = slot ? slotValue(slot) : { kind: 'empty' as const };
    const opts: PickerOption[] = [{ key: '__clear', label: 'Clear (unassigned)', hint: 'Empty means unassigned', selected: current.kind === 'empty' }];
    for (const name of state.organization.dropdown_names) {
      const isPlaceholder = PLACEHOLDER_NAMES.includes(name);
      const mapped = state.organization.name_mapping[name];
      opts.push({
        key: `${isPlaceholder ? 'ph' : 'src'}:${name}`,
        label: name,
        hint: isPlaceholder ? 'Placeholder, not a member' : mapped ? `Mapped to ${membersById.get(mapped)?.username}` : 'Source label · not yet mapped to a member',
        selected: (current.kind === 'placeholder' || current.kind === 'source') && current.label === name,
      });
    }
    return opts;
  };

  const applyPick = (ref: SlotRef, option: PickerOption) => {
    let value: SlotValue;
    if (option.key === '__clear') value = { kind: 'empty' };
    else if (option.key.startsWith('ph:')) value = { kind: 'placeholder', label: option.label };
    else if (option.key.startsWith('src:')) {
      const mapped = state.organization.name_mapping[option.label];
      value = mapped ? { kind: 'member', member_id: mapped } : { kind: 'source', label: option.label };
    } else {
      value = { kind: 'member', member_id: option.key };
      setRecent((r) => [option.key, ...r.filter((x) => x !== option.key)].slice(0, 8));
    }
    const res = actions.setSlot(ref.taskId, ref.position, value);
    if (res.ok) {
      flash(refKey(ref));
      toast({ kind: 'ok', text: `Saved ${findTask(ref.taskId)?.slots.find((s) => s.position === ref.position)?.label}`, action: { label: 'Undo', onClick: () => actions.undoOrganization() } });
      announce(`Saved: ${option.label}`);
      setEditing(null);
    }
  };

  const findTask = (id: string) => state.organization.responsibilities.find((r) => r.id === id);

  const disabledForSlot = (ref: SlotRef): Map<string, string> => {
    const task = findTask(ref.taskId);
    const out = new Map<string, string>();
    task?.slots.forEach((s) => {
      if (s.member_id && s.position !== ref.position) out.set(s.member_id, `already ${s.label} here`);
    });
    return out;
  };

  const onSlotTap = (ref: SlotRef, el: HTMLElement) => {
    returnFocus.current = el;
    if (tapMode) {
      if (tapMode.kind === 'move') commitMove(tapMode.source, ref);
      else setSwapPreview({ from: tapMode.source, to: ref });
      setTapMode(null);
      return;
    }
    setEditing(ref);
  };

  const editingSlot = editing ? findSlot(editing) : undefined;
  const editingTask = editing ? findTask(editing.taskId) : undefined;
  const editingValue = editingSlot ? slotValue(editingSlot) : null;

  if (!canOrganize) {
    const unverified = mode === 'api' && !!account && !!account.member_id && !account.verified;
    return (
      <>
        <Header title="Organize" />
        <main className="page">
          <DemoBanner />
          <EmptyState title="Leadership only" action={!me ? <button type="button" className="btn primary" onClick={() => router.navigate('/settings')}>{mode === 'api' ? 'Link my member' : 'Choose my member'}</button> : undefined}>
            {unverified
              ? 'Your roster link is waiting for a leader to verify it. Once verified, R4 and R5 members get access here automatically.'
              : 'The Organize page is for R4 and R5 members and for leaders they designate. Ask an R4/R5 to add you under "Who can edit" if you should have access.'}
          </EmptyState>
        </main>
      </>
    );
  }

  const designated = state.organization.designated_editors ?? [];
  const rankEditors = state.members.filter((m) => m.active && (m.rank === 'R4' || m.rank === 'R5')).sort((a, b) => (a.rank === b.rank ? a.username.localeCompare(b.username) : a.rank < b.rank ? 1 : -1));

  return (
    <>
      <Header title="Organize" />
      <main className="page">
        <DemoBanner />
        <Art name="organize-banner" alt="" className="art-banner" />
        <div>
          <h1>Responsibilities</h1>
          <p className="muted small">Tap a slot to assign. Long-press the grip to drag. Every drag has a tap equivalent.</p>
        </div>
        <button type="button" className="link-btn" onClick={() => setEditorsOpen(true)}>
          Who can edit · R4/R5 + {designated.length} designated
        </button>
        <SearchInput value={query} onChange={setQuery} placeholder="Search tasks or names" />
        <div className="filter-row" role="tablist" aria-label="Filter">
          {(['all', 'mine', 'unassigned'] as Filter[]).map((f) => (
            <button key={f} type="button" role="tab" className="chip tap" aria-selected={filter === f} aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All tasks' : f === 'mine' ? 'My tasks' : 'Unassigned'}
            </button>
          ))}
          <button type="button" className="chip tap" onClick={() => router.navigate('/organize/mapping')}>
            Map names
          </button>
        </div>

        {tapMode && (
          <div className="callout" role="status">
            <span aria-hidden="true">👉</span>
            <span className="grow">
              Choose a destination slot to {tapMode.kind} <strong>{findSlot(tapMode.source) ? slotDisplay(findSlot(tapMode.source)!, membersById) : ''}</strong>.
            </span>
            <button type="button" className="btn ghost small" onClick={() => setTapMode(null)}>
              Cancel
            </button>
          </div>
        )}

        {tasks.length === 0 && <EmptyState title="No tasks match">{filter === 'mine' && !me ? 'Choose your member in Settings to see your tasks.' : 'Try another filter or search.'}</EmptyState>}

        <div className="list">
          {tasks.map((task, i) => (
            <TaskCard
              key={task.id}
              task={task}
              index={i}
              expanded={!!expanded[task.id] || !!query}
              onToggle={() => setExpanded((e) => ({ ...e, [task.id]: !e[task.id] }))}
              editable={canOrganize}
              onSlotTap={onSlotTap}
              gripProps={gripProps}
              drag={drag}
              canDrop={canDrop}
              flashing={flashing}
              tapMode={tapMode}
              onMenu={() => setTaskMenu(task.id)}
            />
          ))}
        </div>

        {canOrganize && (
          <div className="card-row">
            <button type="button" className="btn secondary" style={{ flex: 1 }} onClick={() => setAddOpen(true)}>
              + Add task
            </button>
            {canUndoOrganization && (
              <button type="button" className="btn ghost" style={{ flex: 1 }} onClick={() => actions.undoOrganization().ok && toast({ kind: 'ok', text: 'Undone' })}>
                <UndoIcon /> Undo
              </button>
            )}
          </div>
        )}
        <p className="faint">Source: STRY_Leadership_Responsibilities_Updated_v2.xlsx. Names such as Rouge or Nemo stay as source labels until a leader maps them to roster members. Placeholders (TBD) are not members and grant no permissions.</p>
      </main>

      {drag && (
        <div className="drag-ghost" style={{ left: drag.x, top: drag.y }} aria-hidden="true">
          {drag.payload.label}
        </div>
      )}

      {editing && editingTask && editingSlot && (
        <MemberPickerSheet
          open
          title={`${editingTask.title} · ${editingSlot.label}`}
          onClose={() => setEditing(null)}
          fixedOptions={[
            ...(editingValue && editingValue.kind !== 'empty'
              ? [
                  { key: '__move', label: 'Move to another slot…', hint: 'Tap a destination; source is cleared' },
                  { key: '__swap', label: 'Swap with another slot…', hint: 'Exchange two assignments' },
                ]
              : []),
            ...pickerOptions(editing),
          ]}
          disabledMembers={disabledForSlot(editing)}
          recent={recent}
          selectedMemberId={editingSlot.member_id}
          onPick={(o) => {
            if (o.key === '__move' || o.key === '__swap') {
              setTapMode({ source: editing, kind: o.key === '__move' ? 'move' : 'swap' });
              setEditing(null);
              announce('Now choose a destination slot.');
              return;
            }
            applyPick(editing, o);
          }}
        />
      )}

      <ConfirmSheet
        open={!!swapPreview}
        title="Swap assignments?"
        confirmLabel="Swap"
        onCancel={() => setSwapPreview(null)}
        onConfirm={() => {
          if (!swapPreview) return;
          const res = actions.swapSlots(swapPreview.from.taskId, swapPreview.from.position, swapPreview.to.taskId, swapPreview.to.position);
          if (res.ok) {
            flash(refKey(swapPreview.from));
            flash(refKey(swapPreview.to));
            toast({ kind: 'ok', text: 'Swapped', action: { label: 'Undo', onClick: () => actions.undoOrganization() } });
            announce('Assignments swapped.');
          }
          setSwapPreview(null);
        }}
      >
        {swapPreview && (
          <div className="list">
            {[swapPreview.from, swapPreview.to].map((r, idx) => {
              const other = idx === 0 ? swapPreview.to : swapPreview.from;
              const s = findSlot(r);
              const o = findSlot(other);
              return (
                <div key={refKey(r)} className="row" style={{ animation: 'none' }}>
                  <div className="main">
                    <div className="name wrap">{s ? slotDisplay(s, membersById) || '(empty)' : ''}</div>
                    <div className="meta">
                      {findTask(r.taskId)?.title} · {s?.label} → {findTask(other.taskId)?.title} · {o?.label}
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="faint">Saved as one atomic change. Roles follow the destination slot (moving into Lead makes that person the lead).</div>
          </div>
        )}
      </ConfirmSheet>

      <TaskMenuSheet taskId={taskMenu} onClose={() => setTaskMenu(null)} />

      <BottomSheet open={editorsOpen && !editorPicker} onClose={() => setEditorsOpen(false)} title="Who can edit Organize">
        <div className="list">
          <p className="small muted">R4 and R5 members always have access{mode === 'api' ? ' once a leader has verified their roster link' : ''}. Leader accounts too. Anyone listed here can add or remove designated leaders.</p>
          <h3>R4 / R5</h3>
          <div className="small wrap">{rankEditors.map((m) => `${m.username} (${m.rank})`).join(', ') || 'None in the roster'}</div>
          <h3>Designated leaders</h3>
          {designated.length === 0 && <div className="small muted">Nobody designated yet.</div>}
          {designated.map((id) => {
            const m = membersById.get(id);
            return (
              <div key={id} className="row" style={{ animation: 'none' }}>
                <div className="main">
                  <div className="name">{m?.username ?? id}</div>
                  <div className="meta">{m ? `${m.rank} · ${m.origin_alliance}` : 'not in roster'}</div>
                </div>
                <button type="button" className="btn ghost small" onClick={() => actions.setDesignatedEditor(id, false).ok && toast({ kind: 'ok', text: `${m?.username ?? id} removed` })}>
                  Remove
                </button>
              </div>
            );
          })}
          <button type="button" className="btn secondary block" onClick={() => setEditorPicker(true)}>
            + Add designated leader
          </button>
        </div>
      </BottomSheet>
      <MemberPickerSheet
        open={editorPicker}
        title="Designate a leader"
        onClose={() => setEditorPicker(false)}
        members={state.members.filter((m) => m.active && !designated.includes(m.id) && m.rank !== 'R4' && m.rank !== 'R5')}
        onPick={(o) => {
          setEditorPicker(false);
          if (actions.setDesignatedEditor(o.key, true).ok) toast({ kind: 'ok', text: `${membersById.get(o.key)?.username ?? o.key} can now edit Organize` });
        }}
        extraHint={(m) => m.rank}
      />

      <BottomSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add task"
        footer={
          <>
            <button type="button" className="btn ghost" onClick={() => setAddOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn primary"
              disabled={!newTitle.trim()}
              onClick={() => {
                if (actions.addTask(newTitle).ok) {
                  toast({ kind: 'ok', text: 'Task added' });
                  setNewTitle('');
                  setAddOpen(false);
                }
              }}
            >
              Add
            </button>
          </>
        }
      >
        <div className="field">
          <label htmlFor="new-task">Title</label>
          <input id="new-task" className="input" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="e.g. Alliance Duel" />
        </div>
      </BottomSheet>
    </>
  );
}

interface TaskCardProps {
  task: Responsibility;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  editable: boolean;
  onSlotTap: (ref: SlotRef, el: HTMLElement) => void;
  gripProps: (payload: DragPayload) => Record<string, unknown>;
  drag: { payload: DragPayload; overTarget: string | null } | null;
  canDrop: (payload: DragPayload, targetKey: string) => boolean;
  flashing: Set<string>;
  tapMode: { source: SlotRef; kind: 'move' | 'swap' } | null;
  onMenu: () => void;
}

function TaskCard({ task, index, expanded, onToggle, editable, onSlotTap, gripProps, drag, canDrop, flashing, tapMode, onMenu }: TaskCardProps) {
  const { membersById } = useStore();
  const summary = task.slots
    .map((s) => slotDisplay(s, membersById))
    .filter(Boolean)
    .join(' · ');
  const lead = task.slots[0];
  return (
    <div className="card" style={{ animation: `row-in var(--m-move) var(--ease) both`, animationDelay: `calc(var(--m-stagger) * ${index})` }}>
      <div className="card-row">
        <button type="button" className="grow" style={{ textAlign: 'left', minHeight: 44 }} aria-expanded={expanded} onClick={onToggle}>
          <h3 className="wrap">{task.title}</h3>
          {!expanded && <div className="task-summary">{summary || 'Unassigned'}</div>}
          {!expanded && lead && slotDisplay(lead, membersById) && (
            <span className="chip" style={{ marginTop: 6, minHeight: 28 }}>
              Lead: {slotDisplay(lead, membersById)}
            </span>
          )}
        </button>
        {editable && (
          <button type="button" className="icon-btn" aria-label={`Task options for ${task.title}`} onClick={onMenu}>
            ⋯
          </button>
        )}
        <button type="button" className="icon-btn" aria-label={expanded ? 'Collapse' : 'Expand'} onClick={onToggle}>
          <ChevronDown style={{ transform: expanded ? 'rotate(180deg)' : undefined, transition: 'transform var(--m-press)' }} />
        </button>
      </div>
      {expanded && (
        <div className="slot-grid">
          {task.slots.map((s) => {
            const key = refKey({ taskId: task.id, position: s.position });
            const value = slotDisplay(s, membersById);
            const v = slotValue(s);
            const isSource = drag?.payload.taskId === task.id && drag.payload.position === s.position;
            const dropOk = drag && !isSource ? canDrop(drag.payload, key) : false;
            const over = drag?.overTarget === key;
            const invalidOver = drag?.overTarget === `invalid:${key}`;
            const isTapSource = tapMode && tapMode.source.taskId === task.id && tapMode.source.position === s.position;
            const cls = ['slot', s.position === 1 ? 'lead' : '', dropOk ? 'drop-target' : '', over ? 'drop-over' : '', invalidOver || (drag && !isSource && !dropOk) ? 'drop-invalid' : '', isSource ? 'dragging-source' : '', flashing.has(key) ? 'pulse chip' : ''].filter(Boolean).join(' ');
            return (
              <div key={s.position} className={cls} data-slot-key={key} style={{ padding: 0 }}>
                <button
                  type="button"
                  style={{ all: 'unset', display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 36px 8px 12px', minHeight: 72, width: '100%', boxSizing: 'border-box', cursor: editable ? 'pointer' : 'default' }}
                  disabled={!editable}
                  aria-label={`${s.label}: ${value || 'unassigned'}${tapMode ? ' (choose as destination)' : ''}`}
                  aria-pressed={!!isTapSource}
                  onClick={(e) => onSlotTap({ taskId: task.id, position: s.position }, e.currentTarget)}
                >
                  <span className="slot-label">{s.label}</span>
                  <span className={`slot-value${value ? '' : ' empty'}`}>
                    {value || (editable ? 'Tap to assign' : 'Unassigned')}
                    {v.kind === 'source' && (
                      <>
                        <br />
                        <span className="badge" title="Source spreadsheet label, not yet mapped">source label</span>
                      </>
                    )}
                    {v.kind === 'placeholder' && (
                      <>
                        <br />
                        <span className="badge">placeholder</span>
                      </>
                    )}
                  </span>
                </button>
                {editable && v.kind !== 'empty' && (
                  <span className="grip" role="button" tabIndex={-1} aria-hidden="true" title="Long-press to drag" {...gripProps({ taskId: task.id, position: s.position, label: value })}>
                    <GripIcon width={18} height={18} />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TaskMenuSheet({ taskId, onClose }: { taskId: string | null; onClose: () => void }) {
  const { state, actions } = useStore();
  const { toast } = useFeedback();
  const task = state.organization.responsibilities.find((r) => r.id === taskId);
  const [title, setTitle] = useState('');
  const [renaming, setRenaming] = useState(false);
  if (!task) return null;
  return (
    <BottomSheet open={!!taskId} onClose={() => { setRenaming(false); onClose(); }} title={task.title}>
      {renaming ? (
        <div className="list">
          <div className="field">
            <label htmlFor="rename">New title</label>
            <input id="rename" className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="card-row">
            <button type="button" className="btn ghost" style={{ flex: 1 }} onClick={() => setRenaming(false)}>
              Back
            </button>
            <button
              type="button"
              className="btn primary"
              style={{ flex: 1 }}
              disabled={!title.trim()}
              onClick={() => {
                if (actions.renameTask(task.id, title).ok) {
                  toast({ kind: 'ok', text: 'Renamed' });
                  setRenaming(false);
                  onClose();
                }
              }}
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <div className="list">
          <button type="button" className="sheet-item" onClick={() => { setTitle(task.title); setRenaming(true); }}>
            <div className="grow"><div className="label">Rename</div></div>
          </button>
          <button type="button" className="sheet-item" onClick={() => actions.reorderTask(task.id, -1)}>
            <div className="grow"><div className="label">Move up</div></div>
          </button>
          <button type="button" className="sheet-item" onClick={() => actions.reorderTask(task.id, 1)}>
            <div className="grow"><div className="label">Move down</div></div>
          </button>
          <button
            type="button"
            className="sheet-item"
            onClick={() => {
              if (actions.archiveTask(task.id, true).ok) {
                toast({ kind: 'ok', text: 'Task archived', action: { label: 'Undo', onClick: () => actions.archiveTask(task.id, false) } });
                onClose();
              }
            }}
          >
            <div className="grow">
              <div className="label">Archive</div>
              <div className="hint">Hidden from the list; assignments are kept.</div>
            </div>
          </button>
        </div>
      )}
    </BottomSheet>
  );
}
