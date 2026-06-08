PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS story_structures (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL UNIQUE,
  structure_type TEXT NOT NULL DEFAULT 'three_act',
  description TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS acts (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  purpose TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  start_percent INTEGER NOT NULL DEFAULT 0,
  end_percent INTEGER NOT NULL DEFAULT 0,
  order_index INTEGER NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#3f8f6b',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_acts_book_order ON acts(book_id, order_index);

CREATE TABLE IF NOT EXISTS beats (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL,
  act_id TEXT,
  name TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT '',
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  FOREIGN KEY (act_id) REFERENCES acts(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_beats_book_order ON beats(book_id, order_index);
CREATE INDEX IF NOT EXISTS idx_beats_act_order ON beats(act_id, order_index);

CREATE TABLE IF NOT EXISTS plot_threads (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#3f8f6b',
  status TEXT NOT NULL DEFAULT 'planned',
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_plot_threads_book_order ON plot_threads(book_id, order_index);

CREATE TABLE IF NOT EXISTS chapters (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL,
  act_id TEXT,
  number INTEGER NOT NULL DEFAULT 1,
  working_title TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  purpose TEXT NOT NULL DEFAULT '',
  conflict TEXT NOT NULL DEFAULT '',
  turning_point TEXT NOT NULL DEFAULT '',
  target_word_count INTEGER,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  FOREIGN KEY (act_id) REFERENCES acts(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_chapters_book_order ON chapters(book_id, order_index);
CREATE INDEX IF NOT EXISTS idx_chapters_act_order ON chapters(act_id, order_index);

CREATE TABLE IF NOT EXISTS chapter_threads (
  chapter_id TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  PRIMARY KEY (chapter_id, thread_id),
  FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE,
  FOREIGN KEY (thread_id) REFERENCES plot_threads(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS beat_threads (
  beat_id TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  PRIMARY KEY (beat_id, thread_id),
  FOREIGN KEY (beat_id) REFERENCES beats(id) ON DELETE CASCADE,
  FOREIGN KEY (thread_id) REFERENCES plot_threads(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chapter_beats (
  chapter_id TEXT NOT NULL,
  beat_id TEXT NOT NULL,
  PRIMARY KEY (chapter_id, beat_id),
  FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE,
  FOREIGN KEY (beat_id) REFERENCES beats(id) ON DELETE CASCADE
);
