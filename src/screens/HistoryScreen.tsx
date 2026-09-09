import { useMemo } from 'react';
import { attendanceSummary } from '../engine/lifecycle';
import { useFeedback } from '../motion';
import { useRouter } from '../store/router';
import { useStore } from '../store/store';
import { EmptyState, Header, StatusBadge } from '../ui/common';
import { ChevronRight } from '../ui/icons';

export function HistoryScreen({ eventId }: { eventId?: string }) {
  const { state, isLeader, actions, membersById, eventById } = useStore();
  const router = useRouter();
  const { toast } = useFeedback();
  const events = useMemo(() => [...state.events].sort((a, b) => (a.date < b.date ? 1 : -1)), [state.events]);
  const detail = eventId ? eventById(eventId) : undefined;

  if (detail) {
    const summary = attendanceSummary(detail);
    const played = Object.values(detail.attendance).filter((a) => a.outcome === 'played');
    return (
      <>
        <Header title={detail.date} back="/canyon/history" />
        <main className="page">
          <div className="card">
            <div className="card-row">
              <h2 className="grow">Canyon Clash {detail.date}</h2>
              <StatusBadge status={detail.status} />
            </div>
            <p className="faint">
              {detail.timezone ?? 'timezone not set'} · {detail.teams.map((t) => `${t.name} ${t.local_time}`).join(' · ')} · revision {detail.revision}
            </p>
          </div>
          <div className="card">
            <h3>Attendance summary</h3>
            <div className="stat-row">
              <div className="stat"><span className="value">{summary.played}</span><span className="label">played</span></div>
              <div className="stat"><span className="value">{summary.no_show}</span><span className="label">no-show</span></div>
              <div className="stat"><span className="value">{summary.withdrew}</span><span className="label">withdrew</span></div>
              <div className="stat"><span className="value">{summary.unused_reserve}</span><span className="label">unused reserve</span></div>
              <div className="stat"><span className="value">{summary.unknown}</span><span className="label">unknown</span></div>
            </div>
            {detail.status === 'finalized' && <p className="faint">Finalized {detail.finalized_at ? new Date(detail.finalized_at).toLocaleString() : ''}. Only played records count toward rotation.</p>}
            {(detail.status === 'published' || detail.status === 'finalized') && isLeader && (
              <button type="button" className="btn secondary" onClick={() => router.navigate(`/canyon/attendance/${detail.id}`)}>
                {detail.status === 'finalized' ? 'Correct attendance' : 'Record attendance'}
              </button>
            )}
          </div>
          {detail.published_revisions.length > 0 && (
            <div className="card">
              <h3>Published revisions</h3>
              {detail.published_revisions.map((r) => (
                <div key={r.revision} className="small muted">
                  Revision {r.revision} · {new Date(r.published_at).toLocaleString()} · {r.assignments.filter((a) => a.role === 'starter').length} starters
                </div>
              ))}
            </div>
          )}
          <div className="card">
            <h3>Played ({played.length})</h3>
            {played.length === 0 && <p className="faint">No played records.</p>}
            <div className="list">
              {played.map((a) => (
                <div key={a.member_id} className="small">
                  {membersById.get(a.member_id)?.username ?? a.member_id}
                  {a.substitute ? ' · substitute' : ''} · {detail.teams.find((t) => t.id === a.team_id)?.name ?? 'no team'}
                </div>
              ))}
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header title="Canyon history" back="/canyon" />
      <main className="page">
        {events.length === 0 && <EmptyState title="No events yet" />}
        <div className="list">
          {events.map((e, i) => {
            const s = attendanceSummary(e);
            return (
              <button key={e.id} type="button" className="row" style={{ ['--i' as string]: i }} onClick={() => router.navigate(e.status === 'finalized' || e.status === 'canceled' ? `/canyon/history/${e.id}` : `/canyon/${e.id}`)}>
                <div className="main">
                  <div className="name">{e.date}</div>
                  <div className="meta">
                    <span>{e.teams.map((t) => t.local_time).join(' / ')}</span>
                    {e.status === 'finalized' && <span>{s.played} played</span>}
                    {e.status !== 'finalized' && e.status !== 'canceled' && <span>{e.assignments.filter((a) => a.role === 'starter').length} starters</span>}
                  </div>
                </div>
                <StatusBadge status={e.status} />
                <ChevronRight className="chevron" />
              </button>
            );
          })}
        </div>
        {isLeader && (
          <button
            type="button"
            className="btn secondary"
            onClick={() => {
              const r = actions.createNextWeek();
              if (r.ok) toast({ kind: 'ok', text: 'Next Friday draft is ready' });
            }}
          >
            Create next week's draft
          </button>
        )}
        <p className="faint">Glory Wars participation from the source spreadsheet is never used as Canyon history. Tracking starts on import (September 9, 2026).</p>
      </main>
    </>
  );
}
