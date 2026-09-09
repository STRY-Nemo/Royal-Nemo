/**
 * In-memory UI state (search text, filters, selected tabs, expanded cards)
 * keyed by screen so it survives navigating away and back. Not persisted.
 */
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

type Store = Map<string, unknown>;

interface UiValue {
  get: <T>(key: string, fallback: T) => T;
  set: <T>(key: string, value: T) => void;
}

const UiContext = createContext<UiValue | null>(null);

export function UiStateProvider({ children }: { children: ReactNode }) {
  const store = useRef<Store>(new Map());
  const [, bump] = useState(0);
  const get = useCallback(<T,>(key: string, fallback: T): T => (store.current.has(key) ? (store.current.get(key) as T) : fallback), []);
  const set = useCallback(<T,>(key: string, value: T) => {
    store.current.set(key, value);
    bump((n) => n + 1);
  }, []);
  return <UiContext.Provider value={{ get, set }}>{children}</UiContext.Provider>;
}

/** Like useState, but remembered across navigation for the given key. */
export function useUiState<T>(key: string, fallback: T): [T, (next: T | ((prev: T) => T)) => void] {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error('useUiState must be used within UiStateProvider');
  const value = ctx.get(key, fallback);
  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      const prev = ctx.get(key, fallback);
      ctx.set(key, typeof next === 'function' ? (next as (p: T) => T)(prev) : next);
    },
    [ctx, key, fallback],
  );
  return [value, setValue];
}
