import { useState } from 'react';
import type { MotionPreference } from '../domain/types';
import { COMMON_TIME_ZONES, deviceTimeZone, isValidTimeZone, timeZoneLabel } from '../engine/recurrence';
import { BottomSheet, ConfirmSheet, SaveIndicator, useEffectiveMotion, useFeedback } from '../motion';
import { useRouter } from '../store/router';
import { STORAGE_KEY, useStore } from '../store/store';
import { Header, MemberPickerSheet } from '../ui/common';

export function SettingsScreen() {
  const { state, actions, me, isLeader, saveState, mode, account, api, lastSyncedAt, loadError } = useStore();
  const router = useRouter();
  const { toast } = useFeedback();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNext, setPwNext] = useState('');
  const effective = useEffectiveMotion(state.settings.motion);
  const tz = state.settings.timezone ?? '';

  const exportJson = async () => {
    let json: string;
    try {
      json = await actions.exportJson();
    } catch (err) {
      toast({ kind: 'error', text: err instanceof Error ? err.message : String(err) });
      return;
    }
    try {
      await navigator.clipboard.writeText(json);
      toast({ kind: 'ok', text: 'Exported JSON copied to clipboard' });
    } catch {
      const w = window.open('', '_blank');
      if (w) {
        w.document.write(`<pre>${json.replace(/</g, '&lt;')}</pre>`);
        toast({ kind: 'info', text: 'Export opened in a new tab' });
      } else toast({ kind: 'error', text: 'Could not export. Allow clipboard or pop-ups.' });
    }
  };

  const changePassword = async () => {
    if (!api) return;
    try {
      await api.changePassword(pwCurrent, pwNext);
      toast({ kind: 'ok', text: 'Password changed' });
      setPwOpen(false);
      setPwCurrent('');
      setPwNext('');
    } catch (err) {
      toast({ kind: 'error', text: err instanceof Error ? err.message : String(err) });
    }
  };

  return (
    <>
      <Header title="Settings" back="/home" />
      <main className="page">
        {mode === 'api' ? (
          <div className="card">
            <div className="card-row">
              <h3 className="grow">Account</h3>
              <SaveIndicator state={saveState} />
            </div>
            <dl className="kv">
              <dt>Signed in as</dt>
              <dd>{account?.username ?? '—'}</dd>
              <dt>Role</dt>
              <dd>{account?.role === 'leader' ? 'Leader' : 'Member'}</dd>
              <dt>Roster member</dt>
              <dd>
                {me ? me.username : 'Not linked'}
                {me && !account?.verified && <span className="badge draft" style={{ marginLeft: 6 }}>awaiting leader verification</span>}
              </dd>
              <dt>Last synced</dt>
              <dd>{lastSyncedAt ? new Date(lastSyncedAt).toLocaleTimeString() : loadError ? 'offline' : '—'}</dd>
            </dl>
            {!me && (
              <button type="button" className="btn secondary block" onClick={() => setPickerOpen(true)}>
                Link my roster member
              </button>
            )}
            {isLeader && (
              <button type="button" className="btn ghost block" onClick={() => router.navigate('/settings/accounts')}>
                Alliance accounts &amp; invite codes
              </button>
            )}
            <div className="card-row">
              <button type="button" className="btn ghost" style={{ flex: 1 }} onClick={() => setPwOpen(true)}>
                Change password
              </button>
              <button type="button" className="btn danger" style={{ flex: 1 }} onClick={() => setSignOutOpen(true)}>
                Sign out
              </button>
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="card-row">
              <h3 className="grow">Account (demo)</h3>
              <SaveIndicator state={saveState} label="Saved locally" />
            </div>
            <p className="faint">No login in demo mode. Choose who you are and which role to preview. When connected to the alliance server, roles come from real accounts.</p>
            <div className="segmented" role="tablist" aria-label="Role">
              <button type="button" role="tab" aria-selected={isLeader} onClick={() => actions.setSession({ ...state.session, role: 'leader' })}>
                Leader
              </button>
              <button type="button" role="tab" aria-selected={!isLeader} onClick={() => actions.setSession({ ...state.session, role: 'member' })}>
                Member
              </button>
            </div>
            <button type="button" className="btn ghost block" onClick={() => setPickerOpen(true)}>
              {me ? `You are ${me.username}` : 'Choose your member'}
            </button>
          </div>
        )}

        <div className="card">
          <h3>Timezone</h3>
          <div className="field">
            <label htmlFor="settings-tz">Default event timezone</label>
            <select
              id="settings-tz"
              className="select"
              value={COMMON_TIME_ZONES.includes(tz) || tz === '' ? tz : '__custom'}
              disabled={mode === 'api' && !isLeader}
              onChange={(e) => {
                const v = e.target.value;
                if (v === '__custom') return;
                actions.updateSettings({ timezone: v || null });
              }}
            >
              <option value="">Not set</option>
              {COMMON_TIME_ZONES.map((z) => (
                <option key={z} value={z}>
                  {timeZoneLabel(z)}
                  {z === deviceTimeZone() ? ' (this device)' : ''}
                </option>
              ))}
              {!COMMON_TIME_ZONES.includes(tz) && tz && <option value="__custom">{tz}</option>}
            </select>
            <input
              className="input"
              placeholder="Or type an IANA name, e.g. Europe/Warsaw"
              defaultValue={COMMON_TIME_ZONES.includes(tz) ? '' : tz}
              disabled={mode === 'api' && !isLeader}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (!v) return;
                if (isValidTimeZone(v)) actions.updateSettings({ timezone: v });
                else toast({ kind: 'error', text: `Unknown timezone: ${v}` });
              }}
              aria-label="Custom timezone"
            />
            <p className="faint">Your device is in {deviceTimeZone()}. The event timezone is set per event on the schedule screen; this is only the default for new weeks{mode === 'api' ? ' and is shared with the whole alliance' : ''}.</p>
          </div>
        </div>

        <div className="card">
          <h3>Motion</h3>
          <div className="segmented" role="tablist" aria-label="Animation">
            {(['system', 'full', 'reduced', 'off'] as MotionPreference[]).map((m) => (
              <button key={m} type="button" role="tab" aria-selected={state.settings.motion === m} onClick={() => actions.updateSettings({ motion: m })}>
                {m[0].toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
          <p className="faint">Currently {effective}. Reduced replaces movement with fades; Off changes state instantly. Status text and announcements stay the same in every mode.</p>
          <label className="card-row" style={{ minHeight: 44 }}>
            <input type="checkbox" checked={state.settings.haptics} onChange={(e) => actions.updateSettings({ haptics: e.target.checked })} style={{ width: 22, height: 22 }} />
            <span>Haptic feedback where supported</span>
          </label>
        </div>

        <div className="card">
          <h3>Data</h3>
          {mode === 'api' ? (
            <p className="faint">Shared alliance data lives on the server. Leaders can export a full backup (members, events, responsibilities, audit trail).</p>
          ) : (
            <p className="faint">
              Demo data lives in this browser under <code>{STORAGE_KEY}</code>. Export before clearing site data. Audit entries: {state.audit.length}.
            </p>
          )}
          {(mode === 'demo' || isLeader) && (
            <button type="button" className="btn ghost block" onClick={exportJson}>
              Export everything as JSON
            </button>
          )}
          {mode === 'demo' && (
            <button type="button" className="btn danger block" onClick={() => setResetOpen(true)}>
              Reset demo data
            </button>
          )}
        </div>

        <div className="card">
          <h3>About</h3>
          <p className="small muted">
            STRY alliance organizer · Canyon Clash rotation {state.events[0]?.algorithm_version ?? 'rotation-v1'}. Weekly selection runs with no AI service.
            {mode === 'api' && api ? ` Connected to ${api.baseUrl}.` : ' Local demo mode.'}
          </p>
          <button type="button" className="link-btn" onClick={() => router.navigate('/organize/mapping')}>
            Leadership name mapping
          </button>
        </div>
      </main>

      <MemberPickerSheet
        open={pickerOpen}
        title={mode === 'api' ? 'Which member are you?' : 'Who are you?'}
        onClose={() => setPickerOpen(false)}
        onPick={async (o) => {
          setPickerOpen(false);
          if (mode === 'api') {
            const r = await actions.linkSelf(o.key);
            if (r.ok) toast({ kind: 'ok', text: `Linked to ${o.label}. A leader will verify it.` });
          } else {
            actions.setSession({ ...state.session, member_id: o.key });
            toast({ kind: 'ok', text: `You are now ${o.label}` });
          }
        }}
        selectedMemberId={state.session.member_id}
        members={state.members}
      />
      <ConfirmSheet
        open={resetOpen}
        title="Reset demo data?"
        confirmLabel="Reset"
        danger
        onCancel={() => setResetOpen(false)}
        onConfirm={() => {
          actions.resetDemo();
          setResetOpen(false);
          toast({ kind: 'ok', text: 'Demo data reset to the seed roster' });
        }}
      >
        <p className="small muted">Removes all availability, lineups, attendance and organization edits stored in this browser and reloads the 100-member seed roster.</p>
      </ConfirmSheet>
      <ConfirmSheet
        open={signOutOpen}
        title="Sign out?"
        confirmLabel="Sign out"
        danger
        onCancel={() => setSignOutOpen(false)}
        onConfirm={async () => {
          setSignOutOpen(false);
          await actions.signOut();
          router.navigate('/home', { replace: true });
        }}
      >
        <p className="small muted">Alliance data stays on the server. You will need your username and password to sign back in.</p>
      </ConfirmSheet>
      <BottomSheet
        open={pwOpen}
        onClose={() => setPwOpen(false)}
        title="Change password"
        footer={
          <>
            <button type="button" className="btn ghost" onClick={() => setPwOpen(false)}>
              Cancel
            </button>
            <button type="button" className="btn primary" disabled={!pwCurrent || pwNext.length < 4} onClick={() => void changePassword()}>
              Save
            </button>
          </>
        }
      >
        <div className="field">
          <label htmlFor="pw-current">Current password</label>
          <input id="pw-current" className="input" type="password" autoComplete="current-password" value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="pw-next">New password (4+ characters)</label>
          <input id="pw-next" className="input" type="password" autoComplete="new-password" value={pwNext} onChange={(e) => setPwNext(e.target.value)} />
        </div>
      </BottomSheet>
    </>
  );
}
