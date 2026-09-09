export interface Env {
  DB: D1Database;
  /** Comma-separated list of browser origins allowed to call the API. */
  ALLOWED_ORIGINS?: string;
  /** Secret. Registering with this code while no leader exists creates the first leader. */
  OWNER_SETUP_CODE?: string;
  /** Optional shared token that lets an automation (GitHub Actions) export suggestions. */
  SUGGESTIONS_SYNC_TOKEN?: string;
}

export type Role = 'leader' | 'member';

export interface Account {
  id: string;
  username: string;
  role: Role;
  member_id: string | null;
  verified: boolean;
  disabled: boolean;
  created_at: string;
}

export class HttpError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
