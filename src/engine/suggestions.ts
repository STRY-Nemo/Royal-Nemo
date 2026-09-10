/**
 * Suggestions / feature requests. Pure validation and edits shared by the
 * client (demo mode, optimistic updates) and the server (authoritative).
 */
import type { Suggestion, SuggestionActivity, SuggestionStatus } from '../domain/types';
import { LifecycleError } from './lifecycle';

export const SUGGESTION_STATUSES: SuggestionStatus[] = ['new', 'planned', 'done', 'declined'];
export const TITLE_MAX = 80;
export const BODY_MAX = 1000;
/** Open suggestions one person may have at once. */
export const OPEN_PER_PERSON = 5;

export function validateSuggestionText(title: string, body: string): { title: string; body: string } {
  const t = title.trim().replace(/\s+/g, ' ');
  const b = body.trim();
  if (t.length < 3) throw new LifecycleError('title_short', 'Give the idea a short title (at least 3 characters).');
  if (t.length > TITLE_MAX) throw new LifecycleError('title_long', `Keep the title under ${TITLE_MAX} characters.`);
  if (b.length > BODY_MAX) throw new LifecycleError('body_long', `Keep the details under ${BODY_MAX} characters.`);
  return { title: t, body: b };
}

export function createSuggestion(existing: Suggestion[], input: { id: string; account_id: string; member_id: string | null; author_name: string; title: string; body: string; now: string }): Suggestion {
  const { title, body } = validateSuggestionText(input.title, input.body);
  const open = existing.filter((s) => s.account_id === input.account_id && (s.status === 'new' || s.status === 'planned')).length;
  if (open >= OPEN_PER_PERSON) throw new LifecycleError('too_many', `You already have ${OPEN_PER_PERSON} open ideas. Wait for a leader to review them.`);
  const created: SuggestionActivity = { at: input.now, by: input.author_name, by_account: input.account_id, kind: 'created' };
  return { id: input.id, account_id: input.account_id, member_id: input.member_id, author_name: input.author_name, title, body, status: 'new', votes: [], leader_reply: null, activity: [created], created_at: input.now, updated_at: input.now };
}

export function toggleVote(s: Suggestion, voter: string, now: string): Suggestion {
  const votes = s.votes.includes(voter) ? s.votes.filter((v) => v !== voter) : [...s.votes, voter];
  return { ...s, votes, updated_at: now };
}

/** Leader triage. `by` is recorded in the idea's activity so everyone can see who set the status or replied. */
export function setSuggestionStatus(s: Suggestion, status: SuggestionStatus, reply: string | null, now: string, by: { id: string; name: string } = { id: 'leader', name: 'A leader' }): Suggestion {
  if (!SUGGESTION_STATUSES.includes(status)) throw new LifecycleError('bad_status', 'Unknown status.');
  const r = reply === null ? s.leader_reply : reply.trim().slice(0, BODY_MAX) || null;
  const activity = [...(s.activity ?? [])];
  if (status !== s.status) activity.push({ at: now, by: by.name, by_account: by.id, kind: 'status', status });
  if (r !== s.leader_reply && r) activity.push({ at: now, by: by.name, by_account: by.id, kind: 'reply', reply: r });
  return { ...s, status, leader_reply: r, activity, updated_at: now };
}

/** Who last replied to an idea, or null when the reply predates activity tracking. */
export function lastReplier(s: Suggestion): SuggestionActivity | null {
  const replies = (s.activity ?? []).filter((a) => a.kind === 'reply');
  return replies[replies.length - 1] ?? null;
}

/** Open first, then most votes, then newest. */
export function sortSuggestions(list: Suggestion[]): Suggestion[] {
  const rank: Record<SuggestionStatus, number> = { new: 0, planned: 1, done: 2, declined: 3 };
  return [...list].sort((a, b) => rank[a.status] - rank[b.status] || b.votes.length - a.votes.length || (a.created_at < b.created_at ? 1 : -1));
}
