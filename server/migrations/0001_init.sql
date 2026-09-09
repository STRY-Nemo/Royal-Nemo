-- STRY alliance API schema (Cloudflare D1 / SQLite).

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('leader', 'member')),
  member_id TEXT,
  verified INTEGER NOT NULL DEFAULT 0,
  disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_account ON sessions(account_id);

CREATE TABLE IF NOT EXISTS invites (
  code TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('leader', 'member')),
  created_by TEXT NOT NULL,
  uses_left INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Roster members, one JSON document per member (see src/domain/types.ts Member).
CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  doc TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Canyon events, one JSON document each; revision is the optimistic-concurrency token.
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  status TEXT NOT NULL,
  revision INTEGER NOT NULL,
  doc TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS events_date ON events(date);

-- Singleton documents: 'organization' and 'settings'.
CREATE TABLE IF NOT EXISTS documents (
  key TEXT PRIMARY KEY,
  revision INTEGER NOT NULL,
  doc TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit (
  id TEXT PRIMARY KEY,
  event_id TEXT,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  before TEXT,
  after TEXT,
  reason TEXT,
  timestamp TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS audit_timestamp ON audit(timestamp);
