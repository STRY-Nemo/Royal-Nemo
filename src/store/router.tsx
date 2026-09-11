/**
 * Tiny hash router. Keeps the last route per bottom tab so switching tabs
 * preserves where you were, and restores scroll positions on back.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

export type Tab = 'home' | 'canyon' | 'organize' | 'members' | 'ideas';

export interface Route {
  path: string;
  segments: string[];
  query: URLSearchParams;
  tab: Tab;
}

function parse(hash: string): Route {
  const raw = hash.replace(/^#\/?/, '');
  const [pathPart, queryPart = ''] = raw.split('?');
  const segments = pathPart.split('/').filter(Boolean);
  const first = segments[0] ?? 'home';
  const tab: Tab = first === 'canyon' || first === 'organize' || first === 'members' || first === 'ideas' ? first : 'home';
  return { path: '/' + segments.join('/') + (queryPart ? `?${queryPart}` : ''), segments, query: new URLSearchParams(queryPart), tab };
}

/**
 * Whether a route lives inside its tab. Pages such as the den (`/bear`) and
 * Settings are reached from Home but are not part of it, so the Home tab must
 * not "remember" them: tapping Home always returns to the overview.
 */
export function belongsToTab(route: Route): boolean {
  const first = route.segments[0];
  return route.tab === 'home' ? first === undefined || first === 'home' : first === route.tab;
}

interface RouterValue {
  route: Route;
  navigate: (path: string, opts?: { replace?: boolean }) => void;
  back: (fallback?: string) => void;
  switchTab: (tab: Tab) => void;
}

const RouterContext = createContext<RouterValue | null>(null);

export function RouterProvider({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash));
  const lastPerTab = useRef<Record<Tab, string>>({ home: '/home', canyon: '/canyon', organize: '/organize', members: '/members', ideas: '/ideas' });
  const scrollPositions = useRef<Map<string, number>>(new Map());
  const historyDepth = useRef(0);

  useEffect(() => {
    const onHash = () => {
      scrollPositions.current.set(route.path, window.scrollY);
      const next = parse(window.location.hash);
      setRoute(next);
      if (belongsToTab(next)) lastPerTab.current[next.tab] = next.path;
      requestAnimationFrame(() => {
        const y = scrollPositions.current.get(next.path) ?? 0;
        window.scrollTo({ top: y, behavior: 'auto' });
      });
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [route.path]);

  useEffect(() => {
    if (!window.location.hash) window.location.replace('#/home');
  }, []);

  const navigate = useCallback((path: string, opts?: { replace?: boolean }) => {
    const target = '#' + (path.startsWith('/') ? path : '/' + path);
    if (window.location.hash === target) return;
    if (opts?.replace) window.location.replace(target);
    else {
      historyDepth.current++;
      window.location.hash = target;
    }
  }, []);

  const back = useCallback(
    (fallback = '/home') => {
      if (historyDepth.current > 0) {
        historyDepth.current--;
        window.history.back();
      } else {
        navigate(fallback, { replace: true });
      }
    },
    [navigate],
  );

  const switchTab = useCallback(
    (tab: Tab) => {
      // Tapping the tab you are already on goes to its root, like native phone apps.
      if (route.tab === tab) navigate(`/${tab}`);
      else navigate(lastPerTab.current[tab] ?? `/${tab}`);
    },
    [navigate, route.tab],
  );

  const value = useMemo(() => ({ route, navigate, back, switchTab }), [route, navigate, back, switchTab]);
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter(): RouterValue {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error('useRouter must be used within RouterProvider');
  return ctx;
}
