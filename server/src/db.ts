import type { AuditEntry, CanyonEvent, Member, OrganizationState, Settings } from '../../src/domain/types';
import { loadSeedMembers, loadSeedOrganization, PACKAGE_DATE, SERIES_ID } from '../../src/data/seed';
import { createDraftEvent } from '../../src/engine/lifecycle';
import { nextFriday, todayInZone } from '../../src/engine/recurrence';
import type { Env } from './env';
import { HttpError } from './env';

export const DEFAULT_SETTINGS: Settings = { timezone: null, motion: 'system', haptics: false, default_team_times: { team1: '18:00', team2: '23:00' } };

/** Inserts the verified seed roster, responsibilities, settings and the first draft if the database is empty. */
export async function ensureSeeded(env: Env, now: Date): Promise<void> {
  const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM members').first<{ n: number }>();
  if ((row?.n ?? 0) > 0) return;
  const iso = now.toISOString();
  const members = loadSeedMembers();
  const statements: D1PreparedStatement[] = members.map((m) => env.DB.prepare('INSERT OR IGNORE INTO members (id, doc, updated_at) VALUES (?, ?, ?)').bind(m.id, JSON.stringify(m), iso));
  const org = loadSeedOrganization();
  statements.push(env.DB.prepare('INSERT OR IGNORE INTO documents (key, revision, doc, updated_at) VALUES (?, ?, ?, ?)').bind('organization', org.revision, JSON.stringify(org), iso));
  statements.push(env.DB.prepare('INSERT OR IGNORE INTO documents (key, revision, doc, updated_at) VALUES (?, ?, ?, ?)').bind('settings', 1, JSON.stringify(DEFAULT_SETTINGS), iso));
  const today = todayInZone('UTC', now);
  const firstFriday = today <= PACKAGE_DATE ? nextFriday(PACKAGE_DATE) : nextFriday(today, true);
  const event = createDraftEvent({ series_id: SERIES_ID, date: firstFriday, timezone: null });
  statements.push(env.DB.prepare('INSERT OR IGNORE INTO events (id, date, status, revision, doc, updated_at) VALUES (?, ?, ?, ?, ?, ?)').bind(event.id, event.date, event.status, event.revision, JSON.stringify(event), iso));
  await env.DB.batch(statements);
}

export async function loadMembers(env: Env): Promise<Member[]> {
  const rows = await env.DB.prepare('SELECT doc FROM members ORDER BY id').all<{ doc: string }>();
  return rows.results.map((r) => JSON.parse(r.doc) as Member);
}

export async function loadMember(env: Env, id: string): Promise<Member> {
  const row = await env.DB.prepare('SELECT doc FROM members WHERE id = ?').bind(id).first<{ doc: string }>();
  if (!row) throw new HttpError(404, 'not_found', 'Member not found.');
  return JSON.parse(row.doc) as Member;
}

export async function saveMember(env: Env, member: Member, now: Date): Promise<void> {
  await env.DB.prepare('UPDATE members SET doc = ?, updated_at = ? WHERE id = ?').bind(JSON.stringify(member), now.toISOString(), member.id).run();
}

export async function loadEvents(env: Env): Promise<CanyonEvent[]> {
  const rows = await env.DB.prepare('SELECT doc FROM events ORDER BY date').all<{ doc: string }>();
  return rows.results.map((r) => JSON.parse(r.doc) as CanyonEvent);
}

export async function loadEvent(env: Env, id: string): Promise<CanyonEvent> {
  const row = await env.DB.prepare('SELECT doc FROM events WHERE id = ?').bind(id).first<{ doc: string }>();
  if (!row) throw new HttpError(404, 'not_found', 'Event not found.');
  return JSON.parse(row.doc) as CanyonEvent;
}

export function auditStatement(env: Env, a: AuditEntry): D1PreparedStatement {
  return env.DB.prepare('INSERT INTO audit (id, event_id, actor_id, action, before, after, reason, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(
    a.id,
    a.event_id,
    a.actor_id,
    a.action,
    JSON.stringify(a.before ?? null),
    JSON.stringify(a.after ?? null),
    a.reason ?? null,
    a.timestamp,
  );
}

/**
 * Compare-and-set write of an event. `previousRevision` must match the stored
 * row or the write is rejected with 409, which is how two leaders editing the
 * same revision are prevented from silently overwriting each other.
 */
export async function saveEventCas(env: Env, previous: CanyonEvent, next: CanyonEvent, audit: AuditEntry[], now: Date): Promise<void> {
  const update = env.DB.prepare('UPDATE events SET doc = ?, revision = ?, status = ?, date = ?, updated_at = ? WHERE id = ? AND revision = ?').bind(
    JSON.stringify(next),
    next.revision,
    next.status,
    next.date,
    now.toISOString(),
    next.id,
    previous.revision,
  );
  const results = await env.DB.batch([update, ...audit.map((a) => auditStatement(env, a))]);
  const changes = results[0]?.meta?.changes ?? 0;
  if (changes !== 1) {
    // The audit rows were written in the same batch; D1 batches are atomic so
    // when the update matched nothing, nothing else was committed either.
    throw new HttpError(409, 'stale_revision', 'Someone else changed this event. Reload to compare.');
  }
}

export async function insertEvent(env: Env, event: CanyonEvent, now: Date): Promise<boolean> {
  const res = await env.DB.prepare('INSERT OR IGNORE INTO events (id, date, status, revision, doc, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(event.id, event.date, event.status, event.revision, JSON.stringify(event), now.toISOString())
    .run();
  return (res.meta?.changes ?? 0) === 1;
}

export async function loadDocument<T>(env: Env, key: string): Promise<{ doc: T; revision: number }> {
  const row = await env.DB.prepare('SELECT doc, revision FROM documents WHERE key = ?').bind(key).first<{ doc: string; revision: number }>();
  if (!row) throw new HttpError(404, 'not_found', `${key} not found.`);
  return { doc: JSON.parse(row.doc) as T, revision: row.revision };
}

export async function saveDocumentCas<T>(env: Env, key: string, previousRevision: number, doc: T, revision: number, audit: AuditEntry[], now: Date): Promise<void> {
  const update = env.DB.prepare('UPDATE documents SET doc = ?, revision = ?, updated_at = ? WHERE key = ? AND revision = ?').bind(JSON.stringify(doc), revision, now.toISOString(), key, previousRevision);
  const results = await env.DB.batch([update, ...audit.map((a) => auditStatement(env, a))]);
  if ((results[0]?.meta?.changes ?? 0) !== 1) throw new HttpError(409, 'stale_revision', 'Another leader changed this. Reload to compare.');
}

export async function loadOrganization(env: Env): Promise<OrganizationState> {
  const { doc } = await loadDocument<OrganizationState>(env, 'organization');
  return doc;
}

export async function loadSettings(env: Env): Promise<Settings> {
  const { doc } = await loadDocument<Settings>(env, 'settings');
  return { ...DEFAULT_SETTINGS, ...doc };
}

export async function recentAudit(env: Env, limit = 200): Promise<AuditEntry[]> {
  const rows = await env.DB.prepare('SELECT * FROM audit ORDER BY timestamp DESC LIMIT ?').bind(limit).all<{ id: string; event_id: string | null; actor_id: string; action: string; before: string; after: string; reason: string | null; timestamp: string }>();
  return rows.results
    .map((r) => ({ id: r.id, event_id: r.event_id, actor_id: r.actor_id, action: r.action, before: JSON.parse(r.before), after: JSON.parse(r.after), reason: r.reason ?? undefined, timestamp: r.timestamp }))
    .reverse();
}
