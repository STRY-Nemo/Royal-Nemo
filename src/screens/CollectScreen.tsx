import { useMemo, useState } from 'react';
import type { SlotPriorities } from '../domain/types';
import { choiceFromSlots, describeAvailability } from '../engine/suggest';
import { ConfirmSheet, useFeedback } from '../motion';
import { useRouter } from '../store/router';
import { useStore } from '../store/store';
import { useUiState } from '../store/ui';
import { Avatar, EmptyState, EventTimes, Header, SearchInput, StatusBadge, matchesSearch } from '../ui/common';
import { ShareIcon } from '../ui/icons';
import { currentSlots, SlotPicker } from '../ui/SlotPicker';

type Filter = 'all' | 'missing' | 'answered';

/** Leader tool: every active member on one screen with 1st / 2nd / Can't per time slot. */
export function CollectScreen({ eventId }: { eventId?: string }) {
  const { currentEvent, eventById, isLeader, actions, state, me } = useStore();
  const router = useRouter();
  const { toast, announce } = useFeedback();
  const event = eventId ? eventById(eventId) : currentEvent;
  const [query, setQuery] = useUiState(`collect.query.${event?.id ?? ''}`, '');
  const [filter, setFilter] = useUiState<Filter>(`collect.filter.${event?.id ?? ''}`, 'all');
  const [bulkOpen, setBulkOpen] = useState(false);

  const members = useMemo(() => state.members.filter((m) => m.active).sort((a, b) => a.username.localeCompare(b.username)), [state.members]);

  if (!event) {
    return (
      <>
        <Header title="Collect availability" back="/canyon" />
        <main className="page">
          <EmptyState title="No event" />
        </main>
      </>
    );
  }
  if (!isLeader) {
    return (
      <>
        <Header title="Collect availability" back="/canyon" />
        <main className="page">
          <EmptyState title="Leaders only" action={<button type="button" className="btn primary" onClick={() => router.navigate(`/canyon/availability/${event.id}`)}>Set my availability</button>}>
            Members answer for themselves from Home or the Canyon tab.
          </EmptyState>
        </main>
      </>
    );
  }

  const locked = event.status === 'finalized' || event.status === 'canceled';
  const answered = members.filter((m) => event.availability[m.id]).length;
  const missing = members.length - answered;
  const visible = members.filter((m) => {
    if (!matchesSearch(m, query)) return false;
    const has = !!event.availability[m.id];
    return filter === 'all' || (filter === 'missing' ? !has : has);
  });

  const save = (memberId: string, username: string, slots: SlotPriorities) => {
    const res = actions.setAvailability(event.id, memberId, choiceFromSlots(slots), slots);
    if (res.ok) announce(`${username}: ${describeAvailability({ choice: choiceFromSlots(slots), slots }, event.teams)}`);
  };

  const share = async () => {
    const url = window.location.href.replace(/#.*$/, `#/canyon/availability/${event.id}`);
    const text = `Canyon Clash ${event.date}: tell us when you can play. Pick 1st / 2nd / Can't for ${event.teams.map((t) => t.local_time).join(' and ')} (Apocalypse Time) here: ${url}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Canyon Clash availability', text });
      else {
        await navigator.clipboard.writeText(text);
        toast({ kind: 'ok', text: 'Request copied — paste it in alliance chat' });
      }
    } catch {
      /* user canceled */
    }
  };

  return (
    <>
      <Header title="Collect availability" back={`/canyon/${event.id}`} actions={<button type="button" className="icon-btn" aria-label="Share the availability request" onClick={share}><ShareIcon /></button>} />
      <main className="page">
        <div className="card">
          <div className="card-row">
            <div className="grow">
              <EventTimes event={event} compact />
            </div>
            <StatusBadge status={event.status} />
          </div>
          <div className="stat-row">
            <div className="stat">
              <span className="value">{answered}</span>
              <span className="label">answered</span>
            </div>
            <div className="stat">
              <span className="value" style={{ color: missing ? 'var(--warn)' : 'var(--ok)' }}>{missing}</span>
              <span className="label">missing</span>
            </div>
          </div>
          <p className="faint">Tap 1st / 2nd / ✕ for each time. Saved instantly and attributed to you{me ? ` (${me.username})` : ''}; members can still change their own answer. Use the share icon to ask everyone to fill it in themselves.</p>
          {!locked && missing > 0 && (
            <button type="button" className="btn ghost block" onClick={() => setBulkOpen(true)}>
              Mark the {missing} without an answer as "either time"
            </button>
          )}
        </div>

        <SearchInput value={query} onChange={setQuery} placeholder="Find a member" />
        <div className="segmented" role="tablist" aria-label="Filter">
          {(['all', 'missing', 'answered'] as Filter[]).map((f) => (
            <button key={f} type="button" role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : f === 'missing' ? 'Missing' : 'Answered'}
              <small>{f === 'all' ? members.length : f === 'missing' ? missing : answered}</small>
            </button>
          ))}
        </div>

        <div className="list" role="list">
          {visible.map((m) => {
            const av = event.availability[m.id];
            return (
              <div key={m.id} className="collect-row" role="listitem">
                <div className="who">
                  <Avatar name={m.username} />
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="name">{m.username}</div>
                    <div className="small" style={{ color: av ? 'var(--ok)' : 'var(--warn)' }}>{av ? describeAvailability(av, event.teams) : 'No answer yet'}</div>
                  </div>
                </div>
                <SlotPicker compact teams={event.teams} value={currentSlots(av)} disabled={locked} onChange={(slots) => save(m.id, m.username, slots)} />
              </div>
            );
          })}
          {visible.length === 0 && <EmptyState title="Nobody matches" />}
        </div>
      </main>
      <ConfirmSheet
        open={bulkOpen}
        title="Mark everyone without an answer as either time?"
        confirmLabel={`Record for ${missing}`}
        onCancel={() => setBulkOpen(false)}
        onConfirm={() => {
          const res = actions.fillMissingAvailability(event.id, 'either');
          setBulkOpen(false);
          if (res.ok) toast({ kind: 'ok', text: `Recorded either time for ${res.count ?? 0} member${res.count === 1 ? '' : 's'}` });
        }}
      >
        <p className="small muted">Existing answers are kept. Members can still change their own answer afterwards.</p>
      </ConfirmSheet>
    </>
  );
}
