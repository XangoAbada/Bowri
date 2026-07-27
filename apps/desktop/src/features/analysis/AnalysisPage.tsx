import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2, ShieldCheck, Trash2 } from "lucide-react";
import {
  deleteConsistencyAudit,
  getBookPlan,
  getCharacterWorkspace,
  getProject,
  getWorldWorkspace
} from "../../shared/api/commands";
import { Button, EmptyState, StatusPill } from "../../shared/ui";
import {
  AUDIT_DIMENSION_LABELS,
  AUDIT_DIMENSIONS,
  AUDIT_PASS_COUNT,
  CONSISTENCY_FINDING_SEVERITY_LABELS,
  CONSISTENCY_SEVERITY_ORDER,
  type AuditDimension
} from "../ai/consistencyAuditPromptPackage";
import {
  retryConsistencyAuditPass,
  startConsistencyAudit
} from "../ai/consistencyAuditService";
import {
  countFindingsBySeverity,
  useConsistencyAuditStore,
  type ConsistencyAudit
} from "../ai/consistencyAuditStore";
import {
  contextWindowFor,
  DEFAULT_OUTPUT_RESERVE_TOKENS,
  estimateTokens
} from "../ai/contextWindows";
import { useTextProviderInfo } from "../ai/textProviderInfo";
import { buildStoryBibleDossier } from "../ai/storyBibleDossier";

// Sekcja "Analiza": sterowanie audytem spójności i historia raportów.
// Same poprawki żyją w panelu AI po prawej (ConsistencyAuditPanel) — tutaj
// autor widzi gotowość projektu, postęp sześciu przebiegów i przeszłe audyty.

type AnalysisPageProps = {
  projectId: string;
};

export function AnalysisPage({ projectId }: AnalysisPageProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const providerInfo = useTextProviderInfo();
  const audits = useConsistencyAuditStore((state) => state.audits);
  const removeAudit = useConsistencyAuditStore((state) => state.removeAudit);
  const markOutdated = useConsistencyAuditStore((state) => state.markOutdated);
  const setAcknowledged = useConsistencyAuditStore((state) => state.setAcknowledged);
  const [starting, setStarting] = useState(false);

  const projectQuery = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProject(projectId),
    retry: 0
  });
  const bookId = projectQuery.data?.book.id;
  const planQuery = useQuery({
    queryKey: ["book-plan", bookId],
    queryFn: () => getBookPlan(bookId ?? ""),
    enabled: Boolean(bookId),
    retry: 0
  });
  const characterQuery = useQuery({
    queryKey: ["character-workspace", projectId],
    queryFn: () => getCharacterWorkspace(projectId),
    retry: 0
  });
  const worldQuery = useQuery({
    queryKey: ["world-workspace", projectId],
    queryFn: () => getWorldWorkspace(projectId),
    retry: 0
  });
  const project = projectQuery.data?.project;
  const book = projectQuery.data?.book;
  const plan = planQuery.data;
  const characters = characterQuery.data;
  const world = worldQuery.data;

  // Dossier budujemy też przed uruchomieniem: to jedyny sposób pokazania
  // autorowi realnego rozmiaru kontekstu i wykrycia, że raport się zestarzał.
  const dossier = useMemo(() => {
    if (!project || !book || !plan || !characters || !world) {
      return null;
    }
    return buildStoryBibleDossier({ project, book, plan, characters, world });
  }, [project, book, plan, characters, world]);

  const projectAudits = useMemo(
    () =>
      audits
        .filter((audit) => audit.projectId === projectId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [audits, projectId]
  );
  const runningAudit = projectAudits.find((audit) => audit.status === "running") ?? null;

  if (!project || !book || !plan || !characters || !world || !dossier) {
    return (
      <section className="analysis-page">
        <EmptyState
          title={t("analysis.loadingTitle")}
          description={t("analysis.loadingDescription")}
        />
      </section>
    );
  }

  const window = contextWindowFor(providerInfo.providerId, providerInfo.model);
  const dossierTokens = estimateTokens(dossier.text);
  // Świadomie NIE używamy resolveContextBudget: jego DEFAULT_CONTEXT_SHARE = 0.25
  // to budżet historii brainstormu. Audyt ma dostać całe okno modelu, a jedyne
  // co robimy przy przekroczeniu, to ostrzeżenie — kontekstu nie obcinamy.
  const overflows = dossierTokens + DEFAULT_OUTPUT_RESERVE_TOKENS > window.totalTokens;

  function handleStart() {
    // Powtórzona bramka: TypeScript nie przenosi zawężenia typów z early
    // return powyżej do wnętrza tej funkcji.
    if (!project || !book || !plan || !characters || !world) {
      return;
    }
    setStarting(true);
    try {
      startConsistencyAudit({ project, book, plan, characters, world });
    } finally {
      setStarting(false);
    }
  }

  async function handleDelete(audit: ConsistencyAudit) {
    removeAudit(audit.id);
    try {
      await deleteConsistencyAudit(audit.id);
    } finally {
      await queryClient.invalidateQueries({
        queryKey: ["consistency-audits", audit.bookId]
      });
    }
  }

  return (
    <section className="analysis-page">
      <header className="analysis-header">
        <div>
          <p className="eyebrow">{t("analysis.eyebrow")}</p>
          <h1>{t("analysis.title")}</h1>
          <p className="muted-text">{t("analysis.intro")}</p>
        </div>
        <ShieldCheck size={22} aria-hidden="true" />
      </header>

      <div className="analysis-section">
        <h2>{t("analysis.readinessTitle")}</h2>
        <ul className="analysis-counts">
          {(
            [
              ["character", dossier.counts.character],
              ["relation", dossier.counts.relation],
              ["memory", dossier.counts.memory],
              ["worldElement", dossier.counts.worldElement],
              ["worldRule", dossier.counts.worldRule],
              ["plotThread", dossier.counts.plotThread],
              ["chapter", dossier.counts.chapter],
              ["scene", dossier.counts.scene]
            ] as const
          ).map(([kind, count]) => (
            <li key={kind}>
              <span>{t(`analysis.count.${kind}`)}</span>
              <strong>{count}</strong>
            </li>
          ))}
        </ul>

        <p className="muted-text">
          {t("analysis.dossierSize", {
            tokens: dossierTokens.toLocaleString("pl-PL"),
            chars: dossier.text.length.toLocaleString("pl-PL"),
            window: window.totalTokens.toLocaleString("pl-PL"),
            model: providerInfo.model ?? providerInfo.providerLabel
          })}
        </p>
        <p className="muted-text">{t("analysis.noTruncationNote")}</p>

        {overflows ? (
          <p className="warning-text">
            <AlertTriangle size={14} aria-hidden="true" /> {t("analysis.overflowWarning")}
          </p>
        ) : null}

        <div className="analysis-actions">
          <Button
            variant="ai"
            busy={starting}
            disabled={Boolean(runningAudit) || starting}
            onClick={handleStart}
          >
            {t("analysis.startButton", { passes: AUDIT_PASS_COUNT })}
          </Button>
          {runningAudit ? (
            <span className="muted-text">{t("analysis.alreadyRunning")}</span>
          ) : null}
        </div>
      </div>

      {projectAudits.length === 0 ? (
        <EmptyState
          title={t("analysis.emptyTitle")}
          description={t("analysis.emptyDescription")}
        />
      ) : (
        <div className="analysis-section">
          <h2>{t("analysis.historyTitle")}</h2>
          <div className="analysis-audit-list">
            {projectAudits.map((audit) => (
              <AuditCard
                key={audit.id}
                audit={audit}
                currentDossierHash={dossier.hash}
                onMarkOutdated={markOutdated}
                onShowInPanel={() => setAcknowledged(audit.id, false)}
                onDelete={() => void handleDelete(audit)}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function AuditCard({
  audit,
  currentDossierHash,
  onMarkOutdated,
  onShowInPanel,
  onDelete
}: {
  audit: ConsistencyAudit;
  currentDossierHash: string;
  onMarkOutdated: (auditId: string, outdated: boolean) => void;
  onShowInPanel: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const outdated = audit.dossierHash !== currentDossierHash;
  // Znacznik nieaktualności liczony z bieżącego dossier — panel AI korzysta
  // z tej samej flagi. Zapis w efekcie, nie w renderze: to mutacja store'u.
  useEffect(() => {
    if (outdated !== audit.outdated) {
      onMarkOutdated(audit.id, outdated);
    }
  }, [audit.id, audit.outdated, onMarkOutdated, outdated]);

  const openFindings = audit.findings.filter(
    (finding) => finding.status === "open" || finding.status === "stale"
  );
  const counts = countFindingsBySeverity(openFindings);
  const applied = audit.findings.filter((finding) => finding.status === "applied").length;
  const dismissed = audit.findings.filter(
    (finding) => finding.status === "dismissed"
  ).length;

  return (
    <article className={`analysis-audit-card ${audit.status}`}>
      <div className="analysis-audit-heading">
        <div>
          <p className="eyebrow">
            {new Date(audit.createdAt).toLocaleString("pl-PL")} · {audit.dossierHash}
          </p>
          <h3>{t(`analysis.auditStatus.${audit.status}`)}</h3>
          {audit.summary ? <p className="muted-text">{audit.summary}</p> : null}
        </div>
        <div className="analysis-audit-pills">
          {CONSISTENCY_SEVERITY_ORDER.map((severity) =>
            counts[severity] > 0 ? (
              <StatusPill
                key={severity}
                tone={severity === "blocker" ? "danger" : severity === "major" ? "warn" : "muted"}
              >
                {CONSISTENCY_FINDING_SEVERITY_LABELS[severity]}: {counts[severity]}
              </StatusPill>
            ) : null
          )}
          {applied > 0 ? (
            <StatusPill tone="success">{t("analysis.appliedCount", { count: applied })}</StatusPill>
          ) : null}
          {dismissed > 0 ? (
            <StatusPill tone="muted">
              {t("analysis.dismissedCount", { count: dismissed })}
            </StatusPill>
          ) : null}
          {outdated ? (
            <StatusPill tone="warn" title={t("analysis.outdatedHint")}>
              {t("analysis.outdated")}
            </StatusPill>
          ) : null}
          {audit.acknowledged ? (
            <StatusPill tone="success">{t("analysis.acknowledged")}</StatusPill>
          ) : null}
        </div>
      </div>

      <ol className="analysis-pass-list">
        {[...AUDIT_DIMENSIONS, "synthesis" as AuditDimension].map((dimension) => {
          const pass = audit.passes[dimension];
          return (
            <li key={dimension} className={`analysis-pass ${pass.status}`}>
              <span className="analysis-pass-name">
                {pass.status === "running" ? (
                  <Loader2 size={13} className="spin-icon" aria-hidden="true" />
                ) : null}
                {AUDIT_DIMENSION_LABELS[dimension]}
              </span>
              <span className="analysis-pass-status">
                {t(`analysis.passStatus.${pass.status}`)}
                {pass.status === "success" && pass.findingCount > 0
                  ? ` · ${t("analysis.passFindings", { count: pass.findingCount })}`
                  : ""}
              </span>
              {pass.status === "error" ? (
                <>
                  <span className="warning-text">{pass.errorMessage}</span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      if (!retryConsistencyAuditPass(audit.id, dimension)) {
                        // Kontekst audytu żyje tylko w sesji — po restarcie
                        // aplikacji trzeba uruchomić analizę od nowa.
                        onMarkOutdated(audit.id, true);
                      }
                    }}
                  >
                    {t("analysis.retryPass")}
                  </Button>
                </>
              ) : null}
            </li>
          );
        })}
      </ol>

      <div className="analysis-audit-actions">
        {audit.acknowledged ? (
          // Przyjęty raport zniknął z panelu AI — bez tego przycisku nie dałoby
          // się do niego wrócić bez restartu aplikacji.
          <Button variant="secondary" size="sm" onClick={onShowInPanel}>
            {t("analysis.showInPanel")}
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" onClick={onDelete}>
          <Trash2 size={14} aria-hidden="true" />
          {t("analysis.deleteAudit")}
        </Button>
      </div>
    </article>
  );
}
