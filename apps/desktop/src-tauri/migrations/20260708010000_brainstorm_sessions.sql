CREATE TABLE IF NOT EXISTS brainstorm_sessions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  book_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  state_summary TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_brainstorm_sessions_project ON brainstorm_sessions(project_id, updated_at);

CREATE TABLE IF NOT EXISTS brainstorm_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES brainstorm_sessions(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  suggestions_json TEXT NOT NULL DEFAULT '[]',
  ai_run_id TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_brainstorm_messages_session ON brainstorm_messages(session_id, created_at);
