import { useMemo, useState } from 'react';
import type { AttendanceOutcome, TeamId } from '../domain/types';
import { attendanceRows, attendanceSummary } from '../engine/lifecycle';
import { ConfirmSheet, useFeedback, useFlash, useSingleFlight } from '../motion';
import { useRouter } from '../store/router';
import { useStore } from '../store/store';
import { useUiState } from '../store/ui';
import { Avatar, EmptyState, Header, MemberPickerSheet, StatusBadge, StickyActions } from '../ui/common';

const OUTCOMES: { key: AttendanceOutcome; label: string; short: string }[] = [
  { key: 'played', label: 'Played', short: 'Played' },
  { key: 'no_show', label: 'No-show', short: 'No-show' },
  { key: 'withdrew', label: 'Withdrew', short: 'Withdrew' },
  { key: 'unused_reserve', label: 'Unused reserve', short: 'Unused' },
  { key: 'unknown', label: 'Unknown', short: '?' },
];

export function AttendanceScreen({ eventId }: { eventId?: string }) {
  const { currentEvent, eventById, isLeader, actions, membersById, state } = useStore();
  const router = useRouter();
  const { toast, announce } = useFeedback();
  const event = eventId ? eventById(eventId) : currentEvent;
  const [tab, setTab] = useUiState<TeamId | 'reserve'>(`attendance.tab.${event?.id ?? ''}`, event?.teams[0]?.id ?? 'reserve');
  const [subOpen, setSubOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [flashing, flash] = useFlash();

  const rows = useMemo(() => (event ? attendanceRows(event) : []), [event]);
  const [finalize, busy] = useSingleFlight(async () => {
    if (!event) return;
    const res = actions.finalize(event.id);
    setConfirmOpen(false);
    if (res.ok) {
      toast({ kind: 'ok', text: 'Attendance finalized. History and next week updated.' });
      announce('Attendance finalized.');
      router.navigate(`/canyon/history/${event.id}`, { replace: true });
    }
  });

  if (!event) {
    return (
      <>
        <Header title="Attendance" back="/canyon" />
        <main className="page">
          <EmptyState title="No event" />
        </main>
      </>
    );
  }

  if (event.status === 'draft') {
    return (
      <>
        <Header title="Attendance" back={`/canyon/${event.id}`} />
        <main className="page">
          <EmptyState title="Publish the lineup first">Attendance is recorded against a published revision so selection and actual play stay separate.</EmptyState>
        </main>
      </>
    );
  }

  const summary = attendanceSummary(event);
  const visible = rows.filter((r) => (tab === 'reserve' ? r.substitute || r.team_id === null : r.team_id === tab && !r.substitute) || (tab !== 'reserve' && r.substitute && r.team_id === tab));
  const finalized = event.status === 'finalized';
  const canEdit = isLeader;
  const teamName = (id: TeamId | null) => event.teams.find((t) => t.id === id)?.name ?? 'No team';

  const set = (memberId: string, outcome: AttendanceOutcome, teamId?: TeamId | null, substitute?: boolean) => {
    const res = actions.recordAttendance(event.id, memberId, outcome, { team_id: teamId, substitute });
    if (res.ok) {
      flash(memberId);
      announce(`${membersById.get(memberId)?.username}: ${OUTCOMES.find((o) => o.key === outcome)?.label}`);
    }
  };

  return (
    <>
      <Header title="Attendance" back={finalized ? `/canyon/history/${event.id}` : `/canyon/${event.id}`} />
      <main className="page">
        <div className="card">
          <div className="card-row">
            <div className="grow">
              <h2>{event.date}</h2>
              <p className="faint">Leader-confirmed outcomes. Default unknown. Only "Played" counts toward rotation; publishing never does.</p>
            </div>
            <StatusBadge status={event.status} />
          </div>
          <div className="stat-row">
            {OUTCOMES.map((o) => (
              <div key={o.key} className="stat">
                <span className="value" style={{ fontSize: 18 }}>{summary[o.key]}</span>
                <span className="label">{o.short}</span>
              </div>
            ))}
          </div>
          {finalized && <div className="callout ok small">Finalized. Corrections here are audited and recalculate history immediately.</div>}
        </div>

        <div className="segmented" role="tablist" aria-label="Team">
          {event.teams.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
              {t.name}
              <small>{t.local_time}</small>
            </button>
          ))}
          <button type="button" role="tab" aria-selected={tab === 'reserve'} onClick={() => setTab('reserve')}>
            Reserves
            <small>{rows.filter((r) => r.substitute && r.team_id === null).length}</small>
          </button>
        </div>

        {canEdit && (
          <div className="filter-row">
            <button
              type="button"
              className="chip tap"
              onClick={() => {
                const targets = visible.filter((r) => r.outcome === 'unknown');
                if (!targets.length) return;
                if (!window.confirm(`Mark ${targets.length} unknown player${targets.length === 1 ? '' : 's'} in this list as Played? Review the list first.`)) return;
                targets.forEach((r) => set(r.member_id, 'played', r.team_id, r.substitute));
              }}
            >
              Mark remaining as Played
            </button>
            <button type="button" className="chip tap" onClick={() => setSubOpen(true)}>
              + Add substitute who played
            </button>
          </div>
        )}

        <div className="list" role="list">
          {visible.map((r, i) => {
            const m = membersById.get(r.member_id);
            if (!m) return null;
            return (
              <div key={r.member_id} className={`row${flashing.has(r.member_id) ? ' highlight' : ''}`} role="listitem" style={{ ['--i' as string]: i, flexWrap: 'wrap' }}>
                <Avatar name={m.username} />
                <div className="main" style={{ flexBasis: '55%' }}>
                  <div className="name wrap">{m.username}</div>
                  <div className="meta">
                    <span>{r.substitute ? `Substitute · ${teamName(r.team_id)}` : teamName(r.team_id)}</span>
                    {r.confirmed_at && <span className="faint">by leader</span>}
                  </div>
                </div>
                <div className="filter-row" style={{ flexBasis: '100%' }} role="group" aria-label={`Outcome for ${m.username}`}>
                  {OUTCOMES.map((o) => (
                    <button key={o.key} type="button" className="chip tap" aria-pressed={r.outcome === o.key} disabled={!canEdit} onClick={() => set(r.member_id, o.key, r.team_id, r.substitute)}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          {visible.length === 0 && <EmptyState title="Nobody here">No players for this list.</EmptyState>}
        </div>
      </main>

      {canEdit && !finalized && (
        <StickyActions>
          <button type="button" className="btn primary" disabled={busy} onClick={() => setConfirmOpen(true)}>
            Finalize attendance
          </button>
        </StickyActions>
      )}

      <MemberPickerSheet
        open={subOpen}
        title="Substitute who played"
        onClose={() => setSubOpen(false)}
        members={state.members.filter((m) => m.active)}
        disabledMembers={new Map(rows.filter((r) => !r.substitute).map((r) => [r.member_id, 'already in lineup']))}
        onPick={(o) => {
          const teamId = tab === 'reserve' ? event.teams[0].id : tab;
          set(o.key, 'played', teamId, true);
          setSubOpen(false);
          toast({ kind: 'ok', text: `${o.label} recorded as played for ${teamName(teamId)}` });
        }}
      />

      <ConfirmSheet open={confirmOpen} title="Finalize attendance?" confirmLabel="Finalize" busy={busy} onCancel={() => setConfirmOpen(false)} onConfirm={() => void finalize()}>
        <div className="list">
          <div className="small">
            {OUTCOMES.map((o) => `${o.label}: ${summary[o.key]}`).join(' · ')}
          </div>
          {summary.unknown > 0 && <div className="callout warn small">{summary.unknown} unknown outcome{summary.unknown === 1 ? '' : 's'} will be excluded from scoring and shown as incomplete data. You can still correct them later.</div>}
          <div className="small muted">Finalizing is idempotent: counts are derived from records, so finalizing again never double counts. Next week's draft is created automatically.</div>
        </div>
      </ConfirmSheet>
    </>
  );
}
