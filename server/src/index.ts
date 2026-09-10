/**
 * STRY alliance API (Cloudflare Worker + D1).
 *
 * Every mutation runs the same pure engine functions as the client
 * (src/engine) and is written with a revision compare-and-set, so capacity,
 * uniqueness, availability, role permissions and stale edits are enforced
 * server-side regardless of what the UI sends.
 */
import type { AttendanceOutcome, AvailabilityChoice, CanyonEvent, Member, OrganizationState, Settings, SlotPriorities, SlotPriority, TeamId } from '../../src/domain/types';
import { choiceFromSlots } from '../../src/engine/suggest';
import { SERIES_ID } from '../../src/data/seed';
import * as L from '../../src/engine/lifecycle';
import { applyLineupImport, type LineupRecord } from '../../src/engine/lineupImport';
import * as O from '../../src/engine/organization';
import { isValidTimeZone, todayInZone } from '../../src/engine/recurrence';
import {
  accountFromRequest,
  createSession,
  deleteSession,
  findAccountByUsername,
  hashPassword,
  leaderCount,
  newId,
  randomToken,
  requireAccount,
  requireLeader,
  rowToAccount,
  validatePassword,
  validateUsername,
  verifyPassword,
} from './auth';
import { auditStatement, ensureSeeded, insertEvent, loadDocument, loadEvent, loadEvents, loadMascot, loadMember, loadMembers, loadOrganization, loadSettings, loadSuggestion, loadSuggestions, recentAudit, saveDocumentCas, saveEventCas, saveMember, saveSuggestion } from './db';
import { createSuggestion, setSuggestionStatus, toggleVote } from '../../src/engine/suggestions';
import { feedMascot, MascotError } from '../../src/engine/mascot';
import { applyStats, type StatsPatch } from '../../src/engine/memberStats';
import type { Account, Env } from './env';
import { HttpError } from './env';
import { corsHeaders, num, readJson, Router, str, type Ctx } from './router';

const router = new Router();

function actorFor(account: Account): string {
  return account.member_id ?? `account:${account.id}`;
}

function ctxFor(account: Account, now: Date): L.Context {
  return { actor: actorFor(account), now: now.toISOString() };
}

function stripPrivate(members: Member[], account: Account | null): Member[] {
  if (account?.role === 'leader') return members;
  return members.map((m) => {
    const { mechanical_notes: _omit, ...rest } = m;
    void _omit;
    return rest;
  });
}

/** Translates engine errors into HTTP errors. */
function mapError(err: unknown): never {
  if (err instanceof HttpError) throw err;
  if (err instanceof L.LifecycleError) {
    const status = err.code === 'stale_revision' ? 409 : err.code === 'forbidden' ? 403 : 422;
    throw new HttpError(status, err.code, err.message);
  }
  throw err;
}

/** Loads an event, applies a lifecycle function and writes it back with compare-and-set. */
async function mutateEvent(ctx: Ctx, id: string, fn: (event: CanyonEvent) => L.Result): Promise<CanyonEvent> {
  const event = await loadEvent(ctx.env, id);
  let res: L.Result;
  try {
    res = fn(event);
  } catch (err) {
    mapError(err);
  }
  await saveEventCas(ctx.env, event, res!.event, res!.audit, ctx.now);
  return res!.event;
}

async function mutateOrganization(ctx: Ctx, fn: (org: OrganizationState) => O.OrgResult): Promise<{ organization: OrganizationState; inverse: O.SlotEdit[] }> {
  const { doc, revision } = await loadDocument<OrganizationState>(ctx.env, 'organization');
  let res: O.OrgResult;
  try {
    res = fn(doc);
  } catch (err) {
    mapError(err);
  }
  await saveDocumentCas(ctx.env, 'organization', revision, res!.state, res!.state.revision, res!.audit, ctx.now);
  return { organization: res!.state, inverse: res!.inverse };
}

/** Organize access: leaders, verified R4/R5 members, and designated editors. */
async function requireOrganizer(ctx: Ctx): Promise<Account> {
  const account = requireAccount(ctx.account);
  if (account.role === 'leader') return account;
  if (!account.member_id) throw new HttpError(403, 'forbidden', 'Organize is for R4, R5 and designated leaders. Link your roster member first.');
  const [member, org] = await Promise.all([loadMember(ctx.env, account.member_id), loadOrganization(ctx.env)]);
  if (!O.canOrganize('member', member, org, account.verified)) {
    throw new HttpError(403, 'forbidden', account.verified ? 'Organize is for R4, R5 and designated leaders.' : 'A leader must verify your roster link before you can use Organize.');
  }
  return account;
}

function expected(body: Record<string, unknown>): number | undefined {
  return num(body, 'expected_revision', false);
}

// ---- Health -------------------------------------------------------------------
router.get('/health', async () => {
  // Exercise password hashing so a runtime limit (e.g. PBKDF2 iterations) shows up here, not at sign-up.
  let crypto_ok = true;
  try {
    await hashPassword('health-probe');
  } catch {
    crypto_ok = false;
  }
  return { ok: crypto_ok, service: 'stry-alliance-api', crypto_ok };
});

// ---- Auth ---------------------------------------------------------------------
/** Username of the enabled account already linked to this roster member (ignoring `except`), or null. */
async function memberClaimedBy(env: Env, memberId: string, except?: string): Promise<string | null> {
  const row = await env.DB.prepare('SELECT id, username FROM accounts WHERE member_id = ? AND disabled = 0').bind(memberId).all<{ id: string; username: string }>();
  const other = row.results.find((r) => r.id !== except);
  return other ? other.username : null;
}

function claimedError(memberName: string, by: string): HttpError {
  return new HttpError(409, 'member_claimed', `Someone already joined as ${memberName} (account "${by}"). If that is you, sign in instead; otherwise ask a leader.`);
}

router.post('/auth/register', async (ctx) => {
  const body = await ctx.body();
  const username = validateUsername(str(body, 'username'));
  const password = str(body, 'password');
  validatePassword(password);
  const inviteCode = str(body, 'invite_code').trim();
  const ownerCode = (ctx.env.OWNER_SETUP_CODE ?? '').trim();
  // Phone keyboards often change capitalisation; the owner code is compared case-insensitively.
  const matchesOwnerCode = ownerCode !== '' && inviteCode.localeCompare(ownerCode, undefined, { sensitivity: 'accent' }) === 0;
  const memberId = str(body, 'member_id', false) || null;

  if (await findAccountByUsername(ctx.env, username)) throw new HttpError(409, 'username_taken', 'That username is already taken.');
  if (memberId) {
    const member = await loadMember(ctx.env, memberId);
    const by = await memberClaimedBy(ctx.env, memberId);
    if (by) throw claimedError(member.username, by);
  }

  let role: 'leader' | 'member' = 'member';
  let verified = false;
  const invite = await ctx.env.DB.prepare('SELECT * FROM invites WHERE code = ?').bind(inviteCode.toUpperCase()).first<{ code: string; role: 'leader' | 'member'; uses_left: number; expires_at: string }>();
  if (invite && invite.uses_left > 0 && invite.expires_at > ctx.now.toISOString()) {
    role = invite.role;
    await ctx.env.DB.prepare('UPDATE invites SET uses_left = uses_left - 1 WHERE code = ? AND uses_left > 0').bind(invite.code).run();
  } else if (matchesOwnerCode && (await leaderCount(ctx.env)) === 0) {
    role = 'leader';
    verified = true;
  } else if (matchesOwnerCode) {
    throw new HttpError(403, 'owner_code_used', 'The owner setup code was already used to create the first leader. Sign in with that account, or ask that leader for an invite code.');
  } else {
    throw new HttpError(403, 'bad_invite', 'That invite code is not valid. Ask a leader for a new one.');
  }

  const { hash, salt } = await hashPassword(password);
  const id = newId('acct');
  await ctx.env.DB.prepare('INSERT INTO accounts (id, username, password_hash, salt, role, member_id, verified, disabled, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)')
    .bind(id, username, hash, salt, role, memberId, verified ? 1 : 0, ctx.now.toISOString())
    .run();
  const token = await createSession(ctx.env, id, ctx.now);
  const account: Account = { id, username, role, member_id: memberId, verified, disabled: false, created_at: ctx.now.toISOString() };
  return { token, account };
});

router.post('/auth/login', async (ctx) => {
  const body = await ctx.body();
  const username = str(body, 'username').trim();
  const password = str(body, 'password');
  const row = await findAccountByUsername(ctx.env, username);
  if (!row || row.disabled === 1 || !(await verifyPassword(password, row.password_hash, row.salt))) {
    throw new HttpError(401, 'bad_credentials', 'Wrong username or password.');
  }
  const token = await createSession(ctx.env, row.id, ctx.now);
  return { token, account: rowToAccount(row) };
});

router.post('/auth/logout', async (ctx) => {
  const header = ctx.request.headers.get('authorization') ?? '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (token) await deleteSession(ctx.env, token);
  return { ok: true };
});

router.post('/auth/password', async (ctx) => {
  const account = requireAccount(ctx.account);
  const body = await ctx.body();
  const current = str(body, 'current_password');
  const next = str(body, 'new_password');
  validatePassword(next);
  const row = await findAccountByUsername(ctx.env, account.username);
  if (!row || !(await verifyPassword(current, row.password_hash, row.salt))) throw new HttpError(401, 'bad_credentials', 'Current password is wrong.');
  const { hash, salt } = await hashPassword(next);
  await ctx.env.DB.prepare('UPDATE accounts SET password_hash = ?, salt = ? WHERE id = ?').bind(hash, salt, account.id).run();
  return { ok: true };
});

router.get('/me', async (ctx) => ({ account: requireAccount(ctx.account) }));

/** A signed-in account without a linked member can link itself once (unverified until a leader confirms). */
router.post('/me/link', async (ctx) => {
  const account = requireAccount(ctx.account);
  const body = await ctx.body();
  const memberId = str(body, 'member_id');
  if (account.member_id) throw new HttpError(422, 'already_linked', 'Ask a leader to change your linked member.');
  const member = await loadMember(ctx.env, memberId);
  const by = await memberClaimedBy(ctx.env, memberId, account.id);
  if (by) throw claimedError(member.username, by);
  await ctx.env.DB.prepare('UPDATE accounts SET member_id = ?, verified = 0 WHERE id = ? AND member_id IS NULL').bind(memberId, account.id).run();
  return { account: { ...account, member_id: memberId, verified: false } };
});

/** Public minimal roster (id + username) so a new member can pick themselves while registering. */
router.get('/roster', async (ctx) => {
  const members = await loadMembers(ctx.env);
  const linked = await ctx.env.DB.prepare('SELECT member_id FROM accounts WHERE member_id IS NOT NULL AND disabled = 0').all<{ member_id: string }>();
  const taken = new Set(linked.results.map((r) => r.member_id));
  return { roster: members.filter((m) => m.active).map((m) => ({ id: m.id, username: m.username, taken: taken.has(m.id) })) };
});

// ---- Bootstrap state ---------------------------------------------------------------
router.get('/state', async (ctx) => {
  const account = requireAccount(ctx.account);
  const [members, events, organization, settings, audit, mascot] = await Promise.all([
    loadMembers(ctx.env),
    loadEvents(ctx.env),
    loadOrganization(ctx.env),
    loadSettings(ctx.env),
    account.role === 'leader' ? recentAudit(ctx.env) : Promise.resolve([]),
    loadMascot(ctx.env, ctx.now),
  ]);
  const suggestions = await loadSuggestions(ctx.env);
  return { members: stripPrivate(members, account), events, organization, settings, audit, mascot: mascot.doc, suggestions, account, server_time: ctx.now.toISOString() };
});

router.get('/export', async (ctx) => {
  requireLeader(ctx.account);
  const [members, events, organization, settings, audit] = await Promise.all([loadMembers(ctx.env), loadEvents(ctx.env), loadOrganization(ctx.env), loadSettings(ctx.env), recentAudit(ctx.env, 5000)]);
  return { exported_at: ctx.now.toISOString(), members, events, organization, settings, audit };
});

// ---- Events ------------------------------------------------------------------------
router.post('/events/:id/availability', async (ctx) => {
  const account = requireAccount(ctx.account);
  const body = await ctx.body();
  let slots: SlotPriorities | undefined;
  if (body.slots && typeof body.slots === 'object') {
    const raw = body.slots as Record<string, unknown>;
    const pick = (v: unknown): SlotPriority => (v === 1 || v === 2 ? v : 0);
    slots = { team1: pick(raw.team1), team2: pick(raw.team2) };
  }
  const choice = (slots ? choiceFromSlots(slots) : str(body, 'choice')) as AvailabilityChoice;
  if (!['team1', 'team2', 'either', 'unavailable'].includes(choice)) throw new HttpError(400, 'bad_request', 'Invalid availability choice.');
  const requested = str(body, 'member_id', false) || account.member_id;
  if (!requested) throw new HttpError(400, 'no_member', 'Link your roster member first.');
  const self = requested === account.member_id;
  if (!self && account.role !== 'leader') throw new HttpError(403, 'forbidden', 'You can only change your own availability.');
  await loadMember(ctx.env, requested);
  const event = await mutateEvent(ctx, ctx.params.id, (e) => L.setAvailability(e, requested, choice, ctxFor(account, ctx.now), self ? 'self' : actorFor(account), slots));
  return { event };
});

router.post('/events/:id/availability/fill', async (ctx) => {
  const account = requireLeader(ctx.account);
  const body = await ctx.body();
  const choice = str(body, 'choice') as AvailabilityChoice;
  if (!['team1', 'team2', 'either', 'unavailable'].includes(choice)) throw new HttpError(400, 'bad_request', 'Invalid availability choice.');
  const members = await loadMembers(ctx.env);
  let count = 0;
  const event = await mutateEvent(ctx, ctx.params.id, (e) => {
    let next = e;
    const audit: L.Result['audit'] = [];
    for (const m of members) {
      if (!m.active || next.availability[m.id]) continue;
      const r = L.setAvailability(next, m.id, choice, ctxFor(account, ctx.now), actorFor(account));
      next = r.event;
      audit.push(...r.audit);
      count++;
    }
    return { event: next, audit };
  });
  return { event, count };
});

router.post('/events/:id/generate', async (ctx) => {
  const account = requireLeader(ctx.account);
  const body = await ctx.body();
  const [members, events] = await Promise.all([loadMembers(ctx.env), loadEvents(ctx.env)]);
  const event = await mutateEvent(ctx, ctx.params.id, (e) => L.applySuggestions(e, members, events, ctxFor(account, ctx.now), expected(body) ?? e.revision));
  return { event };
});

router.post('/events/:id/import-lineup', async (ctx) => {
  const account = requireLeader(ctx.account);
  const body = await ctx.body();
  const raw = Array.isArray(body.records) ? (body.records as Record<string, unknown>[]) : [];
  if (!raw.length || raw.length > 500) throw new HttpError(400, 'bad_request', 'records must be a non-empty list.');
  const records: LineupRecord[] = raw.map((r) => ({
    username: String(r.username ?? '').trim(),
    team: r.team === 1 ? 1 : 2,
    starter: r.starter === true,
    substitute: r.substitute === true,
    ready: r.ready === true,
    declined: r.declined === true,
    other_team: r.other_team === 1 ? 1 : r.other_team === 2 ? 2 : null,
    event_date: typeof r.event_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.event_date) ? r.event_date : null,
  }));
  if (records.some((r) => !r.username)) throw new HttpError(400, 'bad_request', 'Every record needs a username.');
  const source = str(body, 'source', false)?.slice(0, 120) || undefined;
  const [members, org] = await Promise.all([loadMembers(ctx.env), loadOrganization(ctx.env)]);
  let summary: unknown = null;
  const event = await mutateEvent(ctx, ctx.params.id, (e) => {
    const res = applyLineupImport(e, records, members, org.name_mapping, ctxFor(account, ctx.now), { expectedRevision: expected(body), source });
    summary = { starters: res.plan.starters.length, reserves: res.plan.reserves.length, unmatched: res.plan.unmatched.map((r) => r.username), availability_changes: res.plan.availability.length };
    return res;
  });
  return { event, summary };
});

router.post('/events/:id/lock', async (ctx) => {
  const account = requireLeader(ctx.account);
  const body = await ctx.body();
  const event = await mutateEvent(ctx, ctx.params.id, (e) => L.lockMember(e, str(body, 'member_id'), str(body, 'team_id') as TeamId, str(body, 'reason'), ctxFor(account, ctx.now), expected(body)));
  return { event };
});

router.post('/events/:id/unlock', async (ctx) => {
  const account = requireLeader(ctx.account);
  const body = await ctx.body();
  const event = await mutateEvent(ctx, ctx.params.id, (e) => L.unlockMember(e, str(body, 'member_id'), ctxFor(account, ctx.now), expected(body)));
  return { event };
});

router.post('/events/:id/move', async (ctx) => {
  const account = requireLeader(ctx.account);
  const body = await ctx.body();
  const target = str(body, 'target');
  const event = await mutateEvent(ctx, ctx.params.id, (e) => L.moveMember(e, str(body, 'member_id'), target as L.MoveTarget, ctxFor(account, ctx.now), expected(body)));
  return { event };
});

router.post('/events/:id/swap', async (ctx) => {
  const account = requireLeader(ctx.account);
  const body = await ctx.body();
  const event = await mutateEvent(ctx, ctx.params.id, (e) => L.swapMembers(e, str(body, 'a'), str(body, 'b'), ctxFor(account, ctx.now), expected(body)));
  return { event };
});

router.post('/events/:id/restore', async (ctx) => {
  const account = requireLeader(ctx.account);
  const body = await ctx.body();
  const assignments = body.assignments;
  if (!Array.isArray(assignments)) throw new HttpError(400, 'bad_request', 'Missing "assignments".');
  const event = await mutateEvent(ctx, ctx.params.id, (e) => L.replaceAssignments(e, assignments as CanyonEvent['assignments'], ctxFor(account, ctx.now), expected(body)));
  return { event };
});

router.post('/events/:id/publish', async (ctx) => {
  const account = requireLeader(ctx.account);
  const body = await ctx.body();
  const event = await mutateEvent(ctx, ctx.params.id, (e) => L.publishEvent(e, ctxFor(account, ctx.now), expected(body)));
  return { event };
});

router.post('/events/:id/confirm', async (ctx) => {
  const account = requireAccount(ctx.account);
  const body = await ctx.body();
  const requested = str(body, 'member_id', false) || account.member_id;
  if (!requested) throw new HttpError(400, 'no_member', 'Link your roster member first.');
  if (requested !== account.member_id && account.role !== 'leader') throw new HttpError(403, 'forbidden', 'You can only confirm your own assignment.');
  const event = await mutateEvent(ctx, ctx.params.id, (e) => L.confirmAssignment(e, requested, ctxFor(account, ctx.now)));
  return { event };
});

router.post('/events/:id/attendance', async (ctx) => {
  const account = requireLeader(ctx.account);
  const body = await ctx.body();
  const outcome = str(body, 'outcome') as AttendanceOutcome;
  if (!['played', 'no_show', 'withdrew', 'unused_reserve', 'unknown'].includes(outcome)) throw new HttpError(400, 'bad_request', 'Invalid outcome.');
  const memberId = str(body, 'member_id');
  await loadMember(ctx.env, memberId);
  const opts: { team_id?: TeamId | null; substitute?: boolean } = {};
  if ('team_id' in body) opts.team_id = (body.team_id as TeamId | null) ?? null;
  if (typeof body.substitute === 'boolean') opts.substitute = body.substitute;
  const event = await mutateEvent(ctx, ctx.params.id, (e) => L.recordAttendance(e, memberId, outcome, ctxFor(account, ctx.now), opts));
  return { event };
});

router.post('/events/:id/finalize', async (ctx) => {
  const account = requireLeader(ctx.account);
  const settings = await loadSettings(ctx.env);
  const event = await mutateEvent(ctx, ctx.params.id, (e) => L.finalizeEvent(e, ctxFor(account, ctx.now)));
  // Idempotently create next week's draft.
  const events = await loadEvents(ctx.env);
  const next = L.ensureNextWeekDraft(events, { series_id: SERIES_ID, afterDate: event.date, timezone: event.timezone ?? settings.timezone, team_times: settings.default_team_times });
  if (next.created) await insertEvent(ctx.env, next.event, ctx.now);
  return { event, next_event: next.event };
});

router.post('/events/:id/cancel', async (ctx) => {
  const account = requireLeader(ctx.account);
  const body = await ctx.body();
  const event = await mutateEvent(ctx, ctx.params.id, (e) => L.cancelEvent(e, ctxFor(account, ctx.now), str(body, 'reason', false) || 'Canceled by leader'));
  return { event };
});

router.post('/events/:id/schedule', async (ctx) => {
  const account = requireLeader(ctx.account);
  const body = await ctx.body();
  const patch: Parameters<typeof L.updateSchedule>[1] = {};
  if (typeof body.date === 'string') patch.date = body.date;
  if ('timezone' in body) patch.timezone = typeof body.timezone === 'string' && body.timezone ? body.timezone : null;
  if (typeof body.date_confirmed === 'boolean') patch.date_confirmed = body.date_confirmed;
  if (body.team_times && typeof body.team_times === 'object') patch.team_times = body.team_times as { team1?: string; team2?: string };
  const event = await mutateEvent(ctx, ctx.params.id, (e) => L.updateSchedule(e, patch, ctxFor(account, ctx.now)));
  return { event };
});

router.post('/events/next-week', async (ctx) => {
  requireLeader(ctx.account);
  const [events, settings] = await Promise.all([loadEvents(ctx.env), loadSettings(ctx.env)]);
  const latest = [...events].filter((e) => e.status !== 'canceled').sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const afterDate = latest ? latest.date : todayInZone(settings.timezone ?? 'UTC', ctx.now);
  const next = L.ensureNextWeekDraft(events, { series_id: SERIES_ID, afterDate, timezone: settings.timezone, team_times: settings.default_team_times });
  if (next.created) await insertEvent(ctx.env, next.event, ctx.now);
  return { event: next.event, created: next.created };
});

router.post('/events/upcoming', async (ctx) => {
  requireLeader(ctx.account);
  const body = await ctx.body();
  const weeks = num(body, 'weeks', false) ?? L.MAX_WEEKS_AHEAD;
  const [events, settings] = await Promise.all([loadEvents(ctx.env), loadSettings(ctx.env)]);
  const fromDate = todayInZone(settings.timezone ?? 'UTC', ctx.now);
  const res = L.ensureUpcomingDrafts(events, { series_id: SERIES_ID, fromDate, weeks, timezone: settings.timezone, team_times: settings.default_team_times });
  for (const e of res.created) await insertEvent(ctx.env, e, ctx.now);
  return { events: [...events, ...res.created], created: res.created.length, dates: res.dates };
});

// ---- Suggestions (Ideas tab) -----------------------------------------------------
router.get('/suggestions', async (ctx) => {
  requireAccount(ctx.account);
  return { suggestions: await loadSuggestions(ctx.env) };
});

router.post('/suggestions', async (ctx) => {
  const account = requireAccount(ctx.account);
  const body = await ctx.body();
  const member = account.member_id ? await loadMember(ctx.env, account.member_id).catch(() => null) : null;
  const existing = await loadSuggestions(ctx.env);
  let s;
  try {
    s = createSuggestion(existing, { id: newId('idea'), account_id: account.id, member_id: account.member_id, author_name: member?.username ?? account.username, title: str(body, 'title'), body: str(body, 'body', false) ?? '', now: ctx.now.toISOString() });
  } catch (err) {
    mapError(err);
  }
  await saveSuggestion(ctx.env, s!);
  return { suggestion: s };
});

router.post('/suggestions/:id/vote', async (ctx) => {
  const account = requireAccount(ctx.account);
  const s = toggleVote(await loadSuggestion(ctx.env, ctx.params.id), account.id, ctx.now.toISOString());
  await saveSuggestion(ctx.env, s);
  return { suggestion: s };
});

router.post('/suggestions/:id/status', async (ctx) => {
  requireLeader(ctx.account);
  const body = await ctx.body();
  let s;
  try {
    s = setSuggestionStatus(await loadSuggestion(ctx.env, ctx.params.id), str(body, 'status') as Parameters<typeof setSuggestionStatus>[1], typeof body.reply === 'string' ? body.reply : null, ctx.now.toISOString());
  } catch (err) {
    mapError(err);
  }
  await saveSuggestion(ctx.env, s!);
  return { suggestion: s };
});

/** Automation export: GitHub Actions syncs ideas into issues so an agent can analyse them. */
router.get('/suggestions/export', async (ctx) => {
  const token = ctx.env.SUGGESTIONS_SYNC_TOKEN;
  const given = ctx.request.headers.get('x-sync-token') ?? '';
  if (!token || given !== token) throw new HttpError(404, 'not_found', 'Not found.');
  return { exported_at: ctx.now.toISOString(), suggestions: await loadSuggestions(ctx.env) };
});

// ---- Mascot --------------------------------------------------------------------
router.post('/mascot/feed', async (ctx) => {
  const account = requireAccount(ctx.account);
  const member = account.member_id ? await loadMember(ctx.env, account.member_id).catch(() => null) : null;
  const name = member?.username ?? account.username;
  // Feeds race across the alliance; retry the compare-and-set a few times before giving up.
  for (let attempt = 0; attempt < 4; attempt++) {
    const { doc, revision } = await loadMascot(ctx.env, ctx.now);
    let res;
    try {
      res = feedMascot(doc, account.id, name, ctx.now.toISOString());
    } catch (err) {
      if (err instanceof MascotError) throw new HttpError(429, err.code, err.message);
      throw err;
    }
    try {
      await saveDocumentCas(ctx.env, 'mascot', revision, res.state, res.state.revision, [], ctx.now);
      return { mascot: res.state, stage: res.stage, evolved: res.evolved };
    } catch (err) {
      if (!(err instanceof HttpError) || err.status !== 409 || attempt === 3) throw err;
    }
  }
  throw new HttpError(409, 'busy', 'Everyone is feeding the bear at once. Try again.');
});

// ---- Organization ---------------------------------------------------------------
router.post('/organization/slots', async (ctx) => {
  const account = await requireOrganizer(ctx);
  const body = await ctx.body();
  const edits = body.edits;
  if (!Array.isArray(edits) || edits.length === 0) throw new HttpError(400, 'bad_request', 'Missing "edits".');
  const result = await mutateOrganization(ctx, (org) => O.applySlotEdits(org, edits as O.SlotEdit[], ctxFor(account, ctx.now), expected(body) ?? org.revision));
  return result;
});

router.post('/organization/tasks', async (ctx) => {
  const account = await requireOrganizer(ctx);
  const body = await ctx.body();
  const op = str(body, 'op');
  const result = await mutateOrganization(ctx, (org) => {
    const rev = expected(body) ?? org.revision;
    const c = ctxFor(account, ctx.now);
    switch (op) {
      case 'add':
        return O.addTask(org, str(body, 'title'), c, rev);
      case 'rename':
        return O.renameTask(org, str(body, 'id'), str(body, 'title'), c, rev);
      case 'archive':
        return O.setTaskArchived(org, str(body, 'id'), body.archived !== false, c, rev);
      case 'reorder':
        return O.reorderTask(org, str(body, 'id'), (num(body, 'direction') ?? 1) < 0 ? -1 : 1, c, rev);
      default:
        throw new HttpError(400, 'bad_request', 'Unknown task op.');
    }
  });
  return result;
});

router.post('/organization/editors', async (ctx) => {
  const account = await requireOrganizer(ctx);
  const body = await ctx.body();
  const memberId = str(body, 'member_id');
  await loadMember(ctx.env, memberId);
  const result = await mutateOrganization(ctx, (org) => O.setDesignatedEditor(org, memberId, body.on !== false, ctxFor(account, ctx.now), expected(body) ?? org.revision));
  return result;
});

router.post('/organization/mapping', async (ctx) => {
  const account = await requireOrganizer(ctx);
  const body = await ctx.body();
  const memberId = str(body, 'member_id', false) || null;
  if (memberId) await loadMember(ctx.env, memberId);
  const result = await mutateOrganization(ctx, (org) => O.setNameMapping(org, str(body, 'source_name'), memberId, ctxFor(account, ctx.now), expected(body) ?? org.revision));
  return result;
});

// ---- Members ------------------------------------------------------------------------
router.post('/members/:id', async (ctx) => {
  const account = requireAccount(ctx.account);
  const body = await ctx.body();
  const member = await loadMember(ctx.env, ctx.params.id);
  const isLeader = account.role === 'leader';
  const isSelf = account.member_id === member.id;
  if (!isLeader && !isSelf) throw new HttpError(403, 'forbidden', 'You can only update your own stats.');
  let next = member;
  if (isLeader) {
    if (typeof body.mechanical_notes === 'string') next = L.withMechanicalNote(next, body.mechanical_notes);
    if (typeof body.active === 'boolean') next = { ...next, active: body.active };
  } else if ('mechanical_notes' in body || 'active' in body || 'rank' in body) {
    throw new HttpError(403, 'forbidden', 'Members can update their own arena power and level; leaders change rank, notes and status.');
  }
  const stats: StatsPatch = {};
  if ('arena_power_m' in body) stats.arena_power_m = Number(body.arena_power_m);
  if ('level' in body) stats.level = Number(body.level);
  if ('rank' in body) stats.rank = body.rank as StatsPatch['rank'];
  if (Object.keys(stats).length) {
    try {
      next = applyStats(next, stats, ctx.now.toISOString().slice(0, 10));
    } catch (err) {
      mapError(err);
    }
  }
  await saveMember(ctx.env, next, ctx.now);
  const pick = (m: Member) => ({ active: m.active, has_notes: !!m.mechanical_notes, arena_power_m: m.arena_power_m, level: m.level, rank: m.rank });
  await ctx.env.DB.batch([
    auditStatement(ctx.env, { id: `${ctx.now.toISOString()}-member-${randomToken(4)}`, event_id: null, actor_id: actorFor(account), action: 'member.update', before: pick(member), after: pick(next), timestamp: ctx.now.toISOString() }),
  ]);
  return { member: next };
});

// ---- Settings -------------------------------------------------------------------------
router.post('/settings', async (ctx) => {
  const account = requireLeader(ctx.account);
  const body = await ctx.body();
  const { doc, revision } = await loadDocument<Settings>(ctx.env, 'settings');
  const next: Settings = { ...doc };
  if ('timezone' in body) {
    const tz = typeof body.timezone === 'string' && body.timezone ? body.timezone : null;
    if (tz && !isValidTimeZone(tz)) throw new HttpError(400, 'bad_timezone', 'Unknown timezone name.');
    next.timezone = tz;
  }
  if (body.default_team_times && typeof body.default_team_times === 'object') {
    const t = body.default_team_times as { team1?: string; team2?: string };
    next.default_team_times = { team1: t.team1 ?? doc.default_team_times.team1, team2: t.team2 ?? doc.default_team_times.team2 };
  }
  await saveDocumentCas(ctx.env, 'settings', revision, next, revision + 1, [{ id: `${ctx.now.toISOString()}-settings-${randomToken(4)}`, event_id: null, actor_id: actorFor(account), action: 'settings.update', before: doc, after: next, timestamp: ctx.now.toISOString() }], ctx.now);
  return { settings: next };
});

// ---- Accounts and invites (leaders) ---------------------------------------------------
router.get('/accounts', async (ctx) => {
  requireLeader(ctx.account);
  const rows = await ctx.env.DB.prepare('SELECT id, username, role, member_id, verified, disabled, created_at FROM accounts ORDER BY created_at').all<{ id: string; username: string; role: 'leader' | 'member'; member_id: string | null; verified: number; disabled: number; created_at: string }>();
  return { accounts: rows.results.map((r) => ({ id: r.id, username: r.username, role: r.role, member_id: r.member_id, verified: r.verified === 1, disabled: r.disabled === 1, created_at: r.created_at })) };
});

router.post('/accounts/:id', async (ctx) => {
  const leader = requireLeader(ctx.account);
  const body = await ctx.body();
  const row = await ctx.env.DB.prepare('SELECT id, role, disabled FROM accounts WHERE id = ?').bind(ctx.params.id).first<{ id: string; role: 'leader' | 'member'; disabled: number }>();
  if (!row) throw new HttpError(404, 'not_found', 'Account not found.');
  const sets: string[] = [];
  const values: unknown[] = [];
  if (body.role === 'leader' || body.role === 'member') {
    if (row.id === leader.id && body.role === 'member' && (await leaderCount(ctx.env)) <= 1) throw new HttpError(422, 'last_leader', 'You are the only leader; promote someone else first.');
    sets.push('role = ?');
    values.push(body.role);
  }
  if ('member_id' in body) {
    const memberId = typeof body.member_id === 'string' && body.member_id ? body.member_id : null;
    if (memberId) {
      const member = await loadMember(ctx.env, memberId);
      const by = await memberClaimedBy(ctx.env, memberId, row.id);
      if (by) throw new HttpError(409, 'member_claimed', `${member.username} is already linked to the account "${by}". Unlink that account first.`);
    }
    sets.push('member_id = ?');
    values.push(memberId);
  }
  if (typeof body.verified === 'boolean') {
    sets.push('verified = ?');
    values.push(body.verified ? 1 : 0);
  }
  if (typeof body.disabled === 'boolean') {
    if (row.id === leader.id && body.disabled) throw new HttpError(422, 'self_disable', 'You cannot disable your own account.');
    sets.push('disabled = ?');
    values.push(body.disabled ? 1 : 0);
  }
  if (!sets.length) throw new HttpError(400, 'bad_request', 'Nothing to update.');
  await ctx.env.DB.prepare(`UPDATE accounts SET ${sets.join(', ')} WHERE id = ?`)
    .bind(...values, row.id)
    .run();
  if (body.disabled === true) await ctx.env.DB.prepare('DELETE FROM sessions WHERE account_id = ?').bind(row.id).run();
  const updated = await ctx.env.DB.prepare('SELECT id, username, role, member_id, verified, disabled, created_at FROM accounts WHERE id = ?').bind(row.id).first<{ id: string; username: string; role: 'leader' | 'member'; member_id: string | null; verified: number; disabled: number; created_at: string }>();
  await ctx.env.DB.batch([auditStatement(ctx.env, { id: `${ctx.now.toISOString()}-acct-${randomToken(4)}`, event_id: null, actor_id: actorFor(leader), action: 'account.update', before: { id: row.id }, after: body, timestamp: ctx.now.toISOString() })]);
  return { account: updated && { ...updated, verified: updated.verified === 1, disabled: updated.disabled === 1 } };
});

/** Leader resets a member's PIN (they forgot it). Signs that account out everywhere; the leader tells them the new PIN in person. */
router.post('/accounts/:id/password', async (ctx) => {
  const leader = requireLeader(ctx.account);
  const body = await ctx.body();
  const next = str(body, 'new_password');
  validatePassword(next);
  const row = await ctx.env.DB.prepare('SELECT id, username FROM accounts WHERE id = ?').bind(ctx.params.id).first<{ id: string; username: string }>();
  if (!row) throw new HttpError(404, 'not_found', 'Account not found.');
  if (row.id === leader.id) throw new HttpError(422, 'self_reset', 'Change your own PIN from Settings → Change password.');
  const { hash, salt } = await hashPassword(next);
  await ctx.env.DB.batch([
    ctx.env.DB.prepare('UPDATE accounts SET password_hash = ?, salt = ? WHERE id = ?').bind(hash, salt, row.id),
    ctx.env.DB.prepare('DELETE FROM sessions WHERE account_id = ?').bind(row.id),
    auditStatement(ctx.env, { id: `${ctx.now.toISOString()}-pin-${randomToken(4)}`, event_id: null, actor_id: actorFor(leader), action: 'account.reset_password', before: { id: row.id }, after: { username: row.username }, timestamp: ctx.now.toISOString() }),
  ]);
  return { ok: true };
});

router.get('/invites', async (ctx) => {
  requireLeader(ctx.account);
  const rows = await ctx.env.DB.prepare('SELECT code, role, created_by, uses_left, expires_at, created_at FROM invites WHERE uses_left > 0 AND expires_at > ? ORDER BY created_at DESC').bind(ctx.now.toISOString()).all();
  return { invites: rows.results };
});

router.post('/invites', async (ctx) => {
  const leader = requireLeader(ctx.account);
  const body = await ctx.body();
  const role = body.role === 'leader' ? 'leader' : 'member';
  const uses = Math.min(500, Math.max(1, Math.floor(num(body, 'uses', false) ?? 25)));
  const days = Math.min(365, Math.max(1, Math.floor(num(body, 'days', false) ?? 14)));
  const code = randomToken(6).replace(/[-_]/g, 'x').slice(0, 8).toUpperCase();
  const expires = new Date(ctx.now.getTime() + days * 86_400_000).toISOString();
  await ctx.env.DB.prepare('INSERT INTO invites (code, role, created_by, uses_left, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(code, role, leader.id, uses, expires, ctx.now.toISOString()).run();
  return { invite: { code, role, uses_left: uses, expires_at: expires } };
});

/** Public: tells a join link whether its code still works, without revealing anything else. */
router.get('/invites/:code/check', async (ctx) => {
  const code = ctx.params.code.trim().toUpperCase();
  const invite = await ctx.env.DB.prepare('SELECT role, uses_left, expires_at FROM invites WHERE code = ?').bind(code).first<{ role: 'leader' | 'member'; uses_left: number; expires_at: string }>();
  if (!invite) return { valid: false, reason: 'unknown' };
  if (invite.uses_left <= 0) return { valid: false, reason: 'used_up' };
  if (invite.expires_at <= ctx.now.toISOString()) return { valid: false, reason: 'expired' };
  return { valid: true, role: invite.role, uses_left: invite.uses_left, expires_at: invite.expires_at };
});

router.delete('/invites/:code', async (ctx) => {
  requireLeader(ctx.account);
  await ctx.env.DB.prepare('DELETE FROM invites WHERE code = ?').bind(ctx.params.code).run();
  return { ok: true };
});

// ---- Worker entry ---------------------------------------------------------------------
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(env, request);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const url = new URL(request.url);
    const now = new Date();
    const json = (status: number, data: unknown) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...cors } });
    try {
      const match = router.match(request.method, url.pathname);
      if (!match) return json(404, { error: 'not_found', message: `No route for ${request.method} ${url.pathname}` });
      await ensureSeeded(env, now);
      const account = await accountFromRequest(env, request, now);
      let cached: Promise<Record<string, unknown>> | null = null;
      const ctx: Ctx = { env, request, account, params: match.params, now, body: () => (cached ??= readJson(request)) };
      const data = await match.handler(ctx);
      return json(200, data);
    } catch (err) {
      if (err instanceof HttpError) return json(err.status, { error: err.code, message: err.message });
      if (err instanceof L.LifecycleError) return json(err.code === 'stale_revision' ? 409 : 422, { error: err.code, message: err.message });
      console.error(err);
      return json(500, { error: 'internal', message: 'Something went wrong on the server.' });
    }
  },
} satisfies ExportedHandler<Env>;
