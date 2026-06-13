CREATE TABLE IF NOT EXISTS export_presets (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL,
  book_id TEXT NOT NULL,
  name TEXT NOT NULL,
  settings_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_export_presets_project_book
ON export_presets(project_id, book_id, updated_at);
