import { useMemo, useState } from 'react';
import type { TrackingEntryInput, TrackingJoined, TrackingReady } from '../domain/types';
import { JOINED_LABELS, READY_LABELS, SECTION_LABELS, planSheetImport, sheetCounts, sheetLineupRecords, sheetRows, sheetText, type SheetRow, type SheetSection } from '../engine/rosterSheet';
import { planLineupImport } from '../engine/lineupImport';
import { BUNDLED_SHEETS } from '../data/trackingSheets';
import { BottomSheet, ConfirmSheet, useFeedback, useFlash } from '../motion';
import { useRouter } from '../store/router';
import { useStore } from '../store/store';
import { useUiState } from '../store/ui';
import { Avatar, EmptyState, EventTimes, Header, SearchInput, StatusBadge, matchesSearch } from '../ui/common';
import { ShareIcon } from '../ui/icons';
import { shareOrCopy } from '../ui/lineupText';

type Filter = 'all' | SheetSection;
const SECTIONS: SheetSection[] = ['team1_starters', 'team1_subs', 'team2_starters', 'team2_subs', 'declined', 'ready', 'no_response'];
const JOINED: (TrackingJoined | null)[] = ['yes', 'mvp', 'other_alliance', 'no', null];
const READY: (TrackingReady | null)[] = ['ready', 'declined', 'offline', null];

/**
 * The leaders' roster sheet on a phone: every active member with Joined? · Voted ·
 * Ready? · Starter · Sub, grouped like the spreadsheet. Leaders tap a row to set
 * the tracking columns; members can read it.
 */
export function RosterSheetScreen({ eventId }: { eventId?: string }) {
  const { currentEvent, eventById, isLeader, actions, state, membersById } = useStore();
  const router = useRouter();
  const { toast, announce } = useFeedback();
  const event = eventId ? eventById(eventId) : currentEvent;
  const [query, setQuery] = useUiState(`sheet.query.${event?.id ?? ''}`, '');
  const [filter, setFilter] = useUiState<Filter>(`sheet.filter.${event?.id ?? ''}`, 'all');
  const [editing, setEditing] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [flashing, flash] = useFlash();

  const rows = useMemo(() => (event ? sheetRows(event, state.members) : []), [event, state.members]);
  const counts = useMemo(() => sheetCounts(rows), [rows]);
  // The latest bundled sheet can be applied to any week that is still open: exact date first, otherwise the newest.
  const bundled = useMemo(() => (event ? (BUNDLED_SHEETS.find((b) => b.event_date === event.date) ?? [...BUNDLED_SHEETS].sort((a, b) => (a.event_date < b.event_date ? 1 : -1))[0]) : undefined), [event]);
  const plan = useMemo(() => (event && bundled ? planSheetImport(event, state.members, bundled.rows) : null), [event, bundled, state.members]);
  const lineup = useMemo(() => (event && bundled ? sheetLineupRecords(bundled.rows, event.date) : null), [event, bundled]);
  const teamPlans = useMemo(() => {
    if (!event || !lineup) return null;
    const mapping = state.organization.name_mapping;
    return {
      team1: lineup.team1.length ? planLineupImport(event, lineup.team1, state.members, mapping) : null,
      team2: lineup.team2.length ? planLineupImport(event, lineup.team2, state.members, mapping) : null,
    };
  }, [event, lineup, state.members, state.organization.name_mapping]);

  if (!event) {
    return (
      <>
        <Header title="Roster sheet" back="/canyon" />
        <main className="page">
          <EmptyState title="No event" />
        </main>
      </>
    );
  }

  const locked = event.status === 'canceled';
  const canEdit = isLeader && !locked;
  const visible = rows.filter((r) => matchesSearch(r.member, query) && (filter === 'all' || r.section === filter));
  const editingRow = editing ? rows.find((r) => r.member.id === editing) : undefined;

  const save = (memberId: string, patch: Omit<TrackingEntryInput, 'member_id'>) => {
    const res = actions.setTracking(event.id, [{ member_id: memberId, ...patch }]);
    if (res.ok) {
      flash(memberId);
      announce(`${membersById.get(memberId)?.username} updated.`);
    }
  };

  const share = async () => {
    const result = await shareOrCopy(`Canyon Clash ${event.date} roster sheet`, sheetText(event, rows));
    if (result === 'copied') toast({ kind: 'ok', text: 'Sheet copied. Paste it into a spreadsheet or the chat.' });
  };

  const importSheet = () => {
    if (!plan || !lineup || !bundled) return;
    const res = actions.importSheet(event.id, { entries: plan.entries, team1: lineup.team1, team2: lineup.team2 }, bundled.label);
    setImportOpen(false);
    if (res.ok) {
      const t1 = teamPlans?.team1;
      const t2 = teamPlans?.team2;
      toast({ kind: 'ok', text: `Sheet imported · Team 1 ${t1?.starters.length ?? 0}+${t1?.reserves.length ?? 0} · Team 2 ${t2?.starters.length ?? 0}+${t2?.reserves.length ?? 0} · ${plan.entries.length} members tracked`, action: { label: 'Undo', onClick: () => actions.undoAssignments(event.id) } });
    }
  };

  // Rows that only carry a vote leave no tracking entry, so judge "already imported" by the rows that would.
  const trackingRows = plan?.entries.filter((e) => e.joined || e.ready || e.flag || e.note) ?? [];
  const alreadyImported = !!bundled && trackingRows.length > 0 && trackingRows.every((e) => event.tracking?.[e.member_id]) && counts.team1_starters + counts.team2_starters > 0;
  const importErrors = [...(teamPlans?.team1?.errors ?? []), ...(teamPlans?.team2?.errors ?? [])];
  const canImport = isLeader && !!bundled && !!plan && event.status !== 'finalized' && !locked && !alreadyImported;

  return (
    <>
      <Header title="Roster sheet" back={`/canyon/${event.id}`} actions={<button type="button" className="icon-btn" aria-label="Share the sheet as text" onClick={share}><ShareIcon /></button>} />
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
              <span className="value">{counts.team1_starters + counts.team2_starters}</span>
              <span className="label">starters</span>
            </div>
            <div className="stat">
              <span className="value">{counts.team1_subs + counts.team2_subs}</span>
              <span className="label">subs</span>
            </div>
            <div className="stat">
              <span className="value" style={{ color: 'var(--ok)' }}>{counts.joined}</span>
              <span className="label">joined</span>
            </div>
            <div className="stat">
              <span className="value" style={{ color: counts.no_response ? 'var(--warn)' : 'var(--ok)' }}>{counts.no_response}</span>
              <span className="label">no response</span>
            </div>
          </div>
          <p className="faint">
            Voted, Starter and Sub come from availability and the lineup. Joined? and Ready? are the leaders' tracking columns{canEdit ? ': tap a member to set them' : ''}. The share icon copies the whole sheet as tab-separated text.
          </p>
          {canImport && (
            <button type="button" className="btn secondary block" onClick={() => setImportOpen(true)}>
              {bundled!.event_date === event.date ? `Import ${bundled!.label}` : `Import the ${bundled!.event_date.slice(5)} sheet onto this week`}
            </button>
          )}
        </div>

        <div className="sticky-search">
          <SearchInput value={query} onChange={setQuery} placeholder="Find a member" />
        </div>
        <div className="filter-row" role="tablist" aria-label="Section">
          <button type="button" role="tab" className="chip tap" aria-selected={filter === 'all'} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
            All · {rows.length}
          </button>
          {SECTIONS.map((sec) => (
            <button key={sec} type="button" role="tab" className="chip tap" aria-selected={filter === sec} aria-pressed={filter === sec} onClick={() => setFilter(sec)}>
              {SECTION_LABELS[sec]} · {counts[sec]}
            </button>
          ))}
        </div>

        <div className="list dense" role="list" aria-label="Roster sheet">
          {visible.map((r, i) => {
            const prev = visible[i - 1];
            const heading = filter === 'all' && (!prev || prev.section !== r.section);
            return (
              <SheetRowItem key={r.member.id} row={r} heading={heading ? SECTION_LABELS[r.section] : null} canEdit={canEdit} flashing={flashing.has(r.member.id)} onOpen={() => { setNoteDraft(r.note ?? ''); setEditing(r.member.id); }} />
            );
          })}
          {visible.length === 0 && <EmptyState title="Nobody matches" />}
        </div>
      </main>

      {editingRow && (
        <BottomSheet open onClose={() => setEditing(null)} title={editingRow.member.username}>
          <div className="list">
            <div className="small muted">
              {SECTION_LABELS[editingRow.section]} · voted {editingRow.votedLabel}
              {editingRow.starter ? ` · starter ${editingRow.starter}` : editingRow.sub ? ` · sub ${editingRow.sub}` : ''}
            </div>
            <div className="field">
              <span className="label-text">Joined?</span>
              <div className="quick-avail five" role="group" aria-label="Joined">
                {JOINED.map((v) => (
                  <button key={v ?? 'clear'} type="button" className={v === 'no' ? 'none' : ''} aria-pressed={editingRow.joined === v} disabled={!canEdit} onClick={() => save(editingRow.member.id, { joined: v })}>
                    {v ? JOINED_LABELS[v] : 'Clear'}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <span className="label-text">Ready?</span>
              <div className="quick-avail" role="group" aria-label="Ready">
                {READY.map((v) => (
                  <button key={v ?? 'clear'} type="button" className={v === 'declined' ? 'none' : ''} aria-pressed={editingRow.ready === v} disabled={!canEdit} onClick={() => save(editingRow.member.id, { ready: v })}>
                    {v ? READY_LABELS[v] : 'Clear'}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <span className="label-text">Marker</span>
              <div className="quick-avail three" role="group" aria-label="Marker">
                {(['removed', 'added', null] as const).map((v) => (
                  <button key={v ?? 'clear'} type="button" aria-pressed={editingRow.flag === v} disabled={!canEdit} onClick={() => save(editingRow.member.id, { flag: v })}>
                    {v === 'removed' ? 'REMOVED' : v === 'added' ? 'ADDED' : 'None'}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label htmlFor="sheet-note">Note</label>
              <input id="sheet-note" className="input" value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder="e.g. Played for ICE" disabled={!canEdit} maxLength={200} />
              {canEdit && (
                <button type="button" className="btn secondary block" disabled={(editingRow.note ?? '') === noteDraft.trim()} onClick={() => save(editingRow.member.id, { note: noteDraft })}>
                  Save note
                </button>
              )}
            </div>
            <button type="button" className="link-btn" onClick={() => router.navigate(`/members/${editingRow.member.id}`)}>
              Open member
            </button>
          </div>
        </BottomSheet>
      )}

      <ConfirmSheet open={importOpen} title={bundled ? (bundled.event_date === event.date ? `Import ${bundled.label}?` : `Import the ${bundled.event_date} sheet onto ${event.date}?`) : 'Import'} confirmLabel="Import" busy={importErrors.length > 0} onCancel={() => setImportOpen(false)} onConfirm={importSheet}>
        {plan && bundled && teamPlans && (
          <div className="list">
            <p className="small muted">{bundled.source}.</p>
            <div className="small">
              <strong>Teams:</strong> Team 1 gets {teamPlans.team1?.starters.length ?? 0} starters and {teamPlans.team1?.reserves.length ?? 0} substitutes; Team 2 gets {teamPlans.team2?.starters.length ?? 0} starters and {teamPlans.team2?.reserves.length ?? 0} substitutes, exactly as the sheet places them.
              {(teamPlans.team1?.replaced ?? 0) + (teamPlans.team2?.replaced ?? 0) > 0 ? ` This replaces ${(teamPlans.team1?.replaced ?? 0) + (teamPlans.team2?.replaced ?? 0)} current assignment${(teamPlans.team1?.replaced ?? 0) + (teamPlans.team2?.replaced ?? 0) === 1 ? '' : 's'} (Undo is available afterwards).` : ' The lineup is empty now, so nothing is replaced.'}
            </div>
            <div className="small">
              <strong>Tracking:</strong> Joined? / Ready? / markers / notes for {plan.entries.length} members. Fills {plan.votesFilled} missing vote{plan.votesFilled === 1 ? '' : 's'}; answers members already gave are kept, and votes are widened where needed so every placed player is allowed on their team.
            </div>
            {plan.unmatched.length > 0 && <div className="small" style={{ color: 'var(--warn)' }}>Not in the roster, skipped: {plan.unmatched.join(', ')}</div>}
            {importErrors.length > 0 && <div className="small" style={{ color: 'var(--danger)' }}>Cannot import: {importErrors.join(' ')}</div>}
          </div>
        )}
      </ConfirmSheet>
    </>
  );
}

function SheetRowItem({ row, heading, canEdit, flashing, onOpen }: { row: SheetRow; heading: string | null; canEdit: boolean; flashing: boolean; onOpen: () => void }) {
  const leadership = row.rank === 'R4' || row.rank === 'R5';
  return (
    <>
      {heading && <div className="sheet-heading">{heading}</div>}
      <button type="button" className={`row sheet-row${flashing ? ' tron' : ''}`} role="listitem" onClick={onOpen} aria-label={`${row.member.username}, ${SECTION_LABELS[row.section]}${canEdit ? ', edit tracking' : ''}`}>
        <Avatar name={row.member.username} />
        <div className="main">
          <div className="name wrap">
            {row.member.username}
            {leadership && <span className="badge" style={{ marginLeft: 6 }}>{row.rank}</span>}
            {row.flag && <span className={`badge ${row.flag === 'removed' ? 'canceled' : 'published'}`} style={{ marginLeft: 6 }}>{row.flag.toUpperCase()}</span>}
          </div>
          <div className="sheet-cells">
            <span className={`cell joined ${row.joined ?? 'unset'}`} title="Joined?">{row.joined ? JOINED_LABELS[row.joined] : '—'}</span>
            <span className={`cell voted ${row.voted ?? 'none'}`} title="Voted">{row.votedLabel}</span>
            <span className={`cell ready ${row.ready ?? 'unset'}`} title="Ready?">{row.ready ? READY_LABELS[row.ready] : row.confirmed ? 'Confirmed' : '—'}</span>
            <span className="cell team" title="Starter / Sub">{row.starter ? `Starter ${row.starter}` : row.sub ? `Sub ${row.sub}` : '—'}</span>
          </div>
          {row.note && <div className="small muted wrap">{row.note}</div>}
        </div>
      </button>
    </>
  );
}
