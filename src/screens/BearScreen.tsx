import { STAGES, stageFor, topFeeders } from '../engine/mascot';
import { useStore } from '../store/store';
import { BearFeeder, BearSprite } from '../ui/Bear';
import { Header } from '../ui/common';

/** The den: the alliance bear, its stage ladder and who feeds it most. */
export function BearScreen() {
  const { state } = useStore();
  const mascot = state.mascot;
  const stage = stageFor(mascot.feeds);
  const top = topFeeders(mascot, 10);
  return (
    <>
      <Header title="STRY Bear" back="/home" />
      <main className="page">
        <div className="card raised bear-den">
          <BearFeeder mascot={mascot} size={200} />
          <p className="faint">Everyone in the alliance feeds the same bear. One feed every 2 seconds per person, 60 a day, so it grows as the whole alliance shows up. {mascot.last_feeder_name ? `Last fed by ${mascot.last_feeder_name}.` : ''}</p>
        </div>

        <div className="card">
          <h3>Evolution</h3>
          <div className="bear-ladder">
            {STAGES.map((s) => {
              const reached = mascot.feeds >= s.feeds;
              const current = s.n === stage.n;
              return (
                <div key={s.n} className={`bear-rung${reached ? ' reached' : ''}${current ? ' current' : ''}`}>
                  <BearSprite stage={s} size={40} className={reached ? '' : 'locked'} />
                  <div className="grow">
                    <div className="name">
                      {s.n}. {s.name}
                    </div>
                    <div className="small muted">{reached ? s.blurb : `${s.feeds} feeds`}</div>
                  </div>
                  {current && <span className="badge published">Now</span>}
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <h3>Top feeders</h3>
          {top.length === 0 && <p className="muted small">Nobody has fed the bear yet. Be the first!</p>}
          <div className="list" style={{ gap: 4 }}>
            {top.map((f, i) => (
              <div key={f.key} className="row" style={{ animation: 'none' }}>
                <span className="index">{String(i + 1).padStart(2, '0')}</span>
                <div className="main">
                  <div className="name">{f.name}</div>
                </div>
                <span className="mono">{f.count}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
