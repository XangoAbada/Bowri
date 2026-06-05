import { describe, expect, it } from "vitest";
import { extractJsonCandidate, parseTitleSuggestions } from "./titleSuggestions";

const validPayload = {
  version: 1,
  kind: "title_suggestions",
  summary: "Dwie propozycje",
  items: [
    {
      title: "Miasto z popiołu",
      subtitle: null,
      rationale: "Pasuje do mrocznego tonu",
      tone: "mroczny",
      risk: "Może brzmieć klasycznie"
    },
    {
      title: "Ostatni atrament",
      rationale: "Łączy pisanie i stawkę historii"
    }
  ],
  warnings: []
};

describe("parseTitleSuggestions", () => {
  it("parses clean JSON", () => {
    const parsed = parseTitleSuggestions(JSON.stringify(validPayload));

    expect(parsed.items).toHaveLength(2);
    expect(parsed.items[0].title).toBe("Miasto z popiołu");
  });

  it("extracts JSON from a fenced code block", () => {
    const parsed = parseTitleSuggestions(
      `Oto wynik:\n\n\`\`\`json\n${JSON.stringify(validPayload)}\n\`\`\``
    );

    expect(parsed.kind).toBe("title_suggestions");
  });

  it("extracts a balanced JSON object from surrounding text", () => {
    const candidate = extractJsonCandidate(
      `Komentarz przed ${JSON.stringify(validPayload)} komentarz po`
    );

    expect(candidate).toBe(JSON.stringify(validPayload));
  });

  it("rejects invalid contracts", () => {
    expect(() =>
      parseTitleSuggestions(
        JSON.stringify({ version: 1, kind: "wrong_kind", items: [] })
      )
    ).toThrow();
  });
});
