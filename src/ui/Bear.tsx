import { useEffect, useRef, useState } from 'react';
import type { MascotState } from '../domain/types';
import { cooldownRemaining, DAILY_FEED_CAP, FEED_COOLDOWN_MS, feedsToday, nextStage, stageFor, stageProgress, type Stage } from '../engine/mascot';
import { haptic, useFeedback } from '../motion';
import { useStore } from '../store/store';

/** Bear artwork: public/bear/stage-NN.webp (96 px thumbs for small sizes); a drawn placeholder if a file is missing. */
export function BearSprite({ stage, size = 160, bounce, className }: { stage: Stage; size?: number; bounce?: boolean; className?: string }) {
  const [missing, setMissing] = useState<Record<number, boolean>>({});
  const src = `${import.meta.env.BASE_URL}bear/stage-${String(stage.n).padStart(2, '0')}${size <= 96 ? '-thumb' : ''}.webp`;
  const cls = `bear-sprite${bounce ? ' bounce' : ''}${className ? ` ${className}` : ''}`;
  if (!missing[stage.n]) {
    return <img src={src} alt={`${stage.name}, stage ${stage.n}`} width={size} height={size} className={cls} draggable={false} onError={() => setMissing((m) => ({ ...m, [stage.n]: true }))} />;
  }
  return <PlaceholderBear stage={stage} size={size} className={cls} />;
}

/** Simple vector bear used until the real art is dropped into public/bear. */
function PlaceholderBear({ stage, size, className }: { stage: Stage; size: number; className: string }) {
  const n = stage.n;
  const scale = 0.6 + (n / 15) * 0.4;
  const fur = n >= 13 ? '#5b3a1e' : n >= 7 ? '#7a4a22' : '#a86a35';
  const armor = n >= 10;
  const helmet = n >= 13;
  const scarf = n >= 7;
  const glow = n === 15;
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} className={className} role="img" aria-label={`${stage.name}, stage ${n} (placeholder art)`}>
      {glow && <circle cx="60" cy="64" r="54" fill="var(--primary)" opacity="0.18" />}
      <g transform={`translate(60 66) scale(${scale}) translate(-60 -66)`}>
        <ellipse cx="60" cy="86" rx="30" ry="24" fill={fur} />
        {armor && <path d="M34 82 q26 -14 52 0 v14 q-26 12 -52 0z" fill="#c9d6ea" stroke="#168cff" strokeWidth="2" />}
        <circle cx="40" cy="42" r="10" fill={fur} />
        <circle cx="80" cy="42" r="10" fill={fur} />
        <circle cx="40" cy="42" r="5" fill="#e8b48a" />
        <circle cx="80" cy="42" r="5" fill="#e8b48a" />
        <circle cx="60" cy="54" r="24" fill={fur} />
        {helmet && <path d="M36 44 q24 -26 48 0 v6 h-48z" fill="#c9d6ea" stroke="#168cff" strokeWidth="2" />}
        {helmet && <path d="M60 18 l4 12 h-8z" fill="#168cff" />}
        <ellipse cx="60" cy="62" rx="11" ry="8" fill="#e8b48a" />
        <circle cx="60" cy="59" r="3.5" fill="#1a1a1a" />
        <circle cx="51" cy="50" r="2.6" fill="#1a1a1a" />
        <circle cx="69" cy="50" r="2.6" fill="#1a1a1a" />
        <circle cx="52" cy="49" r="0.9" fill="#fff" />
        <circle cx="70" cy="49" r="0.9" fill="#fff" />
        <path d="M56 66 q4 3 8 0" stroke="#1a1a1a" strokeWidth="1.5" fill="none" />
        {scarf && <path d="M42 72 q18 10 36 0 v6 q-18 10 -36 0z" fill="#168cff" />}
        {n >= 4 && <ellipse cx="34" cy="96" rx="9" ry="6" fill={fur} />}
        {n >= 4 && <ellipse cx="86" cy="96" rx="9" ry="6" fill={fur} />}
        {n >= 14 && <path d="M60 78 l3 6 h6 l-5 4 2 6 -6 -4 -6 4 2 -6 -5 -4 h6z" fill="#ffd166" />}
      </g>
    </svg>
  );
}

interface Particle {
  id: number;
  x: number;
  emoji: string;
}

const FOOD = ['🍯', '🐟', '🫐', '🍖', '🥕'];

/** Tappable bear with feed particles, cooldown ring, counters and evolution burst. */
export function BearFeeder({ mascot, size = 180, compact }: { mascot: MascotState; size?: number; compact?: boolean }) {
  const { actions, state, account, me } = useStore();
  const { toast, burst, announce } = useFeedback();
  const stage = stageFor(mascot.feeds);
  const next = nextStage(mascot.feeds);
  const key = account ? account.id : (state.session.member_id ?? 'demo');
  const [now, setNow] = useState(() => Date.now());
  const [bounce, setBounce] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [evolving, setEvolving] = useState(false);
  const idRef = useRef(0);
  const remaining = cooldownRemaining(mascot, key, new Date(now).toISOString());
  const today = feedsToday(mascot, key, new Date(now).toISOString());
  const mine = mascot.feeders[key]?.count ?? 0;

  useEffect(() => {
    if (remaining <= 0) return;
    const t = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(t);
  }, [remaining]);

  const feed = () => {
    setNow(Date.now());
    const res = actions.feedBear();
    if (!res.ok) {
      if (res.code === 'daily_cap') toast({ kind: 'error', text: res.message });
      return;
    }
    haptic(state.settings.haptics, res.evolved ? [20, 40, 60] : 8);
    setBounce(true);
    window.setTimeout(() => setBounce(false), 450);
    const id = ++idRef.current;
    setParticles((p) => [...p, { id, x: 20 + Math.random() * 60, emoji: FOOD[id % FOOD.length] }]);
    window.setTimeout(() => setParticles((p) => p.filter((q) => q.id !== id)), 900);
    if (res.evolved && res.stage) {
      burst();
      setEvolving(true);
      window.setTimeout(() => setEvolving(false), 1200);
      toast({ kind: 'ok', text: `The bear evolved into ${res.stage.name}!` });
      announce(`The bear evolved into stage ${res.stage.n}, ${res.stage.name}.`);
    }
  };

  const pct = Math.round(stageProgress(mascot.feeds) * 100);
  const ringPct = remaining > 0 ? Math.round(((FEED_COOLDOWN_MS - remaining) / FEED_COOLDOWN_MS) * 100) : 100;

  return (
    <div className={`bear-feeder${compact ? ' compact' : ''}`}>
      <button
        type="button"
        className={`bear-tap${remaining > 0 ? ' cooling' : ''}${evolving ? ' evolving' : ''}`}
        style={{ ['--ring' as string]: `${ringPct}%`, width: size + 24, height: size + 24 }}
        onClick={feed}
        aria-label={remaining > 0 ? `Feed the bear (ready in ${Math.ceil(remaining / 1000)} seconds)` : 'Feed the bear'}
      >
        <BearSprite stage={stage} size={size} bounce={bounce} />
        {particles.map((p) => (
          <span key={p.id} className="bear-particle" style={{ left: `${p.x}%` }} aria-hidden="true">
            {p.emoji} +1
          </span>
        ))}
      </button>
      <div className="bear-meta">
        <div className="bear-stage">
          <strong>Stage {stage.n}</strong> · {stage.name}
        </div>
        {!compact && <div className="small muted">{stage.blurb}</div>}
        <div className="bear-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progress to next stage">
          <span style={{ width: `${pct}%` }} />
        </div>
        <div className="small muted">
          {next ? `${mascot.feeds} / ${next.feeds} feeds · next: ${next.name}` : `${mascot.feeds} feeds · fully evolved!`}
        </div>
        <div className="bear-counters">
          <span className="chip">🍯 {mascot.feeds} total</span>
          <span className="chip">{me ? me.username : 'You'}: {mine}</span>
          <span className="chip">{today}/{DAILY_FEED_CAP} today</span>
          <span className={`chip${remaining > 0 ? ' selected' : ''}`}>{remaining > 0 ? `chewing ${(remaining / 1000).toFixed(1)}s` : 'tap to feed'}</span>
        </div>
      </div>
    </div>
  );
}
