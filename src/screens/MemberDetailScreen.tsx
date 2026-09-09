import { useMemo, useState } from 'react';
import { finalStarters } from '../engine/history';
import { slotDisplay } from '../engine/organization';
import { SaveIndicator, useFeedback, type SaveState } from '../motion';
import { useRouter } from '../store/router';
import { fmtPower, useStore } from '../store/store';
import { Avatar, EmptyState, Header } from '../ui/common';

export function MemberDetailScreen({ memberId }: { memberId: string }) {
  const { membersById, history, state, isLeader, actions, finalizedEvents, currentEvent, me } = useStore();
  const router = useRouter();
  const { toast } = useFeedback();
  const member = membersById.get(memberId);
  const [note, setNote] = useState(member?.mechanical_notes ?? '');
  const [noteState, setNoteState] = useState<SaveState>('idle');

  const responsibilities = useMemo(
    () => state.organization.responsibilities.filter((r) => !r.archived && r.slots.some((s) => s.member_id === memberId)).map((r) => ({ title: r.title, label: r.slots.find((s) => s.member_id === memberId)?.label ?? '' })),
    [state.organization.responsibilities, memberId],
  );

  const recent = useMemo(
    () =>
      finalizedEvents.slice(0, 8).map((e) => {
        const att = e.attendance[memberId];
        const starter = finalStarters(e).some((a) => a.member_id === memberId);
        const available = e.availability[memberId] && e.availability[memberId].choice !== 'unavailable';
        const outcome = att?.outcome ?? (starter ? 'unknown' : available ? 'benched' : 'no response');
        return { date: e.date, outcome, starter };
      }),
    [finalizedEvents, memberId],
  );

  if (!member) {
    return (
      <>
        <Header title="Member" back="/members" />
        <main className="page">
          <EmptyState title="Member not found" />
        </main>
      </>
    );
  }
  const h = history[member.id];
  const currentAssignment = currentEvent?.assignments.find((a) => a.member_id === member.id);

  const saveNote = () => {
    setNoteState('saving');
    const res = actions.setMechanicalNote(member.id, note);
    setNoteState(res.ok ? 'saved' : 'failed');
    if (res.ok) toast({ kind: 'ok', text: 'Private note saved' });
    window.setTimeout(() => setNoteState('idle'), 1800);
  };

  return (
    <>
      <Header title={member.username} back="/members" />
      <main className="page">
        <div className="card">
          <div className="card-row">
            <Avatar name={member.username} />
            <div className="grow">
              <h2 className="wrap">{member.username}</h2>
              <div className="small muted">
                {member.rank} · Level {member.level} · origin {member.origin_alliance} · {member.id}
              </div>
            </div>
          </div>
          <div className="stat-row">
            <div className="stat">
              <span className="value">{fmtPower(member.arena_power_m)}</span>
              <span className="label">arena power · as of {member.power_as_of}</span>
            </div>
          </div>
          {!member.active && <div className="callout warn small">Inactive. History is retained; not eligible for selection.</div>}
        </div>

        <div className="card">
          <h3>Canyon participation</h3>
          <div className="stat-row">
            <div className="stat">
              <span className="value">{h?.played_count ?? 0}</span>
              <span className="label">recent plays (last {h?.events_in_window ?? 0})</span>
            </div>
            <div className="stat">
              <span className="value">{h?.eligible_benches ?? 0}</span>
              <span className="label">available but benched</span>
            </div>
            <div className="stat">
              <span className="value">{h?.lifetime_played ?? 0}</span>
              <span className="label">lifetime plays</span>
            </div>
          </div>
          <dl className="kv">
            <dt>Last played</dt>
            <dd>{h?.last_played_at ?? 'Never recorded'}</dd>
            <dt>Waiting since</dt>
            <dd>{h?.waiting_since ?? member.tracking_start}</dd>
            <dt>Tracking start</dt>
            <dd>{member.tracking_start}</dd>
            {currentEvent && (
              <>
                <dt>This week</dt>
                <dd>
                  {currentAssignment ? (currentAssignment.role === 'starter' ? `${currentEvent.teams.find((t) => t.id === currentAssignment.team_id)?.name}${currentAssignment.locked ? ' (locked)' : ''}` : currentAssignment.team_id ? `${currentEvent.teams.find((t) => t.id === currentAssignment.team_id)?.name} substitute` : 'Waiting list') : currentEvent.availability[member.id] ? 'Available, not yet assigned' : 'No response'}
                </dd>
              </>
            )}
          </dl>
          {h?.history_incomplete && <p className="faint">History incomplete: fewer than 8 finalized events since tracking start. Pre-import history is unknown and Glory Wars data is never used.</p>}
          {h && (h.no_show_count > 0 || h.withdrew_count > 0) && isLeader && (
            <div className="callout warn small">
              Reliability note (leader judgment only): {h.no_show_count} no-show{h.no_show_count === 1 ? '' : 's'}, {h.withdrew_count} withdrawal{h.withdrew_count === 1 ? '' : 's'} in the window. No-shows are not penalized automatically.
            </div>
          )}
        </div>

        {recent.length > 0 && (
          <div className="card">
            <h3>Recent events</h3>
            <dl className="kv">
              {recent.map((r) => (
                <div key={r.date} style={{ display: 'contents' }}>
                  <dt>{r.date}</dt>
                  <dd>{r.outcome.replace('_', ' ')}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        <div className="card">
          <h3>Responsibilities</h3>
          {responsibilities.length === 0 ? (
            <p className="faint">None mapped to this member yet. Source spreadsheet labels appear on the Organize page until mapped.</p>
          ) : (
            <div className="list">
              {responsibilities.map((r) => (
                <div key={r.title} className="small">
                  <strong>{r.title}</strong> · {r.label}
                </div>
              ))}
            </div>
          )}
          <button type="button" className="link-btn" style={{ padding: 0 }} onClick={() => router.navigate('/organize')}>
            Open Organize
          </button>
        </div>

        {isLeader && (
          <div className="card">
            <div className="card-row">
              <h3 className="grow">Private mechanical notes</h3>
              <SaveIndicator state={noteState} />
            </div>
            <p className="faint">Leader-only. Never shown to members, never used by the rotation engine.</p>
            <textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. strong shot caller, reliable at 23:00" aria-label="Mechanical notes" />
            <div className="card-row">
              <button type="button" className="btn primary" style={{ flex: 1 }} disabled={note === (member.mechanical_notes ?? '')} onClick={saveNote}>
                Save note
              </button>
              <button type="button" className="btn ghost" onClick={() => actions.setMemberActive(member.id, !member.active)}>
                {member.active ? 'Mark inactive' : 'Mark active'}
              </button>
            </div>
          </div>
        )}

        {me?.id === member.id && currentEvent && (
          <button type="button" className="btn secondary" onClick={() => router.navigate(`/canyon/availability/${currentEvent.id}`)}>
            Set my availability
          </button>
        )}
        <p className="faint">Current responsibilities: {state.organization.responsibilities.filter((r) => r.slots.some((s) => s.member_id === member.id)).map((r) => `${r.title} (${slotDisplay(r.slots.find((s) => s.member_id === member.id)!, membersById)})`).join(', ') || 'none'}.</p>
      </main>
    </>
  );
}
