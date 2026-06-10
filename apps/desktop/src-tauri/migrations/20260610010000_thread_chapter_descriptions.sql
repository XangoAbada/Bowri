PRAGMA foreign_keys = ON;

ALTER TABLE chapter_threads
  ADD COLUMN description TEXT NOT NULL DEFAULT '';

DROP TABLE IF EXISTS beat_threads;
