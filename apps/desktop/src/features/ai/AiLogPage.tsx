import { Check, FileJson, History, Loader2 } from "lucide-react";
import { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import i18n from "../../shared/i18n";
import { Button, Chip, StatusPill } from "../../shared/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getAiSettings,
  listAiRuns,
  markAiProposalAccepted
} from "../../shared/api/commands";
import type { AiLogEntry } from "../../shared/api/types";
import { costOf, formatCostLabel, imageCostOf } from "./pricing";
import { formatLocalDateTime } from "../../shared/date";
import { applyAiProposal } from "./AiProposalPanel";
import { conceptFieldConfigs, ConceptFieldKey } from "./promptPackage";
import { planFieldConfigs, PlanFieldKey } from "./planPromptPackage";
import { characterFieldConfigs, CharacterFieldKey } from "./characterPromptPackage";
import { worldFieldConfigs, WorldFieldKey } from "./worldPromptPackage";
import { sceneEditorFieldLabel, SceneEditorFieldKey } from "./sceneEditorPromptPackage";
import { SCENE_STORY_BIBLE_AUDIT_FIELD } from "./sceneStoryBibleAuditPromptPackage";
import { extractJsonCandidate } from "./titleSuggestions";
import { useProposalStore, type ActiveAiProposal } from "./proposalStore";

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
  const clearProposal = useProposalStore((state) => state.clearProposal);
  const applyMutation = useMutation({
    mutationFn: async (proposal: ActiveAiProposal) => {
      await applyAiProposal(proposal);
      await markAiProposalAccepted(proposal.id);
    },
    onSuccess: async (_payload, proposal) => {
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
            applying={applyMutation.isPending && applyMutation.variables?.aiRunId === entry.id}
            applyErrorMessage={
              applyMutation.isError && applyMutation.variables?.aiRunId === entry.id
                ? applyErrorMessage(applyMutation.error)
                : ""
            }
            onApply={(proposal) => applyMutation.mutate(proposal)}
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
  applying,
  applyErrorMessage,
  onApply
}: {
  entry: AiLogEntry;
  applying: boolean;
  applyErrorMessage: string;
  onApply: (proposal: ActiveAiProposal) => void;
}) {
  const { t } = useTranslation();
  const aiSettingsQuery = useQuery({
    queryKey: ["ai-settings"],
    queryFn: getAiSettings
  });
  const plnPerUsd = aiSettingsQuery.data?.plnPerUsd ?? 4;
  const totalTokens = entry.inputTokens + entry.outputTokens;
  const summary = requestSummary(entry);
  const proposal = proposalFromLogEntry(entry);
  const canApply =
    entry.status === "success" &&
    entry.decisionStatus !== "accepted" &&
    Boolean(proposal);

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
          <div className="ai-log-prompt">
            <h4>{t("ai.log.prompt")}</h4>
            <pre>{entry.prompt || t("ai.log.promptEmpty")}</pre>
          </div>
        </section>

        <section className="ai-log-readable-block">
          <h3>{t("ai.log.response")}</h3>
          {entry.errorMessage ? (
            <p className="warning-text">{entry.errorMessage}</p>
          ) : null}
          <ReadableResponse rawOutput={entry.rawOutput} />
          {canApply && proposal ? (
            <Button
              variant="primary"
              busy={applying}
              onClick={(event) => {
                event.stopPropagation();
                onApply(proposal);
              }}
            >
              {applying ? null : <Check size={15} />}
              {applying ? t("ai.log.applying") : t("ai.log.apply")}
            </Button>
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

function ReadableResponse({ rawOutput }: { rawOutput?: string | null }) {
  const { t } = useTranslation();
  if (!rawOutput?.trim()) {
    return <p className="muted-text">{t("ai.log.responseEmpty")}</p>;
  }

  const parsed = parseResponse(rawOutput);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return <pre className="ai-log-text-response">{rawOutput}</pre>;
  }

  return (
    <dl className="ai-log-response-fields">
      {Object.entries(parsed).map(([key, value]) => (
        <div key={key}>
          <dt>{responseLabel(key)}</dt>
          <dd>{renderReadableValue(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function applyErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || "");
  return message || i18n.t("ai.log.applyError");
}

function proposalFromLogEntry(entry: AiLogEntry): ActiveAiProposal | null {
  if (!entry.proposalSnapshot || typeof entry.proposalSnapshot !== "object") {
    return null;
  }

  const proposal = entry.proposalSnapshot as ActiveAiProposal;
  if (
    !proposal.id ||
    !proposal.projectId ||
    !proposal.bookId ||
    !proposal.field ||
    !proposal.action ||
    !proposal.promptPackageId ||
    !proposal.promptPackageJson ||
    !proposal.prompt
  ) {
    return null;
  }

  return {
    ...proposal,
    aiRunId: entry.id,
    rawOutput: proposal.rawOutput || entry.rawOutput || "",
    status: "success"
  };
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

function renderReadableValue(value: unknown): ReactNode {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="muted-text">{i18n.t("ai.log.noneValue")}</span>;
    }

    return (
      <ul>
        {value.map((item, index) => (
          <li key={`${String(item)}-${index}`}>{renderReadableValue(item)}</li>
        ))}
      </ul>
    );
  }

  if (value && typeof value === "object") {
    return (
      <dl className="ai-log-nested-fields">
        {Object.entries(value).map(([key, nestedValue]) => (
          <div key={key}>
            <dt>{responseLabel(key)}</dt>
            <dd>{renderReadableValue(nestedValue)}</dd>
          </div>
        ))}
      </dl>
    );
  }

  if (typeof value === "boolean") {
    return value ? i18n.t("ai.log.yes") : i18n.t("ai.log.no");
  }

  if (value === null || value === undefined || value === "") {
    return <span className="muted-text">Brak</span>;
  }

  return String(value);
}

function responseLabel(key: string): string {
  const keys = [
    "version",
    "kind",
    "field",
    "summary",
    "value",
    "values",
    "rationale",
    "warnings",
    "imagePath",
    "risks",
    "questionsForAuthor"
  ];

  return keys.includes(key) ? i18n.t(`ai.responseLabel.${key}`) : key;
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
