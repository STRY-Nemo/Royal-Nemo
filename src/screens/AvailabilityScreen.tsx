import { useMemo, useState } from 'react';
import type { Member, SlotPriorities } from '../domain/types';
import { choiceFromSlots, describeAvailability } from '../engine/suggest';
import { currentSlots, SlotPicker } from '../ui/SlotPicker';
import { ConfirmSheet, useFeedback, useFlash } from '../motion';
import { useRouter } from '../store/router';
import { useStore } from '../store/store';
import { useUiState } from '../store/ui';
import { EmptyState, EventTimes, Header, MemberPickerSheet, StatusBadge } from '../ui/common';

export function AvailabilityScreen({ eventId }: { eventId?: string }) {
  const { currentEvent, eventById, me, isLeader, actions, state } = useStore();
  const router = useRouter();
  const { toast, announce } = useFeedback();
  const event = eventId ? eventById(eventId) : currentEvent;
  const forAll = router.route.query.get('all') === '1';
  const [targetId, setTargetId] = useUiState<string | null>('availability.target', null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [flashing, flash] = useFlash();

  const target: Member | null = useMemo(() => {
    if (forAll && targetId) return state.members.find((m) => m.id === targetId) ?? null;
    if (forAll) return null;
    return me;
  }, [forAll, targetId, me, state.members]);

  if (!event) {
    return (
      <>
        <Header title="My availability" back="/canyon" />
        <main className="page">
          <EmptyState title="No event to respond to" />
        </main>
      </>
    );
  }

  const current = target ? event.availability[target.id] : undefined;
  const locked = event.status === 'finalized' || event.status === 'canceled';
  const missingCount = state.members.filter((m) => m.active && !event.availability[m.id]).length;
  const published = event.status === 'published';

  const choose = (slots: SlotPriorities) => {
    if (!target) return;
    const choice = choiceFromSlots(slots);
    const res = actions.setAvailability(event.id, target.id, choice, slots);
    if (res.ok) {
      flash('slots');
      const text = describeAvailability({ choice, slots }, event.teams);
      toast({ kind: 'ok', text: `Saved: ${text}${target.id !== me?.id ? ` for ${target.username}` : ''}` });
      announce(`Availability saved: ${text}`);
    }
  };

  const myAssignment = target ? event.assignments.find((a) => a.member_id === target.id) : undefined;

  return (
    <>
      <Header title={forAll ? 'Record availability' : 'My availability'} back="/canyon" />
      <main className="page">
        <div className="card">
          <div className="card-row">
            <div className="grow">
              <EventTimes event={event} />
            </div>
            <StatusBadge status={event.status} />
          </div>
        </div>

        {forAll && (
          <div className="card">
            <h3>Member</h3>
            <p className="faint">Recorded on their behalf, attributed to you.</p>
            <button type="button" className="btn ghost block" onClick={() => setPickerOpen(true)}>
              {target ? target.username : 'Choose a member'}
            </button>
            <button type="button" className="btn secondary block" onClick={() => router.navigate(`/canyon/collect/${event.id}`)}>
              Quick entry for everyone
            </button>
            {isLeader && !locked && (
              <>
                <div className="divider" />
                <p className="small muted">
                  {missingCount === 0 ? 'Every active member has responded.' : `${missingCount} active member${missingCount === 1 ? ' has' : 's have'} not responded yet.`}
                </p>
                <button type="button" className="btn secondary block" disabled={missingCount === 0} onClick={() => setBulkOpen(true)}>
                  Mark everyone without a response as Either
                </button>
              </>
            )}
          </div>
        )}

        {!target && !forAll && (
          <EmptyState title="Who are you?" action={<button type="button" className="btn primary" onClick={() => router.navigate('/settings')}>Choose in Settings</button>}>
            This demo has no login yet. Pick your member in Settings to record availability.
          </EmptyState>
        )}

        {target && (
          <>
            <div>
              <h2>{forAll ? `${target.username} is available for` : 'I am available for'}</h2>
              <p className="muted small">Choosing a time does not guarantee a slot. Rotation gives everyone fair turns over time.</p>
            </div>
            {locked && <div className="callout">This event is {event.status}. Availability can no longer change.</div>}
            {published && <div className="callout warn">The lineup is already published. Changing availability may remove {forAll ? 'this member' : 'you'} from a team and require a new revision.</div>}
            <div className={`card${flashing.has('slots') ? ' highlight' : ''}`}>
              <p className="small muted">For each time, pick <strong>1st</strong> (best for you), <strong>2nd</strong> (also works) or <strong>Can't</strong>. Saved on every tap.</p>
              <SlotPicker teams={event.teams} value={currentSlots(current)} onChange={choose} disabled={locked || (!isLeader && target.id !== me?.id)} />
              <p className="small" style={{ color: current ? 'var(--ok)' : 'var(--warn)', marginTop: 8 }}>
                {current ? `Saved: ${describeAvailability(current, event.teams)}` : 'No response yet — treated as unknown, not available.'}
              </p>
            </div>
            <p className="faint">
              {current ? `Last saved ${new Date(current.updated_at).toLocaleString()}${current.recorded_by !== 'self' ? ` by leader` : ''}` : 'Priorities matter: the rotation gives you your 1st choice whenever there is room.'}
            </p>

            {myAssignment && published && (
              <div className="card raised">
                <h3>Published assignment</h3>
                <p>
                  {myAssignment.role === 'starter' ? `${event.teams.find((t) => t.id === myAssignment.team_id)?.name} at ${event.teams.find((t) => t.id === myAssignment.team_id)?.local_time}` : myAssignment.team_id ? `${event.teams.find((t) => t.id === myAssignment.team_id)?.name} substitute (${event.teams.find((t) => t.id === myAssignment.team_id)?.local_time})` : 'Waiting list'}
                  {myAssignment.locked && ' · leader pick'}
                </p>
                {event.confirmations[target.id] ? (
                  <p className="small" style={{ color: 'var(--ok)' }}>
                    Confirmed for revision {event.confirmations[target.id].revision}
                  </p>
                ) : (
                  <button type="button" className="btn primary" onClick={() => actions.confirm(event.id, target.id).ok && toast({ kind: 'ok', text: 'Assignment confirmed' })}>
                    Confirm I'll be there
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </main>
      <ConfirmSheet
        open={bulkOpen}
        title="Mark everyone as Either?"
        confirmLabel={`Record for ${missingCount}`}
        onCancel={() => setBulkOpen(false)}
        onConfirm={() => {
          const res = actions.fillMissingAvailability(event.id, 'either');
          setBulkOpen(false);
          if (res.ok) {
            toast({ kind: 'ok', text: `Recorded Either for ${res.count ?? 0} member${res.count === 1 ? '' : 's'}` });
            announce(`Recorded availability for ${res.count ?? 0} members.`);
          }
        }}
      >
        <p className="small muted">
          Records "Either time" for the {missingCount} active member{missingCount === 1 ? '' : 's'} without a response, attributed to you. Existing responses are kept. Members can still change their own answer afterwards. Useful for trying the rotation; for a real week, ask members to answer themselves.
        </p>
      </ConfirmSheet>
      <MemberPickerSheet
        open={pickerOpen}
        title="Record availability for"
        onClose={() => setPickerOpen(false)}
        onPick={(o) => {
          setTargetId(o.key);
          setPickerOpen(false);
        }}
        selectedMemberId={targetId}
        extraHint={(m) => (event.availability[m.id] ? describeAvailability(event.availability[m.id], event.teams) : 'no response')}
      />
    </>
  );
}
