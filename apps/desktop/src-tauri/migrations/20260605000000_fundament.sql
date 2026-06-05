PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'pl',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  active_book_id TEXT,
  settings_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS books (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  working_title TEXT NOT NULL DEFAULT '',
  premise TEXT NOT NULL DEFAULT '',
  logline TEXT NOT NULL DEFAULT '',
  genre TEXT NOT NULL DEFAULT '',
  subgenre TEXT NOT NULL DEFAULT '',
  target_audience TEXT NOT NULL DEFAULT '',
  tone TEXT NOT NULL DEFAULT '',
  style_guide TEXT NOT NULL DEFAULT '',
  point_of_view TEXT NOT NULL DEFAULT '',
  target_word_count INTEGER,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_books_project_id ON books(project_id);

CREATE TABLE IF NOT EXISTS ai_runs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  action TEXT NOT NULL,
  prompt_package_json TEXT NOT NULL,
  raw_output TEXT,
  parsed_output_json TEXT,
  status TEXT NOT NULL,
  error_message TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ai_runs_project_id_created_at ON ai_runs(project_id, created_at);

CREATE TABLE IF NOT EXISTS ai_proposals (
  id TEXT PRIMARY KEY,
  ai_run_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  proposal_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  applied_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (ai_run_id) REFERENCES ai_runs(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ai_proposals_project_status ON ai_proposals(project_id, status);
