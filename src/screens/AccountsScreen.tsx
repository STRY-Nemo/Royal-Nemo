import { joinLink, joinMessage } from '../ui/join';
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
  const [linkFor, setLinkFor] = useState<ApiAccount | null>(null);
  const [inviteRole, setInviteRole] = useState<'leader' | 'member'>('member');
  const [confirmInvite, setConfirmInvite] = useState(false);

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

  const shareCode = async (code: string, role: 'leader' | 'member') => {
    const text = role === 'leader' ? `Leader invite for the STRY alliance app (single use):\n${joinLink(code)}` : joinMessage(code);
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

  const createInvite = async () => {
    try {
      const r = await api.createInvite({ role: inviteRole, uses: inviteRole === 'leader' ? 1 : 200, days: inviteRole === 'leader' ? 7 : 90 });
      setConfirmInvite(false);
      await load();
      await shareCode(r.invite.code, r.invite.role);
    } catch (err) {
      toast({ kind: 'error', text: err instanceof Error ? err.message : String(err) });
    }
  };

  const allianceLink = invites.find((i) => i.role === 'member' && i.uses_left > 0 && i.expires_at > new Date().toISOString());

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
            <button type="button" className="btn primary block" onClick={() => { setInviteRole('member'); void createInvite(); }}>
              Create the alliance join link
            </button>
          )}
        </div>

        <div className="card">
          <h3>Invite codes</h3>
          <p className="faint">Every code doubles as a link. Member links allow 200 sign-ups over 90 days; leader links are single-use and expire in 7 days. Revoke any of them here.</p>
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
                    onClick={async () => {
                      await api.deleteInvite(i.code);
                      await load();
                    }}
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

      <ConfirmSheet open={confirmInvite} title={`Create ${inviteRole} invite?`} confirmLabel="Create & share" onCancel={() => setConfirmInvite(false)} onConfirm={() => void createInvite()}>
        <p className="small muted">{inviteRole === 'leader' ? 'A single-use code that creates a leader account. Only give it to someone you trust with lineups and attendance.' : 'A code up to 50 members can use in the next 14 days. You can revoke it any time.'}</p>
      </ConfirmSheet>
    </>
  );
}
