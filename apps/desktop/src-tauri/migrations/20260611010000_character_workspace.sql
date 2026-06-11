PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS visual_assets (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  related_type TEXT NOT NULL DEFAULT '',
  related_id TEXT NOT NULL DEFAULT '',
  asset_type TEXT NOT NULL DEFAULT 'image',
  title TEXT NOT NULL DEFAULT '',
  prompt TEXT NOT NULL DEFAULT '',
  negative_prompt TEXT NOT NULL DEFAULT '',
  file_path TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_visual_assets_project_related
  ON visual_assets(project_id, related_type, related_id);

CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  character_type TEXT NOT NULL DEFAULT 'person',
  name TEXT NOT NULL DEFAULT '',
  aliases_json TEXT NOT NULL DEFAULT '[]',
  role TEXT NOT NULL DEFAULT '',
  short_description TEXT NOT NULL DEFAULT '',
  external_goal TEXT NOT NULL DEFAULT '',
  internal_need TEXT NOT NULL DEFAULT '',
  wound TEXT NOT NULL DEFAULT '',
  false_belief TEXT NOT NULL DEFAULT '',
  secret TEXT NOT NULL DEFAULT '',
  strengths_json TEXT NOT NULL DEFAULT '[]',
  weaknesses_json TEXT NOT NULL DEFAULT '[]',
  voice_notes TEXT NOT NULL DEFAULT '',
  arc_summary TEXT NOT NULL DEFAULT '',
  knowledge_notes TEXT NOT NULL DEFAULT '',
  visual_prompt TEXT NOT NULL DEFAULT '',
  image_asset_id TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (image_asset_id) REFERENCES visual_assets(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_characters_project_order
  ON characters(project_id, order_index, created_at);

CREATE TABLE IF NOT EXISTS character_relations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  from_character_id TEXT NOT NULL,
  to_character_id TEXT NOT NULL,
  relation_type TEXT NOT NULL DEFAULT 'other',
  description TEXT NOT NULL DEFAULT '',
  history TEXT NOT NULL DEFAULT '',
  conflict TEXT NOT NULL DEFAULT '',
  opinion TEXT NOT NULL DEFAULT '',
  trust_level INTEGER NOT NULL DEFAULT 50,
  secret TEXT NOT NULL DEFAULT '',
  change_over_time TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (from_character_id) REFERENCES characters(id) ON DELETE CASCADE,
  FOREIGN KEY (to_character_id) REFERENCES characters(id) ON DELETE CASCADE,
  UNIQUE(from_character_id, to_character_id, relation_type)
);

CREATE INDEX IF NOT EXISTS idx_character_relations_project
  ON character_relations(project_id, from_character_id, to_character_id);

CREATE TABLE IF NOT EXISTS character_memories (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  character_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  details TEXT NOT NULL DEFAULT '',
  memory_type TEXT NOT NULL DEFAULT 'event',
  subject TEXT NOT NULL DEFAULT '',
  emotion TEXT NOT NULL DEFAULT '',
  importance INTEGER NOT NULL DEFAULT 50,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_character_memories_character
  ON character_memories(character_id, created_at);

CREATE TABLE IF NOT EXISTS character_memory_links (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  from_memory_id TEXT NOT NULL,
  to_memory_id TEXT NOT NULL,
  link_type TEXT NOT NULL DEFAULT 'association',
  description TEXT NOT NULL DEFAULT '',
  strength INTEGER NOT NULL DEFAULT 50,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (from_memory_id) REFERENCES character_memories(id) ON DELETE CASCADE,
  FOREIGN KEY (to_memory_id) REFERENCES character_memories(id) ON DELETE CASCADE,
  UNIQUE(from_memory_id, to_memory_id, link_type)
);

CREATE INDEX IF NOT EXISTS idx_character_memory_links_project
  ON character_memory_links(project_id, from_memory_id, to_memory_id);
