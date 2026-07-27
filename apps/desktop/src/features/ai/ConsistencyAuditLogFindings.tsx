import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listConsistencyAudits } from "../../shared/api/commands";
import type { AiLogEntry } from "../../shared/api/types";
import { Button, StatusPill, toast } from "../../shared/ui";
import { entityFieldLabel, entityKindLabel } from "./brainstormEntityTargets";
import {
  CONSISTENCY_FINDING_KIND_LABELS,
  CONSISTENCY_FINDING_SEVERITY_LABELS,
  parseConsistencyAuditResult,
  type ConsistencyFinding
} from "./consistencyAuditPromptPackage";
import { applyAuditPatch, consistencyAuditQueryKeys } from "./consistencyAuditService";
import {
  findingSignature,
  useConsistencyAuditStore,
  type ConsistencyAudit,
  type ConsistencyAuditReportFinding,
  type ConsistencyFindingStatus
} from "./consistencyAuditStore";

// Uwagi przebiegu audytu pokazane w logu AI jako zwijane kafelki — zamiast
// ściany zagnieżdżonych <dl>, w której nie dało się nic znaleźć ani zastosować.
//
// Stan (zastosowana / odrzucona) czytamy z zapisanego raportu, nie z odpowiedzi
// modelu: log pokazuje, co model zaproponował, a raport wie, co autor z tym
// zrobił. Dopasowanie idzie po sygnaturze uwagi, bo model przy każdej generacji
// nadaje uwagom nowe identyfikatory.

const AUDIT_ACTIONS = new Set(["analyze_consistency", "synthesize_consistency_audit"]);

type LogFinding = {
  finding: ConsistencyFinding;
  /** Uwaga w zapisanym raporcie; null = synteza ją scaliła albo raport zniknął. */
  reportFinding: ConsistencyAuditReportFinding | null;
};

export function ConsistencyAuditLogFindings({
  entry,
  projectId,
  bookId
}: {
  entry: AiLogEntry;
  projectId: string;
  bookId: string;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const audits = useConsistencyAuditStore((state) => state.audits);
  const hydrate = useConsistencyAuditStore((state) => state.hydrate);
  const [applyingKey, setApplyingKey] = useState<string | null>(null);

  const isAuditEntry = AUDIT_ACTIONS.has(entry.action) && entry.status === "success";

  // Ten sam klucz co panel propozycji, więc dane są współdzielone. Log nie może
  // liczyć na to, że panel jest zamontowany — sam hydratuje store.
  const auditsQuery = useQuery({
    queryKey: ["consistency-audits", bookId],
    queryFn: () => listConsistencyAudits(bookId),
    enabled: isAuditEntry && Boolean(bookId),
    retry: 0
  });
  useEffect(() => {
    if (auditsQuery.data) {
      hydrate(auditsQuery.data);
    }
  }, [auditsQuery.data, hydrate]);

  const parsedFindings = useMemo(() => {
    if (!isAuditEntry || !entry.rawOutput?.trim()) {
      return [];
    }
    try {
      return parseConsistencyAuditResult(entry.rawOutput).findings;
    } catch {
      // Odpowiedzi, której nie da się sparsować, i tak nie oddamy do zapisu —
      // niżej w logu zostaje sekcja z surowym JSON-em.
      return [];
    }
  }, [entry.rawOutput, isAuditEntry]);

  const audit = useMemo(() => auditForLogEntry(audits, entry), [audits, entry]);

  const logFindings: LogFinding[] = useMemo(() => {
    if (!parsedFindings.length) {
      return [];
    }
    const bySignature = new Map<string, ConsistencyAuditReportFinding>();
    for (const reportFinding of audit?.findings ?? []) {
      const key = findingSignature(reportFinding);
      if (!bySignature.has(key)) {
        bySignature.set(key, reportFinding);
      }
    }
    return parsedFindings.map((finding) => ({
      finding,
      reportFinding: bySignature.get(findingSignature(finding)) ?? null
    }));
  }, [audit, parsedFindings]);

  if (!isAuditEntry || logFindings.length === 0) {
    return null;
  }

  async function applyPatch(
    reportFinding: ConsistencyAuditReportFinding,
    patchIndex: number
  ) {
    if (!audit) {
      return;
    }
    setApplyingKey(`${reportFinding.id}#${patchIndex}`);
    try {
      const outcome = await applyAuditPatch({
        auditId: audit.id,
        findingId: reportFinding.id,
        patchIndex
      });
      if (outcome.ok) {
        toast.success(t("ai.log.auditPatchApplied"));
        await Promise.all(
          consistencyAuditQueryKeys({ projectId, bookId }).map((queryKey) =>
            queryClient.invalidateQueries({ queryKey })
          )
        );
        return;
      }
      if (outcome.reason !== "notApplicable") {
        toast.error(
          t("analysis.applyError", {
            message:
              outcome.error instanceof Error
                ? outcome.error.message
                : String(outcome.error ?? "")
          })
        );
      }
    } finally {
      setApplyingKey(null);
    }
  }

  return (
    <div className="ai-log-findings">
      <h4>{t("ai.log.auditFindingsHeading")}</h4>
      {!audit && !auditsQuery.isLoading ? (
        <p className="muted-text">{t("ai.log.auditReportMissing")}</p>
      ) : null}

      {logFindings.map(({ finding, reportFinding }, index) => {
        const status = reportFinding?.status ?? null;
        return (
          <details
            className="ai-log-finding-card"
            key={`${finding.title}:${index}`}
          >
            <summary>
              <span className="ai-log-finding-head">
                <span className="scene-discovery-kind">
                  {CONSISTENCY_FINDING_SEVERITY_LABELS[finding.severity]} ·{" "}
                  {CONSISTENCY_FINDING_KIND_LABELS[finding.kind]}
                </span>
                <strong>{finding.title}</strong>
              </span>
              <StatusPill tone={findingStatusTone(status)}>
                {findingStatusLabel(status, t)}
              </StatusPill>
            </summary>

            <div className="ai-log-finding-body">
              <p>{finding.description}</p>

              {finding.evidence.length > 0 ? (
                <ul className="consistency-audit-evidence">
                  {finding.evidence.map((item, evidenceIndex) => (
                    <li key={`${item.kind}:${item.id}:${evidenceIndex}`}>
                      <span className="consistency-audit-evidence-label">
                        {item.label}
                        {item.field ? ` → ${item.field}` : ""}
                      </span>
                      {item.quote ? <em>„{item.quote}"</em> : null}
                    </li>
                  ))}
                </ul>
              ) : null}

              {finding.patches.map((patch, patchIndex) => {
                const reportPatch = reportFinding?.patches[patchIndex];
                const canApply =
                  Boolean(audit) &&
                  Boolean(reportFinding) &&
                  reportPatch?.status === "open" &&
                  reportPatch.applicable === true &&
                  reportFinding?.status !== "dismissed";

                return (
                  <div
                    className="consistency-audit-patch"
                    key={`${patch.targetKind}:${patch.targetId}:${patch.field}:${patchIndex}`}
                  >
                    <p className="consistency-audit-patch-target">
                      {entityKindLabel(patch.targetKind)}:{" "}
                      <strong>{patch.targetLabel}</strong> →{" "}
                      {entityFieldLabel(patch.targetKind, patch.field)}
                      {reportPatch && reportPatch.status !== "open" ? (
                        <StatusPill
                          tone={reportPatch.status === "applied" ? "success" : "warn"}
                        >
                          {reportPatch.status === "applied"
                            ? t("analysis.patchApplied")
                            : t("analysis.patchStale")}
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
                    {patch.rationale ? (
                      <p className="muted-text">{patch.rationale}</p>
                    ) : null}
                    {canApply && reportFinding ? (
                      <div className="consistency-audit-patch-actions">
                        <Button
                          variant="ai"
                          size="sm"
                          busy={applyingKey === `${reportFinding.id}#${patchIndex}`}
                          disabled={applyingKey !== null}
                          onClick={(event) => {
                            event.stopPropagation();
                            void applyPatch(reportFinding, patchIndex);
                          }}
                        >
                          {t("ai.log.applyPatch")}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                );
              })}

              {/* Uwaga bez odpowiednika w raporcie: currentValueExcerpt pochodzi
                  z etapu pośredniego, więc zapis mógłby nadpisać nowszą treść. */}
              {!reportFinding && audit ? (
                <p className="muted-text">{t("ai.log.findingNotInReport")}</p>
              ) : null}
            </div>
          </details>
        );
      })}
    </div>
  );
}

/** Wpis logu to jeden przebieg audytu — wiąże je aiRunId zapisany w passes_json. */
function auditForLogEntry(
  audits: ConsistencyAudit[],
  entry: AiLogEntry
): ConsistencyAudit | null {
  return (
    audits.find((audit) =>
      Object.values(audit.passes).some((pass) => pass.aiRunId === entry.id)
    ) ?? null
  );
}

function findingStatusLabel(
  status: ConsistencyFindingStatus | null,
  t: (key: string) => string
): string {
  if (status === "applied") {
    return t("ai.log.findingStatusApplied");
  }
  if (status === "dismissed") {
    return t("ai.log.findingStatusDismissed");
  }
  if (status === "stale") {
    return t("ai.log.findingStatusStale");
  }
  return t("ai.log.findingStatusOpen");
}

function findingStatusTone(
  status: ConsistencyFindingStatus | null
): "success" | "danger" | "warn" | "muted" {
  if (status === "applied") {
    return "success";
  }
  if (status === "dismissed") {
    return "danger";
  }
  if (status === "stale") {
    return "warn";
  }
  return "muted";
}
