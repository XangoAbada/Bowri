import { describe, expect, it } from "vitest";
import {
  isWorldElementType,
  normalizeWorldElementType,
  WORLD_ELEMENT_TYPES,
  WORLD_ELEMENT_TYPE_ENUM
} from "./worldElementTypes";

describe("normalizeWorldElementType", () => {
  it("przepuszcza poprawne slugi bez zmian", () => {
    for (const type of WORLD_ELEMENT_TYPES) {
      expect(normalizeWorldElementType(type)).toBe(type);
    }
  });

  it("rozpoznaje polskie etykiety typu", () => {
    expect(normalizeWorldElementType("Frakcja")).toBe("faction");
    expect(normalizeWorldElementType("Lokacja")).toBe("location");
    expect(normalizeWorldElementType("Wydarzenie historyczne")).toBe("historical_event");
    expect(normalizeWorldElementType("Istota")).toBe("creature");
  });

  it("rozpoznaje angielskie etykiety typu", () => {
    expect(normalizeWorldElementType("Historical event")).toBe("historical_event");
    expect(normalizeWorldElementType("Faction")).toBe("faction");
  });

  it("toleruje warianty zapisu", () => {
    expect(normalizeWorldElementType(" Historical Event ")).toBe("historical_event");
    expect(normalizeWorldElementType("historical-event")).toBe("historical_event");
    expect(normalizeWorldElementType("HISTORICAL_EVENT")).toBe("historical_event");
    expect(normalizeWorldElementType("wydarzenie historyczne")).toBe("historical_event");
  });

  it("nierozpoznane wartości mapuje na other", () => {
    expect(normalizeWorldElementType("miasto")).toBe("other");
    expect(normalizeWorldElementType("")).toBe("other");
    expect(normalizeWorldElementType(undefined)).toBe("other");
    expect(normalizeWorldElementType(null)).toBe("other");
    expect(normalizeWorldElementType(42)).toBe("other");
  });
});

describe("isWorldElementType", () => {
  it("odróżnia dozwolone typy od surowych wartości", () => {
    expect(isWorldElementType("faction")).toBe(true);
    expect(isWorldElementType("Frakcja")).toBe(false);
    expect(isWorldElementType(undefined)).toBe(false);
  });
});

describe("WORLD_ELEMENT_TYPE_ENUM", () => {
  it("wylicza wszystkie dozwolone typy dla promptu", () => {
    for (const type of WORLD_ELEMENT_TYPES) {
      expect(WORLD_ELEMENT_TYPE_ENUM).toContain(type);
    }
    expect(WORLD_ELEMENT_TYPE_ENUM).toContain(" | ");
  });
});
