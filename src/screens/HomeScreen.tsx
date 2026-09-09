import { useMemo } from 'react';
import { useRouter } from '../store/router';
import { useStore } from '../store/store';
import { DemoBanner, EmptyState, EventTimes, Header, StatusBadge } from '../ui/common';
import { ChevronRight } from '../ui/icons';
import { starters } from '../engine/lifecycle';
import { describeChoice } from '../engine/suggest';

export function HomeScreen() {
  const { state, currentEvent, me, isLeader, finalizedEvents, history } = useStore();
  const router = useRouter();
  const event = currentEvent;
  const myAvailability = event && me ? event.availability[me.id] : undefined;
  const myAssignment = event && me ? event.assignments.find((a) => a.member_id === me.id) : undefined;
  const responses = event ? Object.keys(event.availability).length : 0;
  const unassignedTasks = useMemo(() => state.organization.responsibilities.filter((r) => !r.archived && r.slots.every((s) => !s.member_id && !s.source_name)).length, [state.organization]);
  const myHistory = me ? history[me.id] : null;

  return (
    <>
      <Header />
      <main className="page">
        <DemoBanner />
        <div>
          <h1>Welcome{me ? `, ${me.username}` : ''}</h1>
          <p className="muted small">
            {isLeader ? 'Leader view' : 'Member view'} · {state.members.filter((m) => m.active).length} active members
          </p>
        </div>

        {event ? (
          <button type="button" className="card interactive" onClick={() => router.navigate('/canyon')}>
            <div className="card-row">
              <div className="grow">
                <div className="card-row" style={{ gap: 8 }}>
                  <h2>Canyon Clash</h2>
                  <StatusBadge status={event.status} />
                </div>
              </div>
              <ChevronRight className="chevron" />
            </div>
            <EventTimes event={event} compact />
            <div className="stat-row">
              {event.teams.map((t) => (
                <div key={t.id} className="stat">
                  <span className={`value${starters(event, t.id).length === t.capacity ? ' complete' : ''}`}>
                    {starters(event, t.id).length}/{t.capacity}
                  </span>
                  <span className="label">
                    {t.name} · {t.local_time}
                  </span>
                </div>
              ))}
              <div className="stat">
                <span className="value">{responses}</span>
                <span className="label">responses</span>
              </div>
            </div>
          </button>
        ) : (
          <EmptyState title="No upcoming Canyon Clash" action={isLeader ? <button type="button" className="btn primary" onClick={() => router.navigate('/canyon')}>Open Canyon</button> : undefined}>
            A leader can create next week's draft from the Canyon tab.
          </EmptyState>
        )}

        {event && me && (
          <button type="button" className="card interactive" onClick={() => router.navigate(`/canyon/availability/${event.id}`)}>
            <div className="card-row">
              <div className="grow">
                <h3>My availability</h3>
                <p className="muted small">{myAvailability ? describeChoice(myAvailability.choice, event.teams) : 'Not set — tap to choose a time'}</p>
                {myAssignment && event.status === 'published' && (
                  <p className="small" style={{ color: 'var(--ok)' }}>
                    Published: {myAssignment.role === 'starter' ? event.teams.find((t) => t.id === myAssignment.team_id)?.name : 'Reserve'}
                    {event.confirmations[me.id] ? ' · confirmed' : ' · tap to confirm'}
                  </p>
                )}
              </div>
              <ChevronRight className="chevron" />
            </div>
          </button>
        )}

        {event && !me && (
          <div className="callout warn">
            <span aria-hidden="true">👤</span>
            <span>
              No member is linked to this session. Open Settings to choose who you are (demo) so you can set availability.
            </span>
          </div>
        )}

        {myHistory && (
          <div className="card">
            <h3>My Canyon history</h3>
            <div className="stat-row">
              <div className="stat">
                <span className="value">{myHistory.played_count}</span>
                <span className="label">recent plays</span>
              </div>
              <div className="stat">
                <span className="value">{myHistory.eligible_benches}</span>
                <span className="label">waited while available</span>
              </div>
              <div className="stat">
                <span className="value" style={{ fontSize: 16 }}>{myHistory.last_played_at ?? 'Never recorded'}</span>
                <span className="label">last played</span>
              </div>
            </div>
            {myHistory.history_incomplete && <p className="faint">History is incomplete: tracking started {me?.tracking_start}.</p>}
          </div>
        )}

        <button type="button" className="card interactive" onClick={() => router.navigate('/organize')}>
          <div className="card-row">
            <div className="grow">
              <h3>Organization</h3>
              <p className="muted small">
                {state.organization.responsibilities.filter((r) => !r.archived).length} responsibilities · {unassignedTasks} unassigned
              </p>
            </div>
            <ChevronRight className="chevron" />
          </div>
        </button>

        <button type="button" className="card interactive" onClick={() => router.navigate('/canyon/history')}>
          <div className="card-row">
            <div className="grow">
              <h3>Past events</h3>
              <p className="muted small">{finalizedEvents.length === 0 ? 'No finalized Canyon events yet' : `${finalizedEvents.length} finalized event${finalizedEvents.length === 1 ? '' : 's'}`}</p>
            </div>
            <ChevronRight className="chevron" />
          </div>
        </button>
      </main>
    </>
  );
}
