import enCharacters from "../i18n/locales/en/characters.json";
import plCharacters from "../i18n/locales/pl/characters.json";
import { buildTypeLookup, canonicalTypeKey } from "./typeNormalization";

/**
 * Dozwolone rodzaje postaci. Kolejność steruje listą w selektorze rodzaju
 * i w filtrze listy postaci (CharactersPage).
 */
export const CHARACTER_TYPES = ["person", "animal", "creature", "object", "spirit", "other"] as const;

export type CharacterTypeValue = (typeof CHARACTER_TYPES)[number];

export const CHARACTER_TYPE_ENUM = CHARACTER_TYPES.join(" | ");

const FALLBACK_TYPE: CharacterTypeValue = "other";

// Etykiety PL są wieloczłonowe ("Ożywiony przedmiot", "Duch / byt"), więc model
// rzadko zwraca je dosłownie — potoczne warianty dokładamy jako aliasy.
const ALIASES: Partial<Record<CharacterTypeValue, readonly string[]>> = {
  person: ["człowiek", "ludzka", "ludzki", "human"],
  animal: ["zwierzę", "zwierze"],
  creature: ["stwór", "bestia", "potwór", "monster", "beast"],
  object: ["przedmiot", "animated object"],
  spirit: ["duch", "byt", "istota nadprzyrodzona", "spirit / being", "being", "ghost"]
};

const lookup = buildTypeLookup(
  CHARACTER_TYPES,
  [
    plCharacters.characters.type as Record<string, string>,
    enCharacters.characters.type as Record<string, string>
  ],
  ALIASES
);

export function isCharacterType(value: unknown): value is CharacterTypeValue {
  return typeof value === "string" && (CHARACTER_TYPES as readonly string[]).includes(value);
}

/**
 * Mapuje surowe wyjście AI na dozwolony rodzaj postaci.
 * Nierozpoznana wartość trafia do "other" — inaczej postać wypadałaby
 * z selektora rodzaju i z filtra listy.
 */
export function normalizeCharacterType(value: unknown): CharacterTypeValue {
  if (typeof value !== "string") {
    return FALLBACK_TYPE;
  }
  return lookup.get(canonicalTypeKey(value)) ?? FALLBACK_TYPE;
}
