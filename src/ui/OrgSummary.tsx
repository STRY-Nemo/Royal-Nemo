import { useMemo, useState } from 'react';
import type { Member, MemberId, OrganizationState } from '../domain/types';
import { slotDisplay, slotValue } from '../engine/organization';
import { useUiState } from '../store/ui';

type View = 'task' | 'person';

/** Dense overview of the whole responsibility board: by task (lead + helpers) or by person (their roles). */
export function OrgSummary({ organization, membersById, onTask }: { organization: OrganizationState; membersById: Map<MemberId, Member>; onTask?: (taskId: string) => void }) {
  const [view, setView] = useUiState<View>('organize.summary.view', 'task');
  const [open, setOpen] = useState(true);
  const tasks = useMemo(() => [...organization.responsibilities].filter((r) => !r.archived).sort((a, b) => a.order - b.order), [organization.responsibilities]);

  const byPerson = useMemo(() => {
    const map = new Map<string, { name: string; member: Member | null; leads: string[]; helps: string[] }>();
    for (const t of tasks) {
      for (const s of t.slots) {
        const v = slotValue(s);
        if (v.kind === 'empty' || v.kind === 'placeholder') continue;
        const key = s.member_id ?? `label:${s.source_name}`;
        const name = slotDisplay(s, membersById);
        const entry = map.get(key) ?? { name, member: s.member_id ? membersById.get(s.member_id) ?? null : null, leads: [], helps: [] };
        if (s.position === 1) entry.leads.push(t.title);
        else entry.helps.push(t.title);
        map.set(key, entry);
      }
    }
    return [...map.values()].sort((a, b) => b.leads.length + b.helps.length - (a.leads.length + a.helps.length) || a.name.localeCompare(b.name));
  }, [tasks, membersById]);

  const openSlots = tasks.reduce((n, t) => n + t.slots.filter((s) => slotValue(s).kind === 'empty' || slotValue(s).kind === 'placeholder').length, 0);
  const noLead = tasks.filter((t) => t.slots[0] && (slotValue(t.slots[0]).kind === 'empty' || slotValue(t.slots[0]).kind === 'placeholder')).length;

  return (
    <div className="card org-summary">
      <button type="button" className="card-row" style={{ width: '100%', textAlign: 'left', padding: 0 }} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <div className="grow">
          <h3>At a glance</h3>
          <p className="muted small">
            {tasks.length} tasks · {byPerson.length} people · {openSlots} open slot{openSlots === 1 ? '' : 's'}
            {noLead ? ` · ${noLead} without a lead` : ''}
          </p>
        </div>
        <span className="muted" aria-hidden="true">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <>
          <div className="segmented" role="tablist" aria-label="Summary view">
            <button type="button" role="tab" aria-selected={view === 'task'} onClick={() => setView('task')}>
              By task
            </button>
            <button type="button" role="tab" aria-selected={view === 'person'} onClick={() => setView('person')}>
              By person
            </button>
          </div>
          <div className="table-scroll">
            {view === 'task' ? (
              <table className="summary-table">
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Lead</th>
                    <th>Also</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((t) => {
                    const lead = t.slots.find((s) => s.position === 1);
                    const leadV = lead ? slotValue(lead) : null;
                    const leadName = lead && leadV && leadV.kind !== 'empty' ? slotDisplay(lead, membersById) : '';
                    const others = t.slots.filter((s) => s.position !== 1 && slotValue(s).kind !== 'empty').map((s) => slotDisplay(s, membersById));
                    return (
                      <tr key={t.id} onClick={() => onTask?.(t.id)} className={onTask ? 'tappable' : undefined}>
                        <td className="task">{t.title}</td>
                        <td className={leadName ? 'lead' : 'missing'}>{leadName || '—'}</td>
                        <td className="others">{others.length ? others.join(', ') : <span className="missing">—</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <table className="summary-table">
                <thead>
                  <tr>
                    <th>Person</th>
                    <th>Leads</th>
                    <th>Helps with</th>
                  </tr>
                </thead>
                <tbody>
                  {byPerson.map((p) => (
                    <tr key={p.name}>
                      <td className="task">
                        {p.name}
                        {p.member && <span className="faint"> {p.member.rank}</span>}
                        {!p.member && <span className="faint"> (unmapped)</span>}
                      </td>
                      <td className="lead">{p.leads.join(', ') || <span className="missing">—</span>}</td>
                      <td className="others">{p.helps.join(', ') || <span className="missing">—</span>}</td>
                    </tr>
                  ))}
                  {byPerson.length === 0 && (
                    <tr>
                      <td colSpan={3} className="missing">Nobody is assigned yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
          <p className="faint">Lead is slot 1 of each task. Tap a task row to jump to it.</p>
        </>
      )}
    </div>
  );
}
