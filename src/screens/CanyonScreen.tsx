import { useMemo, useState } from 'react';
import { useRouter } from '../store/router';
import { fmtPower, useStore } from '../store/store';
import { DemoBanner, EmptyState, EventTimes, Header, StatusBadge, StickyActions } from '../ui/common';
import { CalendarIcon, ChevronRight, HistoryIcon, UndoIcon } from '../ui/icons';
import { publishBlockers, reserves, starters, teamPower } from '../engine/lifecycle';
import { ConfirmSheet, OrbitSpinner, useFeedback, useSingleFlight } from '../motion';
import { BUNDLED_IMPORTS } from '../data/bundledImports';

export function CanyonScreen({ eventId }: { eventId?: string }) {
  const { state, currentEvent, eventById, isLeader, actions, canUndoAssignments, me } = useStore();
  const router = useRouter();
  const { toast, announce } = useFeedback();
  const event = eventId ? eventById(eventId) : currentEvent;
  const [confirmGenerate, setConfirmGenerate] = useState(false);
  const [needAvailability, setNeedAvailability] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [generate, busy] = useSingleFlight(async () => {
    if (!event) return;
    setGenerating(true);
    // Keep the orbital mark visible for at least one frame; no artificial delay beyond that.
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    const res = actions.generate(event.id);
    setGenerating(false);
    if (res.ok) {
      toast({ kind: 'ok', text: 'Suggestions generated', action: { label: 'Undo', onClick: () => actions.undoAssignments(event.id) } });
      announce('Suggestions generated. Review the lineup.');
      router.navigate(`/canyon/review/${event.id}`);
    }
  });

  const responses = useMemo(() => {
    if (!event) return { total: 0, team1: 0, team2: 0, either: 0, unavailable: 0 };
    const vals = Object.values(event.availability);
    return {
      total: vals.length,
      team1: vals.filter((a) => a.choice === 'team1').length,
      team2: vals.filter((a) => a.choice === 'team2').length,
      either: vals.filter((a) => a.choice === 'either').length,
      unavailable: vals.filter((a) => a.choice === 'unavailable').length,
    };
  }, [event]);

  if (!event) {
    return (
      <>
        <Header title="Canyon Clash" />
        <main className="page">
          <DemoBanner />
          <EmptyState
            title="No Canyon Clash scheduled"
            action={
              isLeader ? (
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => {
                    const r = actions.createNextWeek();
                    if (r.ok) toast({ kind: 'ok', text: 'Draft created for next Friday' });
                  }}
                >
                  Create next Friday's draft
                </button>
              ) : undefined
            }
          >
            Canyon Clash runs every Friday. A leader creates the weekly draft.
          </EmptyState>
        </main>
      </>
    );
  }

  const blockers = publishBlockers(event);
  const eligible = responses.total - responses.unavailable;
  const hasStarters = event.assignments.some((a) => a.role === 'starter');
  const reserveCount = reserves(event).length;
  const otherOpen = state.events.filter((e) => e.id !== event.id && (e.status === 'draft' || e.status === 'published'));

  return (
    <>
      <Header title="Canyon Clash" />
      <main className="page">
        <DemoBanner />
        <div className="card-row" style={{ alignItems: 'flex-start' }}>
          <div className="grow">
            <h1>Canyon Clash</h1>
            <p className="muted small">Every Friday · two teams of 20</p>
          </div>
          <StatusBadge status={event.status} />
        </div>

        <button type="button" className="card interactive" onClick={() => router.navigate(`/canyon/schedule/${event.id}`)} aria-label="Event time and timezone">
          <div className="card-row">
            <CalendarIcon className="chevron" style={{ color: 'var(--primary)' }} />
            <h3 className="grow">Event time</h3>
            <span className="small" style={{ color: 'var(--primary)', fontWeight: 600 }} aria-hidden="true">
              {isLeader ? 'Edit' : 'View'}
            </span>
            <ChevronRight className="chevron" />
          </div>
          <EventTimes event={event} />
        </button>

        {(!event.timezone || !event.date_confirmed) && (
          <div className="callout warn">
            <span aria-hidden="true">⏱</span>
            <span>
              {!event.timezone ? 'Set the event timezone' : 'Confirm the event date'} before publishing. Times are 18:00 and 23:00 in the event timezone.
            </span>
          </div>
        )}

        {isLeader && !hasStarters && event.status === 'draft' && BUNDLED_IMPORTS.some((b) => b.event_date === event.date) && (
          <button type="button" className="card interactive" onClick={() => router.navigate(`/canyon/import/${event.id}`)} aria-label="Import the in-game lineup">
            <div className="card-row">
              <div className="grow">
                <h3>Lineup from the game is ready to import</h3>
                <p className="muted small">
                  {BUNDLED_IMPORTS.filter((b) => b.event_date === event.date).map((b) => b.label).join(', ')}: starters and substitutes from the in-game screen, plus who is on the other team. Review, then import in one tap.
                </p>
              </div>
              <ChevronRight className="chevron" />
            </div>
          </button>
        )}

        {event.teams.map((t) => {
          const count = starters(event, t.id).length;
          const full = count === t.capacity;
          return (
            <button key={t.id} type="button" className="card interactive" onClick={() => router.navigate(`/canyon/roster/${event.id}?team=${t.id}`)}>
              <div className="card-row">
                <div className="grow">
                  <h2>
                    {t.name} <span className="muted" style={{ fontWeight: 500, fontSize: 16 }}>{t.local_time}</span>
                  </h2>
                  <div className="stat-row" style={{ marginTop: 8 }}>
                    <div className="stat">
                      <span className={`value${full ? ' complete' : ''}`}>
                        {count} / {t.capacity}
                      </span>
                      <span className="label">{full ? 'assigned · complete' : 'assigned'}</span>
                    </div>
                    <div className="stat">
                      <span className="value">{fmtPower(teamPower(event, state.members, t.id))}</span>
                      <span className="label">arena power</span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="chevron" />
              </div>
            </button>
          );
        })}

        <div className="card">
          <div className="card-row">
            <div className="grow">
              <h3>Availability</h3>
              <p className="muted small">
                {responses.total === 0 ? 'No responses yet. No response means unknown, not available.' : `${responses.total} responded · ${eligible} available`}
              </p>
            </div>
            {me && (
              <button type="button" className="btn secondary small" onClick={() => router.navigate(`/canyon/availability/${event.id}`)}>
                {event.availability[me.id] ? 'Change mine' : 'Set mine'}
              </button>
            )}
          </div>
          {responses.total > 0 && (
            <div className="row" style={{ animation: 'none' }}>
              <div className="stat">
                <span className="value">{responses.team1}</span>
                <span className="label">{event.teams[0].local_time} only</span>
              </div>
              <div className="stat">
                <span className="value">{responses.team2}</span>
                <span className="label">{event.teams[1].local_time} only</span>
              </div>
              <div className="stat">
                <span className="value">{responses.either}</span>
                <span className="label">either</span>
              </div>
              <div className="stat">
                <span className="value">{responses.unavailable}</span>
                <span className="label">unavailable</span>
              </div>
            </div>
          )}
          {isLeader && eligible === 0 && (
            <div className="callout warn small">
              <span aria-hidden="true">ⓘ</span>
              <span>Suggestions need availability first. Ask members to set theirs, or record it for them below (you can mark everyone as Either in one tap to try the rotation).</span>
            </div>
          )}
          {isLeader && (
            <button type="button" className="link-btn" onClick={() => router.navigate(`/canyon/availability/${event.id}?all=1`)}>
              Record availability for members
            </button>
          )}
          {isLeader && event.status !== 'finalized' && event.status !== 'canceled' && (
            <button type="button" className="link-btn" onClick={() => router.navigate(`/canyon/import/${event.id}`)}>
              Import the in-game team screen
            </button>
          )}
        </div>

        <button type="button" className="card interactive" onClick={() => router.navigate(`/canyon/roster/${event.id}?team=reserve`)}>
          <div className="card-row">
            <div className="grow">
              <h3>Reserves</h3>
              <p className="muted small">{reserveCount === 0 ? 'No reserves yet' : `${reserveCount} waiting`}</p>
            </div>
            <ChevronRight className="chevron" />
          </div>
        </button>

        {event.status === 'published' && (
          <button type="button" className="card interactive" onClick={() => router.navigate(`/canyon/attendance/${event.id}`)}>
            <div className="card-row">
              <div className="grow">
                <h3>Attendance</h3>
                <p className="muted small">Mark who actually played after the event. Revision {event.revision} published.</p>
              </div>
              <ChevronRight className="chevron" />
            </div>
          </button>
        )}

        <button type="button" className="card interactive" onClick={() => router.navigate('/canyon/history')}>
          <div className="card-row">
            <HistoryIcon className="chevron" />
            <div className="grow">
              <h3>History &amp; other weeks</h3>
              <p className="muted small">
                {otherOpen.length ? `${otherOpen.length} other open draft${otherOpen.length === 1 ? '' : 's'} · ` : ''}
                {state.events.filter((e) => e.status === 'finalized').length} finalized
              </p>
            </div>
            <ChevronRight className="chevron" />
          </div>
        </button>

        {isLeader && canUndoAssignments(event.id) && event.status !== 'finalized' && (
          <button type="button" className="btn ghost" onClick={() => actions.undoAssignments(event.id)}>
            <UndoIcon /> Undo last lineup change
          </button>
        )}
      </main>

      {isLeader && event.status !== 'finalized' && event.status !== 'canceled' && (
        <StickyActions>
          <button type="button" className="btn secondary" onClick={() => (eligible === 0 ? setNeedAvailability(true) : hasStarters ? generate() : setConfirmGenerate(true))} disabled={busy}>
            {generating ? <OrbitSpinner label="Computing" /> : hasStarters ? 'Regenerate' : 'Generate suggestions'}
          </button>
          <button type="button" className="btn primary" onClick={() => router.navigate(`/canyon/review/${event.id}`)} disabled={!hasStarters}>
            {event.status === 'published' ? 'Review lineup' : blockers.length ? 'Preview lineup' : 'Review & publish'}
          </button>
        </StickyActions>
      )}

      <ConfirmSheet
        open={needAvailability}
        title="Nobody is available yet"
        confirmLabel="Record availability"
        onCancel={() => setNeedAvailability(false)}
        onConfirm={() => {
          setNeedAvailability(false);
          router.navigate(`/canyon/availability/${event.id}?all=1`);
        }}
      >
        <p className="small muted">
          {responses.total === 0 ? 'No member has responded for this Friday, so there is nobody to place.' : `${responses.total} responded but all are unavailable.`} No response means unknown, not available. Members can set their own availability from Home, or you can record it for them, including everyone at once.
        </p>
      </ConfirmSheet>

      <ConfirmSheet open={confirmGenerate} title="Generate suggestions?" confirmLabel="Generate" onCancel={() => setConfirmGenerate(false)} onConfirm={() => { setConfirmGenerate(false); void generate(); }}>
        <p className="small muted">
          Ranks {eligible} available player{eligible === 1 ? '' : 's'} by fewest recent plays, most weeks waited while available, longest since last played, then a saved tie-break. Fills both times jointly. Locks are kept.
        </p>
      </ConfirmSheet>
    </>
  );
}
