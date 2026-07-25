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
  BrainstormSuggestionStatus,
  Character,
  PlotThread,
  WorldElement,
  WorldRule
} from "../../shared/api/types";
import {
  BRAINSTORM_ENTITY_FIELDS,
  isBrainstormEntityKind,
  type BrainstormEntityKind
} from "../ai/brainstormEntityTargets";
import { stringField } from "../ai/entityFieldUpdate";
import {
  BrainstormEntityUpdateModal,
  type EntityUpdateCandidate
} from "./BrainstormEntityUpdateModal";
import {
  collectSessionSuggestions,
  isBrainstormConceptField,
  parseBrainstormSuggestions,
  type SessionSuggestion
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

export type PendingBrainstormSuggestion = SessionSuggestion;

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
      collectSessionSuggestions(messagesQuery.data ?? [])
        .filter((suggestion) => suggestion.status === "pending")
        // Świeżo wzbogacona sugestia sprzed kilku tur ma być na górze razem z
        // nowościami — stąd sort po dacie rewizji, a nie zwykłe odwrócenie listy.
        .sort((a, b) =>
          (b.updatedByAiAt ?? b.messageCreatedAt).localeCompare(
            a.updatedByAiAt ?? a.messageCreatedAt
          )
        ),
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
  const isTurnInFlight = useBrainstormSessionStore((state) => state.isTurnInFlight);
  const [conceptPreview, setConceptPreview] = useState<PendingBrainstormSuggestion | null>(null);
  const [entityUpdate, setEntityUpdate] = useState<PendingBrainstormSuggestion | null>(null);

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

  /** Kandydaci do aktualizacji wraz z bieżącą treścią pól z whitelisty. */
  function entityCandidates(kind: BrainstormEntityKind): EntityUpdateCandidate[] {
    const entities: Array<Character | WorldElement | WorldRule | PlotThread> =
      kind === "character"
        ? (characterQuery.data?.characters ?? [])
        : kind === "worldElement"
          ? (worldQuery.data?.elements ?? [])
          : kind === "worldRule"
            ? (worldQuery.data?.rules ?? [])
            : (planQuery.data?.threads ?? []);

    return entities.map((entity) => ({
      id: entity.id,
      name: entity.name,
      fields: Object.fromEntries(
        BRAINSTORM_ENTITY_FIELDS[kind].map((target) => [
          target.key,
          stringField(entity, target.key)
        ])
      )
    }));
  }

  async function refreshAfterEntityUpdate(kind: BrainstormEntityKind) {
    if (kind === "character") {
      await queryClient.invalidateQueries({ queryKey: ["character-workspace", projectId] });
    } else if (kind === "worldElement" || kind === "worldRule") {
      await queryClient.invalidateQueries({ queryKey: ["world-workspace", projectId] });
    } else {
      await queryClient.invalidateQueries({ queryKey: ["book-plan", bookId] });
    }
    // Zapis encji dotyka też projektu (updated_at, liczniki w nagłówku).
    await queryClient.invalidateQueries({ queryKey: ["project", projectId] });
  }

  const entityUpdateKind =
    entityUpdate && isBrainstormEntityKind(entityUpdate.kind) ? entityUpdate.kind : null;

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
            {suggestion.revision > 1 ? (
              <span
                className="brainstorm-revision-pill"
                title={t("brainstorm.revisedTitle", { revision: suggestion.revision })}
              >
                {t("brainstorm.revisedBadge", { revision: suggestion.revision })}
              </span>
            ) : null}
            <h3>{suggestion.title}</h3>
            <p>{suggestion.value}</p>
            <small>{suggestion.reason}</small>
          </div>
          <div className="scene-discovery-actions">
            {suggestion.kind === "conceptField" ? (
              <Button
                variant="ai"
                size="sm"
                disabled={isTurnInFlight}
                title={isTurnInFlight ? t("brainstorm.turnInFlight") : undefined}
                onClick={() => setConceptPreview(suggestion)}
              >
                <Sparkles size={14} aria-hidden />
                {t("brainstorm.apply")}
              </Button>
            ) : suggestion.mode === "update" ? (
              // Aktualizacja istniejącej encji zapisuje się od razu — bez
              // kolejki propozycji i bez kolejnego wywołania modelu.
              <Button
                variant="ai"
                size="sm"
                disabled={!contextReady || isTurnInFlight}
                title={
                  isTurnInFlight ? t("brainstorm.turnInFlight") : t("brainstorm.updateEntityTitle")
                }
                onClick={() => setEntityUpdate(suggestion)}
              >
                <Sparkles size={14} aria-hidden />
                {t("brainstorm.updateEntity")}
              </Button>
            ) : (
              <Button
                variant="ai"
                size="sm"
                disabled={!contextReady || isTurnInFlight}
                title={isTurnInFlight ? t("brainstorm.turnInFlight") : t("brainstorm.generateTitle")}
                onClick={() => queueEntitySuggestion(suggestion)}
              >
                <Sparkles size={14} aria-hidden />
                {t("brainstorm.generate")}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              disabled={isTurnInFlight}
              title={isTurnInFlight ? t("brainstorm.turnInFlight") : undefined}
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

      {entityUpdate && entityUpdateKind && bookId ? (
        <BrainstormEntityUpdateModal
          projectId={projectId}
          bookId={bookId}
          kind={entityUpdateKind}
          suggestion={entityUpdate}
          candidates={entityCandidates(entityUpdateKind)}
          onClose={() => setEntityUpdate(null)}
          onDismiss={() =>
            void setSuggestionStatus(entityUpdate.messageId, entityUpdate.id, "dismissed").then(() =>
              setEntityUpdate(null)
            )
          }
          onApplied={async () => {
            await refreshAfterEntityUpdate(entityUpdateKind);
            await setSuggestionStatus(entityUpdate.messageId, entityUpdate.id, "applied");
            setEntityUpdate(null);
          }}
        />
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
  const base =
    suggestion.kind === "character"
      ? t("brainstorm.kindCharacter")
      : suggestion.kind === "worldElement"
        ? t("brainstorm.kindWorldElement")
        : suggestion.kind === "worldRule"
          ? t("brainstorm.kindWorldRule")
          : t("brainstorm.kindPlotThread");
  // Log AI używa tej samej funkcji, więc rozróżnienie „nowy wpis vs uzupełnienie"
  // pojawia się także tam.
  return suggestion.mode === "update"
    ? `${base} · ${t("brainstorm.kindUpdateSuffix")}`
    : base;
}
