import enWorld from "../i18n/locales/en/world.json";
import plWorld from "../i18n/locales/pl/world.json";
import { buildTypeLookup, canonicalTypeKey } from "./typeNormalization";

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

const lookup = buildTypeLookup(WORLD_ELEMENT_TYPES, [
  plWorld.world.elementType as Record<string, string>,
  enWorld.world.elementType as Record<string, string>
]);

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
  return lookup.get(canonicalTypeKey(value)) ?? FALLBACK_TYPE;
}
