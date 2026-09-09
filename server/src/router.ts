import type { Account, Env } from './env';
import { HttpError } from './env';

export interface Ctx {
  env: Env;
  request: Request;
  account: Account | null;
  params: Record<string, string>;
  now: Date;
  body: () => Promise<Record<string, unknown>>;
}

export type Handler = (ctx: Ctx) => Promise<unknown>;

interface RouteDef {
  method: string;
  pattern: RegExp;
  keys: string[];
  handler: Handler;
}

export class Router {
  private routes: RouteDef[] = [];

  add(method: string, path: string, handler: Handler): this {
    const keys: string[] = [];
    const pattern = new RegExp(
      '^' +
        path.replace(/\/:([A-Za-z_]+)/g, (_m, key: string) => {
          keys.push(key);
          return '/([^/]+)';
        }) +
        '/?$',
    );
    this.routes.push({ method, pattern, keys, handler });
    return this;
  }

  get(path: string, handler: Handler): this {
    return this.add('GET', path, handler);
  }
  post(path: string, handler: Handler): this {
    return this.add('POST', path, handler);
  }
  delete(path: string, handler: Handler): this {
    return this.add('DELETE', path, handler);
  }

  match(method: string, pathname: string): { handler: Handler; params: Record<string, string> } | null {
    for (const r of this.routes) {
      if (r.method !== method) continue;
      const m = r.pattern.exec(pathname);
      if (!m) continue;
      const params: Record<string, string> = {};
      r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
      return { handler: r.handler, params };
    }
    return null;
  }
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    throw new Error('not an object');
  } catch {
    throw new HttpError(400, 'bad_json', 'Request body must be a JSON object.');
  }
}

export function str(body: Record<string, unknown>, key: string, required = true): string {
  const v = body[key];
  if (typeof v === 'string' && v.length > 0) return v;
  if (!required && (v === undefined || v === null || v === '')) return '';
  throw new HttpError(400, 'bad_request', `Missing or invalid "${key}".`);
}

export function num(body: Record<string, unknown>, key: string, required = true): number | undefined {
  const v = body[key];
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (!required && (v === undefined || v === null)) return undefined;
  throw new HttpError(400, 'bad_request', `Missing or invalid "${key}".`);
}

export function corsHeaders(env: Env, request: Request): Record<string, string> {
  const origin = request.headers.get('origin') ?? '';
  const allowed = (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const headers: Record<string, string> = {
    'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS',
    'access-control-allow-headers': 'authorization,content-type',
    'access-control-max-age': '86400',
    vary: 'origin',
  };
  if (origin && (allowed.includes(origin) || allowed.includes('*'))) headers['access-control-allow-origin'] = origin;
  return headers;
}
