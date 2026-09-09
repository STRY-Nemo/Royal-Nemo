import { useState } from 'react';
import type { MotionPreference } from '../domain/types';
import { COMMON_TIME_ZONES, deviceTimeZone, isValidTimeZone } from '../engine/recurrence';
import { ConfirmSheet, SaveIndicator, useEffectiveMotion, useFeedback } from '../motion';
import { useRouter } from '../store/router';
import { STORAGE_KEY, useStore } from '../store/store';
import { Header, MemberPickerSheet } from '../ui/common';

export function SettingsScreen() {
  const { state, actions, me, isLeader, saveState } = useStore();
  const router = useRouter();
  const { toast } = useFeedback();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const effective = useEffectiveMotion(state.settings.motion);
  const tz = state.settings.timezone ?? '';

  const exportJson = async () => {
    const json = actions.exportJson();
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

  return (
    <>
      <Header title="Settings" back="/home" />
      <main className="page">
        <div className="card">
          <div className="card-row">
            <h3 className="grow">Account (demo)</h3>
            <SaveIndicator state={saveState} label="Saved locally" />
          </div>
          <p className="faint">No login exists yet. Choose who you are and which role to preview. In the real build the server decides roles; a self-entered name never grants leader access.</p>
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

        <div className="card">
          <h3>Timezone</h3>
          <div className="field">
            <label htmlFor="settings-tz">Default event timezone</label>
            <select
              id="settings-tz"
              className="select"
              value={COMMON_TIME_ZONES.includes(tz) || tz === '' ? tz : '__custom'}
              onChange={(e) => {
                const v = e.target.value;
                if (v === '__custom') return;
                actions.updateSettings({ timezone: v || null });
              }}
            >
              <option value="">Not set</option>
              {COMMON_TIME_ZONES.map((z) => (
                <option key={z} value={z}>
                  {z}
                  {z === deviceTimeZone() ? ' (this device)' : ''}
                </option>
              ))}
              {!COMMON_TIME_ZONES.includes(tz) && tz && <option value="__custom">{tz}</option>}
            </select>
            <input
              className="input"
              placeholder="Or type an IANA name, e.g. Europe/Warsaw"
              defaultValue={COMMON_TIME_ZONES.includes(tz) ? '' : tz}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (!v) return;
                if (isValidTimeZone(v)) actions.updateSettings({ timezone: v });
                else toast({ kind: 'error', text: `Unknown timezone: ${v}` });
              }}
              aria-label="Custom timezone"
            />
            <p className="faint">Your device is in {deviceTimeZone()}. The event timezone is set per event on the schedule screen; this is only the default for new weeks.</p>
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
          <p className="faint">
            Demo data lives in this browser under <code>{STORAGE_KEY}</code>. Export before clearing site data. Audit entries: {state.audit.length}.
          </p>
          <button type="button" className="btn ghost block" onClick={exportJson}>
            Export everything as JSON
          </button>
          <button type="button" className="btn danger block" onClick={() => setResetOpen(true)}>
            Reset demo data
          </button>
        </div>

        <div className="card">
          <h3>About</h3>
          <p className="small muted">STRY alliance organizer · Canyon Clash rotation {state.events[0]?.algorithm_version ?? 'rotation-v1'}. Weekly selection runs on-device with no AI service.</p>
          <button type="button" className="link-btn" onClick={() => router.navigate('/organize/mapping')}>
            Leadership name mapping
          </button>
        </div>
      </main>

      <MemberPickerSheet
        open={pickerOpen}
        title="Who are you?"
        onClose={() => setPickerOpen(false)}
        onPick={(o) => {
          actions.setSession({ ...state.session, member_id: o.key });
          setPickerOpen(false);
          toast({ kind: 'ok', text: `You are now ${o.label}` });
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
    </>
  );
}
