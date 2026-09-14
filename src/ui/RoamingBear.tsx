import { useEffect, useRef, useState } from 'react';
import { cooldownRemaining, stageFor } from '../engine/mascot';
import { haptic, useEffectiveMotion, useFeedback } from '../motion';
import { useRouter } from '../store/router';
import { useStore } from '../store/store';
import { BearSprite } from './Bear';
import { pickReaction, REACTION_MS } from './bearReactions';
import { playSfx } from './sfx';

const KEY = 'stry-roaming-bear';
const SIZE = 56;
/** After a tap the bear runs around for this long, then walks back to its corner. */
const WANDER_MS = 6000;

export function roamingBearEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setRoamingBearEnabled(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event('stry-roaming-bear'));
}

/**
 * The bear waits in the bottom-right corner of every screen (except Home and
 * the den, which show the big one) so it never sits on top of content. Tap it
 * to feed: it celebrates, runs around for a few seconds, then heads back to its
 * corner. Reduced motion: it sits still; motion Off: hidden.
 */
export function RoamingBear() {
  const { state, actions, account } = useStore();
  const { route } = useRouter();
  const { toast, burst } = useFeedback();
  const motion = useEffectiveMotion(state.settings.motion);
  const [enabled, setEnabled] = useState(roamingBearEnabled);
  const [x, setX] = useState(1);
  const [dir, setDir] = useState<1 | -1>(-1);
  const [walking, setWalking] = useState(false);
  const [bounce, setBounce] = useState(false);
  const [quip, setQuip] = useState<string | null>(null);
  const [reaction, setReaction] = useState<string | null>(null);
  const [emojis, setEmojis] = useState<{ id: number; x: number; emoji: string; cls?: string }[]>([]);
  const [lift, setLift] = useState(0);
  const target = useRef(1);
  const pos = useRef(1);
  const nextDecision = useRef(0);
  const wanderUntil = useRef(0);
  const raf = useRef(0);

  useEffect(() => {
    const onChange = () => setEnabled(roamingBearEnabled());
    window.addEventListener('stry-roaming-bear', onChange);
    return () => window.removeEventListener('stry-roaming-bear', onChange);
  }, []);

  const hidden = !enabled || motion === 'off' || route.segments[0] === 'bear' || route.segments[0] === 'home' || route.segments.length === 0;

  // Wander: pick a new spot every few seconds and walk there at a bear's pace.
  useEffect(() => {
    if (hidden || motion !== 'full') return;
    let last = performance.now();
    const step = (t: number) => {
      const dt = Math.min(50, t - last) / 1000;
      last = t;
      if (t < wanderUntil.current) {
        if (t > nextDecision.current) {
          target.current = Math.random();
          nextDecision.current = t + 1200 + Math.random() * 1500;
        }
      } else target.current = 1; // home corner
      const delta = target.current - pos.current;
      const speed = 0.12; // screen widths per second
      if (Math.abs(delta) > 0.004) {
        const move = Math.sign(delta) * Math.min(Math.abs(delta), speed * dt);
        pos.current += move;
        setDir(move < 0 ? -1 : 1);
        setWalking(true);
        setX(pos.current);
      } else if (walking) setWalking(false);
      // Sticky action bars sit above the tab bar; hop above them so the bear never covers a button.
      const sticky = document.querySelector('.sticky-actions-inner');
      setLift(sticky ? sticky.getBoundingClientRect().height : 0);
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hidden, motion]);

  if (hidden) return null;
  const mascot = state.mascot;
  const stage = stageFor(mascot.feeds);
  const key = account ? account.id : (state.session.member_id ?? 'demo');
  const remaining = cooldownRemaining(mascot, key, new Date().toISOString());

  const feed = () => {
    const res = actions.feedBear();
    if (!res.ok) {
      if (res.code === 'daily_cap') toast({ kind: 'error', text: res.message });
      else {
        setQuip('Still chewing…');
        window.setTimeout(() => setQuip(null), 900);
      }
      return;
    }
    haptic(state.settings.haptics, res.evolved ? [20, 40, 60] : 8);
    setBounce(true);
    window.setTimeout(() => setBounce(false), 450);
    const r = pickReaction();
    if (r.sound) playSfx(r.sound);
    setQuip(res.evolved && res.stage ? `Evolved: ${res.stage.name}!` : `+1 ${r.quip}`);
    window.setTimeout(() => setQuip(null), 1100);
    setReaction(null);
    window.requestAnimationFrame(() => setReaction(`react-${r.anim}`));
    window.setTimeout(() => setReaction((cur) => (cur === `react-${r.anim}` ? null : cur)), REACTION_MS);
    const stamp = Date.now();
    const batch = r.emojis.map((emoji, i) => ({ id: stamp + i, x: 30 + Math.random() * 40, emoji, cls: r.emojiClass }));
    setEmojis((e) => [...e, ...batch]);
    window.setTimeout(() => setEmojis((e) => e.filter((q) => !batch.some((b) => b.id === q.id))), 1000);
    if (res.evolved) burst();
    // Excited bear runs around for a bit, then returns to its corner.
    wanderUntil.current = performance.now() + WANDER_MS;
    target.current = Math.random() * 0.8;
    nextDecision.current = performance.now() + 1500;
  };

  const left = motion === 'full' ? `calc(${x} * (min(100vw, 480px) - ${SIZE + 16}px) + max(0px, (100vw - 480px) / 2) + 8px)` : `calc(100vw - ${SIZE + 12}px)`;
  return (
    <button
      type="button"
      className={`roaming-bear${walking ? ' walking' : ''}${remaining > 0 ? ' cooling' : ''}${!walking && x > 0.97 && motion === 'full' ? ' docked' : ''}`}
      style={{ left, bottom: `calc(var(--nav-height) + var(--safe-bottom) + ${lift + 6}px)`, width: SIZE, height: SIZE }}
      onClick={feed}
      aria-label={`Feed the bear (stage ${stage.n}, ${mascot.feeds} feeds so far)`}
      title="Tap to feed the STRY Bear"
    >
      <span className="roaming-bear-inner" style={{ transform: dir < 0 ? 'scaleX(-1)' : undefined }}>
        <BearSprite stage={stage} size={SIZE} bounce={bounce && !reaction} className={reaction ?? undefined} />
      </span>
      {emojis.map((p, i) => (
        <span key={p.id} className={`bear-emoji${p.cls ? ` ${p.cls}` : ''}`} style={{ left: `${p.x}%`, animationDelay: `${i * 90}ms` }} aria-hidden="true">
          {p.emoji}
        </span>
      ))}
      {quip && <span className="roaming-quip">{quip}</span>}
      <span className="roaming-count">{mascot.feeds}</span>
    </button>
  );
}
