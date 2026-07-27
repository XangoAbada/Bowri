import { Check, FileJson, History, Loader2, RotateCcw, Undo2 } from "lucide-react";
import { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import i18n from "../../shared/i18n";
import { Button, Chip, StatusPill, toast } from "../../shared/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getAiSettings,
  getProject,
  listAiRuns,
  listBrainstormMessages,
  markAiProposalAccepted,
  markAiProposalPending,
  updateBrainstormMessageSuggestions,
  upsertAiProposalSnapshot
} from "../../shared/api/commands";
import type {
  AiLogEntry,
  BrainstormMessage,
  BrainstormSuggestion
} from "../../shared/api/types";
import { parseBrainstormSuggestions } from "./brainstormPromptPackage";
import { suggestionKindLabel } from "../brainstorm/BrainstormSuggestionPanel";
import { useBrainstormSessionStore } from "../brainstorm/brainstormSessionStore";
import { costOf, formatCostLabel, imageCostOf } from "./pricing";
import { formatLocalDateTime } from "../../shared/date";
import { applyAiProposal, proposalCanAccept } from "./AiProposalPanel";
import { conceptFieldConfigs, ConceptFieldKey } from "./promptPackage";
import { planFieldConfigs, PlanFieldKey } from "./planPromptPackage";
import { characterFieldConfigs, CharacterFieldKey } from "./characterPromptPackage";
import { worldFieldConfigs, WorldFieldKey } from "./worldPromptPackage";
import { sceneEditorFieldLabel, SceneEditorFieldKey } from "./sceneEditorPromptPackage";
import { SCENE_STORY_BIBLE_AUDIT_FIELD } from "./sceneStoryBibleAuditPromptPackage";
import { extractJsonCandidate } from "./titleSuggestions";
import {
  useProposalStore,
  type ActiveAiProposal,
  type AiPromptSnapshot
} from "./proposalStore";
import {
  promptSnapshotFromLogEntry,
  proposalFromLogEntry,
  snapshotForRetry,
  type LogEntryProposal
} from "./aiLogReplay";
import { ConsistencyAuditLogFindings } from "./ConsistencyAuditLogFindings";
import { isConsistencyAuditField } from "./reportProposals";

type AiLogPageProps = {
  projectId: string;
};

export function AiLogPage({ projectId }: AiLogPageProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const logQuery = useQuery({
    queryKey: ["ai-runs", projectId],
    queryFn: () => listAiRuns(projectId),
    retry: 0
  });
  // Pakiety promptów koncepcji nie niosą identyfikatora książki — projekt ma dokładnie
  // jedną, więc bierzemy ją stąd jako uzupełnienie przy odtwarzaniu propozycji z logu.
  const projectQuery = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProject(projectId),
    retry: 0
  });
  const fallbackBookId = projectQuery.data?.book.id ?? "";
  const clearProposal = useProposalStore((state) => state.clearProposal);
  const enqueueProposal = useProposalStore((state) => state.enqueueProposal);
  const applyMutation = useMutation({
    mutationFn: async ({ proposal, source }: LogEntryProposal) => {
      await applyAiProposal(proposal);
      if (source === "reconstructed") {
        // Bez rekordu w bazie decyzja nie miałaby czego oznaczyć, a log dalej pokazywałby
        // wpis jako niezaakceptowany.
        await upsertAiProposalSnapshot({
          id: proposal.id,
          aiRunId: proposal.aiRunId ?? null,
          projectId: proposal.projectId,
          proposalType: proposal.scope ?? "bookConcept",
          payloadJson: proposal,
          status: proposal.status
        });
      }
      await markAiProposalAccepted(proposal.id);
    },
    onSuccess: async (_payload, { proposal }) => {
      clearProposal(proposal.id);
      await queryClient.invalidateQueries({ queryKey: ["ai-runs", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["ai-run-usage-totals", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["ai-proposals", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["book-plan"] });
      await queryClient.invalidateQueries({ queryKey: ["character-workspace", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["world-workspace", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      await queryClient.refetchQueries({ queryKey: ["book-plan"], type: "all" });
      await queryClient.refetchQueries({ queryKey: ["character-workspace", projectId], type: "all" });
      await queryClient.refetchQueries({ queryKey: ["world-workspace", projectId], type: "all" });
      await queryClient.refetchQueries({ queryKey: ["project", projectId], type: "all" });
      await queryClient.refetchQueries({ queryKey: ["projects"], type: "all" });
    }
  });

  return (
    <section className="content-panel ai-log-page">
      <div className="section-title-row">
        <div>
          <p className="eyebrow">{t("ai.log.eyebrow")}</p>
          <h2>{t("ai.log.title")}</h2>
        </div>
        <History size={20} aria-hidden="true" />
      </div>

      {logQuery.isLoading ? (
        <p className="muted-text ai-log-loading">
          <Loader2 size={15} className="spin-icon" />
          {t("ai.log.loading")}
        </p>
      ) : null}

      {logQuery.isError ? (
        <div className="empty-state">
          <h3>{t("ai.log.loadErrorTitle")}</h3>
          <p>{t("ai.log.loadErrorHint")}</p>
        </div>
      ) : null}

      {logQuery.data?.length === 0 ? (
        <div className="empty-state">
          <FileJson size={24} aria-hidden="true" />
          <h3>{t("ai.log.emptyTitle")}</h3>
          <p>{t("ai.log.emptyHint")}</p>
        </div>
      ) : null}

      <div className="ai-log-list">
        {logQuery.data?.map((entry) => (
          <AiLogEntryDetails
            entry={entry}
            key={entry.id}
            projectId={projectId}
            fallbackBookId={fallbackBookId}
            applying={
              applyMutation.isPending &&
              applyMutation.variables?.proposal.aiRunId === entry.id
            }
            applyErrorMessage={
              applyMutation.isError &&
              applyMutation.variables?.proposal.aiRunId === entry.id
                ? applyErrorMessage(applyMutation.error)
                : ""
            }
            onApply={(proposal) => applyMutation.mutate(proposal)}
            onRetry={(snapshot) => {
              const { created } = enqueueProposal(snapshotForRetry(snapshot));
              if (created) {
                toast.success(t("ai.log.retryQueued"));
                return;
              }

              toast.info(t("ai.log.retryAlreadyQueued"));
            }}
          />
        ))}
      </div>
    </section>
  );
}

function entryCostLabel(entry: AiLogEntry, plnPerUsd: number): string {
  const cost =
    entry.imageCount > 0
      ? imageCostOf(entry.providerId, entry.model, entry.imageSize, entry.imageCount)
      : costOf(
          {
            inputTokens: entry.inputTokens,
            outputTokens: entry.outputTokens,
            cacheReadTokens: entry.cacheReadTokens,
            cacheCreationTokens: entry.cacheCreationTokens,
            tokensEstimated: entry.tokensEstimated
          },
          entry.providerId,
          entry.model
        );
  return formatCostLabel(cost, plnPerUsd);
}

function AiLogEntryDetails({
  entry,
  projectId,
  fallbackBookId,
  applying,
  applyErrorMessage,
  onApply,
  onRetry
}: {
  entry: AiLogEntry;
  projectId: string;
  fallbackBookId: string;
  applying: boolean;
  applyErrorMessage: string;
  onApply: (proposal: LogEntryProposal) => void;
  onRetry: (snapshot: AiPromptSnapshot) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const restoreProposalToPanel = useProposalStore((state) => state.restoreProposal);
  const aiSettingsQuery = useQuery({
    queryKey: ["ai-settings"],
    queryFn: getAiSettings
  });
  const restoreProposalMutation = useMutation({
    mutationFn: async (proposal: ActiveAiProposal) => {
      await markAiProposalPending(proposal.id);
      return proposal;
    },
    onSuccess: async (proposal) => {
      restoreProposalToPanel(proposal);
      await queryClient.invalidateQueries({ queryKey: ["ai-proposals", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["ai-runs", projectId] });
      toast.success(t("ai.log.proposalRestored"));
    },
    onError: () => {
      toast.error(t("ai.log.proposalRestoreError"));
    }
  });
  const plnPerUsd = aiSettingsQuery.data?.plnPerUsd ?? 4;
  const totalTokens = entry.inputTokens + entry.outputTokens;
  const summary = requestSummary(entry);
  const logProposal = proposalFromLogEntry(entry, fallbackBookId);
  // Przebiegu, który wciąż trwa, nie ponawiamy — jego propozycja jest w panelu po prawej.
  const retrySnapshot =
    entry.status === "queued" || entry.status === "running"
      ? null
      : promptSnapshotFromLogEntry(entry, fallbackBookId);
  // Ta sama reguła co w panelu propozycji. Bez niej log oferował zapis dla
  // raportów (audyt spójności, krytyka sceny), a applyAiProposal nie ma dla nich
  // gałęzi — kończyło się błędem "invalid args".
  const canApply =
    entry.status === "success" &&
    entry.decisionStatus !== "accepted" &&
    Boolean(logProposal) &&
    Boolean(logProposal && proposalCanAccept(logProposal.proposal));
  // Odtworzona propozycja nie ma wiersza w ai_proposals, więc nie ma czego cofać;
  // przebieg audytu nie wraca do skrzynki, bo jego kartą jest raport analizy.
  const restorableProposal =
    entry.decisionStatus === "rejected" &&
    logProposal?.source === "stored" &&
    !isConsistencyAuditField(logProposal.proposal.field)
      ? logProposal.proposal
      : null;

  return (
    <details className="ai-log-entry ui-card">
      <summary>
        <span>
          <strong>{summary.title}</strong>
          <small>{formatLocalDateTime(entry.createdAt)}</small>
        </span>
        <StatusPill tone={generationStatusTone(entry.status)}>
          {generationStatusLabel(entry.status)}
        </StatusPill>
      </summary>

      <div className="ai-log-entry-body">
        <section className="ai-log-readable-block">
          <h3>{t("ai.log.request")}</h3>
          <div className="ai-log-meta">
            <Chip tone="accent" title={t("ai.log.actionTitle")}>
              {summary.actionLabel}
            </Chip>
            {summary.fieldLabel ? <Chip title={t("ai.log.fieldTitle")}>{summary.fieldLabel}</Chip> : null}
            {summary.mode ? (
              <Chip title={t("ai.log.modeTitle")}>
                {summary.mode === "expand" ? t("ai.log.modeExpand") : t("ai.log.modeGenerate")}
              </Chip>
            ) : null}
            <StatusPill tone={decisionStatusTone(entry.decisionStatus)} title={t("ai.log.decisionTitle")}>
              {decisionStatusLabel(entry.decisionStatus)}
            </StatusPill>
            <Chip title={t("ai.log.providerTitle")}>{entry.providerId}</Chip>
            <Chip title={t("ai.log.modelTitle")}>{entry.model?.trim() || t("ai.log.modelNotSaved")}</Chip>
            <Chip tone="ai" title={t("ai.log.reasoningTitle")}>
              {reasoningLabel(entry.reasoningEffort)}
            </Chip>
            {entry.status === "success" ? (
              <Chip
                tone="accent"
                title={t("ai.log.costTitle")}
              >
                {entryCostLabel(entry, plnPerUsd)}
                {entry.imageCount > 0
                  ? ` · ${t("ai.log.images", { count: entry.imageCount })}`
                  : totalTokens > 0
                    ? ` · ${entry.tokensEstimated ? t("ai.log.tokensEstimated", { count: totalTokens }) : t("ai.log.tokens", { count: totalTokens })}`
                    : ""}
              </Chip>
            ) : null}
          </div>
          <details className="ai-log-prompt ai-log-collapsible">
            <summary>
              {entry.prompt
                ? t("ai.log.promptToggle", { chars: entry.prompt.length })
                : t("ai.log.prompt")}
            </summary>
            <pre>{entry.prompt || t("ai.log.promptEmpty")}</pre>
          </details>
        </section>

        <section className="ai-log-readable-block">
          <h3>{t("ai.log.response")}</h3>
          {entry.errorMessage ? (
            <p className="warning-text">{entry.errorMessage}</p>
          ) : null}
          <ConsistencyAuditLogFindings
            entry={entry}
            projectId={projectId}
            bookId={fallbackBookId}
          />
          <ReadableResponse rawOutput={entry.rawOutput} />
          <BrainstormLogSuggestions entry={entry} />
          {(canApply && logProposal) || retrySnapshot || restorableProposal ? (
            <div className="ai-log-entry-actions">
              {canApply && logProposal ? (
                <Button
                  variant="primary"
                  busy={applying}
                  onClick={(event) => {
                    event.stopPropagation();
                    onApply(logProposal);
                  }}
                >
                  {applying ? null : <Check size={15} />}
                  {applying
                    ? t("ai.log.applying")
                    : summary.fieldLabel
                      ? t("ai.log.applyToField", { field: summary.fieldLabel })
                      : t("ai.log.applyGeneric")}
                </Button>
              ) : null}
              {restorableProposal ? (
                <Button
                  variant="secondary"
                  busy={restoreProposalMutation.isPending}
                  disabled={restoreProposalMutation.isPending}
                  title={t("ai.log.restoreProposalTitle")}
                  onClick={(event) => {
                    event.stopPropagation();
                    restoreProposalMutation.mutate(restorableProposal);
                  }}
                >
                  {restoreProposalMutation.isPending ? null : (
                    <Undo2 size={15} aria-hidden />
                  )}
                  {t("ai.log.restoreProposal")}
                </Button>
              ) : null}
              {retrySnapshot ? (
                <Button
                  variant="secondary"
                  title={t("ai.log.retryTitle")}
                  onClick={(event) => {
                    event.stopPropagation();
                    onRetry(retrySnapshot);
                  }}
                >
                  <RotateCcw size={15} aria-hidden />
                  {t("ai.log.retry")}
                </Button>
              ) : null}
            </div>
          ) : null}
          {applyErrorMessage ? (
            <p className="warning-text">{applyErrorMessage}</p>
          ) : null}
          {entry.status === "terminated" ? (
            <p className="muted-text">{t("ai.log.terminated")}</p>
          ) : null}
        </section>
      </div>
    </details>
  );
}

/** Powyżej tego progu odpowiedź startuje zwinięta — raport audytu ma kilkadziesiąt kB. */
const RESPONSE_INLINE_LIMIT = 2000;
const MAX_DEPTH = 2;
const MAX_INLINE_ITEMS = 5;
const MAX_INLINE_KEYS = 8;

function ReadableResponse({ rawOutput }: { rawOutput?: string | null }) {
  const { t } = useTranslation();
  if (!rawOutput?.trim()) {
    return <p className="muted-text">{t("ai.log.responseEmpty")}</p>;
  }

  const parsed = parseResponse(rawOutput);
  const long = rawOutput.length > RESPONSE_INLINE_LIMIT;
  const body =
    !parsed || typeof parsed !== "object" || Array.isArray(parsed) ? (
      <pre className="ai-log-text-response">{rawOutput}</pre>
    ) : (
      <dl className="ai-log-response-fields">
        {Object.entries(parsed).map(([key, value]) => (
          <div key={key}>
            <dt>{responseLabel(key)}</dt>
            <dd>{renderReadableValue(value)}</dd>
          </div>
        ))}
      </dl>
    );

  // Długa odpowiedź startuje zwinięta; surowego JSON-a obok czytelnego widoku
  // świadomie nie dublujemy — to była właśnie ta ściana tekstu.
  return long ? (
    <details className="ai-log-collapsible">
      <summary>{t("ai.log.responseToggle", { chars: rawOutput.length })}</summary>
      {body}
    </details>
  ) : (
    body
  );
}

/**
 * Sugestie burzy mózgów z możliwością cofnięcia decyzji. Czytamy je z wiadomości
 * sesji, a nie z rawOutput: identyfikatory sugestii powstają dopiero przy zapisie
 * wiadomości, a część propozycji odsiewa dedup — w surowej odpowiedzi nie ma więc
 * niczego, czym dałoby się zaadresować pojedynczą sugestię.
 */
function BrainstormLogSuggestions({ entry }: { entry: AiLogEntry }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const setActiveSessionId = useBrainstormSessionStore((state) => state.setActiveSessionId);
  // targetEntityId niosą też inne pakiety promptów (sceny, rozdziały), więc id
  // sesji czytamy dopiero po sprawdzeniu akcji — inaczej odpytywalibyśmy bazę
  // o wiadomości dla identyfikatorów, które sesjami nie są.
  const sessionId = entry.action === "brainstorm_chat" ? brainstormSessionIdOf(entry) : null;

  // Ten sam klucz co widok brainstormu i panel propozycji — wpisy jednej sesji
  // dzielą jedno zapytanie, a przywrócenie odświeża wszystkie naraz.
  const messagesQuery = useQuery({
    queryKey: ["brainstorm-messages", sessionId],
    queryFn: () => listBrainstormMessages(sessionId ?? ""),
    enabled: Boolean(sessionId),
    retry: 0
  });

  const message = messagesQuery.data?.find((item) => item.aiRunId === entry.id) ?? null;
  const suggestions = message ? parseBrainstormSuggestions(message) : [];

  const restoreMutation = useMutation({
    mutationFn: async ({
      message: target,
      suggestionId
    }: {
      message: BrainstormMessage;
      suggestionId: string;
    }) => {
      const next = parseBrainstormSuggestions(target).map((suggestion) =>
        suggestion.id === suggestionId
          ? { ...suggestion, status: "pending" as const }
          : suggestion
      );
      await updateBrainstormMessageSuggestions(target.id, JSON.stringify(next));
      return target.sessionId;
    },
    onSuccess: async (restoredSessionId) => {
      // Panel propozycji w prawym sidebarze renderuje sugestie aktywnej sesji, a
      // wyjście z widoku brainstormu ją czyści. Bez tego przywrócona sugestia
      // byłaby niewidoczna aż do powrotu na widok brainstormu.
      setActiveSessionId(restoredSessionId);
      await queryClient.invalidateQueries({
        queryKey: ["brainstorm-messages", restoredSessionId]
      });
      toast.success(t("ai.log.suggestionRestored"));
    },
    onError: () => {
      toast.error(t("ai.log.suggestionRestoreError"));
    }
  });

  if (!sessionId) {
    return null;
  }

  if (messagesQuery.isLoading) {
    return null;
  }

  if (!message) {
    return (
      <p className="muted-text ai-log-suggestions-empty">{t("ai.log.sessionMissing")}</p>
    );
  }

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className="ai-log-suggestions">
      <h4>{t("ai.log.suggestionsHeading")}</h4>
      {suggestions.map((suggestion) => {
        const isPending = suggestion.status === "pending";
        const restoring =
          restoreMutation.isPending &&
          restoreMutation.variables?.suggestionId === suggestion.id;

        return (
          <article className="ai-log-suggestion-card" key={suggestion.id}>
            <div className="ai-log-suggestion-head">
              <span className="scene-discovery-kind">{suggestionKindLabel(suggestion, t)}</span>
              <StatusPill tone={suggestionStatusTone(suggestion.status)}>
                {suggestionStatusLabel(suggestion.status)}
              </StatusPill>
            </div>
            <h5>{suggestion.title}</h5>
            <p>{suggestion.value}</p>
            {suggestion.reason ? <small>{suggestion.reason}</small> : null}
            <Button
              variant="secondary"
              size="sm"
              busy={restoring}
              disabled={isPending || restoreMutation.isPending}
              title={
                isPending ? t("ai.log.alreadyInPanel") : t("ai.log.restoreSuggestionTitle")
              }
              onClick={(event) => {
                event.stopPropagation();
                restoreMutation.mutate({ message, suggestionId: suggestion.id });
              }}
            >
              {restoring ? null : <Undo2 size={14} aria-hidden />}
              {isPending ? t("ai.log.alreadyInPanel") : t("ai.log.restoreSuggestion")}
            </Button>
          </article>
        );
      })}
    </div>
  );
}

/** Pakiet promptu brainstormu niesie id sesji jako encję docelową. */
function brainstormSessionIdOf(entry: AiLogEntry): string | null {
  const promptPackage = entry.promptPackageJson;
  if (!promptPackage || typeof promptPackage !== "object" || !("context" in promptPackage)) {
    return null;
  }

  const context = promptPackage.context;
  if (
    !context ||
    typeof context !== "object" ||
    !("targetEntityId" in context) ||
    typeof context.targetEntityId !== "string"
  ) {
    return null;
  }

  return context.targetEntityId || null;
}

function suggestionStatusLabel(status: BrainstormSuggestion["status"]): string {
  if (status === "applied") {
    return i18n.t("ai.log.suggestionApplied");
  }

  if (status === "dismissed") {
    return i18n.t("ai.log.suggestionDismissed");
  }

  return i18n.t("ai.log.suggestionPending");
}

function suggestionStatusTone(
  status: BrainstormSuggestion["status"]
): "success" | "danger" | "muted" {
  if (status === "applied") {
    return "success";
  }

  if (status === "dismissed") {
    return "danger";
  }

  return "muted";
}

function applyErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || "");
  return message || i18n.t("ai.log.applyError");
}

function generationStatusLabel(status: string): string {
  const keys: Record<string, string> = {
    queued: "ai.generationStatus.queued",
    running: "ai.generationStatus.running",
    success: "ai.generationStatus.success",
    error: "ai.generationStatus.error",
    timeout: "ai.generationStatus.timeout",
    cancelled: "ai.generationStatus.cancelled",
    terminated: "ai.generationStatus.terminated"
  };

  return keys[status] ? i18n.t(keys[status]) : status;
}

function generationStatusTone(status: string): "success" | "danger" | "muted" {
  if (status === "success") {
    return "success";
  }

  if (status === "error" || status === "timeout" || status === "terminated") {
    return "danger";
  }

  return "muted";
}

function decisionStatusTone(status?: string | null): "success" | "danger" | "muted" {
  if (status === "accepted") {
    return "success";
  }

  if (status === "rejected") {
    return "danger";
  }

  return "muted";
}

function decisionStatusLabel(status?: string | null): string {
  if (status === "accepted") {
    return i18n.t("ai.decisionStatus.accepted");
  }

  if (status === "rejected") {
    return i18n.t("ai.decisionStatus.rejected");
  }

  return i18n.t("ai.decisionStatus.pending");
}

function requestSummary(entry: AiLogEntry): {
  title: string;
  actionLabel: string;
  fieldLabel: string;
  mode: string;
} {
  const promptPackage = entry.promptPackageJson;
  if (!promptPackage || typeof promptPackage !== "object") {
    const actionLabel = actionLabelFor(entry.action);
    return { title: actionLabel, actionLabel, fieldLabel: "", mode: "" };
  }

  const context = "context" in promptPackage ? promptPackage.context : undefined;
  const targetField =
    context && typeof context === "object" && "targetField" in context
      ? String(context.targetField)
      : "";
  const mode =
    context && typeof context === "object" && "generationMode" in context
      ? String(context.generationMode)
      : "";
  const fieldLabel = targetFieldLabel(targetField);
  const actionLabel = fieldLabel || actionLabelFor(entry.action);

  return {
    title: actionLabel,
    actionLabel,
    fieldLabel,
    mode
  };
}

function parseResponse(rawOutput: string): unknown {
  const candidate = extractJsonCandidate(rawOutput);
  if (!candidate) {
    return null;
  }

  try {
    return JSON.parse(candidate) as unknown;
  } catch {
    return null;
  }
}

/**
 * Rekurencyjny podgląd odpowiedzi. Ograniczenia głębokości i liczby elementów
 * są tu po to, żeby raport audytu nie rozwijał się w kilkumetrową ścianę
 * zagnieżdżonych list — reszta danych chowa się w zwiniętym bloku.
 */
function renderReadableValue(value: unknown, depth = 0): ReactNode {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="muted-text">{i18n.t("ai.log.noneValue")}</span>;
    }

    const list = (
      <ul>
        {value.map((item, index) => (
          <li key={index}>{renderReadableValue(item, depth + 1)}</li>
        ))}
      </ul>
    );

    return value.length > MAX_INLINE_ITEMS ? (
      <details className="ai-log-collapsible">
        <summary>{i18n.t("ai.log.moreItems", { count: value.length })}</summary>
        {list}
      </details>
    ) : (
      list
    );
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value);
    if (depth >= MAX_DEPTH) {
      return (
        <details className="ai-log-collapsible">
          <summary>{i18n.t("ai.log.moreFields", { count: entries.length })}</summary>
          <pre className="ai-log-text-response">{JSON.stringify(value, null, 2)}</pre>
        </details>
      );
    }

    const fields = (
      <dl className="ai-log-nested-fields">
        {entries.map(([key, nestedValue]) => (
          <div key={key}>
            <dt>{responseLabel(key)}</dt>
            <dd>{renderReadableValue(nestedValue, depth + 1)}</dd>
          </div>
        ))}
      </dl>
    );

    return entries.length > MAX_INLINE_KEYS ? (
      <details className="ai-log-collapsible">
        <summary>{i18n.t("ai.log.moreFields", { count: entries.length })}</summary>
        {fields}
      </details>
    ) : (
      fields
    );
  }

  if (typeof value === "boolean") {
    return value ? i18n.t("ai.log.yes") : i18n.t("ai.log.no");
  }

  if (value === null || value === undefined || value === "") {
    return <span className="muted-text">{i18n.t("ai.log.noneValue")}</span>;
  }

  return String(value);
}

/** Etykiety trzymamy wyłącznie w ai.json — nowy klucz nie wymaga zmiany kodu. */
function responseLabel(key: string): string {
  return i18n.exists(`ai.responseLabel.${key}`) ? i18n.t(`ai.responseLabel.${key}`) : key;
}

function reasoningLabel(reasoningEffort?: string | null): string {
  const keys = ["low", "medium", "high", "xhigh"];
  const normalized = reasoningEffort?.trim();

  if (!normalized) {
    return i18n.t("ai.reasoning.notSaved");
  }

  return keys.includes(normalized) ? i18n.t(`ai.reasoning.${normalized}`) : normalized;
}

function isConceptFieldKey(value: string): value is ConceptFieldKey {
  return value in conceptFieldConfigs;
}

function isPlanFieldKey(value: string): value is PlanFieldKey {
  return value in planFieldConfigs;
}

function targetFieldLabel(targetField: string): string {
  const overrides: Record<string, string> = {
    characterProfile: "characterProfile",
    characterRelation: "characterRelation",
    characterMemory: "characterMemory",
    characterImage: "characterImage",
    worldElement: "worldElement",
    worldRule: "worldRule",
    worldRuleAnalysis: "worldRuleAnalysis",
    draftScene: "draftScene",
    continueScene: "continueScene",
    rewriteSelection: "rewriteSelection",
    expandSelection: "expandSelection",
    [SCENE_STORY_BIBLE_AUDIT_FIELD]: "sceneAudit"
  };
  if (overrides[targetField]) {
    return i18n.t(`ai.targetField.${overrides[targetField]}`);
  }

  if (isConceptFieldKey(targetField)) return conceptFieldConfigs[targetField].label;
  if (isPlanFieldKey(targetField)) return planFieldConfigs[targetField].label;
  if (isCharacterFieldKey(targetField)) return characterFieldConfigs[targetField].label;
  if (isWorldFieldKey(targetField)) return worldFieldConfigs[targetField].label;
  if (isSceneEditorFieldKey(targetField)) return sceneEditorFieldLabel(targetField);
  return "";
}

function isCharacterFieldKey(value: string): value is CharacterFieldKey {
  return value in characterFieldConfigs;
}

function isWorldFieldKey(value: string): value is WorldFieldKey {
  return value in worldFieldConfigs;
}

function isSceneEditorFieldKey(value: string): value is SceneEditorFieldKey {
  return ["draftScene", "continueScene", "rewriteSelection", "expandSelection"].includes(value);
}

const ACTION_LABEL_KEYS = new Set([
  "generate_working_title",
  "generate_title",
  "generate_premise",
  "generate_protagonist_summary",
  "generate_protagonist_goal",
  "expand_premise",
  "generate_logline",
  "generate_expanded_premise",
  "generate_central_conflict",
  "generate_antagonist_force",
  "generate_stakes",
  "generate_setting_sketch",
  "generate_ending_direction",
  "suggest_genre",
  "suggest_subgenre",
  "suggest_target_audience",
  "suggest_tone",
  "suggest_point_of_view",
  "suggest_target_word_count",
  "suggest_themes",
  "suggest_unwanted_themes",
  "generate_alternative_titles",
  "generate_style_guide",
  "generate_cover_image",
  "suggest_story_structure",
  "generate_acts",
  "generate_act_field",
  "generate_beat_sheet",
  "generate_beat_field",
  "generate_plot_threads",
  "generate_chapter_plan",
  "generate_chapter_field",
  "generate_scene_field",
  "generate_thread_chapter_field",
  "suggest_chapter_relations",
  "find_plan_gaps",
  "generate_character_field",
  "generate_character_relation_field",
  "generate_character_memory_field",
  "generate_character_image",
  "generate_world_element_field",
  "generate_world_rule_field",
  "generate_world_rule_analysis",
  "draft_scene",
  "continue_scene",
  "rewrite_selection",
  "expand_selection",
  "analyze_scene_story_bible_opportunities"
]);

function actionLabelFor(action: string): string {
  return ACTION_LABEL_KEYS.has(action) ? i18n.t(`ai.action.${action}`) : action;
}
