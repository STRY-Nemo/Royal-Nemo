import { useMemo, useRef, useState } from 'react';
import { BUNDLED_IMPORTS } from '../data/bundledImports';
import { LifecycleError } from '../engine/lifecycle';
import { parseLineupRows, planLineupImport, type LineupPlan, type ParsedLineup } from '../engine/lineupImport';
import { timeZoneLabel } from '../engine/recurrence';
import { parseTableFile } from '../import/tables';
import { ConfirmSheet, OrbitSpinner, useFeedback, useSingleFlight } from '../motion';
import { useRouter } from '../store/router';
import { useStore } from '../store/store';
import { EmptyState, EventTimes, Header, StatusBadge, StickyActions } from '../ui/common';

function bundledImportUrl(file: string): string {
  const base = import.meta.env.BASE_URL || '/';
  return `${base.endsWith('/') ? base : `${base}/`}imports/${file}`;
}

interface Loaded {
  name: string;
  parsed: ParsedLineup;
}

/** Leader tool: load the in-game team screen table (.xlsx or .csv) and apply it to the draft. */
export function ImportScreen({ eventId }: { eventId?: string }) {
  const { state, currentEvent, eventById, isLeader, actions } = useStore();
  const router = useRouter();
  const { toast, announce } = useFeedback();
  const event = eventId ? eventById(eventId) : currentEvent;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const plan: LineupPlan | null = useMemo(() => {
    if (!event || !loaded) return null;
    return planLineupImport(event, loaded.parsed.records, state.members, state.organization.name_mapping);
  }, [event, loaded, state.members, state.organization.name_mapping]);

  const bundled = useMemo(() => (event ? BUNDLED_IMPORTS.filter((b) => b.event_date === event.date) : []), [event]);

  const load = (name: string, bytes: Uint8Array) => {
    try {
      const rows = parseTableFile(name, bytes);
      const parsed = parseLineupRows(rows);
      setLoaded({ name, parsed });
      setError(null);
      announce(`${parsed.records.length} rows read from ${name}`);
    } catch (err) {
      setLoaded(null);
      setError(err instanceof LifecycleError || err instanceof Error ? err.message : 'Could not read this file.');
    }
  };

  const [loadBundled, loadingBundled] = useSingleFlight(async (file: string) => {
    try {
      const r = await fetch(bundledImportUrl(file));
      if (!r.ok) throw new Error(`Could not fetch ${file} (${r.status}).`);
      load(file, new Uint8Array(await r.arrayBuffer()));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the bundled file.');
    }
  });

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    load(f.name, new Uint8Array(await f.arrayBuffer()));
  };

  const [apply, applying] = useSingleFlight(async () => {
    if (!event || !loaded || !plan) return;
    const res = actions.importLineup(event.id, loaded.parsed.records, loaded.name);
    if (res.ok) {
      toast({ kind: 'ok', text: `${plan.team.name} imported: ${plan.starters.length} starters, ${plan.reserves.length} substitutes`, action: { label: 'Undo', onClick: () => actions.undoAssignments(event.id) } });
      announce(`${plan.team.name} lineup imported.`);
      router.navigate(`/canyon/roster/${event.id}?team=${plan.team.id}`);
    }
  });

  if (!event) {
    return (
      <>
        <Header title="Import lineup" back="/canyon" />
        <main className="page">
          <EmptyState title="No event" />
        </main>
      </>
    );
  }
  if (!isLeader) {
    return (
      <>
        <Header title="Import lineup" back="/canyon" />
        <main className="page">
          <EmptyState title="Leaders only">Importing the in-game lineup is a leader tool.</EmptyState>
        </main>
      </>
    );
  }
  const readOnly = event.status === 'finalized' || event.status === 'canceled';
  const canApply = !!plan && plan.errors.length === 0 && !readOnly;
  const names = (list: { username: string }[]) => list.map((m) => m.username).join(', ');

  return (
    <>
      <Header title="Import in-game lineup" back={`/canyon/${event.id}`} />
      <main className="page">
        <div className="card">
          <div className="card-row">
            <div className="grow">
              <EventTimes event={event} compact />
            </div>
            <StatusBadge status={event.status} />
          </div>
        </div>

        <div className="card">
          <h3>1. Choose the team screen file</h3>
          <p className="muted small">The table exported from a screen recording of the game's team page (.xlsx or .csv): one row per member with Starter confirmed, Substitute, Ready, Declined and Other team shown.</p>
          {bundled.map((b) => (
            <button key={b.file} type="button" className="btn secondary block" onClick={() => loadBundled(b.file)} disabled={loadingBundled || readOnly}>
              {loadingBundled ? <OrbitSpinner label="Loading" /> : `Use ${b.label}`}
            </button>
          ))}
          <input ref={fileRef} type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" hidden onChange={(e) => void onFile(e.target.files?.[0])} aria-label="Choose a team screen file" />
          <button type="button" className={`btn ${bundled.length ? 'ghost' : 'secondary'} block`} onClick={() => fileRef.current?.click()} disabled={readOnly}>
            Pick a file from this phone…
          </button>
          {error && (
            <div className="callout danger small" role="alert">
              <span aria-hidden="true">!</span>
              <span>{error}</span>
            </div>
          )}
          {loaded && (
            <p className="small muted wrap">
              Read {loaded.parsed.records.length} rows from <span className="mono">{loaded.name}</span>
              {loaded.parsed.event_date ? ` for ${loaded.parsed.event_date}` : ''}
              {loaded.parsed.team ? `, Team ${loaded.parsed.team} screen` : ''}.
            </p>
          )}
          {loaded?.parsed.warnings.map((w) => (
            <p key={w} className="small" style={{ color: 'var(--warn)' }}>
              {w}
            </p>
          ))}
        </div>

        {plan && (
          <div className="card">
            <h3>2. Review what will change</h3>
            {plan.errors.map((e) => (
              <div key={e} className="callout danger small" role="alert">
                <span aria-hidden="true">!</span>
                <span>{e}</span>
              </div>
            ))}
            <dl className="kv">
              <dt>{plan.team.name} starters</dt>
              <dd>
                {plan.starters.length} of {plan.team.capacity} (locked)
              </dd>
              <dt>Substitutes</dt>
              <dd>{plan.reserves.length} (kept as locked reserves)</dd>
              <dt>Declined {plan.team.name}</dt>
              <dd>{plan.declined.length}</dd>
              <dt>Shown on the other team</dt>
              <dd>{plan.other_team.length}</dd>
              <dt>Availability updates</dt>
              <dd>{plan.availability.length}</dd>
              {plan.replaced > 0 && (
                <>
                  <dt>Replaced</dt>
                  <dd>{plan.replaced} current {plan.team.name} assignment{plan.replaced === 1 ? '' : 's'}</dd>
                </>
              )}
              {plan.moved_from_elsewhere.length > 0 && (
                <>
                  <dt>Moved in from elsewhere</dt>
                  <dd className="wrap">{names(plan.moved_from_elsewhere)}</dd>
                </>
              )}
              {plan.sets_timezone && (
                <>
                  <dt>Timezone</dt>
                  <dd>Set to {timeZoneLabel(plan.sets_timezone)}</dd>
                </>
              )}
            </dl>
            {plan.unmatched.length > 0 && (
              <div className="callout warn small">
                <span aria-hidden="true">ⓘ</span>
                <span className="wrap">
                  Not in the roster (skipped): {plan.unmatched.map((r) => r.username).join(', ')}. Map them under Organize → Map names, or rename the member, then import again.
                </span>
              </div>
            )}
            <details>
              <summary className="small">Starters ({plan.starters.length})</summary>
              <p className="small wrap">{names(plan.starters) || '—'}</p>
            </details>
            <details>
              <summary className="small">Substitutes ({plan.reserves.length})</summary>
              <p className="small wrap">{names(plan.reserves) || '—'}</p>
            </details>
            {plan.declined.length > 0 && (
              <details>
                <summary className="small">Declined ({plan.declined.length})</summary>
                <p className="small wrap">{names(plan.declined)}</p>
              </details>
            )}
            <p className="faint">
              Starters and substitutes are locked to {plan.team.name} with the file name as the reason, so Generate keeps them and fills the other team fairly. The import records selection only: attendance is still confirmed after the match.
            </p>
          </div>
        )}
      </main>
      {plan && (
        <StickyActions>
          <button type="button" className="btn primary block" onClick={() => setConfirm(true)} disabled={!canApply || applying}>
            {applying ? <OrbitSpinner label="Importing" /> : `Import to ${plan.team.name}`}
          </button>
        </StickyActions>
      )}
      <ConfirmSheet open={confirm} title={`Import ${plan?.team.name ?? ''} lineup?`} confirmLabel="Import" onCancel={() => setConfirm(false)} onConfirm={() => { setConfirm(false); void apply(); }}>
        <p className="small">
          {plan?.starters.length} starters and {plan?.reserves.length} substitutes replace the current {plan?.team.name} assignments. You can undo from the toast.
        </p>
      </ConfirmSheet>
    </>
  );
}
