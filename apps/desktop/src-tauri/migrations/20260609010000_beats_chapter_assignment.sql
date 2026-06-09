PRAGMA foreign_keys = ON;

UPDATE beats SET act_id = NULL;

DELETE FROM beat_threads;
