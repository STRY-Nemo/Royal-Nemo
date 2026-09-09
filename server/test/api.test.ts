/**
 * Integration test: boots the Worker locally with wrangler (miniflare + local
 * D1), applies migrations, and drives the API through the real HTTP surface.
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const PORT = 8790 + Math.floor(Math.random() * 100);
const BASE = `http://127.0.0.1:${PORT}`;
const SERVER_DIR = join(__dirname, '..');
const OWNER_CODE = 'owner-setup-test';
let proc: ChildProcess | null = null;
let persistDir = '';

async function waitForServer(): Promise<void> {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${BASE}/health`);
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('worker did not start');
}

interface Res<T = Record<string, unknown>> {
  status: number;
  body: T;
}

async function api<T = Record<string, unknown>>(method: string, path: string, body?: unknown, token?: string): Promise<Res<T>> {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, body: (await r.json()) as T };
}

beforeAll(async () => {
  persistDir = mkdtempSync(join(tmpdir(), 'stry-d1-'));
  const env = { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: 'true', NO_D1_WARNING: 'true' };
  const migrate = spawnSync('npx', ['wrangler', 'd1', 'migrations', 'apply', 'stry-alliance', '--local', '--persist-to', persistDir], { cwd: SERVER_DIR, env, encoding: 'utf8' });
  if (migrate.status !== 0) throw new Error(`migrations failed: ${migrate.stdout}\n${migrate.stderr}`);
  proc = spawn('npx', ['wrangler', 'dev', '--local', '--port', String(PORT), '--persist-to', persistDir, '--var', `OWNER_SETUP_CODE:${OWNER_CODE}`, '--var', 'ALLOWED_ORIGINS:http://localhost:5173'], {
    cwd: SERVER_DIR,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  proc.stderr?.on('data', (d) => {
    const s = String(d);
    if (/error/i.test(s)) process.stderr.write(s);
  });
  await waitForServer();
}, 120_000);

afterAll(async () => {
  if (proc) {
    proc.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 500));
    proc.kill('SIGKILL');
  }
  if (persistDir) rmSync(persistDir, { recursive: true, force: true });
});

describe('STRY API', () => {
  let leaderToken = '';
  let memberToken = '';
  let eventId = '';
  let lowToken = '';
  const memberId = 'stry-003'; // Appins

  it('bootstraps the first leader with the owner code and rejects bad invites', async () => {
    const bad = await api('POST', '/auth/register', { username: 'nobody', password: 'password123', invite_code: 'nope' });
    expect(bad.status).toBe(403);
    const short = await api('POST', '/auth/register', { username: 'nobody', password: '123', invite_code: OWNER_CODE });
    expect(short.status).toBe(400);
    // A 4-digit PIN is allowed; the owner code ignores capitalisation and surrounding spaces (phone keyboards).
    const owner = await api<{ token: string; account: { role: string; verified: boolean } }>('POST', '/auth/register', { username: 'ryan', password: '1234', invite_code: ` ${OWNER_CODE.toUpperCase()} `, member_id: 'stry-010' });
    expect(owner.status).toBe(200);
    expect(owner.body.account.role).toBe('leader');
    expect(owner.body.account.verified).toBe(true);
    leaderToken = owner.body.token;
    // Owner code no longer works once a leader exists.
    const again = await api('POST', '/auth/register', { username: 'ryan2', password: 'password123', invite_code: OWNER_CODE });
    expect(again.status).toBe(403);
    expect(again.body.error).toBe('owner_code_used');
  });

  it('serves seeded state to signed-in accounts only', async () => {
    const anon = await api('GET', '/state');
    expect(anon.status).toBe(401);
    const state = await api<{ members: unknown[]; events: { id: string; date: string; status: string }[]; organization: { responsibilities: unknown[] } }>('GET', '/state', undefined, leaderToken);
    expect(state.status).toBe(200);
    expect(state.body.members).toHaveLength(100);
    expect(state.body.organization.responsibilities).toHaveLength(16);
    expect(state.body.events).toHaveLength(1);
    expect(state.body.events[0].status).toBe('draft');
    eventId = state.body.events[0].id;
  });

  it('lets leaders create invites and members register with them', async () => {
    const inv = await api<{ invite: { code: string } }>('POST', '/invites', { role: 'member', uses: 2, days: 7 }, leaderToken);
    expect(inv.status).toBe(200);
    const reg = await api<{ token: string; account: { role: string; member_id: string } }>('POST', '/auth/register', { username: 'appins', password: 'password123', invite_code: inv.body.invite.code, member_id: memberId });
    expect(reg.status).toBe(200);
    expect(reg.body.account.role).toBe('member');
    expect(reg.body.account.member_id).toBe(memberId);
    memberToken = reg.body.token;
    const login = await api<{ token: string }>('POST', '/auth/login', { username: 'Appins', password: 'password123' });
    expect(login.status).toBe(200);
    const wrong = await api('POST', '/auth/login', { username: 'appins', password: 'wrong-password' });
    expect(wrong.status).toBe(401);
  });

  it('hides private notes from members and blocks leader-only actions', async () => {
    await api('POST', `/members/${memberId}`, { mechanical_notes: 'shot caller' }, leaderToken);
    const leaderState = await api<{ members: { id: string; mechanical_notes?: string }[] }>('GET', '/state', undefined, leaderToken);
    expect(leaderState.body.members.find((m) => m.id === memberId)?.mechanical_notes).toBe('shot caller');
    const memberState = await api<{ members: { id: string; mechanical_notes?: string }[]; audit: unknown[] }>('GET', '/state', undefined, memberToken);
    expect(memberState.body.members.find((m) => m.id === memberId)?.mechanical_notes).toBeUndefined();
    expect(memberState.body.audit).toHaveLength(0);
    expect((await api('POST', `/events/${eventId}/generate`, {}, memberToken)).status).toBe(403);
    expect((await api('POST', `/events/${eventId}/availability`, { member_id: 'stry-001', choice: 'either' }, memberToken)).status).toBe(403);
    expect((await api('POST', '/invites', { role: 'leader' }, memberToken)).status).toBe(403);
    expect((await api('GET', '/export', undefined, memberToken)).status).toBe(403);
  });

  it('records own availability, fills the rest, and generates a full lineup', async () => {
    const bySlots = await api<{ event: { availability: Record<string, { choice: string; slots?: { team1: number; team2: number } }> } }>('POST', `/events/${eventId}/availability`, { slots: { team1: 2, team2: 1 } }, memberToken);
    expect(bySlots.status).toBe(200);
    expect(bySlots.body.event.availability[memberId].choice).toBe('either');
    expect(bySlots.body.event.availability[memberId].slots).toEqual({ team1: 2, team2: 1 });
    const mine = await api<{ event: { availability: Record<string, { choice: string; recorded_by: string; slots?: unknown }> } }>('POST', `/events/${eventId}/availability`, { choice: 'team1' }, memberToken);
    expect(mine.status).toBe(200);
    expect(mine.body.event.availability[memberId].choice).toBe('team1');
    expect(mine.body.event.availability[memberId].slots).toBeUndefined();
    expect(mine.body.event.availability[memberId].recorded_by).toBe('self');
    const fill = await api<{ count: number }>('POST', `/events/${eventId}/availability/fill`, { choice: 'either' }, leaderToken);
    expect(fill.body.count).toBe(99);
    const gen = await api<{ event: { revision: number; assignments: { role: string; team_id: string }[] } }>('POST', `/events/${eventId}/generate`, {}, leaderToken);
    expect(gen.status).toBe(200);
    const starters = gen.body.event.assignments.filter((a) => a.role === 'starter');
    expect(starters).toHaveLength(40);
    expect(new Set(starters.map((a) => a.team_id)).size).toBe(2);
  });

  it('rejects stale revisions and enforces capacity and availability on locks', async () => {
    const state = await api<{ events: { id: string; revision: number; teams: { id: string }[]; assignments: { member_id: string; role: string; team_id: string }[] }[] }>('GET', '/state', undefined, leaderToken);
    const ev = state.body.events.find((e) => e.id === eventId)!;
    const stale = await api('POST', `/events/${eventId}/generate`, { expected_revision: ev.revision - 1 }, leaderToken);
    expect(stale.status).toBe(409);
    const reserve = ev.assignments.find((a) => a.role === 'reserve')!;
    const full = await api('POST', `/events/${eventId}/lock`, { member_id: reserve.member_id, team_id: ev.teams[0].id, reason: 'shot caller' }, leaderToken);
    expect(full.status).toBe(422);
    expect(String(full.body.message)).toMatch(/full/i);
    // Appins is team1-only: locking into team 2 must fail on availability.
    const wrongTime = await api('POST', `/events/${eventId}/lock`, { member_id: memberId, team_id: ev.teams[1].id, reason: 'shot caller' }, leaderToken);
    expect(wrongTime.status).toBe(422);
    expect(String(wrongTime.body.message)).toMatch(/not available/i);
  });

  it('blocks publishing until timezone and date are confirmed, then publishes and finalizes idempotently', async () => {
    const blocked = await api('POST', `/events/${eventId}/publish`, {}, leaderToken);
    expect(blocked.status).toBe(422);
    const sched = await api<{ event: { timezone: string; date_confirmed: boolean } }>('POST', `/events/${eventId}/schedule`, { timezone: 'Europe/Berlin', date_confirmed: true }, leaderToken);
    expect(sched.body.event.timezone).toBe('Europe/Berlin');
    const pub = await api<{ event: { status: string; revision: number } }>('POST', `/events/${eventId}/publish`, {}, leaderToken);
    expect(pub.status).toBe(200);
    expect(pub.body.event.status).toBe('published');
    // Member confirms own assignment; cannot confirm someone else's.
    const confirm = await api<{ event: { confirmations: Record<string, unknown> } }>('POST', `/events/${eventId}/confirm`, {}, memberToken);
    expect(confirm.status).toBe(200);
    expect(confirm.body.event.confirmations[memberId]).toBeTruthy();
    expect((await api('POST', `/events/${eventId}/confirm`, { member_id: 'stry-001' }, memberToken)).status).toBe(403);
    await api('POST', `/events/${eventId}/attendance`, { member_id: memberId, outcome: 'played' }, leaderToken);
    const fin = await api<{ event: { status: string }; next_event: { date: string; status: string } }>('POST', `/events/${eventId}/finalize`, {}, leaderToken);
    expect(fin.status).toBe(200);
    expect(fin.body.event.status).toBe('finalized');
    expect(fin.body.next_event.date).toBe('2026-09-18');
    const fin2 = await api<{ event: { status: string } }>('POST', `/events/${eventId}/finalize`, {}, leaderToken);
    expect(fin2.status).toBe(200);
    const state = await api<{ events: { id: string }[] }>('GET', '/state', undefined, leaderToken);
    expect(state.body.events).toHaveLength(2);
  });

  it('imports an in-game team screen into the next draft: leaders only, validated, locked', async () => {
    const state = await api<{ events: { id: string; date: string; status: string; revision: number; timezone: string | null; teams: { id: string }[] }[] }>('GET', '/state', undefined, leaderToken);
    const next = state.body.events.find((e) => e.status === 'draft')!;
    const row = (username: string, extra: Record<string, unknown>) => ({ username, team: 2, starter: false, substitute: false, ready: false, declined: false, other_team: null, event_date: next.date, ...extra });
    const records = [row('Queen Rouge', { starter: true }), row('Mario AK47', { starter: true, ready: true }), row('Appins', { substitute: true }), row('Mada', { other_team: 1 }), row('Nobody Known', { starter: true }), row('hausshavoc', { declined: true })];
    expect((await api('POST', `/events/${next.id}/import-lineup`, { records }, memberToken)).status).toBe(403);
    expect((await api('POST', `/events/${next.id}/import-lineup`, { records: [] }, leaderToken)).status).toBe(400);
    const wrongDate = await api('POST', `/events/${next.id}/import-lineup`, { records: records.map((r) => ({ ...r, event_date: '2026-09-11' })) }, leaderToken);
    expect(wrongDate.status).toBe(422);
    expect(String(wrongDate.body.message)).toMatch(/2026-09-11/);
    const stale = await api('POST', `/events/${next.id}/import-lineup`, { records, expected_revision: next.revision + 5 }, leaderToken);
    expect(stale.status).toBe(409);
    const ok = await api<{ event: { revision: number; timezone: string; availability: Record<string, { choice: string }>; assignments: { member_id: string; role: string; team_id: string; locked: boolean; lock_reason: string }[] }; summary: { starters: number; reserves: number; unmatched: string[] } }>(
      'POST',
      `/events/${next.id}/import-lineup`,
      { records, source: 'Team2.xlsx', expected_revision: next.revision },
      leaderToken,
    );
    expect(ok.status).toBe(200);
    expect(ok.body.summary).toMatchObject({ starters: 2, reserves: 1, unmatched: ['Nobody Known'] });
    expect(ok.body.event.revision).toBe(next.revision + 1);
    // The next-week draft inherited the finalized event's zone; an import never overrides a zone that is already set.
    expect(ok.body.event.timezone).toBe(next.timezone);
    const team2 = next.teams[1].id;
    expect(ok.body.event.assignments.filter((a) => a.role === 'starter' && a.team_id === team2)).toHaveLength(2);
    expect(ok.body.event.assignments.every((a) => a.locked && a.lock_reason === 'In-game Team 2 lineup (Team2.xlsx)')).toBe(true);
    expect(ok.body.event.availability[memberId].choice).toBe('team2');
    expect(ok.body.event.availability['stry-024'].choice).toBe('team1');
  });

  it('opens drafts up to four Fridays ahead for leaders only, idempotently', async () => {
    expect((await api('POST', '/events/upcoming', {}, memberToken)).status).toBe(403);
    const first = await api<{ events: { date: string; status: string }[]; created: number; dates: string[] }>('POST', '/events/upcoming', { weeks: 4 }, leaderToken);
    expect(first.status).toBe(200);
    expect(first.body.dates).toHaveLength(4);
    expect(first.body.created).toBeGreaterThan(0);
    const again = await api<{ created: number }>('POST', '/events/upcoming', {}, leaderToken);
    expect(again.body.created).toBe(0);
    const state = await api<{ events: { date: string; status: string }[] }>('GET', '/state', undefined, leaderToken);
    const open = state.body.events.filter((e) => e.status === 'draft');
    expect(open.map((e) => e.date)).toEqual(expect.arrayContaining(first.body.dates.filter((d) => !state.body.events.some((e) => e.date === d && e.status !== 'draft'))));
    expect(open.length).toBeLessThanOrEqual(4);
  });

  it('limits Organize to leaders, R4/R5 and designated editors with a verified link', async () => {
    // Appins is R4 but the link is unverified: refused until a leader verifies it.
    const unverified = await api('POST', '/organization/tasks', { op: 'add', title: 'Nope' }, memberToken);
    expect(unverified.status).toBe(403);
    expect(String(unverified.body.message)).toMatch(/verify/i);
    // A low-rank member account: refused, then designated, verified, allowed, and refused again once removed.
    const state = await api<{ members: { id: string; rank: string }[] }>('GET', '/state', undefined, leaderToken);
    const low = state.body.members.find((m) => m.rank !== 'R4' && m.rank !== 'R5')!;
    const inv = await api<{ invite: { code: string } }>('POST', '/invites', { role: 'member' }, leaderToken);
    const reg = await api<{ token: string }>('POST', '/auth/register', { username: 'lowrank', password: '1234', invite_code: inv.body.invite.code, member_id: low.id });
    expect(reg.status).toBe(200);
    lowToken = reg.body.token;
    expect((await api('POST', '/organization/tasks', { op: 'add', title: 'Nope' }, lowToken)).status).toBe(403);
    const designate = await api<{ organization: { designated_editors: string[] } }>('POST', '/organization/editors', { member_id: low.id, on: true }, leaderToken);
    expect(designate.status).toBe(200);
    expect(designate.body.organization.designated_editors).toEqual([low.id]);
    expect((await api('POST', '/organization/tasks', { op: 'add', title: 'Nope' }, lowToken)).status).toBe(403);
    const accounts = await api<{ accounts: { id: string; username: string }[] }>('GET', '/accounts', undefined, leaderToken);
    const acct = accounts.body.accounts.find((a) => a.username === 'lowrank')!;
    expect((await api('POST', `/accounts/${acct.id}`, { verified: true }, leaderToken)).status).toBe(200);
    const allowed = await api<{ organization: { responsibilities: { title: string }[] } }>('POST', '/organization/tasks', { op: 'add', title: 'Designated task' }, lowToken);
    expect(allowed.status).toBe(200);
    expect(allowed.body.organization.responsibilities.some((r) => r.title === 'Designated task')).toBe(true);
    expect((await api('POST', '/organization/editors', { member_id: low.id, on: false }, leaderToken)).status).toBe(200);
    expect((await api('POST', '/organization/tasks', { op: 'rename', id: 'x', title: 'y' }, lowToken)).status).toBe(403);
  });

  it('checks join links publicly and accepts codes in any case', async () => {
    const inv = await api<{ invite: { code: string } }>('POST', '/invites', { role: 'member', uses: 2, days: 3 }, leaderToken);
    const ok = await api<{ valid: boolean; role: string; uses_left: number }>('GET', `/invites/${inv.body.invite.code.toLowerCase()}/check`);
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ valid: true, role: 'member', uses_left: 2 });
    expect((await api<{ valid: boolean; reason: string }>('GET', '/invites/NOPE1234/check')).body).toEqual({ valid: false, reason: 'unknown' });
    const reg = await api<{ account: { role: string } }>('POST', '/auth/register', { username: 'joiner', password: '2468', invite_code: inv.body.invite.code.toLowerCase() });
    expect(reg.status).toBe(200);
    expect(reg.body.account.role).toBe('member');
    expect((await api<{ uses_left: number }>('GET', `/invites/${inv.body.invite.code}/check`)).body.uses_left).toBe(1);
    await api('DELETE', `/invites/${inv.body.invite.code}`, undefined, leaderToken);
    expect((await api<{ valid: boolean }>('GET', `/invites/${inv.body.invite.code}/check`)).body.valid).toBe(false);
  });

  it('feeds the shared bear with a per-person cooldown', async () => {
    const st = await api<{ mascot: { feeds: number; revision: number } }>('GET', '/state', undefined, memberToken);
    expect(st.body.mascot.feeds).toBe(0);
    const first = await api<{ mascot: { feeds: number; last_feeder_name: string }; stage: { n: number }; evolved: boolean }>('POST', '/mascot/feed', undefined, memberToken);
    expect(first.status).toBe(200);
    expect(first.body.mascot.feeds).toBe(1);
    expect(first.body.mascot.last_feeder_name).toBe('Appins');
    expect(first.body.stage.n).toBe(1);
    const again = await api('POST', '/mascot/feed', undefined, memberToken);
    expect(again.status).toBe(429);
    expect(again.body.error).toBe('cooldown');
    // Another person is not blocked by my cooldown.
    const other = await api<{ mascot: { feeds: number } }>('POST', '/mascot/feed', undefined, leaderToken);
    expect(other.status).toBe(200);
    expect(other.body.mascot.feeds).toBe(2);
    expect((await api('POST', '/mascot/feed')).status).toBe(401);
  });

  it('edits organization slots atomically with revision checks and undo inverses', async () => {
    const state = await api<{ organization: { revision: number; responsibilities: { id: string; slots: { position: number; source_name: string | null }[] }[] } }>('GET', '/state', undefined, leaderToken);
    const org = state.body.organization;
    const gw = org.responsibilities[0];
    const edit = await api<{ organization: { revision: number; responsibilities: { slots: { member_id: string | null }[] }[] }; inverse: unknown[] }>('POST', '/organization/slots', { expected_revision: org.revision, edits: [{ responsibility_id: gw.id, position: 4, value: { kind: 'member', member_id: 'stry-010' } }] }, leaderToken);
    expect(edit.status).toBe(200);
    expect(edit.body.organization.responsibilities[0].slots[3].member_id).toBe('stry-010');
    expect(edit.body.inverse).toHaveLength(1);
    const dup = await api('POST', '/organization/slots', { expected_revision: edit.body.organization.revision, edits: [{ responsibility_id: gw.id, position: 3, value: { kind: 'member', member_id: 'stry-010' } }] }, leaderToken);
    expect(dup.status).toBe(422);
    const stale = await api('POST', '/organization/slots', { expected_revision: org.revision, edits: edit.body.inverse }, leaderToken);
    expect(stale.status).toBe(409);
    const undo = await api<{ organization: { responsibilities: { slots: { member_id: string | null }[] }[] } }>('POST', '/organization/slots', { expected_revision: edit.body.organization.revision, edits: edit.body.inverse }, leaderToken);
    expect(undo.status).toBe(200);
    expect(undo.body.organization.responsibilities[0].slots[3].member_id).toBeNull();
    expect((await api('POST', '/organization/slots', { edits: [] }, memberToken)).status).toBe(403);
  });

  it('manages accounts: last leader cannot demote themselves; disabled accounts lose sessions', async () => {
    const list = await api<{ accounts: { id: string; username: string }[] }>('GET', '/accounts', undefined, leaderToken);
    expect(list.body.accounts.map((a) => a.username).sort()).toEqual(['appins', 'joiner', 'lowrank', 'ryan']);
    const me = list.body.accounts.find((a) => a.username === 'ryan')!;
    const appins = list.body.accounts.find((a) => a.username === 'appins')!;
    expect((await api('POST', `/accounts/${me.id}`, { role: 'member' }, leaderToken)).status).toBe(422);
    expect((await api('POST', `/accounts/${appins.id}`, { verified: true }, leaderToken)).status).toBe(200);
    expect((await api('POST', `/accounts/${appins.id}`, { disabled: true }, leaderToken)).status).toBe(200);
    expect((await api('GET', '/me', undefined, memberToken)).status).toBe(401);
    const exp = await api<{ members: unknown[]; audit: unknown[] }>('GET', '/export', undefined, leaderToken);
    expect(exp.body.members).toHaveLength(100);
    expect(exp.body.audit.length).toBeGreaterThan(5);
  });

  it('answers CORS preflight only for allowed origins', async () => {
    const ok = await fetch(`${BASE}/state`, { method: 'OPTIONS', headers: { origin: 'http://localhost:5173', 'access-control-request-method': 'GET' } });
    expect(ok.status).toBe(204);
    expect(ok.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
    const nope = await fetch(`${BASE}/state`, { method: 'OPTIONS', headers: { origin: 'https://evil.example', 'access-control-request-method': 'GET' } });
    expect(nope.headers.get('access-control-allow-origin')).toBeNull();
  });
});
