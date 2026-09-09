import { useEffect, useRef, useState } from 'react';
import { cooldownRemaining, stageFor } from '../engine/mascot';
import { haptic, useEffectiveMotion, useFeedback } from '../motion';
import { useRouter } from '../store/router';
import { useStore } from '../store/store';
import { BearSprite } from './Bear';

const KEY = 'stry-roaming-bear';
const SIZE = 72;
const QUIPS = ['Yum!', 'More?', 'Rawr!', 'Thanks!', 'Mmm honey', 'Strong!', 'Nom nom'];

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
 * The bear wanders along the bottom of every screen (except Home and the den,
 * which show the big one). Tap it to feed. Reduced motion: it sits still in a
 * corner; motion Off: hidden.
 */
export function RoamingBear() {
  const { state, actions, account } = useStore();
  const { route } = useRouter();
  const { toast, burst } = useFeedback();
  const motion = useEffectiveMotion(state.settings.motion);
  const [enabled, setEnabled] = useState(roamingBearEnabled);
  const [x, setX] = useState(0.7);
  const [dir, setDir] = useState<1 | -1>(-1);
  const [walking, setWalking] = useState(false);
  const [bounce, setBounce] = useState(false);
  const [quip, setQuip] = useState<string | null>(null);
  const [lift, setLift] = useState(0);
  const target = useRef(0.7);
  const pos = useRef(0.7);
  const nextDecision = useRef(0);
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
      if (t > nextDecision.current) {
        const rest = Math.random() < 0.35;
        target.current = rest ? pos.current : Math.random();
        nextDecision.current = t + 2500 + Math.random() * 4500;
      }
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
    setQuip(res.evolved && res.stage ? `Evolved: ${res.stage.name}!` : `+1 ${QUIPS[Math.floor(Math.random() * QUIPS.length)]}`);
    window.setTimeout(() => setQuip(null), 1100);
    if (res.evolved) burst();
    // Excited bear runs somewhere new.
    target.current = Math.random();
    nextDecision.current = performance.now() + 3000;
  };

  const left = motion === 'full' ? `calc(${x} * (100vw - ${SIZE + 16}px) + 8px)` : `calc(100vw - ${SIZE + 12}px)`;
  return (
    <button
      type="button"
      className={`roaming-bear${walking ? ' walking' : ''}${remaining > 0 ? ' cooling' : ''}`}
      style={{ left, bottom: `calc(var(--nav-height) + var(--safe-bottom) + ${lift + 6}px)`, width: SIZE, height: SIZE }}
      onClick={feed}
      aria-label={`Feed the bear (stage ${stage.n}, ${mascot.feeds} feeds so far)`}
      title="Tap to feed the STRY Bear"
    >
      <span className="roaming-bear-inner" style={{ transform: dir < 0 ? 'scaleX(-1)' : undefined }}>
        <BearSprite stage={stage} size={SIZE} bounce={bounce} />
      </span>
      {quip && <span className="roaming-quip">{quip}</span>}
      <span className="roaming-count">{mascot.feeds}</span>
    </button>
  );
}
