import { useMemo } from 'react';
import { Art } from '../ui/Art';
import { useRouter } from '../store/router';
import { fmtPower, useStore } from '../store/store';
import { useUiState } from '../store/ui';
import { Avatar, DemoBanner, EmptyState, Header, SearchInput, matchesSearch } from '../ui/common';
import { ChevronRight } from '../ui/icons';

type Sort = 'power' | 'name' | 'plays' | 'waiting';

export function MembersScreen() {
  const { state, history, today } = useStore();
  const router = useRouter();
  const [query, setQuery] = useUiState('members.query', '');
  const [sort, setSort] = useUiState<Sort>('members.sort', 'power');
  const [origin, setOrigin] = useUiState<string>('members.origin', 'all');

  const list = useMemo(() => {
    const filtered = state.members.filter((m) => matchesSearch(m, query) && (origin === 'all' || m.origin_alliance === origin));
    return filtered.sort((a, b) => {
      if (sort === 'power') return b.arena_power_m - a.arena_power_m;
      if (sort === 'name') return a.username.localeCompare(b.username, undefined, { sensitivity: 'base' });
      if (sort === 'plays') return (history[a.id]?.lifetime_played ?? 0) - (history[b.id]?.lifetime_played ?? 0);
      return (history[a.id]?.eligible_benches ?? 0) > (history[b.id]?.eligible_benches ?? 0) ? -1 : 1;
    });
  }, [state.members, query, sort, origin, history]);

  const origins = useMemo(() => Array.from(new Set(state.members.map((m) => m.origin_alliance))).sort(), [state.members]);
  const stale = (iso: string) => {
    const [y1, m1, d1] = iso.split('-').map(Number);
    const [y2, m2, d2] = today.split('-').map(Number);
    return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000) > 14;
  };
  const staleCount = state.members.filter((m) => m.active && stale(m.power_as_of)).length;

  return (
    <>
      <Header title="Members" />
      <main className="page">
        <DemoBanner />
        <div>
          <Art name="members-banner" alt="" className="art-banner" />
          <h1>Members</h1>
          <p className="muted small">
            {state.members.length} members{staleCount ? ` · ${staleCount} with arena power older than two weeks` : ' · arena power up to date'}
          </p>
        </div>
        <div className="sticky-search">
          <SearchInput value={query} onChange={setQuery} placeholder="Search by name" />
        </div>
        <div className="filter-row" aria-label="Sort">
          {(
            [
              ['power', 'Power'],
              ['name', 'Name'],
              ['plays', 'Fewest plays'],
              ['waiting', 'Waiting most'],
            ] as [Sort, string][]
          ).map(([k, label]) => (
            <button key={k} type="button" className="chip tap" aria-pressed={sort === k} onClick={() => setSort(k)}>
              {label}
            </button>
          ))}
        </div>
        <div className="filter-row" aria-label="Origin cohort">
          <button type="button" className="chip" aria-pressed={origin === 'all'} onClick={() => setOrigin('all')}>
            All origins
          </button>
          {origins.map((o) => (
            <button key={o} type="button" className="chip" aria-pressed={origin === o} onClick={() => setOrigin(o)}>
              {o}
            </button>
          ))}
        </div>
        {list.length === 0 && <EmptyState title="No members match" />}
        <div className="list dense" role="list">
          {list.map((m) => {
            const h = history[m.id];
            const old = stale(m.power_as_of);
            return (
              <button key={m.id} type="button" className="row" role="listitem" onClick={() => router.navigate(`/members/${m.id}`)}>
                <Avatar name={m.username} />
                <div className="main">
                  <div className="name wrap">
                    {m.username}
                    {!m.active && <span className="badge" style={{ marginLeft: 6 }}>inactive</span>}
                  </div>
                  <div className="meta">
                    <span className="mono">{fmtPower(m.arena_power_m)}</span>
                    <span className={old ? 'stale' : undefined} title={`Arena power updated ${m.power_as_of}`}>
                      {old ? `updated ${m.power_as_of}` : m.rank}
                    </span>
                    {!old && <span>L{m.level} · {m.origin_alliance}</span>}
                    {h?.last_played_at && <span>Last {h.last_played_at}</span>}
                  </div>
                </div>
                <ChevronRight className="chevron" />
              </button>
            );
          })}
        </div>
      </main>
    </>
  );
}
