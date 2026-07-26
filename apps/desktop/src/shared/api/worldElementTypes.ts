import enWorld from "../i18n/locales/en/world.json";
import plWorld from "../i18n/locales/pl/world.json";

/**
 * Dozwolone typy elementu świata. Kolejność steruje listą w selektorze typu
 * i w filtrze listy elementów (WorldPage).
 */
export const WORLD_ELEMENT_TYPES = [
  "location",
  "faction",
  "object",
  "culture",
  "technology",
  "magic",
  "creature",
  "historical_event",
  "institution",
  "custom",
  "other"
] as const;

export type WorldElementType = (typeof WORLD_ELEMENT_TYPES)[number];

export const WORLD_ELEMENT_TYPE_ENUM = WORLD_ELEMENT_TYPES.join(" | ");

const FALLBACK_TYPE: WorldElementType = "other";

/**
 * Klucz porównania odporny na warianty zapisu modelu: wielkość liter,
 * diakrytyki, spacje i myślniki zamiast podkreśleń.
 */
function canonicalKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// Slug + etykieta PL i EN wskazują na ten sam typ — model bywa proszony o typ
// po polsku i zwraca "Wydarzenie historyczne" zamiast "historical_event".
const lookup = new Map<string, WorldElementType>();
for (const type of WORLD_ELEMENT_TYPES) {
  const labels = [
    type,
    (plWorld.world.elementType as Record<string, string>)[type],
    (enWorld.world.elementType as Record<string, string>)[type]
  ];
  for (const label of labels) {
    if (!label) {
      continue;
    }
    const key = canonicalKey(label);
    if (key && !lookup.has(key)) {
      lookup.set(key, type);
    }
  }
}

export function isWorldElementType(value: unknown): value is WorldElementType {
  return typeof value === "string" && (WORLD_ELEMENT_TYPES as readonly string[]).includes(value);
}

/**
 * Mapuje surowe wyjście AI na dozwolony typ elementu świata.
 * Nierozpoznana wartość trafia do "other" — inaczej element wypadałby
 * z selektora typu i z filtra listy.
 */
export function normalizeWorldElementType(value: unknown): WorldElementType {
  if (typeof value !== "string") {
    return FALLBACK_TYPE;
  }
  return lookup.get(canonicalKey(value)) ?? FALLBACK_TYPE;
}
