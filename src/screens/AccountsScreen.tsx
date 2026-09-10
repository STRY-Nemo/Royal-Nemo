import { joinLink, joinMessage, leaderJoinMessage } from '../ui/join';
import { useCallback, useEffect, useState } from 'react';
import type { ApiAccount, Invite } from '../api/client';
import { BottomSheet, ConfirmSheet, useFeedback } from '../motion';
import { useStore } from '../store/store';
import { EmptyState, Header, MemberPickerSheet } from '../ui/common';

/** Leader-only: invite codes and account management (roles, member links, verification). */
export function AccountsScreen() {
  const { api, isLeader, membersById, account: me } = useStore();
  const { toast } = useFeedback();
  const [accounts, setAccounts] = useState<ApiAccount[] | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ApiAccount | null>(null);
  const [resetFor, setResetFor] = useState<ApiAccount | null>(null);
  const [newPin, setNewPin] = useState('');
  const [linkFor, setLinkFor] = useState<ApiAccount | null>(null);
  const [inviteRole, setInviteRole] = useState<'leader' | 'member'>('member');
  const [confirmInvite, setConfirmInvite] = useState(false);
  const [confirmLeaderLink, setConfirmLeaderLink] = useState(false);
  const [leaderSeats, setLeaderSeats] = useState(10);

  const load = useCallback(async () => {
    if (!api) return;
    try {
      const [a, i] = await Promise.all([api.accounts(), api.invites()]);
      setAccounts(a.accounts);
      setInvites(i.invites);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!api || !isLeader) {
    return (
      <>
        <Header title="Alliance accounts" back="/settings" />
        <main className="page">
          <EmptyState title="Leaders only">{!api ? 'Accounts exist only when the app is connected to the alliance server.' : 'Ask a leader.'}</EmptyState>
        </main>
      </>
    );
  }

  const update = async (a: ApiAccount, patch: Parameters<typeof api.updateAccount>[1], label: string) => {
    try {
      await api.updateAccount(a.id, patch);
      toast({ kind: 'ok', text: label });
      await load();
      setSelected(null);
    } catch (err) {
      toast({ kind: 'error', text: err instanceof Error ? err.message : String(err) });
    }
  };

  const resetPin = async () => {
    if (!resetFor) return;
    try {
      await api.resetPassword(resetFor.id, newPin);
      toast({ kind: 'ok', text: `PIN reset for ${resetFor.username}. Tell them the new one.` });
      setResetFor(null);
      setNewPin('');
    } catch (err) {
      toast({ kind: 'error', text: err instanceof Error ? err.message : String(err) });
    }
  };

  const shareCode = async (code: string, role: 'leader' | 'member') => {
    const text = role === 'leader' ? leaderJoinMessage(code) : joinMessage(code);
    try {
      if (navigator.share) await navigator.share({ title: 'STRY alliance app', text, url: joinLink(code) });
      else {
        await navigator.clipboard.writeText(text);
        toast({ kind: 'ok', text: 'Join link copied — paste it in alliance chat' });
      }
    } catch {
      toast({ kind: 'info', text: joinLink(code) });
    }
  };

  const createInvite = async (opts?: { role: 'leader' | 'member'; uses: number; days: number }) => {
    const role = opts?.role ?? inviteRole;
    try {
      const r = await api.createInvite(opts ?? { role, uses: role === 'leader' ? 1 : 200, days: role === 'leader' ? 7 : 90 });
      setConfirmInvite(false);
      await load();
      await shareCode(r.invite.code, r.invite.role);
    } catch (err) {
      toast({ kind: 'error', text: err instanceof Error ? err.message : String(err) });
    }
  };

  const revoke = async (code: string) => {
    try {
      await api.deleteInvite(code);
      toast({ kind: 'ok', text: 'Link revoked' });
      await load();
    } catch (err) {
      toast({ kind: 'error', text: err instanceof Error ? err.message : String(err) });
    }
  };

  const now = new Date().toISOString();
  const allianceLink = invites.find((i) => i.role === 'member' && i.uses_left > 0 && i.expires_at > now);
  const leaderLink = invites.find((i) => i.role === 'leader' && i.uses_left > 1 && i.expires_at > now);

  return (
    <>
      <Header title="Alliance accounts" back="/settings" />
      <main className="page">
        {error && <div className="callout danger small">{error}</div>}

        <div className="card raised">
          <h3>Alliance join link</h3>
          <p className="muted small">One link for everyone. Members tap it, pick their in-game name, choose a PIN, and they're in. No code to type.</p>
          {allianceLink ? (
            <>
              <div className="mono small wrap" style={{ wordBreak: 'break-all' }}>{joinLink(allianceLink.code)}</div>
              <div className="small muted">{allianceLink.uses_left} sign-ups left · valid until {new Date(allianceLink.expires_at).toLocaleDateString()}</div>
              <button type="button" className="btn primary block" onClick={() => void shareCode(allianceLink.code, 'member')}>
                Share join link
              </button>
            </>
          ) : (
            <button type="button" className="btn primary block" onClick={() => void createInvite({ role: 'member', uses: 200, days: 90 })}>
              Create the alliance join link
            </button>
          )}
        </div>

        <div className="card">
          <h3>Leader join link</h3>
          <p className="muted small">One link for all your leaders. Anyone who uses it gets a leader account straight away, so send it privately (leader chat or direct messages), not in alliance chat.</p>
          {leaderLink ? (
            <>
              <div className="mono small wrap" style={{ wordBreak: 'break-all' }}>{joinLink(leaderLink.code)}</div>
              <div className="small muted">{leaderLink.uses_left} leader sign-ups left · valid until {new Date(leaderLink.expires_at).toLocaleDateString()}</div>
              <div className="card-row">
                <button type="button" className="btn secondary grow" onClick={() => void shareCode(leaderLink.code, 'leader')}>
                  Share leader link
                </button>
                <button type="button" className="btn ghost small" style={{ color: 'var(--danger)' }} onClick={() => void revoke(leaderLink.code)}>
                  Revoke
                </button>
              </div>
            </>
          ) : (
            <button type="button" className="btn secondary block" onClick={() => setConfirmLeaderLink(true)}>
              Create the leader join link
            </button>
          )}
          <p className="faint">Already-joined members don't need it: open their account below and tap "Make leader".</p>
        </div>

        <div className="card">
          <h3>Invite codes</h3>
          <p className="faint">Extra codes for special cases. Every code doubles as a link. Single-use leader codes expire in 7 days. Revoke any of them here.</p>
          <div className="segmented" role="tablist" aria-label="Invite role">
            <button type="button" role="tab" aria-selected={inviteRole === 'member'} onClick={() => setInviteRole('member')}>
              Member
            </button>
            <button type="button" role="tab" aria-selected={inviteRole === 'leader'} onClick={() => setInviteRole('leader')}>
              Leader
            </button>
          </div>
          <button type="button" className="btn primary block" onClick={() => setConfirmInvite(true)}>
            Create {inviteRole} invite
          </button>
          {invites.length > 0 && (
            <div className="list">
              {invites.map((i) => (
                <div key={i.code} className="row" style={{ animation: 'none' }}>
                  <div className="main">
                    <div className="name mono">{i.code}</div>
                    <div className="meta">
                      <span>{i.role}</span>
                      <span>{i.uses_left} left</span>
                      <span>expires {new Date(i.expires_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <button type="button" className="btn ghost small" onClick={() => void shareCode(i.code, i.role)}>
                    Share
                  </button>
                  <button
                    type="button"
                    className="btn danger small"
                    onClick={() => void revoke(i.code)}
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3>Accounts {accounts ? `(${accounts.length})` : ''}</h3>
          {!accounts && <p className="faint">Loading…</p>}
          <div className="list">
            {accounts?.map((a) => (
              <button key={a.id} type="button" className="row" style={{ animation: 'none', opacity: a.disabled ? 0.6 : 1 }} onClick={() => setSelected(a)}>
                <div className="main">
                  <div className="name">
                    {a.username}
                    {a.id === me?.id && <span className="badge" style={{ marginLeft: 6 }}>you</span>}
                    {a.disabled && <span className="badge canceled" style={{ marginLeft: 6 }}>disabled</span>}
                  </div>
                  <div className="meta">
                    <span style={{ color: a.role === 'leader' ? 'var(--warn)' : undefined }}>{a.role}</span>
                    <span>{a.member_id ? (membersById.get(a.member_id)?.username ?? a.member_id) : 'no member linked'}</span>
                    <span style={{ color: a.verified ? 'var(--ok)' : 'var(--text-3)' }}>{a.verified ? 'verified' : 'unverified'}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </main>

      <BottomSheet open={!!selected} onClose={() => setSelected(null)} title={selected?.username ?? ''}>
        {selected && (
          <div className="list">
            <button type="button" className="sheet-item" onClick={() => setLinkFor(selected)}>
              <div className="grow">
                <div className="label">Link to roster member</div>
                <div className="hint">{selected.member_id ? membersById.get(selected.member_id)?.username : 'Not linked'}</div>
              </div>
            </button>
            <button type="button" className="sheet-item" onClick={() => update(selected, { verified: !selected.verified }, selected.verified ? 'Marked unverified' : 'Verified')}>
              <div className="grow">
                <div className="label">{selected.verified ? 'Mark unverified' : 'Verify member link'}</div>
                <div className="hint">Confirms this account really is that player.</div>
              </div>
            </button>
            <button type="button" className="sheet-item" onClick={() => update(selected, { role: selected.role === 'leader' ? 'member' : 'leader' }, 'Role updated')}>
              <div className="grow">
                <div className="label">{selected.role === 'leader' ? 'Make member' : 'Make leader'}</div>
                <div className="hint">Leaders manage lineups, attendance, responsibilities and accounts.</div>
              </div>
            </button>
            {selected.id !== me?.id && (
              <button type="button" className="sheet-item" onClick={() => { setResetFor(selected); setNewPin(''); setSelected(null); }}>
                <div className="grow">
                  <div className="label">Reset PIN</div>
                  <div className="hint">They forgot it. Set a new one and tell them in person; it signs them out everywhere.</div>
                </div>
              </button>
            )}
            {selected.id !== me?.id && (
              <button type="button" className="sheet-item" onClick={() => update(selected, { disabled: !selected.disabled }, selected.disabled ? 'Account enabled' : 'Account disabled')}>
                <div className="grow">
                  <div className="label" style={{ color: selected.disabled ? undefined : 'var(--danger)' }}>
                    {selected.disabled ? 'Enable account' : 'Disable account'}
                  </div>
                  <div className="hint">Disabling signs them out everywhere.</div>
                </div>
              </button>
            )}
          </div>
        )}
      </BottomSheet>

      <BottomSheet open={!!resetFor} onClose={() => setResetFor(null)} title={`Reset PIN for ${resetFor?.username ?? ''}`}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void resetPin();
          }}
        >
          <div className="field">
            <label htmlFor="reset-pin">New PIN or password</label>
            <input id="reset-pin" className="input" type="text" inputMode="numeric" autoComplete="off" autoCapitalize="none" value={newPin} onChange={(e) => setNewPin(e.target.value)} minLength={4} required placeholder="e.g. 4 digits" />
            <p className="faint">At least 4 characters. Tell {resetFor?.username} the new PIN; they can change it afterwards from Settings.</p>
          </div>
          <button type="submit" className="btn primary block" disabled={newPin.length < 4}>
            Set new PIN
          </button>
        </form>
      </BottomSheet>

      <MemberPickerSheet
        open={!!linkFor}
        title={`Link ${linkFor?.username ?? ''} to`}
        onClose={() => setLinkFor(null)}
        fixedOptions={[{ key: '__none', label: 'No member', hint: 'Unlink' }]}
        selectedMemberId={linkFor?.member_id ?? null}
        onPick={async (o) => {
          if (!linkFor) return;
          await update(linkFor, { member_id: o.key === '__none' ? null : o.key, verified: o.key !== '__none' }, 'Member link updated');
          setLinkFor(null);
        }}
      />

      <ConfirmSheet
        open={confirmLeaderLink}
        title="Create the leader join link?"
        confirmLabel="Create & share"
        onCancel={() => setConfirmLeaderLink(false)}
        onConfirm={() => {
          setConfirmLeaderLink(false);
          void createInvite({ role: 'leader', uses: Math.min(50, Math.max(2, leaderSeats)), days: 7 });
        }}
      >
        <p className="small muted">Everyone who opens this link within 7 days becomes a leader. Set how many can use it, and revoke it as soon as your leaders are in.</p>
        <div className="field">
          <label htmlFor="leader-seats">How many leaders</label>
          <input id="leader-seats" className="input" type="number" inputMode="numeric" min={2} max={50} value={leaderSeats} onChange={(e) => setLeaderSeats(Number(e.target.value) || 2)} />
        </div>
      </ConfirmSheet>
      <ConfirmSheet open={confirmInvite} title={`Create ${inviteRole} invite?`} confirmLabel="Create & share" onCancel={() => setConfirmInvite(false)} onConfirm={() => void createInvite()}>
        <p className="small muted">{inviteRole === 'leader' ? 'A single-use code that creates a leader account. Only give it to someone you trust with lineups and attendance.' : 'A link up to 200 members can use in the next 90 days. You can revoke it any time.'}</p>
      </ConfirmSheet>
    </>
  );
}
