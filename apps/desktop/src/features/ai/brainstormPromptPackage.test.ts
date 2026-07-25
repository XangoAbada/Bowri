import { describe, expect, it } from "vitest";
import {
  mergeBrainstormSuggestions,
  parseBrainstormChatResult,
  renderBrainstormChatPromptPackage,
  suggestionKey,
  type BrainstormChatPromptPackage,
  type ParsedBrainstormSuggestion,
  type SessionSuggestion
} from "./brainstormPromptPackage";

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
      op: "create",
      mode: "create"
    });
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
      omittedMessageCount: 0,
      userMessage: "Nie mam pomysłu.",
      existingNames: [],
      activeSuggestions: [],
      entityIndex: { character: [], worldElement: [], worldRule: [], plotThread: [] }
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

describe("mergeBrainstormSuggestions", () => {
  const incoming = (
    overrides: Partial<ParsedBrainstormSuggestion>
  ): ParsedBrainstormSuggestion => ({
    op: "create",
    suggestionKey: "",
    kind: "character",
    mode: "create",
    title: "Latarnik Aurelian",
    value: "Opis",
    reason: "Powód",
    ...overrides
  });

  const active = (overrides: Partial<SessionSuggestion>): SessionSuggestion => ({
    id: "s1",
    key: suggestionKey("character", undefined, "Latarnik Aurelian"),
    revision: 1,
    mode: "create",
    kind: "character",
    title: "Latarnik Aurelian",
    value: "Opis",
    reason: "Powód",
    status: "pending",
    messageId: "m1",
    messageCreatedAt: "2026-07-01T10:00:00Z",
    ...overrides
  });

  it("drops titles matching blocked names case-insensitively", () => {
    const result = mergeBrainstormSuggestions(
      [incoming({}), incoming({ title: "Nowa Postać" })],
      { active: [], blockedTitles: ["latarnik aurelian"] }
    );
    expect(result.created.map((item) => item.title)).toEqual(["Nowa Postać"]);
    expect(result.skipped).toEqual([{ title: "Latarnik Aurelian", reason: "blocked" }]);
  });

  it("keeps only one suggestion per concept field", () => {
    const result = mergeBrainstormSuggestions(
      [
        incoming({ kind: "conceptField", conceptField: "premise", title: "Wersja A" }),
        incoming({ kind: "conceptField", conceptField: "premise", title: "Wersja B" }),
        incoming({ kind: "conceptField", conceptField: "stakes", title: "Stawki" })
      ],
      { active: [], blockedTitles: [] }
    );
    expect(result.created.map((item) => item.title)).toEqual(["Wersja B", "Stawki"]);
  });

  it("revises an active suggestion instead of dropping the repeat", () => {
    const existing = active({});
    const result = mergeBrainstormSuggestions(
      [
        incoming({
          op: "revise",
          suggestionKey: existing.key,
          value: "Opis wzbogacony o sekret z rozmowy."
        })
      ],
      { active: [existing], blockedTitles: [] }
    );

    expect(result.created).toHaveLength(0);
    expect(result.revisions).toHaveLength(1);
    expect(result.revisions[0].messageId).toBe("m1");
    expect(result.revisions[0].suggestion).toMatchObject({
      id: "s1",
      key: existing.key,
      revision: 2,
      status: "pending",
      value: "Opis wzbogacony o sekret z rozmowy."
    });
  });

  it("treats a repeated title as a revision even without op=revise", () => {
    const result = mergeBrainstormSuggestions([incoming({ value: "Nowy szczegół." })], {
      active: [active({})],
      blockedTitles: []
    });
    expect(result.revisions).toHaveLength(1);
    expect(result.created).toHaveLength(0);
  });

  it("degrades an unknown revision key to a new suggestion", () => {
    const result = mergeBrainstormSuggestions(
      [incoming({ op: "revise", suggestionKey: "character:nie-istnieje", title: "Zupełnie nowa" })],
      { active: [active({})], blockedTitles: [] }
    );
    expect(result.created.map((item) => item.title)).toEqual(["Zupełnie nowa"]);
    expect(result.revisions).toHaveLength(0);
  });

  it("stops revising after the cap", () => {
    const result = mergeBrainstormSuggestions([incoming({ value: "Kolejna wersja." })], {
      active: [active({ revision: 10 })],
      blockedTitles: []
    });
    expect(result.revisions).toHaveLength(0);
    expect(result.skipped).toEqual([{ title: "Latarnik Aurelian", reason: "revisionCap" }]);
  });
});

describe("suggestionKey", () => {
  it("keeps Polish titles addressable", () => {
    expect(suggestionKey("character", undefined, "Żeglarz Bałtyku")).toBe(
      "character:zeglarz-baltyku"
    );
    expect(suggestionKey("conceptField", "premise", "cokolwiek")).toBe("cf:premise");
  });
});
