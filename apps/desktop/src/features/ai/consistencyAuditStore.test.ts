import { beforeEach, describe, expect, it } from "vitest";
import type { ConsistencyAuditRecord } from "../../shared/api/types";
import {
  AUDIT_DIMENSIONS,
  type AuditDimension,
  type ConsistencyFinding
} from "./consistencyAuditPromptPackage";
import {
  countFindingsBySeverity,
  serializeAuditFindings,
  serializeAuditPasses,
  useConsistencyAuditStore,
  type ConsistencyAuditReportFinding
} from "./consistencyAuditStore";

function findingFixture(
  overrides: Partial<ConsistencyAuditReportFinding> = {}
): ConsistencyAuditReportFinding {
  return {
    id: overrides.id ?? "finding-1",
    dimension: "concept",
    kind: "gap",
    severity: "major",
    title: "Brak stawek",
    description: "Pole stawek jest puste.",
    evidence: [],
    patches: [],
    status: "open",
    applicable: false,
    ...overrides
  };
}

function startAudit() {
  return useConsistencyAuditStore.getState().startAudit({
    id: "audit-1",
    projectId: "project-1",
    bookId: "book-1",
    dossierHash: "hash-1",
    dossierText: "# Dossier"
  });
}

function audit() {
  const found = useConsistencyAuditStore.getState().audits.find((item) => item.id === "audit-1");
  if (!found) {
    throw new Error("brak audytu w store");
  }
  return found;
}

function completeAllDimensions() {
  for (const dimension of AUDIT_DIMENSIONS) {
    useConsistencyAuditStore.getState().setPassResult({
      auditId: "audit-1",
      dimension,
      summary: `podsumowanie ${dimension}`,
      findings: [findingFixture({ id: `finding-${dimension}`, dimension })]
    });
  }
}

beforeEach(() => {
  useConsistencyAuditStore.setState({ audits: [] });
});

describe("useConsistencyAuditStore — status audytu", () => {
  it("startuje jako running z sześcioma przebiegami w kolejce", () => {
    const created = startAudit();

    expect(created.status).toBe("running");
    expect(Object.keys(created.passes)).toHaveLength(6);
    expect(created.passes.synthesis.status).toBe("queued");
  });

  it("zostaje running po komplecie wymiarów, dopóki nie ma syntezy", () => {
    startAudit();
    completeAllDimensions();

    expect(audit().status).toBe("running");
    expect(audit().findings).toHaveLength(5);
  });

  it("kończy się jako complete po syntezie", () => {
    startAudit();
    completeAllDimensions();
    useConsistencyAuditStore.getState().setPassResult({
      auditId: "audit-1",
      dimension: "synthesis",
      summary: "Scalone",
      findings: [findingFixture({ id: "finding-synth", dimension: "synthesis" })]
    });

    expect(audit().status).toBe("complete");
    expect(audit().summary).toBe("Scalone");
    // Synteza zastępuje uwagi przebiegów wymiarowych.
    expect(audit().findings).toHaveLength(1);
    expect(audit().findings[0]?.id).toBe("finding-synth");
  });

  it("nie zostaje w running na zawsze, gdy wymiar padł", () => {
    startAudit();
    for (const dimension of AUDIT_DIMENSIONS.filter((item) => item !== "world")) {
      useConsistencyAuditStore.getState().setPassResult({
        auditId: "audit-1",
        dimension,
        summary: "ok",
        findings: []
      });
    }
    useConsistencyAuditStore
      .getState()
      .setPassStatus("audit-1", "world", "error", { errorMessage: "timeout" });

    expect(audit().status).toBe("partial");
    expect(audit().passes.world.errorMessage).toBe("timeout");
  });
});

describe("useConsistencyAuditStore — uwagi", () => {
  it("podmienia uwagi tylko tego wymiaru, który przyszedł ponownie", () => {
    startAudit();
    completeAllDimensions();
    useConsistencyAuditStore.getState().setPassResult({
      auditId: "audit-1",
      dimension: "world",
      summary: "ponowione",
      findings: [
        findingFixture({ id: "finding-world-nowe", dimension: "world", title: "Reguła bez kosztu" })
      ]
    });

    const worldFindings = audit().findings.filter((finding) => finding.dimension === "world");
    expect(worldFindings).toHaveLength(1);
    expect(worldFindings[0]?.title).toBe("Reguła bez kosztu");
    expect(audit().findings).toHaveLength(5);
  });

  it("zachowuje decyzję autora przy ponowieniu przebiegu", () => {
    startAudit();
    useConsistencyAuditStore.getState().setPassResult({
      auditId: "audit-1",
      dimension: "concept",
      summary: "ok",
      findings: [findingFixture({ id: "stare-id" })]
    });
    useConsistencyAuditStore.getState().setFindingStatus("audit-1", "stare-id", "dismissed");

    // Ponowna generacja nadaje uwagom nowe identyfikatory.
    useConsistencyAuditStore.getState().setPassResult({
      auditId: "audit-1",
      dimension: "concept",
      summary: "ok",
      findings: [findingFixture({ id: "nowe-id" })]
    });

    expect(audit().findings).toHaveLength(1);
    expect(audit().findings[0]?.id).toBe("nowe-id");
    expect(audit().findings[0]?.status).toBe("dismissed");
  });

  it("sortuje uwagi od krytycznych do drobnych", () => {
    startAudit();
    useConsistencyAuditStore.getState().setPassResult({
      auditId: "audit-1",
      dimension: "concept",
      summary: "ok",
      findings: [
        findingFixture({ id: "a", severity: "minor", title: "Drobne" }),
        findingFixture({ id: "b", severity: "blocker", title: "Krytyczne" }),
        findingFixture({ id: "c", severity: "major", title: "Istotne" })
      ]
    });

    expect(audit().findings.map((finding) => finding.severity)).toEqual([
      "blocker",
      "major",
      "minor"
    ]);
  });

  it("liczy uwagi po wagach", () => {
    const counts = countFindingsBySeverity([
      findingFixture({ id: "a", severity: "blocker" }),
      findingFixture({ id: "b", severity: "blocker" }),
      findingFixture({ id: "c", severity: "minor" })
    ]);

    expect(counts).toEqual({ blocker: 2, major: 0, minor: 1 });
  });
});

describe("useConsistencyAuditStore — hydratacja", () => {
  it("odtwarza raport z bazy razem ze statusami uwag", () => {
    const finding = findingFixture({
      id: "finding-x",
      status: "applied",
      applicable: true,
      patches: [
        {
          targetKind: "concept",
          targetId: "book-1",
          targetLabel: "Koncepcja",
          field: "stakes",
          mode: "replace",
          currentValueExcerpt: "",
          proposedValue: "Zatoka pochłonie osadę.",
          rationale: "Uzupełnia lukę.",
          status: "applied",
          applicable: true
        }
      ]
    });
    const source = {
      ...useConsistencyAuditStore.getState().startAudit({
        id: "audit-src",
        projectId: "project-1",
        bookId: "book-1",
        dossierHash: "hash-1",
        dossierText: "# Dossier"
      }),
      findings: [finding]
    };

    const record: ConsistencyAuditRecord = {
      id: "audit-z-bazy",
      projectId: "project-1",
      bookId: "book-1",
      status: "complete",
      dossierHash: "hash-1",
      summary: "Scalone",
      passesJson: serializeAuditPasses(source),
      findingsJson: serializeAuditFindings(source.findings),
      createdAt: "2026-07-01T10:00:00Z",
      updatedAt: "2026-07-01T11:00:00Z"
    };

    useConsistencyAuditStore.setState({ audits: [] });
    useConsistencyAuditStore.getState().hydrate([record]);

    const hydrated = useConsistencyAuditStore.getState().audits[0];
    expect(hydrated?.id).toBe("audit-z-bazy");
    expect(hydrated?.status).toBe("complete");
    expect(hydrated?.findings[0]?.status).toBe("applied");
    expect(hydrated?.findings[0]?.patches[0]?.field).toBe("stakes");
    expect(hydrated?.findings[0]?.patches[0]?.status).toBe("applied");
    // Treść dossier nie idzie do bazy — po hydratacji jej nie ma.
    expect(hydrated?.dossierText).toBeUndefined();
  });

  it("pomija raport z uszkodzonym JSON zamiast pokazywać listę widmo", () => {
    useConsistencyAuditStore.getState().hydrate([
      {
        id: "audit-zepsuty",
        projectId: "project-1",
        bookId: "book-1",
        status: "complete",
        dossierHash: "",
        summary: "",
        passesJson: "{}",
        findingsJson: "{to nie jest json",
        createdAt: "2026-07-01T10:00:00Z",
        updatedAt: "2026-07-01T10:00:00Z"
      }
    ]);

    expect(useConsistencyAuditStore.getState().audits).toHaveLength(0);
  });

  it("nie nadpisuje audytu, który jest już w pamięci", () => {
    startAudit();
    useConsistencyAuditStore.getState().hydrate([
      {
        id: "audit-1",
        projectId: "project-1",
        bookId: "book-1",
        status: "complete",
        dossierHash: "hash-1",
        summary: "z bazy",
        passesJson: "{}",
        findingsJson: "[]",
        createdAt: "2026-07-01T10:00:00Z",
        updatedAt: "2026-07-01T10:00:00Z"
      }
    ]);

    expect(useConsistencyAuditStore.getState().audits).toHaveLength(1);
    expect(audit().summary).toBe("");
    expect(audit().dossierText).toBe("# Dossier");
  });
});

describe("serializeAuditPasses", () => {
  it("zapisuje przebiegi razem z surowymi uwagami wymiarów", () => {
    startAudit();
    const rawFinding: ConsistencyFinding = {
      dimension: "world",
      kind: "gap",
      severity: "major",
      title: "Reguła bez kosztu",
      description: "Brak kosztu.",
      evidence: [],
      patches: []
    };
    useConsistencyAuditStore.getState().setPassResult({
      auditId: "audit-1",
      dimension: "world",
      summary: "ok",
      findings: [{ ...rawFinding, id: "f1", patches: [], status: "open", applicable: false }]
    });

    const parsed = JSON.parse(serializeAuditPasses(audit())) as {
      passes: Record<AuditDimension, { status: string }>;
      rawFindingsByDimension: Record<string, unknown[]>;
    };

    expect(parsed.passes.world.status).toBe("success");
    expect(parsed.rawFindingsByDimension.world).toHaveLength(1);
    // Do promptu syntezy nie idą pola UI (status, applicable).
    expect(parsed.rawFindingsByDimension.world?.[0]).not.toHaveProperty("status");
    expect(parsed.rawFindingsByDimension.world?.[0]).not.toHaveProperty("applicable");
  });
});
