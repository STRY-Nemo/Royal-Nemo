import { useEffect, useRef, useState } from 'react';
import { useEffectiveMotion } from '../motion';
import { useStore } from '../store/store';

/** Optional full-screen scene from public/art/app-background.jpg, dimmed so cards stay readable. */
function Backdrop() {
  const [missing, setMissing] = useState(false);
  if (missing) return null;
  return <img src={`${import.meta.env.BASE_URL}art/app-background.jpg`} alt="" className="app-backdrop" aria-hidden="true" draggable={false} onError={() => setMissing(true)} />;
}

/** Slow celestial starfield behind the app. Static under reduced motion, hidden when motion is off. */
export function Starfield() {
  const { state } = useStore();
  const motion = useEffectiveMotion(state.settings.motion);
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || motion === 'off') return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const stars = Array.from({ length: 90 }, (_, i) => ({ x: Math.random(), y: Math.random(), r: 0.4 + Math.random() * 1.3, p: Math.random() * Math.PI * 2, s: 0.3 + Math.random() * 0.7, blue: i % 5 === 0 }));
    let shooting: { x: number; y: number; vx: number; vy: number; life: number } | null = null;
    let nextShot = performance.now() + 4000 + Math.random() * 6000;
    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        const tw = motion === 'full' ? 0.55 + 0.45 * Math.sin(t / 900 * s.s + s.p) : 0.8;
        const drift = motion === 'full' ? ((t / 60000) * s.s) % 1 : 0;
        const x = ((s.x + drift * 0.02) % 1) * w;
        const y = s.y * h;
        ctx.beginPath();
        ctx.arc(x, y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = s.blue ? `rgba(111, 211, 255, ${0.5 * tw})` : `rgba(201, 214, 234, ${0.45 * tw})`;
        ctx.fill();
      }
      if (motion === 'full') {
        if (!shooting && t > nextShot) {
          shooting = { x: Math.random() * w * 0.7, y: Math.random() * h * 0.3, vx: 9 + Math.random() * 4, vy: 4 + Math.random() * 3, life: 1 };
          nextShot = t + 8000 + Math.random() * 12000;
        }
        if (shooting) {
          const g = ctx.createLinearGradient(shooting.x, shooting.y, shooting.x - shooting.vx * 8, shooting.y - shooting.vy * 8);
          g.addColorStop(0, `rgba(244, 247, 252, ${0.9 * shooting.life})`);
          g.addColorStop(1, 'rgba(244, 247, 252, 0)');
          ctx.strokeStyle = g;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(shooting.x, shooting.y);
          ctx.lineTo(shooting.x - shooting.vx * 8, shooting.y - shooting.vy * 8);
          ctx.stroke();
          shooting.x += shooting.vx;
          shooting.y += shooting.vy;
          shooting.life -= 0.03;
          if (shooting.life <= 0 || shooting.x > w || shooting.y > h) shooting = null;
        }
        raf = requestAnimationFrame(draw);
      }
    };
    const start = () => {
      cancelAnimationFrame(raf);
      resize();
      raf = requestAnimationFrame(draw);
    };
    const onVis = () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else start();
    };
    start();
    window.addEventListener('resize', start);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', start);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [motion]);

  return (
    <>
      <Backdrop />
      {motion !== 'off' && <canvas ref={ref} className="starfield" aria-hidden="true" />}
    </>
  );
}
