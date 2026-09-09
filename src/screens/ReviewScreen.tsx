import { useMemo, useState } from 'react';
import type { TeamId } from '../domain/types';
import { publishBlockers, starters, suggest, teamAveragePower, teamReserves, waitingList } from '../engine/lifecycle';
import { ConfirmSheet, useFeedback, useSingleFlight } from '../motion';
import { useRouter } from '../store/router';
import { fmtPower, useStore } from '../store/store';
import { useUiState } from '../store/ui';
import { Avatar, EmptyState, EventTimes, Header, StatusBadge, StickyActions } from '../ui/common';
import { LockIcon, ShareIcon } from '../ui/icons';

export function ReviewScreen({ eventId }: { eventId?: string }) {
  const { currentEvent, eventById, state, isLeader, actions, membersById, history } = useStore();
  const router = useRouter();
  const { toast, burst, announce } = useFeedback();
  const event = eventId ? eventById(eventId) : currentEvent;
  const [view, setView] = useUiState<TeamId | 'waiting'>(`review.view.${event?.id ?? ''}`, event?.teams[0]?.id ?? 'waiting');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const analysis = useMemo(() => (event ? suggest(event, state.members, state.events) : null), [event, state.members, state.events]);

  const [publish, busy] = useSingleFlight(async () => {
    if (!event) return;
    const res = actions.publish(event.id);
    setConfirmOpen(false);
    if (res.ok) {
      burst();
      toast({ kind: 'ok', text: `Lineup published (revision ${event.revision + 1})` });
      announce('Lineup published.');
      router.navigate(`/canyon/${event.id}`, { replace: true });
    }
  });

  if (!event) {
    return (
      <>
        <Header title="Review" back="/canyon" />
        <main className="page">
          <EmptyState title="No event" />
        </main>
      </>
    );
  }

  const blockers = publishBlockers(event);
  const waiting = waitingList(event);
  const shownStarters = view === 'waiting' ? [] : starters(event, view);
  const shownSubs = view === 'waiting' ? [] : teamReserves(event, view);
  const incomplete = event.assignments.filter((a) => history[a.member_id]?.history_incomplete).length;
  const alreadyPublished = event.status === 'published';
  const changedSincePublish = alreadyPublished && JSON.stringify(event.assignments.map((a) => [a.member_id, a.team_id, a.role]).sort()) !== JSON.stringify((event.published_revisions.at(-1)?.assignments ?? []).map((a) => [a.member_id, a.team_id, a.role]).sort());

  const shareText = () => {
    const lines: string[] = [`Canyon Clash ${event.date}${event.timezone ? ` (${event.timezone})` : ''} — revision ${event.revision}`];
    for (const t of event.teams) {
      lines.push('', `${t.name} ${t.local_time}:`);
      starters(event, t.id).forEach((a, i) => lines.push(`${i + 1}. ${membersById.get(a.member_id)?.username ?? a.member_id}${a.locked ? ' (lock)' : ''}`));
      const subs = teamReserves(event, t.id);
      if (subs.length) {
        lines.push(`${t.name} substitutes:`);
        subs.forEach((a) => lines.push(`- ${membersById.get(a.member_id)?.username ?? a.member_id}`));
      }
    }
    if (waiting.length) {
      lines.push('', 'Waiting list:');
      waiting.forEach((a) => lines.push(`- ${membersById.get(a.member_id)?.username ?? a.member_id}`));
    }
    return lines.join('\n');
  };

  const share = async () => {
    const text = shareText();
    try {
      if (navigator.share) await navigator.share({ title: `Canyon Clash ${event.date}`, text });
      else {
        await navigator.clipboard.writeText(text);
        toast({ kind: 'ok', text: 'Lineup copied as text' });
      }
    } catch {
      /* user canceled share */
    }
  };

  return (
    <>
      <Header title="Suggestion review" back={`/canyon/${event.id}`} actions={<button type="button" className="icon-btn" aria-label="Share lineup as text" onClick={share}><ShareIcon /></button>} />
      <main className="page">
        <div className="card">
          <div className="card-row">
            <div className="grow">
              <EventTimes event={event} compact />
            </div>
            <StatusBadge status={event.status} />
          </div>
          <div className="stat-row">
            {event.teams.map((t) => (
              <div key={t.id} className="stat">
                <span className={`value${starters(event, t.id).length === t.capacity ? ' complete' : ''}`}>
                  {starters(event, t.id).length}/{t.capacity}
                </span>
                <span className="label">
                  {t.name} · avg {fmtPower(teamAveragePower(event, state.members, t.id))}
                </span>
              </div>
            ))}
            <div className="stat">
              <span className="value">{waiting.length}</span>
              <span className="label">waiting</span>
            </div>
          </div>
          {analysis?.warnings.map((w) => (
            <div key={w} className="callout warn small">
              <span aria-hidden="true">ⓘ</span>
              <span>{w}</span>
            </div>
          ))}
          <div className="faint">{incomplete > 0 ? `Tracking started ${state.members[0]?.tracking_start}. ` : ''}Arena power totals inform balance only and do not promise outcomes.</div>
        </div>

        {blockers.length > 0 && (
          <div className="callout danger">
            <span aria-hidden="true">⛔</span>
            <div className="list" style={{ gap: 4 }}>
              {blockers.map((b) => (
                <div key={b.code + b.message}>{b.message}</div>
              ))}
              {(blockers.some((b) => b.code === 'timezone' || b.code === 'date')) && (
                <button type="button" className="link-btn" style={{ padding: 0 }} onClick={() => router.navigate(`/canyon/schedule/${event.id}`)}>
                  Open schedule
                </button>
              )}
            </div>
          </div>
        )}

        {alreadyPublished && (
          <div className={`callout ${changedSincePublish ? 'warn' : 'ok'}`}>
            <span aria-hidden="true">{changedSincePublish ? '✎' : '✓'}</span>
            <span>{changedSincePublish ? `Changes since revision ${event.published_revisions.at(-1)?.revision}. Publishing creates a new revision; members must re-confirm.` : `Revision ${event.revision} is published and unchanged.`}</span>
          </div>
        )}

        <div className="segmented" role="tablist" aria-label="View">
          {event.teams.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={view === t.id} onClick={() => setView(t.id)}>
              {t.name}
              <small>{t.local_time}</small>
            </button>
          ))}
          <button type="button" role="tab" aria-selected={view === 'waiting'} onClick={() => setView('waiting')}>
            Waiting
            <small>{waiting.length}</small>
          </button>
        </div>

        <div className="list" role="list">
          {(view === 'waiting' ? waiting : [...shownStarters, ...shownSubs]).map((a, i) => {
            const isSub = view !== 'waiting' && a.role === 'reserve';
            const subIndex = i - shownStarters.length;
            const m = membersById.get(a.member_id);
            if (!m) return null;
            const h = history[m.id];
            return (
              <div key={m.id} className={`row${a.locked ? ' locked' : ''}`} role="listitem" style={{ ['--i' as string]: i, alignItems: 'flex-start' }}>
                <span className="index">{isSub ? `S${String(subIndex + 1).padStart(2, '0')}` : String(i + 1).padStart(2, '0')}</span>
                <Avatar name={m.username} />
                <div className="main">
                  <div className="name wrap">
                    {m.username}
                    {a.locked && (
                      <span className="badge lock" style={{ marginLeft: 6 }}>
                        <LockIcon width={12} height={12} /> Leader override
                      </span>
                    )}
                  </div>
                  <div className="meta">
                    {isSub && <span className="badge draft">Substitute</span>}
                    <span className="mono">{fmtPower(m.arena_power_m)}</span>
                    {h?.history_incomplete && <span style={{ color: 'var(--warn)' }}>incomplete history</span>}
                  </div>
                  <div className="small muted wrap">{a.reason}</div>
                </div>
              </div>
            );
          })}
          {view === 'waiting' && waiting.length === 0 && <EmptyState title="Nobody is waiting">Every available player is on a team or its bench.</EmptyState>}
          {view !== 'waiting' && shownStarters.length === 0 && <EmptyState title="No starters yet" />}
        </div>
      </main>

      {isLeader && event.status !== 'finalized' && event.status !== 'canceled' && (
        <StickyActions>
          <button type="button" className="btn ghost" onClick={() => router.navigate(`/canyon/roster/${event.id}`)}>
            Edit lineup
          </button>
          <button type="button" className="btn primary" disabled={blockers.length > 0 || busy || (alreadyPublished && !changedSincePublish)} onClick={() => setConfirmOpen(true)}>
            {alreadyPublished ? 'Publish new revision' : 'Publish lineup'}
          </button>
        </StickyActions>
      )}

      <ConfirmSheet open={confirmOpen} title={alreadyPublished ? 'Publish a new revision?' : 'Publish this lineup?'} confirmLabel="Publish" busy={busy} onCancel={() => setConfirmOpen(false)} onConfirm={() => void publish()}>
        <div className="list">
          <div className="small">
            {event.teams.map((t) => `${t.name} ${t.local_time}: ${starters(event, t.id).length}/${t.capacity} + ${teamReserves(event, t.id).length} subs`).join(' · ')} · {waiting.length} waiting
          </div>
          <div className="small muted">Members will see revision {event.revision + 1} and can confirm. Publishing records the selection; it does not count as anyone having played.</div>
        </div>
      </ConfirmSheet>
    </>
  );
}
