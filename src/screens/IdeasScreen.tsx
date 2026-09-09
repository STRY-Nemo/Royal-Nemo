import { useMemo, useState } from 'react';
import type { Suggestion, SuggestionStatus } from '../domain/types';
import { BODY_MAX, OPEN_PER_PERSON, sortSuggestions, TITLE_MAX } from '../engine/suggestions';
import { BottomSheet, useFeedback } from '../motion';
import { useStore } from '../store/store';
import { useUiState } from '../store/ui';
import { Avatar, DemoBanner, EmptyState, Header } from '../ui/common';

type Filter = 'open' | 'planned' | 'done' | 'all';

const STATUS_LABEL: Record<SuggestionStatus, string> = { new: 'New', planned: 'Planned', done: 'Done', declined: 'Not now' };
const STATUS_CLASS: Record<SuggestionStatus, string> = { new: 'draft', planned: 'published', done: 'finalized', declined: 'canceled' };

/** Ideas tab: members post suggestions and feature requests, vote, and leaders triage. */
export function IdeasScreen() {
  const { state, actions, isLeader, account, me } = useStore();
  const { toast, announce } = useFeedback();
  const [filter, setFilter] = useUiState<Filter>('ideas.filter', 'open');
  const [composeOpen, setComposeOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [triage, setTriage] = useState<Suggestion | null>(null);
  const [reply, setReply] = useState('');
  const voter = account ? account.id : (state.session.member_id ?? 'demo');

  const list = useMemo(() => {
    const sorted = sortSuggestions(state.suggestions);
    return sorted.filter((s) => (filter === 'all' ? true : filter === 'open' ? s.status === 'new' : filter === 'planned' ? s.status === 'planned' : s.status === 'done' || s.status === 'declined'));
  }, [state.suggestions, filter]);
  const counts = useMemo(() => ({
    open: state.suggestions.filter((s) => s.status === 'new').length,
    planned: state.suggestions.filter((s) => s.status === 'planned').length,
    done: state.suggestions.filter((s) => s.status === 'done' || s.status === 'declined').length,
    all: state.suggestions.length,
  }), [state.suggestions]);
  const mineOpen = state.suggestions.filter((s) => s.account_id === voter && (s.status === 'new' || s.status === 'planned')).length;

  const submit = () => {
    const res = actions.addSuggestion(title, body);
    if (res.ok) {
      toast({ kind: 'ok', text: 'Idea posted. Leaders will review it.' });
      announce('Idea posted.');
      setTitle('');
      setBody('');
      setComposeOpen(false);
    } else toast({ kind: 'error', text: res.message });
  };

  return (
    <>
      <Header title="Ideas" />
      <main className="page">
        <DemoBanner />
        <div>
          <h1>Ideas &amp; requests</h1>
          <p className="muted small">Suggest a feature, report something clunky, or vote up what matters. Leaders mark ideas Planned, Done or Not now.</p>
        </div>

        <button type="button" className="btn primary block" onClick={() => setComposeOpen(true)} disabled={mineOpen >= OPEN_PER_PERSON}>
          + New idea{mineOpen >= OPEN_PER_PERSON ? ` (you have ${OPEN_PER_PERSON} open)` : ''}
        </button>

        <div className="segmented" role="tablist" aria-label="Filter ideas">
          {(['open', 'planned', 'done', 'all'] as Filter[]).map((f) => (
            <button key={f} type="button" role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}>
              {f === 'open' ? 'New' : f === 'planned' ? 'Planned' : f === 'done' ? 'Closed' : 'All'}
              <small>{counts[f]}</small>
            </button>
          ))}
        </div>

        {list.length === 0 && (
          <EmptyState title={filter === 'open' ? 'No new ideas' : 'Nothing here yet'}>{filter === 'open' ? 'Be the first: tap New idea.' : 'Ideas move here as leaders review them.'}</EmptyState>
        )}

        <div className="list" role="list">
          {list.map((s) => {
            const voted = s.votes.includes(voter);
            return (
              <div key={s.id} className="card idea" role="listitem">
                <div className="card-row" style={{ alignItems: 'flex-start' }}>
                  <button type="button" className={`vote${voted ? ' on' : ''}`} aria-pressed={voted} aria-label={`${voted ? 'Remove vote' : 'Vote'} for ${s.title}`} onClick={() => actions.voteSuggestion(s.id)}>
                    <span aria-hidden="true">▲</span>
                    <strong>{s.votes.length}</strong>
                  </button>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="card-row" style={{ gap: 8 }}>
                      <h3 className="grow wrap">{s.title}</h3>
                      <span className={`badge ${STATUS_CLASS[s.status]}`}>{STATUS_LABEL[s.status]}</span>
                    </div>
                    {s.body && <p className="small wrap" style={{ whiteSpace: 'pre-wrap' }}>{s.body}</p>}
                    <div className="meta small muted" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <Avatar name={s.author_name} />
                      <span>{s.author_name}</span>
                      <span>· {new Date(s.created_at).toLocaleDateString()}</span>
                    </div>
                    {s.leader_reply && (
                      <div className="callout small" style={{ marginTop: 6 }}>
                        <span aria-hidden="true">💬</span>
                        <span className="wrap">
                          <strong>Leaders:</strong> {s.leader_reply}
                        </span>
                      </div>
                    )}
                    {isLeader && (
                      <button type="button" className="link-btn" style={{ padding: 0, marginTop: 4 }} onClick={() => { setTriage(s); setReply(s.leader_reply ?? ''); }}>
                        Review · set status or reply
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <p className="faint">Ideas are shared with the whole alliance{me ? ` as ${me.username}` : ''}. Leaders review them regularly; the most-voted ideas float to the top.</p>
      </main>

      <BottomSheet
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        title="New idea"
        footer={
          <>
            <button type="button" className="btn ghost" onClick={() => setComposeOpen(false)}>
              Cancel
            </button>
            <button type="button" className="btn primary" disabled={title.trim().length < 3} onClick={submit}>
              Post idea
            </button>
          </>
        }
      >
        <div className="field">
          <label htmlFor="idea-title">Title</label>
          <input id="idea-title" className="input" value={title} maxLength={TITLE_MAX} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Remind me before Canyon starts" />
        </div>
        <div className="field">
          <label htmlFor="idea-body">Details (optional)</label>
          <textarea id="idea-body" className="input" rows={4} value={body} maxLength={BODY_MAX} onChange={(e) => setBody(e.target.value)} placeholder="What would it do? Why does it help?" />
          <p className="faint">{body.length}/{BODY_MAX}</p>
        </div>
      </BottomSheet>

      <BottomSheet open={!!triage} onClose={() => setTriage(null)} title={triage?.title ?? 'Review idea'}>
        {triage && (
          <div className="list">
            <div className="segmented" role="tablist" aria-label="Status">
              {(['new', 'planned', 'done', 'declined'] as SuggestionStatus[]).map((st) => (
                <button key={st} type="button" role="tab" aria-selected={triage.status === st} onClick={() => setTriage({ ...triage, status: st })}>
                  {STATUS_LABEL[st]}
                </button>
              ))}
            </div>
            <div className="field">
              <label htmlFor="idea-reply">Reply to the alliance (optional)</label>
              <textarea id="idea-reply" className="input" rows={3} value={reply} maxLength={BODY_MAX} onChange={(e) => setReply(e.target.value)} placeholder="e.g. Great idea, coming next week." />
            </div>
            <button
              type="button"
              className="btn primary block"
              onClick={() => {
                const res = actions.setSuggestionStatus(triage.id, triage.status, reply);
                if (res.ok) {
                  toast({ kind: 'ok', text: `Marked ${STATUS_LABEL[triage.status]}` });
                  setTriage(null);
                } else toast({ kind: 'error', text: res.message });
              }}
            >
              Save
            </button>
          </div>
        )}
      </BottomSheet>
    </>
  );
}
