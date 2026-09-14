import { useState } from 'react';
import { APOCALYPSE_TIME_ZONE, isValidTimeZone, nextFriday, weekday } from '../engine/recurrence';
import { TimeZoneChoice } from '../ui/TimeZoneChoice';
import { ConfirmSheet, useFeedback } from '../motion';
import { useRouter } from '../store/router';
import { useStore } from '../store/store';
import { EmptyState, EventTimes, Header, StatusBadge, StickyActions } from '../ui/common';

export function ScheduleScreen({ eventId }: { eventId?: string }) {
  const { currentEvent, eventById, isLeader, actions, state } = useStore();
  const router = useRouter();
  const { toast } = useFeedback();
  const event = eventId ? eventById(eventId) : currentEvent;
  const [date, setDate] = useState(event?.date ?? '');
  const [tz, setTz] = useState(event?.timezone ?? state.settings.timezone ?? APOCALYPSE_TIME_ZONE);
  const [customTz, setCustomTz] = useState('');
  const [t1, setT1] = useState(event?.teams[0]?.local_time ?? '18:00');
  const [t2, setT2] = useState(event?.teams[1]?.local_time ?? '23:00');
  const [confirmed, setConfirmed] = useState(event?.date_confirmed ?? false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  if (!event) {
    return (
      <>
        <Header title="Schedule" back="/canyon" />
        <main className="page">
          <EmptyState title="No event" />
        </main>
      </>
    );
  }

  const effectiveTz = tz === '__custom' ? customTz : tz;
  const tzValid = isValidTimeZone(effectiveTz);
  const isFriday = /^\d{4}-\d{2}-\d{2}$/.test(date) && weekday(date) === 5;
  const timesChanged = t1 !== event.teams[0].local_time || t2 !== event.teams[1].local_time;
  const dirty = date !== event.date || (effectiveTz || null) !== event.timezone || timesChanged || confirmed !== event.date_confirmed;
  const readOnly = !isLeader || event.status === 'finalized' || event.status === 'canceled';

  const save = () => {
    if (!isFriday) {
      toast({ kind: 'error', text: 'Canyon Clash must be on a Friday in the event timezone.' });
      return;
    }
    const res = actions.updateSchedule(event.id, {
      date: date !== event.date ? date : undefined,
      timezone: effectiveTz ? effectiveTz : null,
      date_confirmed: confirmed,
      team_times: timesChanged ? { team1: t1, team2: t2 } : undefined,
    });
    if (res.ok) {
      if (effectiveTz && tzValid && state.settings.timezone !== effectiveTz) actions.updateSettings({ timezone: effectiveTz });
      toast({ kind: 'ok', text: timesChanged ? 'Schedule saved. Availability must be re-confirmed for the new times.' : 'Schedule saved' });
      router.back('/canyon');
    }
  };

  return (
    <>
      <Header title="Event schedule" back="/canyon" />
      <main className="page">
        <div className="card">
          <div className="card-row">
            <div className="grow">
              <EventTimes event={event} />
            </div>
            <StatusBadge status={event.status} />
          </div>
        </div>

        <div className="card">
          <div className="field">
            <label htmlFor="ev-date">Date (Friday)</label>
            <input id="ev-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={readOnly} />
            {!isFriday && date && (
              <p className="small" style={{ color: 'var(--danger)' }}>
                Not a Friday. Next Friday would be {nextFriday(date, true)}.
              </p>
            )}
            <p className="faint">Canyon Clash is always on a Friday in the event timezone. The next week is created automatically.</p>
          </div>
          <label className="card-row" style={{ minHeight: 44 }}>
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} disabled={readOnly} style={{ width: 22, height: 22 }} />
            <span>I confirm this date</span>
          </label>
        </div>

        <div className="card">
          <div className="field">
            <label htmlFor="ev-tz">Event timezone</label>
            <TimeZoneChoice id="ev-tz" value={tz} customValue={customTz} onChange={setTz} onCustomChange={setCustomTz} disabled={readOnly} />
            {effectiveTz && !tzValid && (
              <p className="small" style={{ color: 'var(--danger)' }}>
                Unknown timezone name.
              </p>
            )}
            <p className="faint">Required before publishing. Game time is the Apocalypse clock (00:00 AT is 7 pm US Pacific). Members see their own local conversion automatically.</p>
          </div>
        </div>

        <div className="card">
          <h3>Team times (this week)</h3>
          <div className="choice-grid">
            <div className="field">
              <label htmlFor="t1">Team 1</label>
              <input id="t1" className="input" type="time" value={t1} onChange={(e) => setT1(e.target.value)} disabled={readOnly} />
            </div>
            <div className="field">
              <label htmlFor="t2">Team 2</label>
              <input id="t2" className="input" type="time" value={t2} onChange={(e) => setT2(e.target.value)} disabled={readOnly} />
            </div>
          </div>
          <p className="faint">18:00 and 23:00 are confirmed for this week only. Changing a time clears availability responses for this event so members can re-confirm. Other weeks are unaffected.</p>
          {isLeader && (
            <label className="card-row" style={{ minHeight: 44 }}>
              <input
                type="checkbox"
                checked={state.settings.default_team_times.team1 === t1 && state.settings.default_team_times.team2 === t2}
                onChange={(e) => e.target.checked && actions.updateSettings({ default_team_times: { team1: t1, team2: t2 } })}
                style={{ width: 22, height: 22 }}
              />
              <span className="small">Use these as defaults for future weeks</span>
            </label>
          )}
        </div>

        {isLeader && event.status !== 'finalized' && event.status !== 'canceled' && (
          <button type="button" className="btn danger" onClick={() => setCancelOpen(true)}>
            Cancel this week's event
          </button>
        )}
        {event.status === 'canceled' && <div className="callout danger">Canceled{event.note ? `: ${event.note}` : ''}. Canceled events do not affect rotation.</div>}
      </main>

      {!readOnly && (
        <StickyActions>
          <button type="button" className="btn primary" onClick={save} disabled={!dirty || !isFriday || (!!effectiveTz && !tzValid)}>
            Save schedule
          </button>
        </StickyActions>
      )}

      <ConfirmSheet
        open={cancelOpen}
        title="Cancel this week?"
        confirmLabel="Cancel event"
        danger
        onCancel={() => setCancelOpen(false)}
        onConfirm={() => {
          const res = actions.cancel(event.id, cancelReason || 'Canceled by leader');
          setCancelOpen(false);
          if (res.ok) {
            toast({ kind: 'ok', text: 'Event canceled' });
            router.navigate('/canyon', { replace: true });
          }
        }}
      >
        <p className="small muted">Only this Friday is canceled. Previous weeks and rotation history are not changed.</p>
        <div className="field">
          <label htmlFor="cancel-reason">Reason (optional)</label>
          <input id="cancel-reason" className="input" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
        </div>
      </ConfirmSheet>
    </>
  );
}
