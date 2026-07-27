import { create } from "zustand";
import type { ConsistencyAuditRecord } from "../../shared/api/types";
import {
  AUDIT_DIMENSIONS,
  CONSISTENCY_SEVERITY_ORDER,
  upgradeStoredFinding,
  type AuditDimension,
  type ConsistencyFinding,
  type ConsistencyFindingSeverity,
  type ConsistencyPatch
} from "./consistencyAuditPromptPackage";

// Stan audytów spójności. Wzorzec sceneCritiqueStore: zustand + hydratacja
// z bazy + status per uwaga. Różnica: audyt składa się z sześciu przebiegów,
// więc store musi wiedzieć, na którym etapie jest, i przetrwać restart
// aplikacji w połowie analizy.

export type ConsistencyAuditPassStatus = "queued" | "running" | "success" | "error";

export type ConsistencyFindingStatus = "open" | "applied" | "dismissed" | "stale";

export type ConsistencyPatchStatus = "open" | "applied" | "stale";

/**
 * Status trzymamy per poprawka, nie per uwaga. Przy mode "append" częściowe
 * zastosowanie jest nieodróżnialne od zerowego (currentValueExcerpt sprawdza
 * tylko prefiks), więc przycisk przy już zapisanej poprawce dopisałby tekst
 * po raz drugi.
 */
export type ConsistencyReportPatch = ConsistencyPatch & {
  status: ConsistencyPatchStatus;
  /** false = cel poprawki nie istnieje w projekcie; powód w blockedReason. */
  applicable: boolean;
  blockedReason?: string;
};

export type ConsistencyAuditReportFinding = Omit<ConsistencyFinding, "patches"> & {
  id: string;
  patches: ConsistencyReportPatch[];
  /** "dismissed" ustawia autor; pozostałe statusy wynikają ze stanu poprawek. */
  status: ConsistencyFindingStatus;
  /** Agregat: czy jakakolwiek poprawka uwagi da się zapisać. */
  applicable: boolean;
  applyBlockedReason?: string;
};

export type ConsistencyAuditPass = {
  status: ConsistencyAuditPassStatus;
  aiRunId?: string;
  /** Propozycja z kolejki, która ten przebieg wykonała — do rozliczenia raportu. */
  proposalId?: string;
  summary: string;
  errorMessage?: string;
  findingCount: number;
};

export type ConsistencyAuditStatus = "running" | "complete" | "partial";

export type ConsistencyAudit = {
  id: string;
  projectId: string;
  bookId: string;
  status: ConsistencyAuditStatus;
  dossierHash: string;
  /**
   * Treść dossier trzymana tylko w pamięci sesji. Do bazy nie idzie — prompty
   * każdego przebiegu i tak są zapisane w ai_runs, a raport potrzebuje jedynie
   * hasha, żeby wykryć, że projekt zmienił się po analizie.
   */
  dossierText?: string;
  passes: Record<AuditDimension, ConsistencyAuditPass>;
  /** Uwagi pokazywane autorowi: po syntezie jej wynik, wcześniej suma przebiegów. */
  findings: ConsistencyAuditReportFinding[];
  /** Surowe uwagi per wymiar — wsad dla przebiegu syntezy. */
  rawFindingsByDimension: Partial<Record<AuditDimension, ConsistencyFinding[]>>;
  summary: string;
  /** true, gdy dossier zbudowane teraz różni się od tego z czasu analizy. */
  outdated: boolean;
  /** Autor przyjął raport — karta znika z panelu AI, raport zostaje na stronie Analiza. */
  acknowledged: boolean;
  createdAt: string;
  updatedAt: string;
};

type ConsistencyAuditState = {
  audits: ConsistencyAudit[];
  startAudit: (input: {
    id: string;
    projectId: string;
    bookId: string;
    dossierHash: string;
    dossierText: string;
  }) => ConsistencyAudit;
  setPassStatus: (
    auditId: string,
    dimension: AuditDimension,
    status: ConsistencyAuditPassStatus,
    detail?: { aiRunId?: string; errorMessage?: string }
  ) => void;
  setPassResult: (input: {
    auditId: string;
    dimension: AuditDimension;
    summary: string;
    findings: ConsistencyAuditReportFinding[];
    aiRunId?: string;
  }) => void;
  setFindingStatus: (
    auditId: string,
    findingId: string,
    status: ConsistencyFindingStatus
  ) => void;
  setPatchStatus: (input: {
    auditId: string;
    findingId: string;
    patchIndex: number;
    status: ConsistencyPatchStatus;
    applicable?: boolean;
    blockedReason?: string;
  }) => void;
  setPassProposalId: (
    auditId: string,
    dimension: AuditDimension,
    proposalId: string
  ) => void;
  setAcknowledged: (auditId: string, acknowledged: boolean) => void;
  markOutdated: (auditId: string, outdated: boolean) => void;
  hydrate: (records: ConsistencyAuditRecord[]) => void;
  removeAudit: (auditId: string) => void;
};

function emptyPasses(): Record<AuditDimension, ConsistencyAuditPass> {
  const passes = {} as Record<AuditDimension, ConsistencyAuditPass>;
  for (const dimension of [...AUDIT_DIMENSIONS, "synthesis" as AuditDimension]) {
    passes[dimension] = { status: "queued", summary: "", findingCount: 0 };
  }
  return passes;
}

export const useConsistencyAuditStore = create<ConsistencyAuditState>((set) => ({
  audits: [],
  startAudit: ({ id, projectId, bookId, dossierHash, dossierText }) => {
    const now = new Date().toISOString();
    const audit: ConsistencyAudit = {
      id,
      projectId,
      bookId,
      status: "running",
      dossierHash,
      dossierText,
      passes: emptyPasses(),
      findings: [],
      rawFindingsByDimension: {},
      summary: "",
      outdated: false,
      acknowledged: false,
      createdAt: now,
      updatedAt: now
    };
    set((state) => ({
      audits: [audit, ...state.audits.filter((item) => item.id !== id)]
    }));
    return audit;
  },
  setPassStatus: (auditId, dimension, status, detail) =>
    set((state) => ({
      audits: state.audits.map((audit) =>
        audit.id === auditId
          ? withStatus({
              ...audit,
              updatedAt: new Date().toISOString(),
              passes: {
                ...audit.passes,
                [dimension]: {
                  ...audit.passes[dimension],
                  status,
                  ...(detail?.aiRunId ? { aiRunId: detail.aiRunId } : {}),
                  ...(detail?.errorMessage === undefined
                    ? {}
                    : { errorMessage: detail.errorMessage })
                }
              }
            })
          : audit
      )
    })),
  setPassResult: ({ auditId, dimension, summary, findings, aiRunId }) =>
    set((state) => ({
      audits: state.audits.map((audit) => {
        if (audit.id !== auditId) {
          return audit;
        }

        const passes: Record<AuditDimension, ConsistencyAuditPass> = {
          ...audit.passes,
          [dimension]: {
            status: "success",
            summary,
            findingCount: findings.length,
            ...(aiRunId ? { aiRunId } : {})
          }
        };
        const rawFindingsByDimension = {
          ...audit.rawFindingsByDimension,
          [dimension]: findings.map(stripReportFields)
        };

        // Synteza zastępuje uwagi przebiegów wymiarowych — to jej zadanie.
        // Do tego czasu pokazujemy sumę tego, co już przyszło, żeby autor nie
        // czekał bezczynnie na koniec sześciu przebiegów. W obu wypadkach
        // decyzje autora (zastosowane, odrzucone) przechodzą na nową listę.
        const visible =
          dimension === "synthesis"
            ? applyPreviousDecisions(audit.findings, findings)
            : [
                ...audit.findings.filter((finding) => finding.dimension !== dimension),
                ...applyPreviousDecisions(
                  audit.findings.filter((finding) => finding.dimension === dimension),
                  findings
                )
              ];

        return withStatus({
          ...audit,
          passes,
          rawFindingsByDimension,
          findings: sortFindings(visible),
          summary: dimension === "synthesis" ? summary : audit.summary,
          updatedAt: new Date().toISOString()
        });
      })
    })),
  setFindingStatus: (auditId, findingId, status) =>
    set((state) => ({
      audits: state.audits.map((audit) =>
        audit.id === auditId
          ? {
              ...audit,
              findings: audit.findings.map((finding) => {
                if (finding.id !== findingId) {
                  return finding;
                }
                // Przywrócenie odrzuconej uwagi nie może cofnąć zapisanych już
                // poprawek — właściwy status wynika wtedy ze stanu poprawek.
                return {
                  ...finding,
                  status:
                    status === "open"
                      ? deriveFindingStatus("open", finding.patches)
                      : status
                };
              }),
              updatedAt: new Date().toISOString()
            }
          : audit
      )
    })),
  setPatchStatus: ({ auditId, findingId, patchIndex, status, applicable, blockedReason }) =>
    set((state) => ({
      audits: state.audits.map((audit) => {
        if (audit.id !== auditId) {
          return audit;
        }

        return {
          ...audit,
          findings: audit.findings.map((finding) => {
            if (finding.id !== findingId || !finding.patches[patchIndex]) {
              return finding;
            }

            const patches = finding.patches.map((patch, index) =>
              index === patchIndex
                ? {
                    ...patch,
                    status,
                    ...(applicable === undefined ? {} : { applicable }),
                    ...(blockedReason === undefined ? {} : { blockedReason })
                  }
                : patch
            );

            return {
              ...finding,
              patches,
              applicable: patches.some((patch) => patch.applicable),
              status: deriveFindingStatus(finding.status, patches)
            };
          }),
          updatedAt: new Date().toISOString()
        };
      })
    })),
  setPassProposalId: (auditId, dimension, proposalId) =>
    set((state) => ({
      audits: state.audits.map((audit) =>
        audit.id === auditId
          ? {
              ...audit,
              passes: {
                ...audit.passes,
                [dimension]: { ...audit.passes[dimension], proposalId }
              }
            }
          : audit
      )
    })),
  setAcknowledged: (auditId, acknowledged) =>
    set((state) => ({
      audits: state.audits.map((audit) =>
        audit.id === auditId
          ? { ...audit, acknowledged, updatedAt: new Date().toISOString() }
          : audit
      )
    })),
  markOutdated: (auditId, outdated) =>
    set((state) => ({
      audits: state.audits.map((audit) =>
        audit.id === auditId ? { ...audit, outdated } : audit
      )
    })),
  hydrate: (records) =>
    set((state) => {
      const existing = new Set(state.audits.map((audit) => audit.id));
      const hydrated = records
        .filter((record) => !existing.has(record.id))
        .map(auditFromRecord)
        .filter((audit): audit is ConsistencyAudit => Boolean(audit));
      if (!hydrated.length) {
        return state;
      }
      return {
        audits: [...state.audits, ...hydrated].sort((a, b) =>
          b.updatedAt.localeCompare(a.updatedAt)
        )
      };
    }),
  removeAudit: (auditId) =>
    set((state) => ({ audits: state.audits.filter((audit) => audit.id !== auditId) }))
}));

// ---------------------------------------------------------------------------
// Serializacja do bazy i z powrotem
// ---------------------------------------------------------------------------

export function serializeAuditFindings(findings: ConsistencyAuditReportFinding[]): string {
  return JSON.stringify(findings);
}

export function serializeAuditPasses(audit: ConsistencyAudit): string {
  return JSON.stringify({
    passes: audit.passes,
    rawFindingsByDimension: audit.rawFindingsByDimension,
    acknowledged: audit.acknowledged
  });
}

function auditFromRecord(record: ConsistencyAuditRecord): ConsistencyAudit | null {
  let findings: ConsistencyAuditReportFinding[] = [];
  let passes = emptyPasses();
  let rawFindingsByDimension: Partial<Record<AuditDimension, ConsistencyFinding[]>> = {};
  let acknowledged = false;

  try {
    const parsedFindings: unknown = JSON.parse(record.findingsJson || "[]");
    if (Array.isArray(parsedFindings)) {
      findings = parsedFindings
        .filter(isRecord)
        .map((item, index) => reportFindingFromRecord(item, `${record.id}:${index}`));
    }

    const parsedPasses: unknown = JSON.parse(record.passesJson || "{}");
    if (isRecord(parsedPasses)) {
      if (isRecord(parsedPasses.passes)) {
        passes = { ...passes, ...(parsedPasses.passes as typeof passes) };
      }
      if (isRecord(parsedPasses.rawFindingsByDimension)) {
        rawFindingsByDimension = upgradeRawFindings(parsedPasses.rawFindingsByDimension);
      }
      acknowledged = parsedPasses.acknowledged === true || acknowledgedByDefault(findings, record);
    }
  } catch {
    // Uszkodzony JSON: raport jest nieodtwarzalny, lepiej go pominąć niż
    // pokazać autorowi listę widmo bez celów poprawek.
    return null;
  }

  return {
    id: record.id,
    projectId: record.projectId,
    bookId: record.bookId,
    status: normalizeAuditStatus(record.status),
    dossierHash: record.dossierHash,
    passes,
    findings: sortFindings(findings),
    rawFindingsByDimension,
    summary: record.summary,
    outdated: false,
    acknowledged,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

function reportFindingFromRecord(
  item: Record<string, unknown>,
  fallbackId: string
): ConsistencyAuditReportFinding {
  const status = normalizeFindingStatus(item.status);
  const patches = reportPatchesFromRecord(item, status);
  return {
    id: typeof item.id === "string" && item.id ? item.id : fallbackId,
    dimension: (item.dimension ?? "crossCutting") as AuditDimension,
    kind: (item.kind ?? "weakness") as ConsistencyAuditReportFinding["kind"],
    severity: normalizeSeverity(item.severity),
    title: typeof item.title === "string" ? item.title : "",
    description: typeof item.description === "string" ? item.description : "",
    evidence: Array.isArray(item.evidence)
      ? (item.evidence as ConsistencyFinding["evidence"])
      : [],
    patches,
    status,
    applicable: patches.length ? patches.some((patch) => patch.applicable) : item.applicable !== false,
    ...(typeof item.applyBlockedReason === "string"
      ? { applyBlockedReason: item.applyBlockedReason }
      : {})
  };
}

/**
 * Raporty sprzed wprowadzenia listy poprawek trzymają pojedyncze `patch` bez
 * własnego statusu. Status bierzemy wtedy ze statusu uwagi — inaczej raport
 * zastosowany dawno temu znów pokazałby przycisk „Zastosuj".
 */
function reportPatchesFromRecord(
  item: Record<string, unknown>,
  findingStatus: ConsistencyFindingStatus
): ConsistencyReportPatch[] {
  const legacyStatus: ConsistencyPatchStatus =
    findingStatus === "applied" ? "applied" : findingStatus === "stale" ? "stale" : "open";

  const source = Array.isArray(item.patches)
    ? item.patches
    : isRecord(item.patch)
      ? [item.patch]
      : [];

  return source.filter(isRecord).map((entry) => ({
    ...(entry as unknown as ConsistencyPatch),
    status: normalizePatchStatus(entry.status, legacyStatus),
    applicable: entry.applicable !== false,
    ...(typeof entry.blockedReason === "string" ? { blockedReason: entry.blockedReason } : {})
  }));
}

/**
 * Raport bez flagi „przyjęty" (zapisany przed jej wprowadzeniem) uznajemy za
 * przyjęty, gdy nie został w nim ani jeden punkt do decyzji — inaczej po
 * aktualizacji panel AI zapełniłby się kartami dawno rozliczonych analiz.
 * Autor wraca do nich przyciskiem „Pokaż w panelu AI" na stronie Analiza.
 */
function acknowledgedByDefault(
  findings: ConsistencyAuditReportFinding[],
  record: ConsistencyAuditRecord
): boolean {
  if (record.status === "running") {
    return false;
  }
  return !findings.some(
    (finding) => finding.status === "open" || finding.status === "stale"
  );
}

function upgradeRawFindings(
  value: Record<string, unknown>
): Partial<Record<AuditDimension, ConsistencyFinding[]>> {
  const upgraded: Partial<Record<AuditDimension, ConsistencyFinding[]>> = {};
  for (const [dimension, findings] of Object.entries(value)) {
    if (!Array.isArray(findings)) {
      continue;
    }
    upgraded[dimension as AuditDimension] = findings
      .map((finding) => upgradeStoredFinding(finding))
      .filter((finding): finding is ConsistencyFinding => Boolean(finding));
  }
  return upgraded;
}

// ---------------------------------------------------------------------------
// Pomocnicze
// ---------------------------------------------------------------------------

/**
 * Status całości pochodzi z przebiegów, nie jest ustawiany ręcznie: complete
 * dopiero po syntezie, partial gdy któryś przebieg padł i nic już nie leci.
 *
 * Synteza startuje wyłącznie po komplecie wymiarów, więc jej "queued" przy
 * padniętym wymiarze nie jest pracą w toku — inaczej audyt zostawałby na
 * zawsze w stanie "running".
 */
function withStatus(audit: ConsistencyAudit): ConsistencyAudit {
  const dimensionStatuses = AUDIT_DIMENSIONS.map(
    (dimension) => audit.passes[dimension].status
  );
  const synthesisStatus = audit.passes.synthesis.status;
  if (
    dimensionStatuses.every((status) => status === "success") &&
    synthesisStatus === "success"
  ) {
    return { ...audit, status: "complete" };
  }

  const dimensionsFailed = dimensionStatuses.some((status) => status === "error");
  const dimensionsWorking = dimensionStatuses.some(
    (status) => status === "queued" || status === "running"
  );
  const synthesisWorking = synthesisStatus === "queued" || synthesisStatus === "running";
  const working = dimensionsWorking || (!dimensionsFailed && synthesisWorking);
  return { ...audit, status: working ? "running" : "partial" };
}

/**
 * Ponowienie przebiegu (i synteza) nie może wymazać decyzji autora o uwagach,
 * które już zdążył zastosować lub odrzucić. Dopasowanie po treści, bo model
 * przy ponownej generacji nadaje uwagom nowe identyfikatory.
 */
function applyPreviousDecisions(
  previous: ConsistencyAuditReportFinding[],
  incoming: ConsistencyAuditReportFinding[]
): ConsistencyAuditReportFinding[] {
  const decided = new Map(
    previous
      .filter((finding) => finding.status !== "open")
      .map((finding) => [findingSignature(finding), finding.status])
  );
  if (!decided.size) {
    return incoming;
  }
  return incoming.map((finding) => {
    const status = decided.get(findingSignature(finding));
    return status ? { ...finding, status } : finding;
  });
}

/**
 * Sygnatura uwagi: stabilna między generacjami i niewrażliwa na kolejność
 * poprawek (model potrafi je przestawić). Dla uwagi bez poprawek i z jedną
 * poprawką daje dokładnie ten sam string co wersja sprzed listy poprawek, więc
 * decyzje zapisane w starych raportach nadal się dopasowują.
 */
export function findingSignature(finding: {
  dimension: AuditDimension;
  kind: ConsistencyFinding["kind"];
  title: string;
  patches: Pick<ConsistencyPatch, "targetId" | "field">[];
}): string {
  const targets = finding.patches.length
    ? [...finding.patches].map((patch) => `${patch.targetId}|${patch.field}`).sort().join(";")
    : "|";
  return [finding.dimension, finding.kind, finding.title.trim().toLowerCase(), targets].join("|");
}

export function sortFindings(
  findings: ConsistencyAuditReportFinding[]
): ConsistencyAuditReportFinding[] {
  return [...findings].sort(
    (a, b) =>
      CONSISTENCY_SEVERITY_ORDER.indexOf(a.severity) -
        CONSISTENCY_SEVERITY_ORDER.indexOf(b.severity) ||
      a.dimension.localeCompare(b.dimension) ||
      a.title.localeCompare(b.title)
  );
}

export function countFindingsBySeverity(
  findings: ConsistencyAuditReportFinding[]
): Record<ConsistencyFindingSeverity, number> {
  const counts: Record<ConsistencyFindingSeverity, number> = {
    blocker: 0,
    major: 0,
    minor: 0
  };
  for (const finding of findings) {
    counts[finding.severity] += 1;
  }
  return counts;
}

function stripReportFields(finding: ConsistencyAuditReportFinding): ConsistencyFinding {
  const { status: _status, applicable: _applicable, applyBlockedReason: _reason, ...rest } =
    finding;
  return {
    ...rest,
    // Pola UI muszą zniknąć także z poprawek — prompt syntezy dostaje te dane
    // jako materiał wejściowy i nie ma po co widzieć naszych statusów.
    patches: finding.patches.map((patch) => {
      const {
        status: _patchStatus,
        applicable: _patchApplicable,
        blockedReason: _patchReason,
        ...patchRest
      } = patch;
      return patchRest;
    })
  };
}

/**
 * Status uwagi wynika ze stanu jej poprawek; wyjątkiem jest odrzucenie, które
 * jest decyzją autora i nie może zostać przeliczone.
 */
function deriveFindingStatus(
  previous: ConsistencyFindingStatus,
  patches: ConsistencyReportPatch[]
): ConsistencyFindingStatus {
  if (previous === "dismissed") {
    return "dismissed";
  }
  if (!patches.length) {
    return previous;
  }
  if (patches.every((patch) => patch.status === "applied")) {
    return "applied";
  }
  if (
    patches.every((patch) => patch.status !== "open") &&
    patches.some((patch) => patch.status === "stale")
  ) {
    return "stale";
  }
  return "open";
}

function normalizeSeverity(value: unknown): ConsistencyFindingSeverity {
  return value === "blocker" || value === "major" || value === "minor" ? value : "major";
}

function normalizeFindingStatus(value: unknown): ConsistencyFindingStatus {
  return value === "applied" || value === "dismissed" || value === "stale" ? value : "open";
}

function normalizePatchStatus(
  value: unknown,
  fallback: ConsistencyPatchStatus
): ConsistencyPatchStatus {
  return value === "applied" || value === "stale" || value === "open" ? value : fallback;
}

function normalizeAuditStatus(value: unknown): ConsistencyAuditStatus {
  return value === "complete" || value === "partial" ? value : "running";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function createAuditId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `consistency-audit:${crypto.randomUUID()}`;
  }
  return `consistency-audit:${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`;
}

export function createFindingId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `consistency-finding:${crypto.randomUUID()}`;
  }
  return `consistency-finding:${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`;
}
