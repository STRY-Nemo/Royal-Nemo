/**
 * Tiny sound effects for the bear. A real recording is used when the file
 * exists (public/sfx/<name>.mp3, e.g. the wet fart from Nemo's Flappy
 * Adventure); otherwise a synthesized stand-in plays. Off switch in Settings.
 */
import { useEffect, useState } from 'react';

const KEY = 'stry-sfx';
const EVENT = 'stry-sfx';

export function sfxEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setSfxEnabled(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(EVENT));
}

type SfxName = 'fart';
const files: Partial<Record<SfxName, HTMLAudioElement | null>> = {};
let ctx: AudioContext | null = null;

function audioContext(): AudioContext | null {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx ??= new Ctor();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Loads the recording once; resolves null when the file is missing. */
function recording(name: SfxName): Promise<HTMLAudioElement | null> {
  if (name in files) return Promise.resolve(files[name] ?? null);
  return new Promise((resolve) => {
    const a = new Audio(`${import.meta.env.BASE_URL}sfx/${name}.mp3`);
    a.preload = 'auto';
    const done = (ok: boolean) => {
      files[name] = ok ? a : null;
      resolve(files[name] ?? null);
    };
    a.addEventListener('canplaythrough', () => done(true), { once: true });
    a.addEventListener('error', () => done(false), { once: true });
    a.load();
    window.setTimeout(() => {
      if (!(name in files)) done(a.readyState >= 2);
    }, 2500);
  });
}

/** A wet, wobbly toot: low sawtooth with fast pitch wobble, a noisy tail and a quick fade. */
function synthFart(): void {
  const ac = audioContext();
  if (!ac) return;
  const t0 = ac.currentTime;
  const dur = 0.55;
  const master = ac.createGain();
  master.gain.setValueAtTime(0.0001, t0);
  master.gain.exponentialRampToValueAtTime(0.5, t0 + 0.03);
  master.gain.exponentialRampToValueAtTime(0.35, t0 + 0.3);
  master.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(900, t0);
  lp.frequency.exponentialRampToValueAtTime(300, t0 + dur);
  lp.Q.value = 4;
  master.connect(ac.destination);
  lp.connect(master);

  const osc = ac.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(95, t0);
  osc.frequency.exponentialRampToValueAtTime(60, t0 + dur);
  // Wobble (the "wet" part).
  const lfo = ac.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.setValueAtTime(28, t0);
  lfo.frequency.linearRampToValueAtTime(14, t0 + dur);
  const lfoGain = ac.createGain();
  lfoGain.gain.value = 35;
  lfo.connect(lfoGain);
  lfoGain.connect(osc.frequency);
  osc.connect(lp);

  // Breathy noise layer.
  const len = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) * 0.6;
  const noise = ac.createBufferSource();
  noise.buffer = buf;
  const noiseGain = ac.createGain();
  noiseGain.gain.value = 0.25;
  noise.connect(noiseGain);
  noiseGain.connect(lp);

  osc.start(t0);
  lfo.start(t0);
  noise.start(t0);
  osc.stop(t0 + dur);
  lfo.stop(t0 + dur);
  noise.stop(t0 + dur);
}

/** Plays a sound effect if sounds are on. Never throws. */
export function playSfx(name: SfxName): void {
  if (!sfxEnabled()) return;
  void recording(name)
    .then((a) => {
      if (a) {
        a.currentTime = 0;
        return a.play().catch(() => synthFart());
      }
      synthFart();
    })
    .catch(() => undefined);
}

export function useSfxSetting(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(sfxEnabled);
  useEffect(() => {
    const h = () => setOn(sfxEnabled());
    window.addEventListener(EVENT, h);
    return () => window.removeEventListener(EVENT, h);
  }, []);
  return [
    on,
    (v: boolean) => {
      setSfxEnabled(v);
      setOn(v);
    },
  ];
}
