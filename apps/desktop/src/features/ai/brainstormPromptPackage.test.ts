import { describe, expect, it } from "vitest";
import {
  dedupeBrainstormSuggestions,
  parseBrainstormChatResult,
  renderBrainstormChatPromptPackage,
  type BrainstormChatPromptPackage
} from "./brainstormPromptPackage";
import type { BrainstormSuggestion } from "../../shared/api/types";

describe("parseBrainstormChatResult", () => {
  it("normalizes reply and suggestions", () => {
    const parsed = parseBrainstormChatResult(
      JSON.stringify({
        version: 1,
        kind: "brainstorm_chat",
        reply: "Mocny punkt wyjścia. Co jeśli latarnik sam wywołał katastrofę?",
        suggestions: [
          {
            kind: "conceptField",
            conceptField: "premise",
            title: "Premise o latarniku",
            value: "Latarnik ukrywa, że zgasił światło w noc katastrofy.",
            reason: "Padło wprost w rozmowie."
          },
          {
            kind: "character",
            title: "Latarnik Aurelian",
            value: "Samotnik z poczuciem winy, strażnik tajemnicy zatoki.",
            reason: "Główny bohater ustalony w rozmowie."
          }
        ],
        stateSummary: "Historia o latarniku i katastrofie sprzed lat."
      })
    );

    expect(parsed.reply).toContain("Co jeśli");
    expect(parsed.suggestions).toHaveLength(2);
    expect(parsed.suggestions[0]).toMatchObject({
      kind: "conceptField",
      conceptField: "premise",
      status: "pending"
    });
    expect(parsed.suggestions[0].id).toBeTruthy();
    expect(parsed.stateSummary).toBe("Historia o latarniku i katastrofie sprzed lat.");
  });

  it("drops suggestions with invalid kind, missing value or bad conceptField", () => {
    const parsed = parseBrainstormChatResult(
      JSON.stringify({
        version: 1,
        kind: "brainstorm_chat",
        reply: "Odpowiedź.",
        suggestions: [
          { kind: "chapter", title: "Rozdział 1", value: "x", reason: "zakazany rodzaj" },
          { kind: "character", title: "Bez treści", value: "", reason: "brak value" },
          {
            kind: "conceptField",
            conceptField: "targetWordCount",
            title: "Objętość",
            value: "120000",
            reason: "pole spoza listy"
          },
          { kind: "plotThread", title: "Wątek winy", value: "Latarnik vs prawda", reason: "ok" }
        ]
      })
    );

    expect(parsed.suggestions).toHaveLength(1);
    expect(parsed.suggestions[0].kind).toBe("plotThread");
  });

  it("throws on wrong kind or empty reply", () => {
    expect(() =>
      parseBrainstormChatResult(JSON.stringify({ kind: "scene_critique", reply: "x" }))
    ).toThrow(/nieprawidłowy typ/);
    expect(() =>
      parseBrainstormChatResult(JSON.stringify({ kind: "brainstorm_chat", reply: "" }))
    ).toThrow(/pustą odpowiedź/);
  });
});

describe("renderBrainstormChatPromptPackage", () => {
  const basePackage = (hasExistingMaterial: boolean): BrainstormChatPromptPackage => ({
    id: "brainstorm_chat:test",
    projectId: "p1",
    bookId: "b1",
    action: "brainstorm_chat",
    locale: "pl",
    userInstruction: "Prowadź burzę mózgów.",
    context: {
      targetField: "__brainstorm_chat__",
      targetEntityId: "s1",
      sessionName: "Sesja",
      stateSummary: "",
      hasExistingMaterial,
      conceptFields: { premise: hasExistingMaterial ? "Latarnik ukrywa prawdę." : "" } as never,
      storyBible: {
        characters: [],
        relations: [],
        worldElements: [],
        worldRules: [],
        plotThreads: []
      },
      conversation: [],
      userMessage: "Nie mam pomysłu.",
      existingNames: []
    },
    outputContract: { kind: "brainstorm_chat", format: "json" },
    generationOptions: { providerId: "codex-cli-bridge" }
  });

  it("anchors on existing material when project has content", () => {
    const prompt = renderBrainstormChatPromptPackage(basePackage(true));
    expect(prompt).toContain("Projekt ma już materiał");
    expect(prompt).toContain("Kierunki rozwoju");
    expect(prompt).not.toContain("Startery od zera");
  });

  it("offers starters from scratch when project is empty", () => {
    const prompt = renderBrainstormChatPromptPackage(basePackage(false));
    expect(prompt).toContain("Projekt jest pusty");
    expect(prompt).toContain("Startery od zera");
    expect(prompt).not.toContain("Kierunki rozwoju");
  });
});

describe("dedupeBrainstormSuggestions", () => {
  const suggestion = (overrides: Partial<BrainstormSuggestion>): BrainstormSuggestion => ({
    id: "s1",
    kind: "character",
    title: "Latarnik Aurelian",
    value: "Opis",
    reason: "Powód",
    status: "pending",
    ...overrides
  });

  it("drops titles matching existing names case-insensitively", () => {
    const result = dedupeBrainstormSuggestions(
      [suggestion({}), suggestion({ id: "s2", title: "Nowa Postać" })],
      ["latarnik aurelian"]
    );
    expect(result.map((item) => item.title)).toEqual(["Nowa Postać"]);
  });

  it("keeps only one suggestion per concept field", () => {
    const result = dedupeBrainstormSuggestions(
      [
        suggestion({ id: "a", kind: "conceptField", conceptField: "premise", title: "Wersja A" }),
        suggestion({ id: "b", kind: "conceptField", conceptField: "premise", title: "Wersja B" }),
        suggestion({ id: "c", kind: "conceptField", conceptField: "stakes", title: "Stawki" })
      ],
      []
    );
    expect(result.map((item) => item.id)).toEqual(["a", "c"]);
  });
});
