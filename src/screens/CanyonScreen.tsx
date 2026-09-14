import { useMemo, useState } from 'react';
import { useRouter } from '../store/router';
import { fmtPower, useStore } from '../store/store';
import { DemoBanner, EmptyState, EventTimes, Header, StatusBadge, StickyActions } from '../ui/common';
import { CalendarIcon, ChevronRight, HistoryIcon, UndoIcon } from '../ui/icons';
import { pastOpenEvents, previousEventWithAvailability, publishBlockers, starters, teamAveragePower, teamReserves, waitingList } from '../engine/lifecycle';
import { ConfirmSheet, OrbitSpinner, useFeedback, useSingleFlight } from '../motion';
import { BUNDLED_IMPORTS } from '../data/bundledImports';
import { Art } from '../ui/Art';
import { lineupText, shareOrCopy } from '../ui/lineupText';
import { APOCALYPSE_TIME_ZONE } from '../engine/recurrence';

function weekLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function CanyonScreen({ eventId }: { eventId?: string }) {
  const { state, currentEvent, today, eventById, isLeader, actions, canUndoAssignments, me, membersById } = useStore();
  const router = useRouter();
  const { toast, announce } = useFeedback();
  const event = eventId ? eventById(eventId) : currentEvent;
  const [confirmGenerate, setConfirmGenerate] = useState(false);
  const [needAvailability, setNeedAvailability] = useState(false);
  const [allLocked, setAllLocked] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [generate, busy] = useSingleFlight(async () => {
    if (!event) return;
    setGenerating(true);
    // Keep the orbital mark visible for at least one frame; no artificial delay beyond that.
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    const res = actions.generate(event.id);
    setGenerating(false);
    if (res.ok) {
      const kept = event.assignments.filter((a) => a.role === 'starter' && a.locked).length;
      toast({ kind: 'ok', text: kept ? `Suggestions generated · ${kept} locked starter${kept === 1 ? '' : 's'} kept` : 'Suggestions generated', action: { label: 'Undo', onClick: () => actions.undoAssignments(event.id) } });
      announce('Suggestions generated. Review the lineup.');
      router.navigate(`/canyon/review/${event.id}`);
    }
  });

  const copyLastWeek = async () => {
    if (!event) return;
    const r = actions.carryOverAvailability(event.id);
    if (r.ok) {
      toast({ kind: 'ok', text: `${r.count ?? 0} answer${r.count === 1 ? '' : 's'} copied from last week · members can still change theirs`, action: { label: 'Undo', onClick: () => actions.undoAssignments(event.id) } });
      announce(`${r.count ?? 0} availability answers copied.`);
    }
  };

  const copyForChat = async () => {
    if (!event) return;
    const result = await shareOrCopy(`Canyon Clash ${event.date}`, lineupText(event, membersById));
    if (result === 'copied') toast({ kind: 'ok', text: 'Lineup copied. Paste it in the alliance chat.' });
  };

  const confirmDate = () => {
    if (!event) return;
    const timezone = event.timezone ?? state.settings.timezone ?? APOCALYPSE_TIME_ZONE;
    const res = actions.updateSchedule(event.id, { timezone, date_confirmed: true });
    if (res.ok) {
      if (!state.settings.timezone) actions.updateSettings({ timezone });
      toast({ kind: 'ok', text: `Confirmed ${weekLabel(event.date)}` });
      announce('Event date confirmed.');
    }
  };

  const unlockAndRegenerate = async () => {
    if (!event) return;
    const r = actions.unlockAll(event.id);
    if (r.ok) {
      toast({ kind: 'ok', text: `${r.count ?? 0} lock${r.count === 1 ? '' : 's'} removed` });
      await generate();
    }
  };

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
  const capacity = event.teams.reduce((sum, t) => sum + t.capacity, 0);
  const lockedStarters = event.assignments.filter((a) => a.role === 'starter' && a.locked).length;
  const everythingLocked = lockedStarters >= capacity;
  const previousWithAnswers = previousEventWithAvailability(event, state.events);
  const nextWeek = state.events.filter((e) => e.date > event.date && (e.status === 'draft' || e.status === 'published')).sort((a, b) => (a.date < b.date ? -1 : 1))[0] ?? null;
  const reserveCount = waitingList(event).length;
  // Bundled team screen files for this date whose team has no starters yet.
  const pendingImports = BUNDLED_IMPORTS.filter((b) => b.event_date === event.date && event.teams[b.team - 1] && starters(event, event.teams[b.team - 1].id).length === 0);
  const otherOpen = state.events.filter((e) => e.id !== event.id && (e.status === 'draft' || e.status === 'published')).sort((a, b) => (a.date < b.date ? -1 : 1));
  const openCount = state.events.filter((e) => e.status === 'draft' || e.status === 'published').length;
  const isCurrent = currentEvent?.id === event.id;
  const isPast = event.date < today;
  // Earlier Fridays that were never finalized: still need attendance and a wrap-up.
  const pastOpen = pastOpenEvents(state.events, today).filter((e) => e.id !== event.id);

  return (
    <>
      <Header title="Canyon Clash" />
      <main className="page">
        <DemoBanner />
        <Art name="canyon-banner" alt="" className="art-banner" />
        <div className="card-row" style={{ alignItems: 'flex-start' }}>
          <div className="grow">
            <h1>Canyon Clash</h1>
            <p className="muted small">{isCurrent ? 'This week · every Friday · two teams of 20' : isPast ? `Week of ${event.date} · past week, not wrapped up yet` : `Week of ${event.date} · planning ahead`}</p>
          </div>
          <StatusBadge status={event.status} />
        </div>
        {!isCurrent && currentEvent && (
          <button type="button" className="link-btn" onClick={() => router.navigate(`/canyon/${currentEvent.id}`)}>
            ← Back to this week ({currentEvent.date})
          </button>
        )}

        <button type="button" className="card interactive" onClick={() => router.navigate(`/canyon/schedule/${event.id}`)} aria-label="Event time and timezone">
          <div className="card-row">
            <CalendarIcon className="chevron" style={{ color: 'var(--primary)' }} />
            <h3 className="grow">Event time</h3>
            <span className="small" style={{ color: 'var(--primary)', fontWeight: 600 }} aria-hidden="true">
              {isLeader ? 'Edit' : 'View'}
            </span>
            <ChevronRight className="chevron" />
          </div>
          <EventTimes event={event} dateChip={false} />
        </button>

        {isCurrent && isLeader && pastOpen.length > 0 && (
          <div className="callout warn" role="status">
            <span aria-hidden="true">📋</span>
            <span className="grow">
              {pastOpen.length === 1 ? `Last week (${pastOpen[0].date}) was never finalized.` : `${pastOpen.length} earlier weeks were never finalized.`} Record attendance and finalize so history stays right; the rotation already counts that lineup.
            </span>
            <button type="button" className="btn ghost small" onClick={() => router.navigate(pastOpen[0].status === 'published' ? `/canyon/attendance/${pastOpen[0].id}` : `/canyon/${pastOpen[0].id}`)}>
              Wrap up
            </button>
          </div>
        )}

        {(!event.timezone || !event.date_confirmed) && event.status !== 'finalized' && event.status !== 'canceled' && (
          <div className="callout warn" role="status">
            <span aria-hidden="true">⏱</span>
            <span className="grow">
              {isLeader
                ? `${weekLabel(event.date)} is not confirmed yet. One tap confirms the date${event.timezone ? '' : ' in game time'}; change it on the schedule page if the week is different.`
                : `The leaders have not confirmed ${weekLabel(event.date)} yet.`}
            </span>
            {isLeader && (
              <button type="button" className="btn primary small" style={{ flex: 'none', whiteSpace: 'nowrap' }} onClick={confirmDate}>
                Confirm date
              </button>
            )}
          </div>
        )}

        {isLeader && event.status !== 'finalized' && event.status !== 'canceled' && pendingImports.length > 0 && (
          <button type="button" className="card interactive" onClick={() => router.navigate(`/canyon/import/${event.id}`)} aria-label="Import the in-game lineup">
            <div className="card-row">
              <div className="grow">
                <h3>{pendingImports.length === 1 ? `${event.teams[pendingImports[0].team - 1]?.name ?? 'Team'} lineup from the game is ready to import` : 'Lineups from the game are ready to import'}</h3>
                <p className="muted small">
                  {pendingImports.map((b) => b.label).join(', ')}: starters and substitutes from the in-game screen, plus who is on the other team. Review, then import in one tap.
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
                  <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Art name={t.id.endsWith('team1') ? 'team-1-emblem' : 'team-2-emblem'} alt="" className="art-emblem" />
                    <span>
                      {t.name} <span className="muted" style={{ fontWeight: 500, fontSize: 16 }}>{t.local_time}</span>
                    </span>
                  </h2>
                  <div className="stat-row" style={{ marginTop: 8 }}>
                    <div className="stat">
                      <span className={`value${full ? ' complete' : ''}`}>
                        {count} / {t.capacity}
                      </span>
                      <span className="label">{full ? 'assigned · complete' : 'assigned'}</span>
                    </div>
                    <div className="stat">
                      <span className="value">{teamReserves(event, t.id).length}</span>
                      <span className="label">substitutes</span>
                    </div>
                    <div className="stat">
                      <span className="value">{fmtPower(teamAveragePower(event, state.members, t.id))}</span>
                      <span className="label">avg arena power</span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="chevron" />
              </div>
            </button>
          );
        })}

        {hasStarters && (
          <button type="button" className="btn secondary block" onClick={() => void copyForChat()}>
            Copy lineup for chat
          </button>
        )}

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
          {isLeader && responses.total === 0 && previousWithAnswers && event.status !== 'finalized' && event.status !== 'canceled' && (
            <button type="button" className="btn secondary block" onClick={() => void copyLastWeek()}>
              Copy answers from {previousWithAnswers.date}
            </button>
          )}
          {isLeader && (
            <button type="button" className="btn secondary block" onClick={() => router.navigate(`/canyon/collect/${event.id}`)}>
              Collect availability (1st / 2nd / can't per time)
            </button>
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

        <button type="button" className="card interactive" onClick={() => router.navigate(`/canyon/sheet/${event.id}`)}>
          <div className="card-row">
            <div className="grow">
              <h3>Roster sheet</h3>
              <p className="muted small">Joined? · Voted · Ready? · Starter · Sub for every member, the way the leaders track it.</p>
            </div>
            <ChevronRight className="chevron" />
          </div>
        </button>

        <button type="button" className="card interactive" onClick={() => router.navigate(`/canyon/roster/${event.id}?team=reserve`)}>
          <div className="card-row">
            <div className="grow">
              <h3>Waiting list</h3>
              <p className="muted small">{reserveCount === 0 ? 'Nobody waiting; each team lists its own substitutes' : `${reserveCount} available but on neither bench`}</p>
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

        <div className="card">
          <h3>Upcoming weeks</h3>
          <p className="muted small">Canyon Clash can be planned up to 4 Fridays ahead. Each week has its own times, availability and lineup.</p>
          {otherOpen.length > 0 && (
            <div className="list" style={{ gap: 4 }}>
              {otherOpen.map((e) => (
                <button key={e.id} type="button" className="row" style={{ animation: 'none' }} onClick={() => router.navigate(`/canyon/${e.id}`)}>
                  <div className="main">
                    <div className="name">{e.date}</div>
                    <div className="meta">
                      <span>{e.teams.map((t) => t.local_time).join(' / ')}</span>
                      <span>{Object.keys(e.availability).length} responses</span>
                      <span>{e.assignments.filter((a) => a.role === 'starter').length} starters</span>
                    </div>
                  </div>
                  <StatusBadge status={e.status} />
                  <ChevronRight className="chevron" />
                </button>
              ))}
            </div>
          )}
          {isLeader && openCount < 4 && (
            <button
              type="button"
              className="btn secondary block"
              onClick={() => {
                const r = actions.openUpcomingWeeks();
                if (r.ok) toast({ kind: 'ok', text: r.created ? `${r.created} new week${r.created === 1 ? '' : 's'} opened` : 'The next 4 Fridays are already open' });
              }}
            >
              Open the next 4 weeks
            </button>
          )}
          {isLeader && openCount >= 4 && <p className="faint">The next 4 Fridays are open. Another week opens automatically when one is finalized.</p>}
        </div>

        <button type="button" className="card interactive" onClick={() => router.navigate('/canyon/history')}>
          <div className="card-row">
            <HistoryIcon className="chevron" />
            <div className="grow">
              <h3>History</h3>
              <p className="muted small">{state.events.filter((e) => e.status === 'finalized').length} finalized</p>
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
          <button type="button" className="btn secondary" onClick={() => (eligible === 0 ? setNeedAvailability(true) : everythingLocked ? setAllLocked(true) : setConfirmGenerate(true))} disabled={busy}>
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
        {previousWithAnswers && responses.total === 0 && (
          <button type="button" className="btn secondary block" onClick={() => { setNeedAvailability(false); void copyLastWeek(); }}>
            Copy answers from {previousWithAnswers.date} instead
          </button>
        )}
      </ConfirmSheet>

      <ConfirmSheet
        open={allLocked}
        title="Every starter is locked"
        confirmLabel="Unlock all, keep lineup"
        onCancel={() => setAllLocked(false)}
        onConfirm={() => {
          setAllLocked(false);
          const r = actions.unlockAll(event.id);
          if (r.ok) toast({ kind: 'ok', text: `${r.count ?? 0} lock${r.count === 1 ? '' : 's'} removed · lineup kept, you can move players now`, action: { label: 'Undo', onClick: () => actions.undoAssignments(event.id) } });
        }}
      >
        <p className="small muted">
          {lockedStarters} of {capacity} starters are locked, so neither suggestions nor moves can change them. Unlocking keeps everyone where they are and lets you move, swap or regenerate. This week's starters and substitutes already count towards next week's fairness.
        </p>
        <button type="button" className="btn secondary block" onClick={() => { setAllLocked(false); void unlockAndRegenerate(); }}>
          Unlock all and regenerate
        </button>
        {nextWeek && (
          <button type="button" className="btn secondary block" onClick={() => { setAllLocked(false); router.navigate(`/canyon/${nextWeek.id}`); }}>
            Plan next week ({nextWeek.date}) instead
          </button>
        )}
        <p className="faint">Both options can be undone from the toast.</p>
      </ConfirmSheet>

      <ConfirmSheet open={confirmGenerate} title={hasStarters ? 'Regenerate the lineup?' : 'Generate suggestions?'} confirmLabel={hasStarters ? 'Regenerate' : 'Generate'} onCancel={() => setConfirmGenerate(false)} onConfirm={() => { setConfirmGenerate(false); void generate(); }}>
        {hasStarters && (
          <p className="small">
            This replaces the current lineup{event.assignments.some((a) => /in-game/.test(a.reason ?? '')) ? ', including the one imported from the game screen' : ''}. Locked players stay where they are. You can undo from the toast.
          </p>
        )}
        <p className="small muted">
          Ranks {eligible} available player{eligible === 1 ? '' : 's'} by fewest recent plays (last week's imported or published lineup counts), most weeks waited while available, longest since last played, then a saved tie-break. Fills both times jointly. Locks are kept.
        </p>
      </ConfirmSheet>
    </>
  );
}
