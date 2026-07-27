-- Audyt spójności całego projektu: jeden wiersz na uruchomioną analizę.
-- Przebiegi (5 wymiarów + synteza) i uwagi trzymane jako JSON w kolumnach,
-- tak jak findings_json w scene_critiques — raport jest zawsze przepisywany
-- w całości, więc tabele dzieci nic by nie dały.
CREATE TABLE IF NOT EXISTS consistency_audits (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  book_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  dossier_hash TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  passes_json TEXT NOT NULL DEFAULT '{}',
  findings_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_consistency_audits_book
  ON consistency_audits(book_id, updated_at);

CREATE INDEX IF NOT EXISTS idx_consistency_audits_project
  ON consistency_audits(project_id, updated_at);
