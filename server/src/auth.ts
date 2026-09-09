import type { Account, Env, Role } from './env';
import { HttpError } from './env';

const SESSION_DAYS = 90;
const PBKDF2_ITERATIONS = 120_000;

function toBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function randomToken(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return toBase64Url(buf);
}

export function newId(prefix: string): string {
  return `${prefix}_${randomToken(12)}`;
}

export async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return toBase64Url(digest);
}

async function pbkdf2(password: string, salt: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS }, key, 256);
  return toBase64Url(bits);
}

export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  return { hash: await pbkdf2(password, salt), salt: toBase64Url(salt) };
}

export async function verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
  const computed = await pbkdf2(password, fromBase64Url(salt));
  if (computed.length !== hash.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) diff |= computed.charCodeAt(i) ^ hash.charCodeAt(i);
  return diff === 0;
}

export function validateUsername(username: string): string {
  const u = username.trim();
  if (!/^[A-Za-z0-9_.-]{3,32}$/.test(u)) throw new HttpError(400, 'bad_username', 'Username must be 3–32 letters, digits, dots, dashes or underscores.');
  return u;
}

export function validatePassword(password: string): void {
  if (typeof password !== 'string' || password.length < 4) throw new HttpError(400, 'bad_password', 'Password must be at least 4 characters (a 4-digit PIN is fine).');
  if (password.length > 200) throw new HttpError(400, 'bad_password', 'Password is too long.');
}

interface AccountRow {
  id: string;
  username: string;
  password_hash: string;
  salt: string;
  role: Role;
  member_id: string | null;
  verified: number;
  disabled: number;
  created_at: string;
}

export function rowToAccount(r: AccountRow): Account {
  return { id: r.id, username: r.username, role: r.role, member_id: r.member_id, verified: r.verified === 1, disabled: r.disabled === 1, created_at: r.created_at };
}

export async function createSession(env: Env, accountId: string, now: Date): Promise<string> {
  const token = randomToken(32);
  const expires = new Date(now.getTime() + SESSION_DAYS * 86_400_000).toISOString();
  await env.DB.prepare('INSERT INTO sessions (token_hash, account_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(await sha256(token), accountId, now.toISOString(), expires)
    .run();
  return token;
}

export async function deleteSession(env: Env, token: string): Promise<void> {
  await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run();
}

export async function accountFromRequest(env: Env, request: Request, now: Date): Promise<Account | null> {
  const header = request.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return null;
  const row = await env.DB.prepare(
    `SELECT a.* FROM sessions s JOIN accounts a ON a.id = s.account_id WHERE s.token_hash = ? AND s.expires_at > ?`,
  )
    .bind(await sha256(match[1].trim()), now.toISOString())
    .first<AccountRow>();
  if (!row || row.disabled === 1) return null;
  return rowToAccount(row);
}

export async function findAccountByUsername(env: Env, username: string): Promise<AccountRow | null> {
  return env.DB.prepare('SELECT * FROM accounts WHERE username = ? COLLATE NOCASE').bind(username).first<AccountRow>();
}

export async function leaderCount(env: Env): Promise<number> {
  const row = await env.DB.prepare(`SELECT COUNT(*) AS n FROM accounts WHERE role = 'leader' AND disabled = 0`).first<{ n: number }>();
  return row?.n ?? 0;
}

export function requireAccount(account: Account | null): Account {
  if (!account) throw new HttpError(401, 'unauthenticated', 'Sign in to continue.');
  return account;
}

export function requireLeader(account: Account | null): Account {
  const a = requireAccount(account);
  if (a.role !== 'leader') throw new HttpError(403, 'forbidden', 'Leaders only.');
  return a;
}
