-- Member suggestions and feature requests (the Ideas tab).
CREATE TABLE IF NOT EXISTS suggestions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  member_id TEXT,
  author_name TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('new', 'planned', 'done', 'declined')),
  votes TEXT NOT NULL DEFAULT '[]',
  leader_reply TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS suggestions_created ON suggestions(created_at);
