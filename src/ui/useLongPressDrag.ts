/**
 * Touch/pointer long-press drag with edge auto-scroll. Generic over a payload
 * and a drop target id. Normal swipes that start on a grip but move before the
 * long-press delay are treated as scrolling.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export interface DragState<P> {
  payload: P;
  x: number;
  y: number;
  overTarget: string | null;
}

interface Options<P> {
  delayMs?: number;
  /** Return the drop target id under the point, or null. */
  hitTest: (x: number, y: number) => string | null;
  /** Whether the target is a valid destination for the payload. */
  canDrop: (payload: P, targetId: string) => boolean;
  onDrop: (payload: P, targetId: string) => void;
  onStart?: (payload: P) => void;
  onCancel?: () => void;
}

export function useLongPressDrag<P>({ delayMs = 250, hitTest, canDrop, onDrop, onStart, onCancel }: Options<P>) {
  const [drag, setDrag] = useState<DragState<P> | null>(null);
  const timer = useRef<number | null>(null);
  const pending = useRef<{ payload: P; x: number; y: number; pointerId: number; el: HTMLElement } | null>(null);
  const dragRef = useRef<DragState<P> | null>(null);
  const raf = useRef<number | null>(null);

  const clearTimer = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
  };

  const stopAutoScroll = () => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = null;
  };

  const autoScroll = useCallback(() => {
    const d = dragRef.current;
    if (!d) return;
    const edge = 56;
    const top = 56; // sticky header
    const bottom = window.innerHeight - 64; // bottom tab bar
    let dy = 0;
    if (d.y < top + edge) dy = -Math.ceil((top + edge - d.y) / 6);
    else if (d.y > bottom - edge) dy = Math.ceil((d.y - (bottom - edge)) / 6);
    if (dy !== 0) window.scrollBy(0, dy);
    raf.current = requestAnimationFrame(autoScroll);
  }, []);

  const update = useCallback(
    (x: number, y: number) => {
      const d = dragRef.current;
      if (!d) return;
      const target = hitTest(x, y);
      const next = { ...d, x, y, overTarget: target && canDrop(d.payload, target) ? target : target ? `invalid:${target}` : null };
      dragRef.current = next;
      setDrag(next);
    },
    [hitTest, canDrop],
  );

  const finish = useCallback(
    (drop: boolean) => {
      clearTimer();
      stopAutoScroll();
      const d = dragRef.current;
      pending.current = null;
      dragRef.current = null;
      setDrag(null);
      if (!d) return;
      if (drop && d.overTarget && !d.overTarget.startsWith('invalid:')) onDrop(d.payload, d.overTarget);
      else onCancel?.();
    },
    [onDrop, onCancel],
  );

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const p = pending.current;
      if (p && !dragRef.current) {
        // Moved before long-press: treat as scroll, cancel.
        if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > 8) {
          clearTimer();
          pending.current = null;
        }
        return;
      }
      if (dragRef.current) {
        e.preventDefault();
        update(e.clientX, e.clientY);
      }
    };
    const onUp = () => {
      if (dragRef.current) finish(true);
      else {
        clearTimer();
        pending.current = null;
      }
    };
    const onCancelEv = () => finish(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dragRef.current) finish(false);
    };
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancelEv);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancelEv);
      window.removeEventListener('keydown', onKey);
    };
  }, [update, finish]);

  /** Attach to the grip element's onPointerDown. */
  const gripProps = useCallback(
    (payload: P) => ({
      onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        const el = e.currentTarget as HTMLElement;
        pending.current = { payload, x: e.clientX, y: e.clientY, pointerId: e.pointerId, el };
        clearTimer();
        timer.current = window.setTimeout(() => {
          const p = pending.current;
          if (!p) return;
          try {
            p.el.setPointerCapture(p.pointerId);
          } catch {
            /* ignore */
          }
          const state: DragState<P> = { payload: p.payload, x: p.x, y: p.y, overTarget: null };
          dragRef.current = state;
          setDrag(state);
          onStart?.(p.payload);
          try {
            navigator.vibrate?.(10);
          } catch {
            /* ignore */
          }
          raf.current = requestAnimationFrame(autoScroll);
          update(p.x, p.y);
        }, delayMs);
      },
      onPointerUp: () => {
        clearTimer();
      },
      onContextMenu: (e: React.MouseEvent) => {
        if (pending.current || dragRef.current) e.preventDefault();
      },
    }),
    [delayMs, onStart, autoScroll, update],
  );

  return { drag, gripProps, cancel: () => finish(false) };
}
