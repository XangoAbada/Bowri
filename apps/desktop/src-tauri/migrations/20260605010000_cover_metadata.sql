ALTER TABLE books ADD COLUMN cover_image_path TEXT NOT NULL DEFAULT '';
ALTER TABLE books ADD COLUMN cover_prompt TEXT NOT NULL DEFAULT '';
ALTER TABLE books ADD COLUMN cover_negative_prompt TEXT NOT NULL DEFAULT '';
ALTER TABLE books ADD COLUMN cover_generated_at TEXT;
