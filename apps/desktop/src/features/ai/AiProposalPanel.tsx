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
import { parsePremiseDevelopment } from "./premiseDevelopment";
import {
  conceptFieldConfigs,
  ConceptFieldKey,
  listConceptFields,
  longConceptFields
} from "./promptPackage";
import { ActiveAiProposal, ParsedAiProposal, useProposalStore } from "./proposalStore";

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
  const setEditableField = useProposalStore((state) => state.setEditableField);
  const toggleSelectedField = useProposalStore((state) => state.toggleSelectedField);
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

      if (visibleProposal.scope === "newProject") {
        const value = visibleProposal.editableValue.trim();
        if (!onAcceptValue) {
          throw new Error("Brak obslugi akceptacji propozycji nowego projektu.");
        }

        await onAcceptValue(value);
        return null;
      }

      if (isPremiseDevelopment(visibleProposal.parsed)) {
        const input = proposalInputFromFields(
          visibleProposal.editableFields,
          visibleProposal.selectedFields
        );
        return updateBookConcept(visibleProposal.bookId, input);
      }

      const value = visibleProposal.editableValue.trim();
      return updateBookConcept(
        visibleProposal.bookId,
        proposalInputFromValue(value, visibleProposal)
      );
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

      const parsed = parseProposalResult(
        result.rawOutput,
        snapshot.field,
        snapshot.action
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
        editableFields: editableFieldsFromParsed(payload.parsed),
        selectedFields: selectedFieldsFromParsed(payload.parsed),
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
  const premiseProposal = isPremiseDevelopment(visibleProposal.parsed)
    ? visibleProposal.parsed
    : null;
  const structured = premiseProposal !== null;
  const proposalRows =
    longConceptFields.includes(visibleProposal.field) || structured ? 8 : 3;
  const canAccept = structured
    ? hasSelectedEditableField(visibleProposal)
    : visibleProposal.editableValue.trim().length > 0;

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
          Zadanie jest w kolejce panelu. Wynik pojawi się tutaj i nie zapisze
          się bez akceptacji.
        </p>
      ) : null}

      {success && premiseProposal ? (
        <div className="proposal-field-list">
          {premiseProposal.fieldValues.map((item) => {
            const selected = visibleProposal.selectedFields[item.field] !== false;
            const rows = longConceptFields.includes(item.field) ? 5 : 3;
            return (
              <div className="proposal-field-item" key={item.field}>
                <label className="proposal-field-toggle">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleSelectedField(item.field)}
                  />
                  <span>{item.label}</span>
                </label>
                <textarea
                  aria-label={`Edytuj ${item.label}`}
                  value={visibleProposal.editableFields[item.field] ?? item.value}
                  onChange={(event) =>
                    setEditableField(item.field, event.target.value)
                  }
                  rows={rows}
                  disabled={!selected}
                  title={`Możesz poprawić propozycję dla pola ${item.label} przed zapisem.`}
                />
              </div>
            );
          })}
        </div>
      ) : null}

      {success && !structured ? (
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

      {visibleProposal.parsed &&
      "rationale" in visibleProposal.parsed &&
      visibleProposal.parsed.rationale ? (
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

      {premiseProposal && premiseProposal.questionsForAuthor.length > 0 ? (
        <details className="raw-output">
          <summary>Pytania dla autora</summary>
          <ul>
            {premiseProposal.questionsForAuthor.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </details>
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
          disabled={acceptMutation.isPending || running || !canAccept}
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

export function parseProposalResult(
  rawOutput: string,
  expectedField: ConceptFieldKey,
  action: string
): ParsedAiProposal {
  if (action === "expand_premise") {
    return parsePremiseDevelopment(rawOutput);
  }

  return parseConceptFieldSuggestion(rawOutput, expectedField);
}

export function editableFieldsFromParsed(
  parsed: ParsedAiProposal
): Partial<Record<ConceptFieldKey, string>> {
  if (!isPremiseDevelopment(parsed)) {
    return {};
  }

  return Object.fromEntries(
    parsed.fieldValues.map((item) => [item.field, item.value])
  ) as Partial<Record<ConceptFieldKey, string>>;
}

export function selectedFieldsFromParsed(
  parsed: ParsedAiProposal
): Partial<Record<ConceptFieldKey, boolean>> {
  if (!isPremiseDevelopment(parsed)) {
    return {};
  }

  return Object.fromEntries(
    parsed.fieldValues.map((item) => [item.field, true])
  ) as Partial<Record<ConceptFieldKey, boolean>>;
}

export function proposalInputFromValue(
  value: string,
  proposal: Pick<ActiveAiProposal, "field">
): BookConceptInput {
  return proposalInputForField(proposal.field, value);
}

export function proposalInputFromFields(
  editableFields: Partial<Record<ConceptFieldKey, string>>,
  selectedFields: Partial<Record<ConceptFieldKey, boolean>>
): BookConceptInput {
  const input: BookConceptInput = {};

  for (const [field, selected] of Object.entries(selectedFields)) {
    if (!selected) {
      continue;
    }

    Object.assign(
      input,
      proposalInputForField(
        field as ConceptFieldKey,
        editableFields[field as ConceptFieldKey] ?? ""
      )
    );
  }

  if (Object.keys(input).length === 0) {
    throw new Error("Wybierz co najmniej jedno pole do zapisania.");
  }

  return input;
}

function proposalInputForField(
  field: ConceptFieldKey,
  value: string
): BookConceptInput {
  switch (field) {
    case "title":
      return { title: value };
    case "workingTitle":
      return { workingTitle: value };
    case "premise":
      return { premise: value };
    case "expandedPremise":
      return { expandedPremise: value };
    case "logline":
      return { logline: value };
    case "centralConflict":
      return { centralConflict: value };
    case "stakes":
      return { stakes: value };
    case "genre":
      return { genre: value };
    case "subgenre":
      return { subgenre: value };
    case "targetAudience":
      return { targetAudience: value };
    case "tone":
      return { tone: value };
    case "pointOfView":
      return { pointOfView: value };
    case "targetWordCount":
      return { targetWordCount: parseTargetWordCount(value) };
    case "themesJson":
      return { themesJson: serializeListValue(value) };
    case "unwantedThemes":
      return { unwantedThemes: value };
    case "alternativeTitlesJson":
      return { alternativeTitlesJson: serializeListValue(value) };
    case "titleChoiceNote":
      return { titleChoiceNote: value };
    case "styleGuide":
      return { styleGuide: value };
  }
}

function isPremiseDevelopment(
  parsed: ParsedAiProposal | undefined
): parsed is Extract<ParsedAiProposal, { kind: "premise_development" }> {
  return parsed?.kind === "premise_development";
}

function hasSelectedEditableField(proposal: ActiveAiProposal): boolean {
  return Object.entries(proposal.selectedFields).some(([field, selected]) => {
    const value = proposal.editableFields[field as ConceptFieldKey] ?? "";
    return selected && value.trim().length > 0;
  });
}

function parseTargetWordCount(value: string): number | null {
  const normalized = value.replace(/\s+/g, "");
  const match = normalized.match(/\d+/);
  if (!match) {
    return null;
  }

  const parsed = Number(match[0]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function serializeListValue(value: string): string {
  const items = value
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);

  return JSON.stringify([...new Set(items)]);
}

class RetryError extends Error {
  rawOutput: string;

  constructor(message: string, rawOutput = "") {
    super(message);
    this.name = "RetryError";
    this.rawOutput = rawOutput;
  }
}
