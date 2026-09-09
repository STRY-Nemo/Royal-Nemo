import { useEffect, useMemo, useState } from 'react';
import { normalizeName } from '../engine/organization';
import { OrbitSpinner, useSingleFlight } from '../motion';
import { useStore } from '../store/store';
import { SearchInput } from '../ui/common';

type Tab = 'signin' | 'register';

export function LoginScreen() {
  const { actions, api, loadError } = useStore();
  const [tab, setTab] = useState<Tab>('signin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [invite, setInvite] = useState('');
  const [memberId, setMemberId] = useState<string | null>(null);
  const [memberQuery, setMemberQuery] = useState('');
  const [roster, setRoster] = useState<{ id: string; username: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (tab !== 'register' || !api || roster.length) return;
    api
      .roster()
      .then((r) => setRoster(r.roster))
      .catch(() => setRoster([]));
  }, [tab, api, roster.length]);

  const filtered = useMemo(() => {
    const q = normalizeName(memberQuery);
    return roster.filter((m) => !q || normalizeName(m.username).includes(q)).slice(0, 12);
  }, [roster, memberQuery]);

  const [submit, busy] = useSingleFlight(async () => {
    setError(null);
    const res = tab === 'signin' ? await actions.signIn(username.trim(), password) : await actions.register({ username: username.trim(), password, invite_code: invite.trim(), member_id: memberId });
    if (!res.ok) setError(res.message);
  });

  return (
    <main className="page" style={{ paddingTop: 'calc(var(--space-6) + var(--safe-top))' }}>
      <div style={{ textAlign: 'center' }}>
        <img src={`${import.meta.env.BASE_URL}brand/stry-logo.png`} alt="STRY" width={96} height={96} style={{ display: 'block', margin: '0 auto 8px' }} />
        <h1>STRY Alliance</h1>
        <p className="muted small">Canyon Clash rotation · responsibilities · members</p>
      </div>

      {loadError && <div className="callout warn small">Server unreachable: {loadError}</div>}

      <div className="segmented" role="tablist" aria-label="Sign in or create account">
        <button type="button" role="tab" aria-selected={tab === 'signin'} onClick={() => setTab('signin')}>
          Sign in
        </button>
        <button type="button" role="tab" aria-selected={tab === 'register'} onClick={() => setTab('register')}>
          Create account
        </button>
      </div>

      {tab === 'signin' && (
        <div className="callout small">
          <span aria-hidden="true">ⓘ</span>
          <span>No account yet? Tap <strong>Create account</strong>. The first person to register with the owner setup code becomes the leader; members register with an invite code from a leader.</span>
        </div>
      )}

      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="field">
          <label htmlFor="login-username">Username</label>
          <input id="login-username" className="input" autoComplete="username" autoCapitalize="none" value={username} onChange={(e) => setUsername(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="login-password">Password</label>
          <input id="login-password" className="input" type="password" autoComplete={tab === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={tab === 'register' ? 4 : undefined} />
          {tab === 'register' && <p className="faint">At least 4 characters; a 4-digit PIN is fine.</p>}
        </div>
        {tab === 'register' && (
          <>
            <div className="field">
              <label htmlFor="login-invite">Invite code</label>
              <input id="login-invite" className="input" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={invite} onChange={(e) => setInvite(e.target.value)} required placeholder="Owner setup code or a leader's invite" />
              <p className="faint">Setting up the alliance? Enter the owner setup code you saved when deploying: that first account becomes the leader. Everyone after that uses an invite code a leader shares from Settings.</p>
            </div>
            <div className="field">
              <label>Which member are you?</label>
              {memberId ? (
                <button type="button" className="btn ghost block" onClick={() => setMemberId(null)}>
                  {roster.find((m) => m.id === memberId)?.username ?? memberId} · change
                </button>
              ) : (
                <>
                  <SearchInput value={memberQuery} onChange={setMemberQuery} placeholder="Search your in-game name" />
                  {memberQuery && (
                    <div className="list" role="listbox" aria-label="Members">
                      {filtered.map((m) => (
                        <button key={m.id} type="button" role="option" aria-selected={false} className="sheet-item" onClick={() => setMemberId(m.id)}>
                          <div className="grow">
                            <div className="label">{m.username}</div>
                          </div>
                        </button>
                      ))}
                      {filtered.length === 0 && <div className="faint">No match. You can skip this and a leader can link you later.</div>}
                    </div>
                  )}
                </>
              )}
              <p className="faint">Optional. A leader verifies the link; it never grants leader access.</p>
            </div>
          </>
        )}
        {error && (
          <div className="callout danger small" role="alert">
            {error}
          </div>
        )}
        <button type="submit" className="btn primary block" disabled={busy}>
          {busy ? <OrbitSpinner label="Signing in" /> : tab === 'signin' ? 'Sign in' : 'Create account'}
        </button>
      </form>
      <p className="faint" style={{ textAlign: 'center' }}>
        Shared alliance data. Sessions stay signed in on this device for 90 days.
      </p>
    </main>
  );
}
