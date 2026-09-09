/**
 * Shared motion and feedback components. Every screen uses these rather than
 * ad-hoc effects so that the Full / Reduced / Off settings apply everywhere.
 */
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import type { MotionPreference } from '../domain/types';
import { CheckIcon, CloseIcon, StarIcon } from '../ui/icons';

// ---- Motion preference ------------------------------------------------------

export function applyMotionPreference(pref: MotionPreference): void {
  document.documentElement.setAttribute('data-motion', pref);
}

export function useEffectiveMotion(pref: MotionPreference): 'full' | 'reduced' | 'off' {
  const [system, setSystem] = useState<'full' | 'reduced'>(() => (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'reduced' : 'full'));
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setSystem(mq.matches ? 'reduced' : 'full');
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);
  return pref === 'system' ? system : pref;
}

// ---- Haptics ----------------------------------------------------------------

export function haptic(enabled: boolean, pattern: number | number[] = 10): void {
  if (!enabled) return;
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(pattern);
  } catch {
    /* no-op where unsupported */
  }
}

// ---- Live announcements -----------------------------------------------------

interface FeedbackContextValue {
  announce: (text: string) => void;
  toast: (t: Omit<Toast, 'id'>) => void;
  burst: () => void;
}

interface Toast {
  id: number;
  kind: 'ok' | 'error' | 'info';
  text: string;
  action?: { label: string; onClick: () => void };
  duration?: number;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export function useFeedback(): FeedbackContextValue {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useFeedback must be used within FeedbackProvider');
  return ctx;
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [live, setLive] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [leaving, setLeaving] = useState<Set<number>>(new Set());
  const [burstKey, setBurstKey] = useState(0);
  const counter = useRef(0);

  const announce = useCallback((text: string) => {
    setLive('');
    // Re-set on next frame so identical messages are announced again.
    requestAnimationFrame(() => setLive(text));
  }, []);

  const dismiss = useCallback((id: number) => {
    setLeaving((s) => new Set(s).add(id));
    window.setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
      setLeaving((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
    }, 200);
  }, []);

  const toast = useCallback(
    (t: Omit<Toast, 'id'>) => {
      const id = ++counter.current;
      setToasts((list) => [...list.slice(-2), { ...t, id }]);
      announce(t.text);
      const duration = t.duration ?? (t.action ? 6000 : t.kind === 'error' ? 6000 : 2600);
      window.setTimeout(() => dismiss(id), duration);
    },
    [announce, dismiss],
  );

  const burst = useCallback(() => setBurstKey((k) => k + 1), []);

  const value = useMemo(() => ({ announce, toast, burst }), [announce, toast, burst]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {live}
      </div>
      <div className="toast-host">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}${leaving.has(t.id) ? ' leaving' : ''}`} role={t.kind === 'error' ? 'alert' : undefined}>
            {t.kind === 'ok' ? <Checkmark /> : t.kind === 'error' ? <CloseIcon className="check" style={{ color: 'var(--danger)' }} /> : <StarIcon className="check" style={{ color: 'var(--cyan)' }} />}
            <div className="grow wrap">{t.text}</div>
            {t.action && (
              <button
                type="button"
                className="btn secondary small"
                onClick={() => {
                  t.action?.onClick();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
      {burstKey > 0 && <StarBurst key={burstKey} />}
    </FeedbackContext.Provider>
  );
}

export function Checkmark() {
  return (
    <svg className="check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  );
}

/** One-shot blue/silver star burst used after a successful publish. */
export function StarBurst() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => setVisible(false), 800);
    return () => window.clearTimeout(t);
  }, []);
  if (!visible) return null;
  const particles = Array.from({ length: 14 }, (_, i) => {
    const angle = (i / 14) * Math.PI * 2;
    const r = 70 + (i % 3) * 25;
    return { dx: `${Math.cos(angle) * r}px`, dy: `${Math.sin(angle) * r}px` };
  });
  return (
    <div className="burst" aria-hidden="true">
      {particles.map((p, i) => (
        <span key={i} style={{ ['--dx' as string]: p.dx, ['--dy' as string]: p.dy }} />
      ))}
    </div>
  );
}

export function OrbitSpinner({ label = 'Working' }: { label?: string }) {
  return (
    <span className="orbit" role="img" aria-label={label}>
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function Skeleton({ rows = 3, height = 60 }: { rows?: number; height?: number }) {
  return (
    <div className="list" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton" style={{ minHeight: height }} />
      ))}
    </div>
  );
}

export type SaveState = 'idle' | 'saving' | 'saved' | 'failed';

export function SaveIndicator({ state, label }: { state: SaveState; label?: string }) {
  if (state === 'idle') return null;
  return (
    <span className={`save-state ${state}`} role="status">
      {state === 'saving' && (
        <>
          <OrbitSpinner label="Saving" /> Saving…
        </>
      )}
      {state === 'saved' && (
        <>
          <CheckIcon width={16} height={16} /> {label ?? 'Saved'}
        </>
      )}
      {state === 'failed' && <>Save failed</>}
    </span>
  );
}

// ---- Bottom sheet -----------------------------------------------------------

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Return focus to this element on close. Defaults to the previously focused element. */
  returnFocusTo?: HTMLElement | null;
}

export function BottomSheet({ open, onClose, title, children, footer, returnFocusTo }: SheetProps) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const dragStart = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);

  useEffect(() => {
    if (open) {
      previousFocus.current = (document.activeElement as HTMLElement) ?? null;
      setMounted(true);
      setClosing(false);
    } else if (mounted) {
      setClosing(true);
      const duration = getMotionMs('--m-sheet');
      const t = window.setTimeout(() => {
        setMounted(false);
        setClosing(false);
        const target = returnFocusTo ?? previousFocus.current;
        target?.focus?.();
      }, duration);
      return () => window.clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!mounted || closing) return;
    const el = sheetRef.current;
    if (!el) return;
    const first = el.querySelector<HTMLElement>('input, button, [tabindex]:not([tabindex="-1"])');
    (first ?? el).focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const focusables = Array.from(el.querySelectorAll<HTMLElement>('input, button, select, textarea, [tabindex]:not([tabindex="-1"])')).filter((f) => !f.hasAttribute('disabled'));
        if (!focusables.length) return;
        const firstEl = focusables[0];
        const lastEl = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [mounted, closing, onClose]);

  if (!mounted) return null;

  return (
    <>
      <div className={`sheet-backdrop${closing ? ' closing' : ''}`} onClick={onClose} aria-hidden="true" />
      <div
        ref={sheetRef}
        className={`sheet${closing ? ' closing' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={dragY ? { transform: `translate(-50%, ${dragY}px)`, transition: 'none' } : undefined}
      >
        <div
          className="sheet-handle"
          onPointerDown={(e) => {
            dragStart.current = e.clientY;
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (dragStart.current === null) return;
            setDragY(Math.max(0, e.clientY - dragStart.current));
          }}
          onPointerUp={() => {
            const y = dragY;
            dragStart.current = null;
            setDragY(0);
            if (y > 80) onClose();
          }}
          style={{ touchAction: 'none', width: 80, padding: '8px 0', background: 'transparent', display: 'flex', justifyContent: 'center' }}
        >
          <span style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border)' }} />
        </div>
        <div className="sheet-header">
          <h2 id={titleId} className="wrap">
            {title}
          </h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-footer">{footer}</div>}
      </div>
    </>
  );
}

export function getMotionMs(token: string): number {
  if (typeof window === 'undefined') return 0;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  const n = parseFloat(raw);
  if (Number.isNaN(n)) return 200;
  return raw.endsWith('ms') ? n : n * 1000;
}

/** Runs a one-shot CSS class (e.g. pulse/highlight) on a keyed element. */
export function useFlash(): [Set<string>, (key: string) => void] {
  const [keys, setKeys] = useState<Set<string>>(new Set());
  const flash = useCallback((key: string) => {
    setKeys((s) => new Set(s).add(key));
    window.setTimeout(() => {
      setKeys((s) => {
        const n = new Set(s);
        n.delete(key);
        return n;
      });
    }, Math.max(getMotionMs('--m-lock'), 50) + 50);
  }, []);
  return [keys, flash];
}

/** Guards against double taps / double submits while an action runs. */
export function useSingleFlight<T extends unknown[]>(fn: (...args: T) => Promise<void> | void): [(...args: T) => Promise<void>, boolean] {
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const run = useCallback(
    async (...args: T) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      try {
        await fn(...args);
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [fn],
  );
  return [run, busy];
}

// ---- Confirm sheet ----------------------------------------------------------

interface ConfirmProps {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmSheet({ open, title, children, confirmLabel, danger, busy, onConfirm, onCancel }: ConfirmProps) {
  return (
    <BottomSheet
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" className={`btn ${danger ? 'danger' : 'primary'}`} onClick={onConfirm} disabled={busy}>
            {busy ? <OrbitSpinner label="Working" /> : confirmLabel}
          </button>
        </>
      }
    >
      {children}
    </BottomSheet>
  );
}
