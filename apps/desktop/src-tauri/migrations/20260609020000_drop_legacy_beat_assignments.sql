PRAGMA foreign_keys = OFF;

DROP INDEX IF EXISTS idx_beats_act_order;

CREATE TABLE IF NOT EXISTS beats_without_act (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT '',
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

INSERT OR IGNORE INTO beats_without_act
  (id, book_id, name, description, role, order_index, created_at, updated_at)
SELECT id, book_id, name, description, role, order_index, created_at, updated_at
FROM beats;

DROP TABLE IF EXISTS beat_threads;
DROP TABLE beats;
ALTER TABLE beats_without_act RENAME TO beats;

CREATE INDEX IF NOT EXISTS idx_beats_book_order ON beats(book_id, order_index);

PRAGMA foreign_keys = ON;
