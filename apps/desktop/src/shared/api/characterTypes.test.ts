import { describe, expect, it } from "vitest";
import {
  CHARACTER_TYPES,
  CHARACTER_TYPE_ENUM,
  isCharacterType,
  normalizeCharacterType
} from "./characterTypes";

describe("normalizeCharacterType", () => {
  it("przepuszcza poprawne slugi bez zmian", () => {
    for (const type of CHARACTER_TYPES) {
      expect(normalizeCharacterType(type)).toBe(type);
    }
  });

  it("rozpoznaje polskie etykiety rodzaju", () => {
    expect(normalizeCharacterType("Człowiek")).toBe("person");
    expect(normalizeCharacterType("Zwierzę")).toBe("animal");
    expect(normalizeCharacterType("Ożywiony przedmiot")).toBe("object");
    expect(normalizeCharacterType("Duch / byt")).toBe("spirit");
  });

  it("rozpoznaje angielskie etykiety rodzaju", () => {
    expect(normalizeCharacterType("Human")).toBe("person");
    expect(normalizeCharacterType("Animal")).toBe("animal");
    expect(normalizeCharacterType("Animated object")).toBe("object");
    expect(normalizeCharacterType("Spirit / being")).toBe("spirit");
  });

  it("rozpoznaje potoczne aliasy", () => {
    expect(normalizeCharacterType("duch")).toBe("spirit");
    expect(normalizeCharacterType("stwór")).toBe("creature");
    expect(normalizeCharacterType("bestia")).toBe("creature");
    expect(normalizeCharacterType("przedmiot")).toBe("object");
  });

  it("toleruje warianty zapisu", () => {
    expect(normalizeCharacterType(" ANIMAL ")).toBe("animal");
    expect(normalizeCharacterType("animated-object")).toBe("object");
    expect(normalizeCharacterType("zwierze")).toBe("animal");
  });

  it("nierozpoznane wartości mapuje na other", () => {
    expect(normalizeCharacterType("elf")).toBe("other");
    expect(normalizeCharacterType("")).toBe("other");
    expect(normalizeCharacterType(undefined)).toBe("other");
    expect(normalizeCharacterType(null)).toBe("other");
    expect(normalizeCharacterType(7)).toBe("other");
  });
});

describe("isCharacterType", () => {
  it("odróżnia dozwolone rodzaje od surowych wartości", () => {
    expect(isCharacterType("spirit")).toBe(true);
    expect(isCharacterType("Duch / byt")).toBe(false);
    expect(isCharacterType(undefined)).toBe(false);
  });
});

describe("CHARACTER_TYPE_ENUM", () => {
  it("wylicza wszystkie dozwolone rodzaje dla promptu", () => {
    for (const type of CHARACTER_TYPES) {
      expect(CHARACTER_TYPE_ENUM).toContain(type);
    }
    expect(CHARACTER_TYPE_ENUM).toContain(" | ");
  });
});
