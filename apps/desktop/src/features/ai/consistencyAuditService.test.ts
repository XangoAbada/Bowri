import { beforeEach, describe, expect, it, vi } from "vitest";
import { AUDIT_DIMENSIONS, type AuditDimension } from "./consistencyAuditPromptPackage";

vi.mock("../../shared/api/commands", () => ({
  cancelActiveCodexRun: vi.fn(async () => true),
  listActiveCodexRuns: vi.fn(async () => []),
  markAiProposalAccepted: vi.fn(async () => undefined),
  markAiProposalRejected: vi.fn(async () => undefined),
  saveConsistencyAudit: vi.fn(async () => undefined),
  // proposalStore zapisuje snapshot przy każdej zmianie kolejki.
  upsertAiProposalSnapshot: vi.fn(async () => undefined)
}));

const commands = await import("../../shared/api/commands");
const {
  discardConsistencyAuditProposals,
  discardOrphanedConsistencyAuditProposals,
  stopConsistencyAudit
} = await import("./consistencyAuditService");
const { useConsistencyAuditStore } = await import("./consistencyAuditStore");
const { useProposalStore } = await import("./proposalStore");

/**
 * Propozycja przebiegu audytu w kolejce. Kluczowy jest promptPackageJson —
 * to z niego consistencyAuditPassRef odczytuje, do którego audytu należy.
 */
function enqueuePassProposal(auditId: string, dimension: AuditDimension): string {
  const { id } = useProposalStore.getState().enqueueProposal({
    scope: "consistencyAudit",
    projectId: "project-1",
    bookId: "book-1",
    field: "__consistency_audit__",
    action: "analyze_consistency",
    promptPackageId: `pkg-${auditId}-${dimension}`,
    promptPackageJson: {
      context: {
        auditId,
        dimension,
        targetEntityId: `${auditId}:${dimension}`,
        dossierHash: "hash-1"
      }
    } as never,
    prompt: "prompt"
  });
  return id;
}

function proposalIds(): string[] {
  return useProposalStore.getState().proposals.map((proposal) => proposal.id);
}

beforeEach(() => {
  vi.clearAllMocks();
  useProposalStore.setState({ proposals: [] });
  useConsistencyAuditStore.setState({ audits: [] });
});

describe("stopConsistencyAudit", () => {
  function startAudit() {
    return useConsistencyAuditStore.getState().startAudit({
      id: "audit-1",
      projectId: "project-1",
      bookId: "book-1",
      dossierHash: "hash-1",
      dossierText: "# Dossier",
      dimensions: [...AUDIT_DIMENSIONS]
    });
  }

  function audit() {
    return useConsistencyAuditStore.getState().audits[0]!;
  }

  it("ubija biegnący przebieg i zdejmuje z kolejki te, które nie ruszyły", async () => {
    startAudit();
    const runningId = enqueuePassProposal("audit-1", "concept");
    enqueuePassProposal("audit-1", "world");
    useProposalStore.getState().startQueuedProposal(runningId);
    vi.mocked(commands.listActiveCodexRuns).mockResolvedValueOnce([
      {
        aiRunId: "run-9",
        projectId: "project-1",
        action: "analyze_consistency",
        startedAt: "2026-07-27T10:00:00Z",
        phase: "running"
      } as never
    ]);

    await stopConsistencyAudit("audit-1");

    expect(commands.cancelActiveCodexRun).toHaveBeenCalledWith({
      projectId: "project-1",
      aiRunId: "run-9"
    });
    expect(proposalIds()).toEqual([]);
  });

  it("oznacza zatrzymane przebiegi jako błąd, żeby dało się je ponowić", async () => {
    startAudit();
    enqueuePassProposal("audit-1", "concept");
    useConsistencyAuditStore.getState().setPassResult({
      auditId: "audit-1",
      dimension: "world",
      summary: "gotowe",
      findings: []
    });

    await stopConsistencyAudit("audit-1");

    // Wynik, który zdążył się policzyć, zostaje nietknięty.
    expect(audit().passes.world.status).toBe("success");
    // Reszta dostaje błąd, a nie "skipped": skipped znaczy „wymiar spoza
    // zakresu", a te autor zamawiał i może chcieć ponowić.
    expect(audit().passes.concept.status).toBe("error");
    expect(audit().passes.concept.errorMessage).toContain("zatrzymana");
    expect(audit().status).toBe("partial");
  });

  it("nie rusza raportu, którego nie ma w store", async () => {
    await stopConsistencyAudit("audit-nieistniejacy");

    expect(commands.cancelActiveCodexRun).not.toHaveBeenCalled();
    expect(commands.markAiProposalRejected).not.toHaveBeenCalled();
  });
});

describe("discardConsistencyAuditProposals", () => {
  it("usuwa przebiegi skasowanego raportu z kolejki i odrzuca je w bazie", async () => {
    useConsistencyAuditStore.getState().startAudit({
      id: "audit-1",
      projectId: "project-1",
      bookId: "book-1",
      dossierHash: "hash-1",
      dossierText: "# Dossier",
      dimensions: [...AUDIT_DIMENSIONS]
    });
    const removed = enqueuePassProposal("audit-1", "concept");
    const kept = enqueuePassProposal("audit-2", "world");

    await discardConsistencyAuditProposals("audit-1");

    // Bez tego przebieg wracał po restarcie i blokował kolejny audyt: runner
    // jest szeregowy, a kafelki audytu są odfiltrowane z kolejki.
    expect(proposalIds()).toEqual([kept]);
    expect(commands.markAiProposalRejected).toHaveBeenCalledWith(removed);
    expect(commands.markAiProposalRejected).not.toHaveBeenCalledWith(kept);
  });

  it("zatrzymuje proces CLI, gdy kasowany przebieg właśnie biegnie", async () => {
    const id = enqueuePassProposal("audit-1", "concept");
    useProposalStore.getState().startQueuedProposal(id);
    vi.mocked(commands.listActiveCodexRuns).mockResolvedValueOnce([
      {
        aiRunId: "run-7",
        projectId: "project-1",
        action: "analyze_consistency",
        startedAt: "2026-07-27T10:00:00Z",
        phase: "running"
      } as never
    ]);

    await discardConsistencyAuditProposals("audit-1");

    // Samo usunięcie ze store'u nie ubija procesu — ten trzymałby slot kolejki
    // aż do timeoutu, który dla audytu wynosi pół godziny.
    expect(commands.cancelActiveCodexRun).toHaveBeenCalledWith({
      projectId: "project-1",
      aiRunId: "run-7"
    });
    expect(proposalIds()).toEqual([]);
  });
});

describe("discardOrphanedConsistencyAuditProposals", () => {
  it("kasuje przebiegi audytu, którego nie ma w store", async () => {
    useConsistencyAuditStore.getState().startAudit({
      id: "audit-zyjacy",
      projectId: "project-1",
      bookId: "book-1",
      dossierHash: "hash-1",
      dossierText: "# Dossier",
      dimensions: [...AUDIT_DIMENSIONS]
    });
    const alive = enqueuePassProposal("audit-zyjacy", "concept");
    const orphan = enqueuePassProposal("audit-usuniety", "world");

    const removed = await discardOrphanedConsistencyAuditProposals();

    expect(removed).toBe(1);
    expect(proposalIds()).toEqual([alive]);
    expect(commands.markAiProposalRejected).toHaveBeenCalledWith(orphan);
  });

  it("nie rusza propozycji spoza audytu", async () => {
    const { id } = useProposalStore.getState().enqueueProposal({
      scope: "bookConcept",
      projectId: "project-1",
      bookId: "book-1",
      field: "premise",
      action: "generate_premise",
      promptPackageId: "pkg-1",
      promptPackageJson: { context: {} } as never,
      prompt: "prompt"
    });

    const removed = await discardOrphanedConsistencyAuditProposals();

    expect(removed).toBe(0);
    expect(proposalIds()).toEqual([id]);
    expect(commands.markAiProposalRejected).not.toHaveBeenCalled();
  });
});
