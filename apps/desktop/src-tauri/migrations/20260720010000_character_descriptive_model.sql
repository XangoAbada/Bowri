-- Model postaci: opisowy zamiast preskryptywnego.
-- Dodaje pola opisujące osobę (temperament, upodobania, świat wewnętrzny, światopogląd,
-- manieryzmy, pochodzenie, rodzina, przeszłość) i scala treść ze starych pól fabularnych.
-- Stare kolumny (external_goal, internal_need, wound, false_belief, arc_summary,
-- strengths_json, weaknesses_json) zostają w tabeli jako backup — struct Rust ich nie czyta.

ALTER TABLE characters ADD COLUMN temperament TEXT NOT NULL DEFAULT '';
ALTER TABLE characters ADD COLUMN likes_dislikes TEXT NOT NULL DEFAULT '';
ALTER TABLE characters ADD COLUMN inner_world TEXT NOT NULL DEFAULT '';
ALTER TABLE characters ADD COLUMN worldview TEXT NOT NULL DEFAULT '';
ALTER TABLE characters ADD COLUMN mannerisms TEXT NOT NULL DEFAULT '';
ALTER TABLE characters ADD COLUMN origin TEXT NOT NULL DEFAULT '';
ALTER TABLE characters ADD COLUMN family TEXT NOT NULL DEFAULT '';
ALTER TABLE characters ADD COLUMN background TEXT NOT NULL DEFAULT '';

-- Scalenie starej treści (best-effort; autor doczyszcza — pola są prozą).

UPDATE characters SET inner_world = TRIM(
  CASE WHEN external_goal <> '' THEN 'Dąży do: ' || external_goal || char(10) ELSE '' END ||
  CASE WHEN internal_need <> '' THEN 'Potrzebuje: ' || internal_need ELSE '' END
)
WHERE inner_world = '' AND (external_goal <> '' OR internal_need <> '');

UPDATE characters SET worldview = false_belief
WHERE worldview = '' AND false_belief <> '';

UPDATE characters SET background = TRIM(
  CASE WHEN wound <> '' THEN 'Rana: ' || wound || char(10) ELSE '' END ||
  CASE WHEN arc_summary <> '' THEN 'Łuk (poprzednia wersja): ' || arc_summary ELSE '' END
)
WHERE background = '' AND (wound <> '' OR arc_summary <> '');

-- strengths_json/weaknesses_json to JSON array stringów: ["a","b"] -> "a, b".
UPDATE characters SET temperament = TRIM(
  CASE WHEN strengths_json NOT IN ('', '[]')
    THEN 'Silne strony: ' || replace(replace(replace(replace(strengths_json, '["', ''), '"]', ''), '","', ', '), '"', '') || char(10)
    ELSE '' END ||
  CASE WHEN weaknesses_json NOT IN ('', '[]')
    THEN 'Słabości: ' || replace(replace(replace(replace(weaknesses_json, '["', ''), '"]', ''), '","', ', '), '"', '')
    ELSE '' END
)
WHERE temperament = '' AND (strengths_json NOT IN ('', '[]') OR weaknesses_json NOT IN ('', '[]'));
