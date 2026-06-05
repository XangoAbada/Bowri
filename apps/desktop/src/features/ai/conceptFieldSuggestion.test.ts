import { describe, expect, it } from "vitest";
import { parseConceptFieldSuggestion } from "./conceptFieldSuggestion";

describe("parseConceptFieldSuggestion", () => {
  it("parses a text value", () => {
    const parsed = parseConceptFieldSuggestion(
      JSON.stringify({
        version: 1,
        kind: "concept_field_suggestion",
        field: "premise",
        summary: "Premisa",
        value: "Archiwistka odkrywa klamstwo miasta.",
        warnings: []
      }),
      "premise"
    );

    expect(parsed.textValue).toBe("Archiwistka odkrywa klamstwo miasta.");
  });

  it("normalizes multiple values", () => {
    const parsed = parseConceptFieldSuggestion(
      JSON.stringify({
        version: 1,
        kind: "concept_field_suggestion",
        field: "tone",
        values: ["mroczny", "liryczny"],
        warnings: ["Sprawdź, czy ton nie będzie zbyt ciężki."]
      }),
      "tone"
    );

    expect(parsed.textValue).toBe("mroczny, liryczny");
    expect(parsed.warnings).toHaveLength(1);
  });

  it("rejects invalid JSON", () => {
    expect(() => parseConceptFieldSuggestion("{ bad }", "genre")).toThrow(
      /Niepoprawny JSON/
    );
  });

  it("rejects a different field", () => {
    expect(() =>
      parseConceptFieldSuggestion(
        JSON.stringify({
          version: 1,
          kind: "concept_field_suggestion",
          field: "tone",
          value: "ciepły"
        }),
        "genre"
      )
    ).toThrow(/oczekiwano genre/);
  });
});
