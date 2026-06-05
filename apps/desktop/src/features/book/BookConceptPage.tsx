import { Save, Sparkles } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { checkCodexCli, getProject, runCodexPrompt, updateBookConcept } from "../../shared/api/commands";
import type { BookConceptInput } from "../../shared/api/types";
import { buildGenerateTitlesPromptPackage, renderPromptPackage } from "../ai/promptPackage";
import { parseTitleSuggestions } from "../ai/titleSuggestions";
import { useCodexSettingsStore } from "../ai/codexSettingsStore";
import { useProposalStore } from "../ai/proposalStore";

type BookConceptPageProps = {
  projectId: string;
};

type ConceptForm = {
  workingTitle: string;
  premise: string;
  genre: string;
  targetAudience: string;
  tone: string;
  styleGuide: string;
};

const emptyForm: ConceptForm = {
  workingTitle: "",
  premise: "",
  genre: "",
  targetAudience: "",
  tone: "",
  styleGuide: ""
};

export function BookConceptPage({ projectId }: BookConceptPageProps) {
  const queryClient = useQueryClient();
  const codexPath = useCodexSettingsStore((state) => state.codexPath);
  const timeoutSeconds = useCodexSettingsStore((state) => state.timeoutSeconds);
  const setTitleProposal = useProposalStore((state) => state.setTitleProposal);
  const [form, setForm] = useState<ConceptForm>(emptyForm);
  const [saveMessage, setSaveMessage] = useState("");
  const [aiError, setAiError] = useState("");

  const projectQuery = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProject(projectId),
    retry: 0
  });

  const codexStatusQuery = useQuery({
    queryKey: ["codex-cli", codexPath],
    queryFn: () => checkCodexCli(codexPath),
    retry: 0
  });

  useEffect(() => {
    if (!projectQuery.data) {
      return;
    }

    const { book } = projectQuery.data;
    setForm({
      workingTitle: book.workingTitle,
      premise: book.premise,
      genre: book.genre,
      targetAudience: book.targetAudience,
      tone: book.tone,
      styleGuide: book.styleGuide
    });
  }, [projectQuery.data?.book.id, projectQuery.data?.book.updatedAt]);

  const bookForPrompt = useMemo(() => {
    if (!projectQuery.data) {
      return null;
    }

    return {
      ...projectQuery.data.book,
      workingTitle: form.workingTitle,
      premise: form.premise,
      genre: form.genre,
      targetAudience: form.targetAudience,
      tone: form.tone,
      styleGuide: form.styleGuide
    };
  }, [form, projectQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!projectQuery.data) {
        throw new Error("Brak projektu do zapisu.");
      }

      return updateBookConcept(projectQuery.data.book.id, conceptInputFromForm(form));
    },
    onSuccess: async () => {
      setSaveMessage("Zapisano koncepcje.");
      await queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
    }
  });

  const generateTitlesMutation = useMutation({
    mutationFn: async () => {
      if (!projectQuery.data || !bookForPrompt) {
        throw new Error("Brak danych projektu.");
      }

      const promptPackage = buildGenerateTitlesPromptPackage(
        projectQuery.data.project,
        bookForPrompt,
        20
      );
      const prompt = renderPromptPackage(promptPackage);
      const result = await runCodexPrompt({
        projectId,
        action: "generate_titles",
        promptPackageId: promptPackage.id,
        promptPackageJson: promptPackage,
        prompt,
        codexPath,
        timeoutSeconds
      });

      if (result.status !== "success" || !result.rawOutput) {
        throw new Error(result.errorMessage || "Codex CLI nie zwrocil wyniku.");
      }

      const parsed = parseTitleSuggestions(result.rawOutput);
      return { parsed, result, promptPackage };
    },
    onSuccess: ({ parsed, result, promptPackage }) => {
      if (!projectQuery.data) {
        return;
      }

      setAiError("");
      setTitleProposal({
        projectId,
        bookId: projectQuery.data.book.id,
        aiRunId: result.id,
        promptPackageId: promptPackage.id,
        rawOutput: result.rawOutput ?? "",
        parsed,
        selectedTitle: parsed.items[0]?.title ?? ""
      });
    },
    onError: (error) => {
      setAiError(error instanceof Error ? error.message : String(error));
    }
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaveMessage("");
    saveMutation.mutate();
  }

  function updateField<Key extends keyof ConceptForm>(
    key: Key,
    value: ConceptForm[Key]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const codexUnavailable = codexStatusQuery.data?.available === false;

  return (
    <section className="content-panel concept-panel">
      <div className="section-title-row">
        <div>
          <p className="eyebrow">Faza 1</p>
          <h2>Koncepcja ksiazki</h2>
        </div>
        <button
          type="button"
          className="secondary-button"
          onClick={() => generateTitlesMutation.mutate()}
          disabled={
            generateTitlesMutation.isPending ||
            !projectQuery.data ||
            codexUnavailable
          }
          title="Generuj tytuly przez Codex CLI"
        >
          <Sparkles size={16} />
          {generateTitlesMutation.isPending ? "Generuje" : "Generuj tytuly"}
        </button>
      </div>

      {projectQuery.isError ? (
        <div className="empty-state">
          <h3>Nie mozna wczytac projektu</h3>
          <p>Sprawdz, czy aplikacja dziala w Tauri i baza jest dostepna.</p>
        </div>
      ) : null}

      <form className="concept-form" onSubmit={handleSubmit}>
        <label className="field-label">
          Tytul roboczy
          <input
            value={form.workingTitle}
            onChange={(event) => updateField("workingTitle", event.target.value)}
            placeholder="Tytul roboczy"
          />
        </label>

        <label className="field-label">
          Premise
          <textarea
            value={form.premise}
            onChange={(event) => updateField("premise", event.target.value)}
            placeholder="Jedno lub dwa zdania o obietnicy historii"
            rows={5}
          />
        </label>

        <div className="form-grid">
          <label className="field-label">
            Gatunek
            <input
              value={form.genre}
              onChange={(event) => updateField("genre", event.target.value)}
              placeholder="fantasy, kryminal, obyczajowa..."
            />
          </label>

          <label className="field-label">
            Odbiorcy
            <input
              value={form.targetAudience}
              onChange={(event) =>
                updateField("targetAudience", event.target.value)
              }
              placeholder="adult, YA, dzieci..."
            />
          </label>

          <label className="field-label">
            Ton
            <input
              value={form.tone}
              onChange={(event) => updateField("tone", event.target.value)}
              placeholder="mroczny, cieply, ironiczny..."
            />
          </label>
        </div>

        <label className="field-label">
          Style guide
          <textarea
            value={form.styleGuide}
            onChange={(event) => updateField("styleGuide", event.target.value)}
            placeholder="Notatki o jezyku, rytmie, zakazach i preferencjach"
            rows={5}
          />
        </label>

        <div className="button-row">
          <button
            type="submit"
            className="primary-button"
            disabled={saveMutation.isPending || !projectQuery.data}
          >
            <Save size={16} />
            {saveMutation.isPending ? "Zapisuje" : "Zapisz"}
          </button>
          {saveMessage ? <span className="success-text">{saveMessage}</span> : null}
          {saveMutation.isError ? (
            <span className="warning-text">Nie udalo sie zapisac koncepcji.</span>
          ) : null}
        </div>
      </form>

      {codexUnavailable ? (
        <p className="warning-text">
          Codex CLI nie jest gotowy. Skonfiguruj go w prawym panelu albo ekranie AI.
        </p>
      ) : null}

      {aiError ? <p className="warning-text">{aiError}</p> : null}
    </section>
  );
}

function conceptInputFromForm(form: ConceptForm): BookConceptInput {
  return {
    workingTitle: form.workingTitle,
    premise: form.premise,
    genre: form.genre,
    targetAudience: form.targetAudience,
    tone: form.tone,
    styleGuide: form.styleGuide
  };
}
