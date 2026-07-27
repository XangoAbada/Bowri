import { describe, expect, it } from "vitest";
import type { Book, Project } from "../../shared/api/types";
import {
  AUDIT_DIMENSIONS,
  AUDIT_PASS_COUNT,
  auditActionFor,
  auditPassTargetId,
  buildConsistencyAuditPromptPackage,
  parseConsistencyAuditResult,
  renderConsistencyAuditPromptPackage,
  type AuditDimension,
  type ConsistencyFinding
} from "./consistencyAuditPromptPackage";
import type { StoryBibleDossier } from "./storyBibleDossier";

const project = { id: "project-1", name: "Zatoka", language: "pl" } as Project;
const book = { id: "book-1", projectId: "project-1" } as Book;

const DOSSIER_BODY = `# Dossier projektu: Zatoka
### Postać: Kaja  [character:character-1]
- Sekret: ${"S".repeat(2500)}`;

const dossier = {
  text: DOSSIER_BODY,
  hash: "deadbeef",
  counts: {} as StoryBibleDossier["counts"],
  knownIds: {} as StoryBibleDossier["knownIds"],
  estimatedTokens: 700
} as StoryBibleDossier;

function packageFor(dimension: AuditDimension, priorFindings?: ConsistencyFinding[]) {
  return buildConsistencyAuditPromptPackage({
    project,
    book,
    auditId: "audit-1",
    dimension,
    dossier,
    priorFindings
  });
}

describe("buildConsistencyAuditPromptPackage", () => {
  it("ma pięć przebiegów wymiarowych plus syntezę", () => {
    expect(AUDIT_DIMENSIONS).toHaveLength(5);
    expect(AUDIT_PASS_COUNT).toBe(6);
    expect(AUDIT_DIMENSIONS).not.toContain("synthesis");
  });

  it("rozdziela akcje: wymiary analizują, synteza scala", () => {
    for (const dimension of AUDIT_DIMENSIONS) {
      expect(auditActionFor(dimension)).toBe("analyze_consistency");
    }
    expect(auditActionFor("synthesis")).toBe("synthesize_consistency_audit");
  });

  it("nadaje każdemu przebiegowi osobny cel, żeby dedup kolejki ich nie zlał", () => {
    const targets = new Set(
      [...AUDIT_DIMENSIONS, "synthesis" as AuditDimension].map((dimension) =>
        auditPassTargetId("audit-1", dimension)
      )
    );

    expect(targets.size).toBe(6);
    expect(packageFor("world").context.targetEntityId).toBe("audit-1:world");
  });

  it("przenosi auditId i hash dossier do kontekstu pakietu", () => {
    const promptPackage = packageFor("characters");

    expect(promptPackage.context.auditId).toBe("audit-1");
    expect(promptPackage.context.dossierHash).toBe("deadbeef");
    expect(promptPackage.context.dimension).toBe("characters");
  });

  it("dokłada priorFindings tylko do syntezy", () => {
    expect(packageFor("concept").context.priorFindings).toBeUndefined();
    expect(packageFor("synthesis", []).context.priorFindings).toEqual([]);
  });
});

describe("renderConsistencyAuditPromptPackage", () => {
  it("wkłada całe dossier do promptu, bez skracania", () => {
    const prompt = renderConsistencyAuditPromptPackage(packageFor("characters"));

    expect(prompt).toContain(DOSSIER_BODY);
    expect(prompt).toContain("S".repeat(2500));
  });

  it("zmienia zadanie razem z wymiarem, ale dossier zostaje ten sam", () => {
    const concept = renderConsistencyAuditPromptPackage(packageFor("concept"));
    const world = renderConsistencyAuditPromptPackage(packageFor("world"));

    expect(concept).toContain("Wymiar tego przebiegu: Koncepcja.");
    expect(world).toContain("Wymiar tego przebiegu: Świat i reguły.");
    expect(concept).toContain(DOSSIER_BODY);
    expect(world).toContain(DOSSIER_BODY);
  });

  it("mówi modelowi, że dossier jest kompletny i że puste pole to luka", () => {
    const prompt = renderConsistencyAuditPromptPackage(packageFor("concept"));

    expect(prompt).toContain("Dossier poniżej jest KOMPLETNY");
    expect(prompt).toContain('jest faktycznie puste w projekcie');
    expect(prompt).not.toContain("maksymalnie 10");
  });

  it("podaje whitelistę pól patcha wraz z koncepcją", () => {
    const prompt = renderConsistencyAuditPromptPackage(packageFor("crossCutting"));

    expect(prompt).toContain("concept: premise");
    expect(prompt).toContain("character: role");
    expect(prompt).toContain("worldRule: description");
    expect(prompt).not.toContain("concept: title");
  });

  it("dokłada sekcję Prior Findings tylko w syntezie", () => {
    const withPrior = renderConsistencyAuditPromptPackage(
      packageFor("synthesis", [
        {
          dimension: "concept",
          kind: "gap",
          severity: "blocker",
          title: "Brak stawek",
          description: "Pole stawek jest puste.",
          evidence: [],
          patches: []
        }
      ])
    );

    expect(withPrior).toContain("# Prior Findings");
    expect(withPrior).toContain("Brak stawek");
    expect(renderConsistencyAuditPromptPackage(packageFor("threads"))).not.toContain(
      "# Prior Findings"
    );
  });
});

describe("parseConsistencyAuditResult", () => {
  function result(findings: unknown[], overrides: Record<string, unknown> = {}) {
    return parseConsistencyAuditResult(
      JSON.stringify({
        version: 1,
        kind: "consistency_audit",
        dimension: "characters",
        summary: "Obsada trzyma się kupy, ale dwie postacie mówią identycznie.",
        findings,
        warnings: ["mało danych"],
        ...overrides
      })
    );
  }

  it("parsuje pełną uwagę z poprawkami dla kilku encji", () => {
    const parsed = result([
      {
        kind: "contradiction",
        severity: "blocker",
        title: "Sprzeczne tło Kai",
        description: "Pochodzenie przeczy rodzinie.",
        evidence: [
          { kind: "character", id: "character-1", label: "Kaja", field: "origin" },
          { kind: "character", id: "character-1", label: "Kaja", field: "family" }
        ],
        patches: [
          {
            targetKind: "character",
            targetId: "character-1",
            targetLabel: "Kaja",
            field: "background",
            mode: "replace",
            currentValueExcerpt: "Wychowała się",
            proposedValue: "Wychowała się w osadzie u ciotki, rodziców nie znała.",
            rationale: "Usuwa kolizję pochodzenia z rodziną."
          },
          {
            targetKind: "character",
            targetId: "character-2",
            targetLabel: "Oren",
            field: "background",
            mode: "replace",
            currentValueExcerpt: "Brat Kai",
            proposedValue: "Kuzyn Kai z osady, poznali się po jej ucieczce.",
            rationale: "Domyka tę samą sprzeczność po drugiej stronie."
          },
          {
            targetKind: "character",
            targetId: "character-1",
            targetLabel: "Kaja",
            field: "background",
            mode: "append",
            proposedValue: "Duplikat tego samego pola — powinien wypaść."
          }
        ]
      }
    ]);

    expect(parsed.kind).toBe("consistency_audit");
    expect(parsed.dimension).toBe("characters");
    expect(parsed.warnings).toEqual(["mało danych"]);
    expect(parsed.findings).toHaveLength(1);
    expect(parsed.findings[0]).toMatchObject({
      dimension: "characters",
      kind: "contradiction",
      severity: "blocker",
      title: "Sprzeczne tło Kai"
    });
    expect(parsed.findings[0]?.evidence).toHaveLength(2);
    // Trzecia poprawka celuje w to samo pole co pierwsza — dedup zostawia pierwszą.
    expect(parsed.findings[0]?.patches).toHaveLength(2);
    expect(parsed.findings[0]?.patches[0]?.field).toBe("background");
    expect(parsed.findings[0]?.patches[1]?.targetId).toBe("character-2");
  });

  it("nadaje uwadze wymiar przebiegu, gdy model go nie powtórzył", () => {
    const parsed = result([
      { title: "Coś", description: "Opis", evidence: [], patches: [] }
    ]);

    expect(parsed.findings[0]?.dimension).toBe("characters");
  });

  it("degraduje nieznany rodzaj i wagę do wartości bezpiecznych", () => {
    const parsed = result([
      { kind: "cosmic", severity: "apocalyptic", title: "X", description: "Y" }
    ]);

    expect(parsed.findings[0]?.kind).toBe("weakness");
    expect(parsed.findings[0]?.severity).toBe("major");
  });

  it("wyrzuca uwagi bez tytułu i opisu", () => {
    const parsed = result([
      { title: "", description: "" },
      { title: "Realna", description: "Realny opis" }
    ]);

    expect(parsed.findings).toHaveLength(1);
  });

  it("odczytuje starą odpowiedź z pojedynczym patchem jako listę poprawek", () => {
    const parsed = result([
      {
        title: "Sprzeczne tło Kai",
        description: "Pochodzenie przeczy rodzinie.",
        patch: {
          targetKind: "character",
          targetId: "character-1",
          targetLabel: "Kaja",
          field: "background",
          mode: "replace",
          proposedValue: "Wychowała się u ciotki."
        }
      }
    ]);

    expect(parsed.findings[0]?.patches).toHaveLength(1);
    expect(parsed.findings[0]?.patches[0]?.field).toBe("background");
  });

  it("odrzuca poprawkę bez gotowej treści, zostawiając samą uwagę", () => {
    const parsed = result([
      {
        title: "Luka",
        description: "Brak treści",
        patches: [
          {
            targetKind: "character",
            targetId: "character-1",
            field: "background",
            mode: "replace",
            proposedValue: "   "
          }
        ]
      }
    ]);

    expect(parsed.findings).toHaveLength(1);
    expect(parsed.findings[0]?.patches).toEqual([]);
  });

  it("odrzuca poprawkę wskazującą pole spoza whitelisty", () => {
    const parsed = result([
      {
        title: "Rozdział bez celu",
        description: "Rozdział 3 nie ma celu.",
        patches: [
          {
            targetKind: "chapter",
            targetId: "chapter-3",
            field: "purpose",
            mode: "replace",
            proposedValue: "Kaja odkrywa list."
          }
        ]
      }
    ]);

    expect(parsed.findings[0]?.patches).toEqual([]);
  });

  it("odrzuca poprawkę na dozwolonej encji, ale zabronionym polu", () => {
    const parsed = result([
      {
        title: "Zły tytuł",
        description: "Tytuł nie pasuje.",
        patches: [
          {
            targetKind: "concept",
            targetId: "book-1",
            field: "title",
            mode: "replace",
            proposedValue: "Nowy tytuł"
          }
        ]
      }
    ]);

    expect(parsed.findings[0]?.patches).toEqual([]);
  });

  it("odrzuca dowody bez identyfikatora albo o nieznanym rodzaju", () => {
    const parsed = result([
      {
        title: "X",
        description: "Y",
        evidence: [
          { kind: "character", id: "character-1", label: "Kaja" },
          { kind: "character", id: "", label: "Bez id" },
          { kind: "wymyslony", id: "abc", label: "Nieznany rodzaj" }
        ]
      }
    ]);

    expect(parsed.findings[0]?.evidence).toHaveLength(1);
    expect(parsed.findings[0]?.evidence[0]?.id).toBe("character-1");
  });

  it("odrzuca odpowiedź o nieprawidłowym typie", () => {
    expect(() =>
      parseConsistencyAuditResult(JSON.stringify({ kind: "scene_critique", findings: [] }))
    ).toThrow(/nieprawidłowy typ audytu spójności/);
  });

  it("czyta JSON z bloku ```json", () => {
    const parsed = parseConsistencyAuditResult(
      "Oto wynik:\n```json\n" +
        JSON.stringify({
          kind: "consistency_audit",
          dimension: "world",
          summary: "OK",
          findings: []
        }) +
        "\n```"
    );

    expect(parsed.dimension).toBe("world");
    expect(parsed.findings).toEqual([]);
  });
});
