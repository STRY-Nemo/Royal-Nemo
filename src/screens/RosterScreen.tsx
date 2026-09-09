import { useMemo, useState } from 'react';
import type { Assignment, CanyonEvent, Member, MemberId, TeamId } from '../domain/types';
import { reserves, starters, teamPower } from '../engine/lifecycle';
import { allowedTeamIds, describeChoice } from '../engine/suggest';
import { BottomSheet, ConfirmSheet, useFeedback, useFlash } from '../motion';
import { useRouter } from '../store/router';
import { fmtPower, useStore } from '../store/store';
import { useUiState } from '../store/ui';
import { Avatar, EmptyState, Header, MemberPickerSheet, SearchInput, StatusBadge, StickyActions, matchesSearch } from '../ui/common';
import { ChevronDown, HistoryIcon, LockIcon, MoreIcon, SwapIcon, UndoIcon } from '../ui/icons';

type TabKey = TeamId | 'reserve';

export function RosterScreen({ eventId }: { eventId?: string }) {
  const { currentEvent, eventById, state, isLeader, actions, history, membersById, canUndoAssignments } = useStore();
  const router = useRouter();
  const { toast, announce } = useFeedback();
  const event = eventId ? eventById(eventId) : currentEvent;
  const initialTab = (router.route.query.get('team') as TabKey | null) ?? event?.teams[0]?.id ?? 'reserve';
  const [tab, setTab] = useUiState<TabKey>(`roster.tab.${event?.id ?? 'none'}`, initialTab);
  const [query, setQuery] = useUiState(`roster.query.${event?.id ?? 'none'}`, '');
  const [expanded, setExpanded] = useUiState<string | null>(`roster.expanded.${event?.id ?? 'none'}`, null);
  const [actionFor, setActionFor] = useState<MemberId | null>(null);
  const [flashing, flash] = useFlash();

  if (!event) {
    return (
      <>
        <Header title="Roster" back="/canyon" />
        <main className="page">
          <EmptyState title="No event" />
        </main>
      </>
    );
  }

  const list: Assignment[] = tab === 'reserve' ? reserves(event) : starters(event, tab);
  const filtered = list.filter((a) => {
    const m = membersById.get(a.member_id);
    return m ? matchesSearch(m, query) : false;
  });
  const team = event.teams.find((t) => t.id === tab);
  const editable = isLeader && event.status !== 'finalized' && event.status !== 'canceled';

  return (
    <>
      <Header title="Canyon Clash" back="/canyon" />
      <main className="page">
        <div className="segmented" role="tablist" aria-label="Team">
          {event.teams.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
              {t.name}
              <small>{t.local_time}</small>
            </button>
          ))}
          <button type="button" role="tab" aria-selected={tab === 'reserve'} onClick={() => setTab('reserve')}>
            Reserves
            <small>{reserves(event).length}</small>
          </button>
        </div>

        <div className="card-row">
          <div className="grow">
            {team ? (
              <>
                <div className="card-row" style={{ gap: 8 }}>
                  <span className={`value${list.length === team.capacity ? ' complete' : ''}`} style={{ fontSize: 22, fontWeight: 800 }}>
                    {list.length} / {team.capacity}
                  </span>
                  <span className="muted">assigned</span>
                  {list.length === team.capacity && <span className="badge published">Complete</span>}
                </div>
                <div className="small muted">
                  Total arena power {fmtPower(teamPower(event, state.members, team.id))} · {Object.keys(event.confirmations).filter((id) => list.some((a) => a.member_id === id)).length} confirmed
                </div>
              </>
            ) : (
              <div className="small muted">Waiting players in rotation priority order. Reserves are not proof anyone played.</div>
            )}
          </div>
          <StatusBadge status={event.status} />
        </div>

        <SearchInput value={query} onChange={setQuery} placeholder="Find a player" />

        {list.length === 0 && (
          <EmptyState title={tab === 'reserve' ? 'No reserves yet' : 'No players assigned'} action={editable && !event.assignments.length ? <button type="button" className="btn primary" onClick={() => router.navigate(`/canyon/${event.id}`)}>Generate suggestions</button> : undefined}>
            {tab === 'reserve' ? 'Everyone available fit, or suggestions have not been generated.' : 'Generate suggestions or lock players from the reserves list.'}
          </EmptyState>
        )}

        <div className="list" role="list">
          {filtered.map((a, i) => {
            const m = membersById.get(a.member_id);
            if (!m) return null;
            const h = history[m.id];
            const open = expanded === m.id;
            return (
              <div key={m.id} role="listitem">
                <div className={`row${a.locked ? ' locked' : ''}${flashing.has(m.id) ? ' highlight' : ''}`} style={{ ['--i' as string]: i }}>
                  <span className="index">{String(i + 1).padStart(2, '0')}</span>
                  <Avatar name={m.username} />
                  <div className="main">
                    <div className="name wrap">
                      {m.username}
                      {a.locked && (
                        <span className="badge lock" style={{ marginLeft: 6 }}>
                          <LockIcon width={12} height={12} /> Locked
                        </span>
                      )}
                    </div>
                    <div className="meta">
                      <span className="mono">{fmtPower(m.arena_power_m)}</span>
                      <span>{h?.last_played_at ? `Last played ${h.last_played_at}` : 'Never recorded'}</span>
                      {event.status === 'published' && (
                        <span style={{ color: event.confirmations[m.id] ? 'var(--ok)' : 'var(--warn)' }}>{event.confirmations[m.id] ? 'Confirmed' : 'Pending'}</span>
                      )}
                    </div>
                  </div>
                  <div className="actions">
                    <button type="button" className="icon-btn" aria-expanded={open} aria-label={`${open ? 'Hide' : 'Show'} details for ${m.username}`} onClick={() => setExpanded(open ? null : m.id)}>
                      <ChevronDown style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform var(--m-press)' }} />
                    </button>
                    <button type="button" className="icon-btn" aria-label={`Actions for ${m.username}`} onClick={() => setActionFor(m.id)}>
                      <MoreIcon />
                    </button>
                  </div>
                </div>
                {open && (
                  <div className="row-details">
                    <div className="wrap">
                      <strong>Why:</strong> {a.reason}
                    </div>
                    {h?.history_incomplete && <div className="faint">History incomplete since tracking start {m.tracking_start}.</div>}
                    {event.availability[m.id] && <div className="faint">Available: {describeChoice(event.availability[m.id].choice, event.teams)}</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {editable && canUndoAssignments(event.id) && (
          <button type="button" className="btn ghost" onClick={() => actions.undoAssignments(event.id).ok && toast({ kind: 'ok', text: 'Undone' })}>
            <UndoIcon /> Undo last change
          </button>
        )}
      </main>

      {editable && (
        <StickyActions>
          <button type="button" className="btn primary" onClick={() => router.navigate(`/canyon/review/${event.id}`)}>
            {event.status === 'published' ? 'Review & republish' : 'Review & publish'}
          </button>
        </StickyActions>
      )}

      <PlayerActionSheet
        event={event}
        memberId={actionFor}
        onClose={() => setActionFor(null)}
        editable={editable}
        onChanged={(ids, message) => {
          ids.forEach(flash);
          announce(message);
        }}
      />
    </>
  );
}

// ---- Action sheet -----------------------------------------------------------

interface ActionProps {
  event: CanyonEvent;
  memberId: MemberId | null;
  onClose: () => void;
  editable: boolean;
  onChanged: (ids: MemberId[], message: string) => void;
}

type Mode = 'menu' | 'lock' | 'swap' | 'move';

export function PlayerActionSheet({ event, memberId, onClose, editable, onChanged }: ActionProps) {
  const { membersById, actions, history, state } = useStore();
  const router = useRouter();
  const { toast } = useFeedback();
  const [mode, setMode] = useState<Mode>('menu');
  const [reason, setReason] = useState('');
  const [lockTeam, setLockTeam] = useState<TeamId | null>(null);
  const [counterpart, setCounterpart] = useState<MemberId | null>(null);
  const [confirmSwap, setConfirmSwap] = useState(false);

  const member = memberId ? membersById.get(memberId) : undefined;
  const assignment = memberId ? event.assignments.find((a) => a.member_id === memberId) : undefined;
  const availability = memberId ? event.availability[memberId] : undefined;
  const allowed = availability ? allowedTeamIds(availability.choice, event.teams) : [];

  const close = () => {
    setMode('menu');
    setReason('');
    setLockTeam(null);
    setCounterpart(null);
    onClose();
  };

  const finish = (ok: boolean, text: string, ids: MemberId[]) => {
    if (ok) {
      toast({ kind: 'ok', text, action: { label: 'Undo', onClick: () => actions.undoAssignments(event.id) } });
      onChanged(ids, text);
      close();
    }
  };

  const swapCandidates: Map<MemberId, string> = useMemo(() => {
    const disabled = new Map<MemberId, string>();
    if (!assignment || !member) return disabled;
    for (const m of state.members) {
      if (m.id === member.id) {
        disabled.set(m.id, 'this player');
        continue;
      }
      const other = event.assignments.find((a) => a.member_id === m.id);
      if (!other) {
        disabled.set(m.id, 'not in lineup or reserves');
        continue;
      }
      const av = event.availability[m.id];
      const otherAllowed = av ? allowedTeamIds(av.choice, event.teams) : [];
      // The other player would move into this player's slot and vice versa.
      if (assignment.role === 'starter' && assignment.team_id && !otherAllowed.includes(assignment.team_id)) disabled.set(m.id, `not available for ${event.teams.find((t) => t.id === assignment.team_id)?.local_time}`);
      if (other.role === 'starter' && other.team_id && !allowed.includes(other.team_id)) disabled.set(m.id, `you are not available for ${event.teams.find((t) => t.id === other.team_id)?.local_time}`);
      if (other.role === 'reserve' && assignment.role === 'reserve') disabled.set(m.id, 'both are reserves');
    }
    return disabled;
  }, [assignment, member, state.members, event, allowed]);

  const swapPool = useMemo(() => state.members.filter((m) => event.assignments.some((a) => a.member_id === m.id)), [state.members, event.assignments]);

  if (!member) return null;
  const h = history[member.id];
  const teamOf = (a?: Assignment) => (a?.role === 'starter' ? event.teams.find((t) => t.id === a.team_id) : undefined);
  const counterpartAssignment = counterpart ? event.assignments.find((a) => a.member_id === counterpart) : undefined;

  return (
    <>
      <BottomSheet open={!!memberId && !confirmSwap} onClose={close} title={member.username}>
        <div className="card-row">
          <Avatar name={member.username} />
          <div className="grow">
            <div className="small muted">
              {assignment ? (assignment.role === 'starter' ? `Currently in ${teamOf(assignment)?.name}` : 'Currently a reserve') : 'Not in lineup'} · {fmtPower(member.arena_power_m)}
            </div>
            <div className="faint">{availability ? describeChoice(availability.choice, event.teams) : 'No availability response'}</div>
          </div>
        </div>
        {assignment && <div className="small wrap muted">{assignment.reason}</div>}

        {mode === 'menu' && (
          <div className="list">
            {editable && assignment?.role === 'starter' && !assignment.locked && (
              <button type="button" className="sheet-item" onClick={() => { setLockTeam(assignment.team_id); setMode('lock'); }}>
                <LockIcon />
                <div className="grow">
                  <div className="label">Lock in {teamOf(assignment)?.name}</div>
                  <div className="hint">Keeps this player through regeneration. Reason required.</div>
                </div>
              </button>
            )}
            {editable && assignment?.locked && (
              <button type="button" className="sheet-item" onClick={() => finish(actions.unlock(event.id, member.id).ok, `${member.username} unlocked`, [member.id])}>
                <LockIcon />
                <div className="grow">
                  <div className="label">Unlock</div>
                  <div className="hint">Locked: {assignment.lock_reason}</div>
                </div>
              </button>
            )}
            {editable && (!assignment || assignment.role === 'reserve') && allowed.length > 0 && (
              <button type="button" className="sheet-item" onClick={() => setMode('lock')}>
                <LockIcon />
                <div className="grow">
                  <div className="label">Lock into a team</div>
                  <div className="hint">Leader override with reason (e.g. shot caller). Never bypasses capacity or availability.</div>
                </div>
              </button>
            )}
            {editable && assignment && (
              <button type="button" className="sheet-item" onClick={() => setMode('swap')}>
                <SwapIcon />
                <div className="grow">
                  <div className="label">Swap with…</div>
                  <div className="hint">Exchange places with an eligible player. Preview before commit.</div>
                </div>
              </button>
            )}
            {editable && allowed.length > 0 && (
              <button type="button" className="sheet-item" onClick={() => setMode('move')}>
                <SwapIcon />
                <div className="grow">
                  <div className="label">Move to…</div>
                  <div className="hint">Reserves, or a team with an open slot.</div>
                </div>
              </button>
            )}
            <button type="button" className="sheet-item" onClick={() => { close(); router.navigate(`/members/${member.id}`); }}>
              <HistoryIcon />
              <div className="grow">
                <div className="label">View history</div>
                <div className="hint">
                  {h ? `${h.played_count} recent plays · waited ${h.eligible_benches}× · ${h.last_played_at ? `last ${h.last_played_at}` : 'never recorded'}` : 'No history'}
                </div>
              </div>
            </button>
          </div>
        )}

        {mode === 'lock' && (
          <div className="list">
            <div className="field">
              <label>Team</label>
              <div className="segmented" role="tablist">
                {event.teams.map((t) => (
                  <button key={t.id} type="button" role="tab" aria-selected={lockTeam === t.id} disabled={!allowed.includes(t.id)} onClick={() => setLockTeam(t.id)}>
                    {t.name}
                    <small>{allowed.includes(t.id) ? `${starters(event, t.id).length}/${t.capacity}` : 'unavailable'}</small>
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label htmlFor="lock-reason">Reason (required, leader-only)</label>
              <input id="lock-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. shot caller, strong objective play" maxLength={80} />
              <div className="filter-row">
                {['Shot caller', 'Strong objective play', 'Rally lead', 'Coordinator'].map((r) => (
                  <button key={r} type="button" className="chip" onClick={() => setReason(r)}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div className="sheet-footer" style={{ padding: 0, border: 'none' }}>
              <button type="button" className="btn ghost" onClick={() => setMode('menu')}>
                Back
              </button>
              <button
                type="button"
                className="btn primary"
                disabled={!lockTeam || !reason.trim()}
                onClick={() => lockTeam && finish(actions.lock(event.id, member.id, lockTeam, reason).ok, `${member.username} locked in ${event.teams.find((t) => t.id === lockTeam)?.name}`, [member.id])}
              >
                <LockIcon /> Lock
              </button>
            </div>
          </div>
        )}

        {mode === 'move' && (
          <div className="list">
            {event.teams.map((t) => {
              const count = starters(event, t.id).length;
              const here = assignment?.role === 'starter' && assignment.team_id === t.id;
              const full = count >= t.capacity;
              return (
                <button
                  key={t.id}
                  type="button"
                  className="sheet-item"
                  disabled={here || !allowed.includes(t.id) || full}
                  onClick={() => finish(actions.move(event.id, member.id, t.id).ok, `${member.username} moved to ${t.name}`, [member.id])}
                >
                  <div className="grow">
                    <div className="label">
                      {t.name} · {t.local_time}
                    </div>
                    <div className="hint">{here ? 'Already here' : !allowed.includes(t.id) ? 'Not available for this time' : full ? 'Full — use swap' : `${count}/${t.capacity} assigned`}</div>
                  </div>
                </button>
              );
            })}
            <button type="button" className="sheet-item" disabled={assignment?.role === 'reserve'} onClick={() => finish(actions.move(event.id, member.id, 'reserve').ok, `${member.username} moved to reserves`, [member.id])}>
              <div className="grow">
                <div className="label">Reserves</div>
                <div className="hint">Waits this week; keeps bench credit if available.</div>
              </div>
            </button>
            <button type="button" className="btn ghost" onClick={() => setMode('menu')}>
              Back
            </button>
          </div>
        )}
      </BottomSheet>

      {mode === 'swap' && !confirmSwap && (
        <MemberPickerSheet
          open
          title={`Swap ${member.username} with`}
          onClose={() => setMode('menu')}
          members={swapPool}
          disabledMembers={swapCandidates}
          extraHint={(m) => {
            const a = event.assignments.find((x) => x.member_id === m.id);
            return a ? (a.role === 'starter' ? teamOf(a)?.name : 'Reserve') : undefined;
          }}
          onPick={(o) => {
            setCounterpart(o.key);
            setConfirmSwap(true);
          }}
        />
      )}

      <ConfirmSheet
        open={confirmSwap}
        title="Confirm swap"
        confirmLabel="Swap"
        onCancel={() => {
          setConfirmSwap(false);
          setMode('menu');
        }}
        onConfirm={() => {
          if (!counterpart) return;
          const other = membersById.get(counterpart);
          const ok = actions.swap(event.id, member.id, counterpart).ok;
          setConfirmSwap(false);
          finish(ok, `Swapped ${member.username} and ${other?.username}`, [member.id, counterpart]);
        }}
      >
        {counterpart && counterpartAssignment && assignment && (
          <SwapPreview a={member} aFrom={assignment} b={membersById.get(counterpart)!} bFrom={counterpartAssignment} event={event} />
        )}
      </ConfirmSheet>
    </>
  );
}

function SwapPreview({ a, aFrom, b, bFrom, event }: { a: Member; aFrom: Assignment; b: Member; bFrom: Assignment; event: CanyonEvent }) {
  const { state } = useStore();
  const label = (x: Assignment) => (x.role === 'starter' ? `${event.teams.find((t) => t.id === x.team_id)?.name} (${event.teams.find((t) => t.id === x.team_id)?.local_time})` : 'Reserves');
  const powerAfter = (teamId: TeamId) => {
    let p = teamPower(event, state.members, teamId);
    if (aFrom.role === 'starter' && aFrom.team_id === teamId) p -= a.arena_power_m;
    if (bFrom.role === 'starter' && bFrom.team_id === teamId) p -= b.arena_power_m;
    if (bFrom.role === 'starter' && bFrom.team_id === teamId) p += a.arena_power_m;
    if (aFrom.role === 'starter' && aFrom.team_id === teamId) p += b.arena_power_m;
    return Math.round(p * 10) / 10;
  };
  return (
    <div className="list">
      <div className="row" style={{ animation: 'none' }}>
        <div className="main">
          <div className="name">{a.username}</div>
          <div className="meta">
            {label(aFrom)} → {label(bFrom)}
          </div>
        </div>
      </div>
      <div className="row" style={{ animation: 'none' }}>
        <div className="main">
          <div className="name">{b.username}</div>
          <div className="meta">
            {label(bFrom)} → {label(aFrom)}
          </div>
        </div>
      </div>
      <div className="small muted">
        Power after swap: {event.teams.map((t) => `${t.name} ${fmtPower(powerAfter(t.id))}`).join(' · ')}
      </div>
    </div>
  );
}
