import { Art } from '../ui/Art';
import { useEffect, useMemo, useState } from 'react';
import { normalizeName } from '../engine/organization';
import { OrbitSpinner, useSingleFlight } from '../motion';
import { useStore } from '../store/store';
import { SearchInput } from '../ui/common';
import { joinCodeFromLocation, suggestUsername } from '../ui/join';

type Tab = 'signin' | 'register';

export function LoginScreen() {
  const { actions, api, loadError } = useStore();
  const [joinCode] = useState<string | null>(() => joinCodeFromLocation());
  const [tab, setTab] = useState<Tab>(joinCode ? 'register' : 'signin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [invite, setInvite] = useState(joinCode ?? '');
  const [joinStatus, setJoinStatus] = useState<'checking' | 'ok' | 'unknown' | 'used_up' | 'expired' | null>(joinCode ? 'checking' : null);
  const [joinRole, setJoinRole] = useState<'leader' | 'member'>('member');
  const [usernameTouched, setUsernameTouched] = useState(false);
  const joining = !!joinCode && joinStatus !== 'unknown' && joinStatus !== 'used_up' && joinStatus !== 'expired';

  useEffect(() => {
    if (!joinCode || !api) return;
    api
      .checkInvite(joinCode)
      .then((r) => {
        setJoinStatus(r.valid ? 'ok' : (r.reason ?? 'unknown'));
        if (r.role) setJoinRole(r.role);
      })
      .catch(() => setJoinStatus('ok'));
  }, [joinCode, api]);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [memberQuery, setMemberQuery] = useState('');
  const [roster, setRoster] = useState<{ id: string; username: string; taken?: boolean }[]>([]);
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
    else if (joinCode) window.location.hash = '#/home';
  });

  const pickMember = (m: { id: string; username: string }) => {
    setMemberId(m.id);
    if (!usernameTouched || !username.trim()) setUsername(suggestUsername(m.username));
  };

  return (
    <main className="page" style={{ paddingTop: 'calc(var(--space-6) + var(--safe-top))' }}>
      <Art name="login-hero" alt="" className="art-banner" />
      <div style={{ textAlign: 'center' }}>
        <img src={`${import.meta.env.BASE_URL}brand/stry-logo.png`} alt="STRY" width={96} height={96} style={{ display: 'block', margin: '0 auto 8px' }} />
        <h1>STRY Alliance</h1>
        <p className="muted small">Canyon Clash rotation · responsibilities · members</p>
      </div>

      {loadError && <div className="callout warn small">Server unreachable: {loadError}</div>}

      {joinCode && joinStatus !== 'ok' && joinStatus !== 'checking' && (
        <div className="callout danger small" role="alert">
          {joinStatus === 'expired' ? 'This join link has expired.' : joinStatus === 'used_up' ? 'This join link has been used up.' : 'This join link is not valid.'} Ask a leader for a new one, or sign in if you already have an account.
        </div>
      )}
      {joining && (
        <div className="callout ok small">
          <span aria-hidden="true">✓</span>
          <span>
            {joinRole === 'leader' ? "You're invited as a leader of the STRY alliance app. Pick your in-game name, choose a PIN, and your leader account is ready." : "You're invited to the STRY alliance app. Pick your in-game name, choose a PIN, and you're in."}
          </span>
        </div>
      )}

      <div className="segmented" role="tablist" aria-label="Sign in or create account" hidden={joining}>
        <button type="button" role="tab" aria-selected={tab === 'signin'} onClick={() => setTab('signin')}>
          Sign in
        </button>
        <button type="button" role="tab" aria-selected={tab === 'register'} onClick={() => setTab('register')}>
          Create account
        </button>
      </div>

      {tab === 'signin' && !joinCode && (
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
        {joining && tab === 'register' && (
          <div className="field">
            <label>1. Who are you in the game?</label>
            {memberId ? (
              <button type="button" className="btn ghost block" onClick={() => setMemberId(null)}>
                {roster.find((m) => m.id === memberId)?.username ?? memberId} · change
              </button>
            ) : (
              <>
                <SearchInput value={memberQuery} onChange={setMemberQuery} placeholder="Search your in-game name" autoFocus />
                {memberQuery && (
                  <div className="list" role="listbox" aria-label="Members">
                    {filtered.map((m) => (
                      <button key={m.id} type="button" role="option" aria-selected={false} aria-disabled={m.taken || undefined} className="sheet-item" onClick={() => (m.taken ? setError(`Someone already joined as ${m.username}. If that is you, sign in instead; otherwise ask a leader.`) : pickMember(m))}>
                        <div className="grow">
                          <div className="label" style={m.taken ? { color: 'var(--text-3)' } : undefined}>{m.username}</div>
                          {m.taken && <div className="hint">Already joined · sign in instead</div>}
                        </div>
                      </button>
                    ))}
                    {filtered.length === 0 && <div className="faint">No match. You can skip this and a leader can link you later.</div>}
                  </div>
                )}
              </>
            )}
          </div>
        )}
        <div className="field">
          <label htmlFor="login-username">{joining && tab === 'register' ? '2. Username' : 'Username'}</label>
          <input id="login-username" className="input" autoComplete="username" autoCapitalize="none" value={username} onChange={(e) => { setUsername(e.target.value); setUsernameTouched(true); }} required />
          {joining && tab === 'register' && <p className="faint">Suggested from your in-game name; change it if you like. You'll use it to sign in.</p>}
        </div>
        <div className="field">
          <label htmlFor="login-password">{joining && tab === 'register' ? '3. PIN or password' : 'Password'}</label>
          <input id="login-password" className="input" type="password" autoComplete={tab === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={tab === 'register' ? 4 : undefined} />
          {tab === 'register' && <p className="faint">At least 4 characters; a 4-digit PIN is fine.</p>}
        </div>
        {tab === 'register' && !joining && (
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
          {busy ? <OrbitSpinner label="Signing in" /> : tab === 'signin' ? 'Sign in' : joining ? 'Join the alliance' : 'Create account'}
        </button>
        {joining && tab === 'register' && (
          <button type="button" className="link-btn" onClick={() => setTab('signin')}>
            Already have an account? Sign in
          </button>
        )}
        {joining && tab === 'signin' && (
          <button type="button" className="link-btn" onClick={() => setTab('register')}>
            New here? Join with your invite
          </button>
        )}
      </form>
      <p className="faint" style={{ textAlign: 'center' }}>
        Shared alliance data. Sessions stay signed in on this device for 90 days.
      </p>
    </main>
  );
}
