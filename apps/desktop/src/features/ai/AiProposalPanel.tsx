import { Check, FileJson, Loader2, RotateCcw, X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  generateNewProjectTitle,
  runCodexPrompt,
  updateBookConcept
} from "../../shared/api/commands";
import type { BookConceptInput } from "../../shared/api/types";
import { parseConceptFieldSuggestion } from "./conceptFieldSuggestion";
import { useCodexSettingsStore } from "./codexSettingsStore";
import { conceptFieldConfigs } from "./promptPackage";
import { ActiveAiProposal, useProposalStore } from "./proposalStore";

type AiProposalPanelProps = {
  projectId: string;
  onAcceptValue?: (value: string) => void | Promise<void>;
};

export function AiProposalPanel({
  projectId,
  onAcceptValue
}: AiProposalPanelProps) {
  const queryClient = useQueryClient();
  const proposal = useProposalStore((state) => state.activeProposal);
  const setEditableValue = useProposalStore((state) => state.setEditableValue);
  const clearProposal = useProposalStore((state) => state.clearProposal);
  const startProposal = useProposalStore((state) => state.startProposal);
  const finishProposal = useProposalStore((state) => state.finishProposal);
  const failProposal = useProposalStore((state) => state.failProposal);
  const codexPath = useCodexSettingsStore((state) => state.codexPath);
  const timeoutSeconds = useCodexSettingsStore((state) => state.timeoutSeconds);
  const model = useCodexSettingsStore((state) => state.model);
  const reasoningEffort = useCodexSettingsStore(
    (state) => state.reasoningEffort
  );

  const visibleProposal =
    proposal && proposal.projectId === projectId ? proposal : null;

  const acceptMutation = useMutation({
    mutationFn: async () => {
      if (!visibleProposal || visibleProposal.status !== "success") {
        return null;
      }

      const value = visibleProposal.editableValue.trim();
      if (visibleProposal.scope === "newProject") {
        if (!onAcceptValue) {
          throw new Error("Brak obslugi akceptacji propozycji nowego projektu.");
        }

        await onAcceptValue(value);
        return null;
      }

      return updateBookConcept(visibleProposal.bookId, proposalInputFromValue(value, visibleProposal));
    },
    onSuccess: async () => {
      clearProposal();
      if (visibleProposal?.scope !== "newProject") {
        await queryClient.invalidateQueries({ queryKey: ["project", projectId] });
        await queryClient.invalidateQueries({ queryKey: ["projects"] });
      }
    }
  });

  const retryMutation = useMutation({
    mutationFn: async () => {
      if (!visibleProposal) {
        return null;
      }

      const snapshot = {
        scope: visibleProposal.scope,
        projectId: visibleProposal.projectId,
        bookId: visibleProposal.bookId,
        field: visibleProposal.field,
        action: visibleProposal.action,
        promptPackageId: visibleProposal.promptPackageId,
        promptPackageJson: visibleProposal.promptPackageJson,
        prompt: visibleProposal.prompt
      };

      startProposal(snapshot);

      const result =
        snapshot.scope === "newProject"
          ? await generateNewProjectTitle({
              action: "generate_working_title",
              promptPackageId: snapshot.promptPackageId,
              promptPackageJson: snapshot.promptPackageJson,
              prompt: snapshot.prompt,
              codexPath,
              timeoutSeconds,
              model,
              reasoningEffort
            })
          : await runCodexPrompt({
              projectId: snapshot.projectId,
              action: snapshot.action,
              promptPackageId: snapshot.promptPackageId,
              promptPackageJson: snapshot.promptPackageJson,
              prompt: snapshot.prompt,
              codexPath,
              timeoutSeconds,
              model,
              reasoningEffort
            });

      if (result.status !== "success" || !result.rawOutput) {
        throw new RetryError(
          result.errorMessage || "Codex CLI nie zwrócił wyniku.",
          result.rawOutput ?? ""
        );
      }

      const parsed = parseConceptFieldSuggestion(
        result.rawOutput,
        snapshot.field
      );
      return { parsed, result };
    },
    onSuccess: (payload) => {
      if (!payload) {
        return;
      }

      finishProposal({
        aiRunId: payload.result.id,
        rawOutput: payload.result.rawOutput ?? "",
        parsed: payload.parsed,
        editableValue: payload.parsed.textValue,
        durationMs: payload.result.durationMs
      });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : String(error);
      const rawOutput = error instanceof RetryError ? error.rawOutput : "";
      failProposal(message, rawOutput);
    }
  });

  if (!visibleProposal) {
    return (
      <section className="context-section compact">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">Propozycje</p>
            <h2>Panel AI</h2>
          </div>
          <FileJson size={18} aria-hidden="true" />
        </div>
        <p className="muted-text">
          Wyniki AI pojawią się tutaj od razu po kliknięciu przycisku pola.
        </p>
      </section>
    );
  }

  const config = conceptFieldConfigs[visibleProposal.field];
  const running = visibleProposal.status === "running";
  const success = visibleProposal.status === "success";
  const proposalRows =
    visibleProposal.field === "premise" || visibleProposal.field === "styleGuide"
      ? 8
      : 3;

  return (
    <section className="context-section compact proposal-panel">
      <div className="section-title-row">
        <div>
          <p className="eyebrow">Codex CLI</p>
          <h2>{config.label}</h2>
        </div>
        <span
          className={
            success
              ? "status-pill ready"
              : visibleProposal.status === "error"
                ? "status-pill muted"
                : "status-pill"
          }
        >
          {running ? <Loader2 size={14} className="spin-icon" /> : null}
          {running ? "Generuje" : success ? "Gotowe" : "Błąd"}
        </span>
      </div>

      {visibleProposal.parsed?.summary ? (
        <p className="muted-text">{visibleProposal.parsed.summary}</p>
      ) : null}

      {running ? (
        <p className="muted-text">
          Zadanie jest w kolejce panelu. Wynik pojawi się tutaj i nie zapisze się
          bez akceptacji.
        </p>
      ) : null}

      {success ? (
        <label className="field-label">
          Propozycja do akceptacji
          <textarea
            value={visibleProposal.editableValue}
            onChange={(event) => setEditableValue(event.target.value)}
            rows={proposalRows}
            title={`Możesz poprawić propozycję dla pola ${config.label} przed zapisem.`}
          />
        </label>
      ) : null}

      {visibleProposal.parsed?.rationale ? (
        <p className="muted-text">{visibleProposal.parsed.rationale}</p>
      ) : null}

      {visibleProposal.errorMessage ? (
        <p className="warning-text">{visibleProposal.errorMessage}</p>
      ) : null}

      {visibleProposal.parsed && visibleProposal.parsed.warnings.length > 0 ? (
        <div className="warning-box">
          {visibleProposal.parsed.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}

      {visibleProposal.rawOutput ? (
        <details className="raw-output">
          <summary>Surowy wynik</summary>
          <pre>{visibleProposal.rawOutput}</pre>
        </details>
      ) : null}

      <div className="button-row">
        <button
          type="button"
          className="primary-button"
          onClick={() => acceptMutation.mutate()}
          disabled={
            acceptMutation.isPending ||
            running ||
            !visibleProposal.editableValue.trim()
          }
        >
          <Check size={16} />
          Akceptuj
        </button>
        <button
          type="button"
          className="ghost-button"
          onClick={() => clearProposal()}
          disabled={acceptMutation.isPending || retryMutation.isPending}
        >
          <X size={16} />
          Odrzuć
        </button>
        <button
          type="button"
          className="ghost-button"
          onClick={() => retryMutation.mutate()}
          disabled={running || acceptMutation.isPending || retryMutation.isPending}
          title="Ponownie uruchom ten sam prompt z zapisanym snapshotem kontekstu."
        >
          <RotateCcw size={16} />
          Ponów
        </button>
      </div>

      {acceptMutation.isError ? (
        <p className="warning-text">Nie udało się zapisać propozycji.</p>
      ) : null}
    </section>
  );
}

function proposalInputFromValue(
  value: string,
  proposal: ActiveAiProposal
): BookConceptInput {
  switch (proposal.field) {
    case "workingTitle":
      return { workingTitle: value };
    case "premise":
      return { premise: value };
    case "genre":
      return { genre: value };
    case "targetAudience":
      return { targetAudience: value };
    case "tone":
      return { tone: value };
    case "styleGuide":
      return { styleGuide: value };
  }
}

class RetryError extends Error {
  rawOutput: string;

  constructor(message: string, rawOutput = "") {
    super(message);
    this.name = "RetryError";
    this.rawOutput = rawOutput;
  }
}
