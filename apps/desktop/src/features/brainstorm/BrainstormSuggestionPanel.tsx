import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { Button, Modal, toast } from "../../shared/ui";
import {
  getBookPlan,
  getCharacterWorkspace,
  getProject,
  getWorldWorkspace,
  listBrainstormMessages,
  updateBookConcept,
  updateBrainstormMessageSuggestions
} from "../../shared/api/commands";
import type {
  BrainstormMessage,
  BrainstormSuggestion,
  BrainstormSuggestionStatus
} from "../../shared/api/types";
import {
  isBrainstormConceptField,
  parseBrainstormSuggestions
} from "../ai/brainstormPromptPackage";
import { useBrainstormSessionStore } from "./brainstormSessionStore";
import { useProposalStore, type EnqueueProposalResult } from "../ai/proposalStore";
import {
  characterDraftFromDiscovery,
  plotThreadDraftFromSuggestion,
  worldElementDraftFromDiscovery,
  worldRuleDraftFromDiscovery
} from "../ai/discoveryDrafts";
import type { SceneDiscovery } from "../ai/sceneDiscoveryStore";
import {
  buildCharacterPromptPackage,
  renderCharacterPromptPackage
} from "../ai/characterPromptPackage";
import { buildWorldPromptPackage, renderWorldPromptPackage } from "../ai/worldPromptPackage";
import { buildPlanPromptPackage, renderPlanPromptPackage } from "../ai/planPromptPackage";
import { conceptFieldConfigs } from "../ai/promptPackage";

export type PendingBrainstormSuggestion = BrainstormSuggestion & { messageId: string };

/**
 * Nierozstrzygnięte sugestie aktywnej sesji brainstormingu. Współdzieli klucz
 * React Query z BrainstormPage, więc nie generuje dodatkowego zapytania.
 * Zwraca [], gdy nie jesteśmy na widoku brainstormingu (activeSessionId = null).
 */
export function usePendingBrainstormSuggestions(): PendingBrainstormSuggestion[] {
  const sessionId = useBrainstormSessionStore((state) => state.activeSessionId);
  const messagesQuery = useQuery({
    queryKey: ["brainstorm-messages", sessionId],
    queryFn: () => listBrainstormMessages(sessionId ?? ""),
    enabled: Boolean(sessionId),
    retry: 0
  });

  return useMemo(
    () =>
      (messagesQuery.data ?? [])
        .flatMap((message) =>
          parseBrainstormSuggestions(message).map((suggestion) => ({
            ...suggestion,
            messageId: message.id
          }))
        )
        .filter((suggestion) => suggestion.status === "pending")
        .reverse(),
    [messagesQuery.data]
  );
}

export function BrainstormSuggestionPanel({
  projectId,
  suggestions
}: {
  projectId: string;
  suggestions: PendingBrainstormSuggestion[];
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const sessionId = useBrainstormSessionStore((state) => state.activeSessionId);
  const enqueueProposal = useProposalStore((state) => state.enqueueProposal);
  const [conceptPreview, setConceptPreview] = useState<PendingBrainstormSuggestion | null>(null);

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

  const contextReady = Boolean(
    projectQuery.data && planQuery.data && characterQuery.data && worldQuery.data
  );

  if (suggestions.length === 0) {
    return null;
  }

  async function setSuggestionStatus(
    messageId: string,
    suggestionId: string,
    status: BrainstormSuggestionStatus
  ) {
    if (!sessionId) {
      return;
    }
    const messages = queryClient.getQueryData<BrainstormMessage[]>([
      "brainstorm-messages",
      sessionId
    ]);
    const message = messages?.find((item) => item.id === messageId);
    if (!message) {
      return;
    }
    const next = parseBrainstormSuggestions(message).map((suggestion) =>
      suggestion.id === suggestionId ? { ...suggestion, status } : suggestion
    );
    await updateBrainstormMessageSuggestions(messageId, JSON.stringify(next));
    await queryClient.invalidateQueries({ queryKey: ["brainstorm-messages", sessionId] });
  }

  async function applyConceptSuggestion(mode: "replace" | "append") {
    const suggestion = conceptPreview;
    const book = projectQuery.data?.book;
    if (!suggestion || !book || !isBrainstormConceptField(suggestion.conceptField)) {
      return;
    }
    const currentValue = (book[suggestion.conceptField] ?? "").trim();
    const nextValue =
      mode === "append" && currentValue
        ? `${currentValue}\n\n${suggestion.value}`
        : suggestion.value;
    await updateBookConcept(book.id, { [suggestion.conceptField]: nextValue });
    await queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    await setSuggestionStatus(suggestion.messageId, suggestion.id, "applied");
    setConceptPreview(null);
  }

  function queueEntitySuggestion(suggestion: PendingBrainstormSuggestion) {
    const project = projectQuery.data?.project;
    const book = projectQuery.data?.book;
    const plan = planQuery.data;
    const characters = characterQuery.data;
    const world = worldQuery.data;
    if (!project || !book || !plan || !characters || !world) {
      return;
    }

    // Draft buildery odkryć oczekują SceneDiscovery — brainstorming nie ma
    // sceny, więc sceneId zostaje pusty, a treść sugestii wchodzi jako evidence.
    const discoveryFor = (kind: SceneDiscovery["kind"]): SceneDiscovery => ({
      id: suggestion.id,
      projectId,
      bookId: book.id,
      sceneId: "",
      kind,
      title: suggestion.title,
      reason: suggestion.reason,
      evidence: suggestion.value,
      createdAt: new Date().toISOString()
    });

    let result: EnqueueProposalResult;
    if (suggestion.kind === "character") {
      const promptPackage = buildCharacterPromptPackage(
        project,
        book,
        characters,
        "characterProfile",
        characterDraftFromDiscovery(discoveryFor("character"))
      );
      result = enqueueProposal({
        scope: "characters",
        projectId,
        bookId: book.id,
        field: "characterProfile",
        action: promptPackage.action,
        promptPackageId: promptPackage.id,
        promptPackageJson: promptPackage,
        prompt: renderCharacterPromptPackage(promptPackage)
      });
    } else if (suggestion.kind === "worldElement" || suggestion.kind === "worldRule") {
      const promptPackage = buildWorldPromptPackage(
        project,
        book,
        plan,
        characters,
        world,
        suggestion.kind,
        suggestion.kind === "worldElement"
          ? worldElementDraftFromDiscovery(discoveryFor("worldElement"))
          : worldRuleDraftFromDiscovery(discoveryFor("worldRule"))
      );
      result = enqueueProposal({
        scope: "world",
        projectId,
        bookId: book.id,
        field: suggestion.kind,
        action: promptPackage.action,
        promptPackageId: promptPackage.id,
        promptPackageJson: promptPackage,
        prompt: renderWorldPromptPackage(promptPackage)
      });
    } else if (suggestion.kind === "plotThread") {
      // Szkic wątku niesie unikalne id sugestii jako cel propozycji. Bez niego
      // wszystkie wątki z jednej sesji mają identyczny klucz dedupu w
      // proposalStore i tylko pierwszy trafiał do kolejki.
      const promptPackage = buildPlanPromptPackage(
        project,
        book,
        plan,
        "plotThreads",
        plotThreadDraftFromSuggestion(suggestion, book.id)
      );
      promptPackage.userInstruction = `Zaproponuj dokładnie jeden wątek fabularny o roboczej nazwie "${suggestion.title}". Uzasadnienie z burzy mózgów: ${suggestion.reason} Proponowana treść: ${suggestion.value} Nie generuj struktury, aktów, beatów ani rozdziałów.`;
      result = enqueueProposal({
        scope: "bookPlan",
        projectId,
        bookId: book.id,
        field: "plotThreads",
        action: promptPackage.action,
        promptPackageId: promptPackage.id,
        promptPackageJson: promptPackage,
        prompt: renderPlanPromptPackage(promptPackage)
      });
    } else {
      return;
    }

    // Sugestię zużywamy tylko wtedy, gdy faktycznie coś dołożyliśmy do kolejki —
    // inaczej zniknęłaby z panelu, mimo że nic nie wystartowało.
    if (result.created) {
      void setSuggestionStatus(suggestion.messageId, suggestion.id, "applied");
    } else {
      toast.info(t("brainstorm.alreadyQueued"));
    }
  }

  const conceptPreviewField =
    conceptPreview && isBrainstormConceptField(conceptPreview.conceptField)
      ? conceptPreview.conceptField
      : null;
  const conceptCurrentValue =
    conceptPreviewField && projectQuery.data
      ? (projectQuery.data.book[conceptPreviewField] ?? "").trim()
      : "";

  return (
    <div className="scene-discovery-list" aria-label={t("brainstorm.suggestionsAriaLabel")}>
      <div className="scene-discovery-heading">
        <p className="eyebrow">{t("brainstorm.suggestionsHeading")}</p>
        <span className="status-pill">{suggestions.length}</span>
      </div>
      {suggestions.map((suggestion) => (
        <article className="scene-discovery-card" key={suggestion.id}>
          <div>
            <span className="scene-discovery-kind">{suggestionKindLabel(suggestion, t)}</span>
            <h3>{suggestion.title}</h3>
            <p>{suggestion.value}</p>
            <small>{suggestion.reason}</small>
          </div>
          <div className="scene-discovery-actions">
            {suggestion.kind === "conceptField" ? (
              <Button variant="ai" size="sm" onClick={() => setConceptPreview(suggestion)}>
                <Sparkles size={14} aria-hidden />
                {t("brainstorm.apply")}
              </Button>
            ) : (
              <Button
                variant="ai"
                size="sm"
                disabled={!contextReady}
                title={t("brainstorm.generateTitle")}
                onClick={() => queueEntitySuggestion(suggestion)}
              >
                <Sparkles size={14} aria-hidden />
                {t("brainstorm.generate")}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                void setSuggestionStatus(suggestion.messageId, suggestion.id, "dismissed")
              }
            >
              {t("brainstorm.dismiss")}
            </Button>
          </div>
        </article>
      ))}

      {conceptPreview && conceptPreviewField ? (
        <Modal
          title={t("brainstorm.conceptFieldModalTitle", {
            label: conceptFieldConfigs[conceptPreviewField].label
          })}
          size="lg"
          onClose={() => setConceptPreview(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConceptPreview(null)}>
                {t("brainstorm.cancel")}
              </Button>
              <Button
                variant="ghost"
                onClick={() =>
                  void setSuggestionStatus(
                    conceptPreview.messageId,
                    conceptPreview.id,
                    "dismissed"
                  ).then(() => setConceptPreview(null))
                }
              >
                {t("brainstorm.dismiss")}
              </Button>
              {conceptCurrentValue ? (
                <Button variant="secondary" onClick={() => void applyConceptSuggestion("append")}>
                  {t("brainstorm.append")}
                </Button>
              ) : null}
              <Button variant="primary" onClick={() => void applyConceptSuggestion("replace")}>
                {conceptCurrentValue ? t("brainstorm.replace") : t("brainstorm.insert")}
              </Button>
            </>
          }
        >
          <div className="brainstorm-concept-preview">
            <section>
              <p className="eyebrow">{t("brainstorm.currentContent")}</p>
              <p className="brainstorm-concept-value">
                {conceptCurrentValue || t("brainstorm.emptyFieldPlaceholder")}
              </p>
            </section>
            <section>
              <p className="eyebrow">{t("brainstorm.proposalFromBrainstorm")}</p>
              <p className="brainstorm-concept-value">{conceptPreview.value}</p>
              <small className="muted-text">{conceptPreview.reason}</small>
            </section>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

export function suggestionKindLabel(
  suggestion: BrainstormSuggestion,
  t: (key: string, options?: Record<string, unknown>) => string
): string {
  if (suggestion.kind === "conceptField") {
    return isBrainstormConceptField(suggestion.conceptField)
      ? t("brainstorm.kindConceptWithField", {
          label: conceptFieldConfigs[suggestion.conceptField].label
        })
      : t("brainstorm.kindConcept");
  }
  if (suggestion.kind === "character") return t("brainstorm.kindCharacter");
  if (suggestion.kind === "worldElement") return t("brainstorm.kindWorldElement");
  if (suggestion.kind === "worldRule") return t("brainstorm.kindWorldRule");
  return t("brainstorm.kindPlotThread");
}
