import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Button, StatusPill, toast } from "../../shared/ui";
import { useProjectNavigationStore } from "../../app/projectNavigationStore";
import {
  AUDIT_DIMENSION_LABELS,
  CONSISTENCY_FINDING_KIND_LABELS,
  CONSISTENCY_FINDING_SEVERITY_LABELS,
  CONSISTENCY_SEVERITY_ORDER,
  type ConsistencyFindingSeverity
} from "./consistencyAuditPromptPackage";
import {
  acceptConsistencyAuditReport,
  applyAuditPatch,
  consistencyAuditQueryKeys,
  persistConsistencyAudit
} from "./consistencyAuditService";
import {
  auditScope,
  useConsistencyAuditStore,
  type ConsistencyAudit,
  type ConsistencyAuditReportFinding,
  type ConsistencyFindingStatus,
  type ConsistencyReportPatch
} from "./consistencyAuditStore";
import { entityFieldLabel, entityKindLabel } from "./brainstormEntityTargets";
import { ProposalStreamPreview } from "./TextStreamPreview";

// Panel raportów audytu spójności w prawym sidebarze. Wzorzec SceneCritiquePanel:
// samoukrywanie przy pustej liście, uwagi filtrowane po statusie, zapis raportu
// po każdej decyzji autora.
//
// Hydratacja NIE jest tutaj — robi ją AiProposalPanel, bo jego bramka pustego
// stanu decyduje, czy ten komponent w ogóle się wyrenderuje.

type ConsistencyAuditPanelProps = {
  projectId: string;
  audits: ConsistencyAudit[];
};

/** Zakładki karty raportu. Uwagi „stale" siedzą razem z otwartymi — autor musi je zobaczyć. */
type FindingFilter = "open" | "applied" | "dismissed";

const SEVERITY_TONE: Record<ConsistencyFindingSeverity, "danger" | "warn" | "muted"> = {
  blocker: "danger",
  major: "warn",
  minor: "muted"
};

export function ConsistencyAuditPanel({ projectId, audits }: ConsistencyAuditPanelProps) {
  const { t } = useTranslation();

  if (audits.length === 0) {
    return null;
  }

  return (
    <div className="scene-discovery-list" aria-label={t("analysis.panelLabel")}>
      {audits.map((audit) => (
        <ConsistencyAuditCard key={audit.id} projectId={projectId} audit={audit} />
      ))}
    </div>
  );
}

function ConsistencyAuditCard({
  projectId,
  audit
}: {
  projectId: string;
  audit: ConsistencyAudit;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const setFindingStatus = useConsistencyAuditStore((state) => state.setFindingStatus);
  const setProjectViewState = useProjectNavigationStore(
    (state) => state.setProjectViewState
  );
  const [filter, setFilter] = useState<FindingFilter>("open");
  /** Klucz „idUwagi#indeksPoprawki" — inaczej spinner zapaliłby się na wszystkich przyciskach. */
  const [applyingKey, setApplyingKey] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [accepting, setAccepting] = useState(false);

  const running = audit.status === "running";
  const openFindings = audit.findings.filter(
    (finding) => finding.status === "open" || finding.status === "stale"
  );
  const appliedFindings = audit.findings.filter((finding) => finding.status === "applied");
  const dismissedFindings = audit.findings.filter(
    (finding) => finding.status === "dismissed"
  );
  const visibleFindings =
    filter === "applied"
      ? appliedFindings
      : filter === "dismissed"
        ? dismissedFindings
        : openFindings;
  const blockerPatchCount = openFindings
    .filter((finding) => finding.severity === "blocker")
    .reduce((sum, finding) => sum + applicablePatchCount(finding), 0);
  const busy = applyingKey !== null || bulkBusy;

  async function refreshAfterApply() {
    await Promise.all(
      consistencyAuditQueryKeys({ projectId, bookId: audit.bookId }).map((queryKey) =>
        queryClient.invalidateQueries({ queryKey })
      )
    );
  }

  /** Zwraca true, gdy poprawka faktycznie została zapisana. */
  async function applyPatch(
    finding: ConsistencyAuditReportFinding,
    patchIndex: number
  ): Promise<boolean> {
    const outcome = await applyAuditPatch({
      auditId: audit.id,
      findingId: finding.id,
      patchIndex
    });
    if (outcome.ok) {
      return true;
    }
    if (outcome.reason !== "notApplicable") {
      toast.error(
        t("analysis.applyError", {
          message:
            outcome.error instanceof Error ? outcome.error.message : String(outcome.error ?? "")
        })
      );
    }
    return false;
  }

  async function applySingle(finding: ConsistencyAuditReportFinding, patchIndex: number) {
    setApplyingKey(patchKey(finding.id, patchIndex));
    try {
      if (await applyPatch(finding, patchIndex)) {
        await refreshAfterApply();
      }
    } finally {
      setApplyingKey(null);
    }
  }

  /**
   * Seryjne stosowanie wielu poprawek. Świadomie po kolei, nie równolegle:
   * dwie poprawki mogą dotyczyć tej samej encji, a każdy zapis odsyła komplet
   * jej pól — równoległe wywołania nadpisałyby się wzajemnie.
   */
  async function applyMany(findings: ConsistencyAuditReportFinding[]) {
    setBulkBusy(true);
    let applied = 0;
    let total = 0;
    try {
      for (const finding of findings) {
        // Stan po każdym zapisie jest inny, więc listę poprawek czytamy na świeżo.
        const fresh = currentFinding(audit.id, finding.id);
        if (!fresh) {
          continue;
        }
        for (let index = 0; index < fresh.patches.length; index += 1) {
          const patch = currentFinding(audit.id, finding.id)?.patches[index];
          if (!patch || !patch.applicable || patch.status !== "open") {
            continue;
          }
          total += 1;
          if (await applyPatch(fresh, index)) {
            applied += 1;
          }
        }
      }
      if (applied > 0) {
        await refreshAfterApply();
        toast.success(t("analysis.patchesApplied", { count: applied, total }));
      }
    } finally {
      setBulkBusy(false);
    }
  }

  async function acceptReport() {
    setAccepting(true);
    try {
      const { failed } = await acceptConsistencyAuditReport(audit.id);
      if (failed > 0) {
        toast.error(t("analysis.acceptReportError"));
        return;
      }
      toast.success(t("analysis.acceptReportDone"));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["ai-proposals", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["ai-runs", projectId] })
      ]);
    } finally {
      setAccepting(false);
    }
  }

  function setStatus(findingId: string, status: ConsistencyFindingStatus) {
    setFindingStatus(audit.id, findingId, status);
    void persistConsistencyAudit(audit.id);
  }

  function openInPlan(entityId: string) {
    setProjectViewState(projectId, "searchSceneId", entityId);
    void navigate({ to: "/projects/$projectId/plan", params: { projectId } });
  }

  return (
    <article className="scene-discovery-card">
      <div>
        <span className="scene-discovery-kind">{t("analysis.panelKind")}</span>
        <h3>
          {running
            ? t("analysis.panelHeadingRunning", {
                done: completedPassCount(audit),
                total: totalPassCount(audit)
              })
            : t("analysis.panelHeading", { count: openFindings.length })}
        </h3>
        {audit.summary ? <p>{audit.summary}</p> : null}
        <div className="consistency-audit-meta">
          {CONSISTENCY_SEVERITY_ORDER.map((severity) => {
            const count = openFindings.filter(
              (finding) => finding.severity === severity
            ).length;
            return count > 0 ? (
              <StatusPill key={severity} tone={SEVERITY_TONE[severity]}>
                {CONSISTENCY_FINDING_SEVERITY_LABELS[severity]}: {count}
              </StatusPill>
            ) : null;
          })}
          {audit.outdated ? (
            <StatusPill tone="warn" title={t("analysis.outdatedHint")}>
              {t("analysis.outdated")}
            </StatusPill>
          ) : null}
        </div>
        {running ? <p className="muted-text">{runningPassLabel(audit, t)}</p> : null}
        {running ? <RunningPassProgress audit={audit} /> : null}
      </div>

      {appliedFindings.length > 0 || dismissedFindings.length > 0 ? (
        <div className="consistency-audit-filters" role="group" aria-label={t("analysis.filterLabel")}>
          <FilterTab
            active={filter === "open"}
            count={openFindings.length}
            label={t("analysis.filterOpen", { count: openFindings.length })}
            onSelect={() => setFilter("open")}
          />
          <FilterTab
            active={filter === "applied"}
            count={appliedFindings.length}
            label={t("analysis.filterApplied", { count: appliedFindings.length })}
            onSelect={() => setFilter("applied")}
          />
          <FilterTab
            active={filter === "dismissed"}
            count={dismissedFindings.length}
            label={t("analysis.filterDismissed", { count: dismissedFindings.length })}
            onSelect={() => setFilter("dismissed")}
          />
        </div>
      ) : null}

      {filter === "open" && blockerPatchCount > 1 ? (
        <div className="scene-discovery-actions">
          <Button
            variant="ai"
            size="sm"
            busy={bulkBusy}
            disabled={busy}
            onClick={() =>
              void applyMany(
                openFindings.filter((finding) => finding.severity === "blocker")
              )
            }
          >
            {t("analysis.applyAllBlockers", { count: blockerPatchCount })}
          </Button>
        </div>
      ) : null}

      {visibleFindings.length === 0 && filter !== "open" ? (
        <p className="muted-text">
          {filter === "applied" ? t("analysis.emptyApplied") : t("analysis.emptyDismissed")}
        </p>
      ) : null}

      {visibleFindings.map((finding) => (
        <div className="consistency-audit-finding" key={finding.id}>
          <p>
            <strong>
              {AUDIT_DIMENSION_LABELS[finding.dimension]} ·{" "}
              {CONSISTENCY_FINDING_KIND_LABELS[finding.kind]} ·{" "}
              {CONSISTENCY_FINDING_SEVERITY_LABELS[finding.severity]}
            </strong>{" "}
            — {finding.title}
          </p>
          <p>{finding.description}</p>

          {finding.evidence.length > 0 ? (
            <ul className="consistency-audit-evidence">
              {finding.evidence.map((item, index) => (
                <li key={`${item.kind}:${item.id}:${index}`}>
                  <span className="consistency-audit-evidence-label">
                    {item.label}
                    {item.field ? ` → ${item.field}` : ""}
                  </span>
                  {item.quote ? <em>„{item.quote}"</em> : null}
                </li>
              ))}
            </ul>
          ) : null}

          {finding.patches.length > 1 ? (
            <p className="consistency-audit-patches-heading">
              {t("analysis.patchesHeading", { count: finding.patches.length })}
            </p>
          ) : null}

          {finding.patches.map((patch, index) => (
            <PatchBlock
              key={`${patch.targetKind}:${patch.targetId}:${patch.field}:${index}`}
              patch={patch}
              readOnly={filter !== "open"}
              busy={applyingKey === patchKey(finding.id, index)}
              disabled={busy}
              onApply={() => void applySingle(finding, index)}
            />
          ))}

          {finding.patches.length === 0 && finding.applyBlockedReason ? (
            <p className="warning-text">{finding.applyBlockedReason}</p>
          ) : null}

          <div className="scene-discovery-actions">
            {filter === "open" && applicablePatchCount(finding) > 1 ? (
              <Button
                variant="ai"
                size="sm"
                disabled={busy}
                onClick={() => void applyMany([finding])}
              >
                {t("analysis.applyAllInFinding", { count: applicablePatchCount(finding) })}
              </Button>
            ) : null}
            {filter === "open" && finding.patches.length === 0 && firstPlanEvidenceId(finding) ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => openInPlan(firstPlanEvidenceId(finding) ?? "")}
              >
                {t("analysis.showInPlan")}
              </Button>
            ) : null}
            {filter === "open" ? (
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => setStatus(finding.id, "dismissed")}
              >
                {t("analysis.dismiss")}
              </Button>
            ) : null}
            {filter === "dismissed" ? (
              <Button
                variant="secondary"
                size="sm"
                title={t("analysis.restoreFindingTitle")}
                onClick={() => setStatus(finding.id, "open")}
              >
                {t("analysis.restoreFinding")}
              </Button>
            ) : null}
          </div>
        </div>
      ))}

      {!running ? (
        <div className="consistency-audit-card-footer">
          <Button
            variant="primary"
            size="sm"
            busy={accepting}
            disabled={busy || accepting}
            title={t("analysis.acceptReportTitle")}
            onClick={() => void acceptReport()}
          >
            {t("analysis.acceptReport")}
          </Button>
        </div>
      ) : null}
    </article>
  );
}

function FilterTab({
  active,
  count,
  label,
  onSelect
}: {
  active: boolean;
  count: number;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`consistency-audit-filter${active ? " is-active" : ""}`}
      aria-pressed={active}
      disabled={count === 0 && !active}
      onClick={onSelect}
    >
      {label}
    </button>
  );
}

function PatchBlock({
  patch,
  readOnly,
  busy,
  disabled,
  onApply
}: {
  patch: ConsistencyReportPatch;
  readOnly: boolean;
  busy: boolean;
  disabled: boolean;
  onApply: () => void;
}) {
  const { t } = useTranslation();
  const decided = patch.status !== "open";

  return (
    <div className="consistency-audit-patch">
      <p className="consistency-audit-patch-target">
        {entityKindLabel(patch.targetKind)}: <strong>{patch.targetLabel}</strong> →{" "}
        {entityFieldLabel(patch.targetKind, patch.field)}
        {patch.mode === "append" ? ` (${t("analysis.patchModeAppend")})` : ""}
        {decided ? (
          <StatusPill
            tone={patch.status === "applied" ? "success" : "warn"}
            title={patch.status === "stale" ? t("analysis.patchStaleHint") : undefined}
          >
            {patch.status === "applied" ? t("analysis.patchApplied") : t("analysis.patchStale")}
          </StatusPill>
        ) : null}
      </p>
      {patch.currentValueExcerpt ? (
        <div className="consistency-patch-before">
          <span>{t("analysis.patchBefore")}</span>
          <p>{patch.currentValueExcerpt}</p>
        </div>
      ) : null}
      <div className="consistency-patch-after">
        <span>{t("analysis.patchAfter")}</span>
        <p>{patch.proposedValue}</p>
      </div>
      {patch.rationale ? <p className="muted-text">{patch.rationale}</p> : null}
      {patch.blockedReason ? <p className="warning-text">{patch.blockedReason}</p> : null}
      {!readOnly && !decided ? (
        <div className="consistency-audit-patch-actions">
          <Button
            variant="ai"
            size="sm"
            busy={busy}
            disabled={!patch.applicable || disabled}
            title={
              patch.applicable
                ? t("analysis.applyTitleReady")
                : patch.blockedReason ?? t("analysis.applyTitleDisabled")
            }
            onClick={onApply}
          >
            {t("analysis.apply")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function patchKey(findingId: string, patchIndex: number): string {
  return `${findingId}#${patchIndex}`;
}

function applicablePatchCount(finding: ConsistencyAuditReportFinding): number {
  return finding.patches.filter((patch) => patch.applicable && patch.status === "open").length;
}

function currentFinding(
  auditId: string,
  findingId: string
): ConsistencyAuditReportFinding | undefined {
  return useConsistencyAuditStore
    .getState()
    .audits.find((item) => item.id === auditId)
    ?.findings.find((item) => item.id === findingId);
}

/** Uwagi bez poprawek często dotyczą planu — daj autorowi skrót do miejsca. */
function firstPlanEvidenceId(finding: ConsistencyAuditReportFinding): string | null {
  const planKinds = new Set(["chapter", "scene", "act", "beat", "plotThread"]);
  return finding.evidence.find((item) => planKinds.has(item.kind))?.id ?? null;
}

function completedPassCount(audit: ConsistencyAudit): number {
  return Object.values(audit.passes).filter((pass) => pass.status === "success").length;
}

/**
 * Ile przebiegów ma ten audyt. Nie stała 6: raport częściowy ma tyle przebiegów,
 * ile wymiarów wybrał autor, a synteza dochodzi tylko wtedy, gdy jest co scalać.
 */
function totalPassCount(audit: ConsistencyAudit): number {
  const scope = auditScope(audit).length;
  return scope + (scope > 1 ? 1 : 0);
}

/**
 * Podgląd generacji przy karcie audytu. Przebiegi audytu są odfiltrowane z
 * kafelków kolejki (patrz AiProposalPanel), więc bez tego autor pracujący poza
 * stroną Analiza widziałby wyłącznie licznik „przebieg n/N".
 */
function RunningPassProgress({ audit }: { audit: ConsistencyAudit }) {
  const proposalId = Object.values(audit.passes).find(
    (pass) => pass.status === "running"
  )?.proposalId;

  return <ProposalStreamPreview proposalId={proposalId} />;
}

function runningPassLabel(audit: ConsistencyAudit, t: TFunction): string {
  const entry = Object.entries(audit.passes).find(
    ([, pass]) => pass.status === "running"
  );
  if (!entry) {
    return t("analysis.panelWaiting");
  }
  return t("analysis.panelRunningPass", {
    dimension:
      AUDIT_DIMENSION_LABELS[entry[0] as keyof typeof AUDIT_DIMENSION_LABELS] ?? entry[0]
  });
}
