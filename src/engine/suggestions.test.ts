import { describe, expect, it } from 'vitest';
import { LifecycleError } from './lifecycle';
import { createSuggestion, OPEN_PER_PERSON, setSuggestionStatus, sortSuggestions, toggleVote } from './suggestions';

const now = '2026-09-09T20:00:00Z';
const mk = (i: number, extra: Partial<Parameters<typeof createSuggestion>[1]> = {}) =>
  createSuggestion([], { id: `s${i}`, account_id: 'a1', member_id: 'stry-001', author_name: 'Nemo', title: `Idea ${i}`, body: 'details', now, ...extra });

describe('suggestions', () => {
  it('validates titles and caps open ideas per person', () => {
    expect(() => mk(1, { title: 'ab' })).toThrow(LifecycleError);
    expect(() => mk(1, { title: 'x'.repeat(81) })).toThrow(/title/);
    const many = Array.from({ length: OPEN_PER_PERSON }, (_, i) => mk(i));
    expect(() => createSuggestion(many, { id: 'x', account_id: 'a1', member_id: null, author_name: 'Nemo', title: 'One more', body: '', now })).toThrow(/open ideas/);
    const closed = many.map((s) => setSuggestionStatus(s, 'done', 'Shipped', now));
    expect(createSuggestion(closed, { id: 'x', account_id: 'a1', member_id: null, author_name: 'Nemo', title: 'One more', body: '', now }).status).toBe('new');
  });

  it('toggles votes, sets status with a reply, and sorts open + most-voted first', () => {
    let s = mk(1);
    s = toggleVote(s, 'b', now);
    s = toggleVote(s, 'c', now);
    expect(s.votes).toEqual(['b', 'c']);
    s = toggleVote(s, 'b', now);
    expect(s.votes).toEqual(['c']);
    const done = setSuggestionStatus(mk(2), 'done', '  Shipped!  ', now);
    expect(done.status).toBe('done');
    expect(done.leader_reply).toBe('Shipped!');
    expect(setSuggestionStatus(done, 'planned', null, now).leader_reply).toBe('Shipped!');
    expect(() => setSuggestionStatus(done, 'weird' as never, null, now)).toThrow(LifecycleError);
    const popular = toggleVote(toggleVote(mk(3), 'x', now), 'y', now);
    const order = sortSuggestions([done, mk(4), popular]).map((x) => x.id);
    expect(order).toEqual(['s3', 's4', 's2']);
  });
});
