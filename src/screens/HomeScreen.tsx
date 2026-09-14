import { useMemo, useState } from 'react';
import { useRouter } from '../store/router';
import { useStore } from '../store/store';
import { DemoBanner, EmptyState, EventTimes, Header, StatusBadge } from '../ui/common';
import { ChevronRight } from '../ui/icons';
import { starters } from '../engine/lifecycle';
import { describeAvailability } from '../engine/suggest';
import { InstallHint } from '../ui/InstallHint';
import { quickFromSlots, quickOptions } from '../ui/quickAvailability';
import { currentSlots } from '../ui/SlotPicker';
import { useFeedback } from '../motion';
import { BearFeeder } from '../ui/Bear';
import { Art } from '../ui/Art';
import { PaletteIcon } from '../ui/icons';
import { ThemeSheet } from '../ui/ThemeSheet';

function weekLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/** Days between an ISO date and today (UTC arithmetic; fine for "is this stale"). */
function daysSince(iso: string, today: string): number {
  const [y1, m1, d1] = iso.split('-').map(Number);
  const [y2, m2, d2] = today.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}
export const POWER_STALE_DAYS = 14;

const LINK_HINT_KEY = 'stry-link-hint';

export function HomeScreen() {
  const { state, currentEvent, today, me, isLeader, finalizedEvents, history, mode } = useStore();
  const [linkHintHidden, setLinkHintHidden] = useState(() => {
    try {
      return localStorage.getItem(LINK_HINT_KEY) === 'hidden';
    } catch {
      return false;
    }
  });
  const upcoming = state.events.filter((e) => (e.status === 'draft' || e.status === 'published') && e.id !== currentEvent?.id && e.date >= today).sort((a, b) => (a.date < b.date ? -1 : 1));
  const router = useRouter();
  const event = currentEvent;
  const responses = event ? Object.keys(event.availability).length : 0;
  const unassignedTasks = useMemo(() => state.organization.responsibilities.filter((r) => !r.archived && r.slots.every((s) => !s.member_id && !s.source_name)).length, [state.organization]);
  const myHistory = me ? history[me.id] : null;

  const [themeOpen, setThemeOpen] = useState(false);

  return (
    <>
      <Header
        actions={
          <button type="button" className="icon-btn" aria-label="Change theme" onClick={() => setThemeOpen(true)}>
            <PaletteIcon />
          </button>
        }
      />
      <main className="page">
        <DemoBanner />
        <Art name="home-hero" alt="" className="art-banner" />
        <div>
          <h1>Welcome{me ? `, ${me.username}` : ''}</h1>
          <p className="muted small">
            {isLeader ? 'Leader view' : 'Member view'} · {state.members.filter((m) => m.active).length} active members
          </p>
        </div>

        <InstallHint />

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

        {event && me && <MyWeek event={event} me={me} today={today} />}

        <div className="card has-backdrop">
          <Art name="den-backdrop" alt="" className="art-backdrop" />
          <div className="card-row">
            <h3 className="grow">STRY Bear</h3>
            <button type="button" className="link-btn" onClick={() => router.navigate('/bear')}>
              Open the den →
            </button>
          </div>
          <div className="bear-row">
            <BearFeeder mascot={state.mascot} size={72} compact />
          </div>
        </div>

        {upcoming.length > 0 && (
          <div className="card">
            <h3>Upcoming weeks</h3>
            <p className="muted small">{me ? 'Set your availability early so leaders can plan ahead.' : 'Weeks already opened by the leaders.'}</p>
            <div className="list" style={{ gap: 4 }}>
              {upcoming.map((e) => {
                const mine = me ? e.availability[me.id] : undefined;
                return (
                  <button key={e.id} type="button" className="row" onClick={() => router.navigate(me ? `/canyon/availability/${e.id}` : `/canyon/${e.id}`)} style={{ animation: 'none' }}>
                    <div className="main">
                      <div className="name">{weekLabel(e.date)}</div>
                      <div className="meta">
                        <span>{e.teams.map((t) => t.local_time).join(' / ')}</span>
                        {me && <span style={{ color: mine ? 'var(--ok)' : 'var(--warn)' }}>{mine ? describeAvailability(mine, e.teams) : 'Availability not set'}</span>}
                      </div>
                    </div>
                    <StatusBadge status={e.status} />
                    <ChevronRight className="chevron" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {event && !me && !(isLeader && linkHintHidden) && (
          <div className="callout warn" role="note">
            <span aria-hidden="true">👤</span>
            <button type="button" className="grow" style={{ all: 'unset', cursor: 'pointer', flex: 1 }} onClick={() => router.navigate('/settings')}>
              {mode === 'api' ? 'Your account is not linked to a roster member yet. Tap to link it in Settings so you can set availability.' : 'No member is linked to this session. Tap to choose who you are in Settings so you can set availability.'}
            </button>
            {isLeader && (
              <button
                type="button"
                className="icon-btn"
                aria-label="Hide this hint"
                onClick={() => {
                  try {
                    localStorage.setItem(LINK_HINT_KEY, 'hidden');
                  } catch {
                    /* ignore */
                  }
                  setLinkHintHidden(true);
                }}
              >
                ✕
              </button>
            )}
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
      <ThemeSheet open={themeOpen} onClose={() => setThemeOpen(false)} />
    </>
  );
}

import type { CanyonEvent, Member } from '../domain/types';

/**
 * The member's whole week in one card: answer availability with a single tap,
 * see where they landed once the lineup is published, and confirm from here.
 */
function MyWeek({ event, me, today }: { event: CanyonEvent; me: Member; today: string }) {
  const { actions, isLeader } = useStore();
  const router = useRouter();
  const { toast, announce } = useFeedback();
  const av = event.availability[me.id];
  const slots = currentSlots(av);
  const quick = quickFromSlots(slots);
  const locked = event.status === 'finalized' || event.status === 'canceled';
  const published = event.status === 'published';
  const assignment = event.assignments.find((a) => a.member_id === me.id);
  const team = assignment?.team_id ? event.teams.find((t) => t.id === assignment.team_id) : undefined;
  const confirmed = !!event.confirmations[me.id];
  const staleDays = daysSince(me.power_as_of, today);

  const answer = (key: string) => {
    const opt = quickOptions(event.teams).find((o) => o.key === key);
    if (!opt) return;
    const res = actions.setAvailability(event.id, me.id, opt.choice, opt.slots);
    if (res.ok) {
      const text = describeAvailability({ choice: opt.choice, slots: opt.slots }, event.teams);
      toast({ kind: 'ok', text: `Saved: ${text}` });
      announce(`Availability saved: ${text}`);
    }
  };

  let status: string;
  if (published && assignment) {
    status = assignment.role === 'starter' && team ? `You start on ${team.name} at ${team.local_time}` : team ? `You are a ${team.name} substitute (${team.local_time})` : 'You are on the waiting list';
  } else if (published) status = av && av.choice !== 'unavailable' ? 'Not selected this week' : "You said you can't play this week";
  else status = av ? `You said: ${describeAvailability(av, event.teams)}` : 'Can you play this Friday?';

  return (
    <div className="card raised">
      <div className="card-row">
        <h3 className="grow">My week</h3>
        <button type="button" className="link-btn" onClick={() => router.navigate(`/canyon/availability/${event.id}`)}>
          {av ? 'Change' : '1st / 2nd choice…'}
        </button>
      </div>
      <p className={published && assignment?.role === 'starter' ? '' : 'muted small'} style={published && assignment?.role === 'starter' ? { fontWeight: 600 } : undefined}>
        {status}
      </p>
      {!locked && !published && (
        <div className="quick-avail" role="group" aria-label="My availability">
          {quickOptions(event.teams).map((o) => (
            <button key={o.key} type="button" className={o.key} aria-pressed={quick === o.key} onClick={() => answer(o.key)}>
              {o.label}
            </button>
          ))}
        </div>
      )}
      {published && assignment && assignment.role !== 'reserve' && (
        confirmed ? (
          <p className="small" style={{ color: 'var(--ok)' }}>✓ Confirmed for revision {event.confirmations[me.id].revision}</p>
        ) : (
          <button type="button" className="btn primary block" onClick={() => actions.confirm(event.id, me.id).ok && toast({ kind: 'ok', text: "Confirmed. See you there!" })}>
            Confirm I'll be there
          </button>
        )
      )}
      {published && assignment?.role === 'reserve' && !confirmed && (
        <button type="button" className="btn secondary block" onClick={() => actions.confirm(event.id, me.id).ok && toast({ kind: 'ok', text: 'Thanks, noted as available to step in.' })}>
          I can step in if needed
        </button>
      )}
      {staleDays > POWER_STALE_DAYS && (
        <button type="button" className="link-btn" onClick={() => router.navigate(`/members/${me.id}`)}>
          Your arena power was last updated {me.power_as_of} · tap to update
        </button>
      )}
      {isLeader && !av && <p className="faint">Leaders play too: answer here so the rotation counts you.</p>}
    </div>
  );
}
