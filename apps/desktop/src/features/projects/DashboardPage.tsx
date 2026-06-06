import { BookOpen, FolderOpen, Loader2, Plus, Sparkles } from "lucide-react";
import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  checkCodexCli,
  createProject,
  generateNewProjectTitle,
  getProject,
  listProjects,
  runCodexPrompt
} from "../../shared/api/commands";
import { coverImageSource } from "../../shared/api/assets";
import { formatLocalDateTime } from "../../shared/date";
import { AiProposalPanel } from "../ai/AiProposalPanel";
import { CodexStatusPanel } from "../ai/CodexStatusPanel";
import { parseConceptFieldSuggestion } from "../ai/conceptFieldSuggestion";
import { useCodexSettingsStore } from "../ai/codexSettingsStore";
import {
  buildNewProjectTitlePromptPackage,
  buildConceptFieldPromptPackage,
  renderNewProjectTitlePromptPackage,
  renderPromptPackage
} from "../ai/promptPackage";
import {
  NEW_PROJECT_PROPOSAL_ID,
  useProposalStore
} from "../ai/proposalStore";

export function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [proposalProjectId, setProposalProjectId] = useState("");
  const [aiError, setAiError] = useState("");
  const codexPath = useCodexSettingsStore((state) => state.codexPath);
  const timeoutSeconds = useCodexSettingsStore((state) => state.timeoutSeconds);
  const model = useCodexSettingsStore((state) => state.model);
  const reasoningEffort = useCodexSettingsStore(
    (state) => state.reasoningEffort
  );
  const startProposal = useProposalStore((state) => state.startProposal);
  const finishProposal = useProposalStore((state) => state.finishProposal);
  const failProposal = useProposalStore((state) => state.failProposal);
  const activeProposal = useProposalStore((state) => state.activeProposal);

  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: listProjects,
    retry: 0
  });

  const codexStatusQuery = useQuery({
    queryKey: ["codex-cli", codexPath],
    queryFn: () => checkCodexCli(codexPath),
    retry: 0
  });

  const createMutation = useMutation({
    mutationFn: () => createProject({ name, language: "pl" }),
    onSuccess: async (details) => {
      setName("");
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      await navigate({
        to: "/projects/$projectId/concept",
        params: { projectId: details.project.id }
      });
    }
  });

  const generateNewProjectTitleMutation = useMutation({
    mutationFn: async () => {
      const promptPackage = buildNewProjectTitlePromptPackage(name);
      const prompt = renderNewProjectTitlePromptPackage(promptPackage);
      const snapshot = {
        scope: "newProject" as const,
        projectId: NEW_PROJECT_PROPOSAL_ID,
        bookId: NEW_PROJECT_PROPOSAL_ID,
        field: "workingTitle" as const,
        action: promptPackage.action,
        promptPackageId: promptPackage.id,
        promptPackageJson: promptPackage,
        prompt
      };

      startProposal(snapshot);

      const result = await generateNewProjectTitle({
        action: promptPackage.action,
        promptPackageId: promptPackage.id,
        promptPackageJson: promptPackage,
        prompt,
        codexPath,
        timeoutSeconds,
        model,
        reasoningEffort
      });

      if (result.status !== "success" || !result.rawOutput) {
        throw new GenerationError(
          result.errorMessage || "Codex CLI nie zwrócił wyniku.",
          result.rawOutput ?? ""
        );
      }

      const parsed = parseConceptFieldSuggestion(result.rawOutput, "workingTitle");
      return { parsed, result };
    },
    onMutate: () => {
      setProposalProjectId(NEW_PROJECT_PROPOSAL_ID);
      setAiError("");
    },
    onSuccess: ({ parsed, result }) => {
      finishProposal({
        aiRunId: result.id,
        rawOutput: result.rawOutput ?? "",
        parsed,
        editableValue: parsed.textValue,
        durationMs: result.durationMs
      });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : String(error);
      const rawOutput = error instanceof GenerationError ? error.rawOutput : "";
      failProposal(message, rawOutput);
    }
  });

  const generateTitleMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const details = await getProject(projectId);
      const promptPackage = buildConceptFieldPromptPackage(
        details.project,
        details.book,
        "workingTitle"
      );
      const prompt = renderPromptPackage(promptPackage);

      startProposal({
        projectId,
        bookId: details.book.id,
        field: "workingTitle",
        action: promptPackage.action,
        promptPackageId: promptPackage.id,
        promptPackageJson: promptPackage,
        prompt
      });

      const result = await runCodexPrompt({
        projectId,
        action: promptPackage.action,
        promptPackageId: promptPackage.id,
        promptPackageJson: promptPackage,
        prompt,
        codexPath,
        timeoutSeconds,
        model,
        reasoningEffort
      });

      if (result.status !== "success" || !result.rawOutput) {
        throw new GenerationError(
          result.errorMessage || "Codex CLI nie zwrócił wyniku.",
          result.rawOutput ?? ""
        );
      }

      const parsed = parseConceptFieldSuggestion(result.rawOutput, "workingTitle");
      return { parsed, result };
    },
    onMutate: (projectId) => {
      setProposalProjectId(projectId);
      setAiError("");
    },
    onSuccess: ({ parsed, result }) => {
      setAiError("");
      finishProposal({
        aiRunId: result.id,
        rawOutput: result.rawOutput ?? "",
        parsed,
        editableValue: parsed.textValue,
        durationMs: result.durationMs
      });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : String(error);
      const rawOutput = error instanceof GenerationError ? error.rawOutput : "";
      setAiError(message);
      failProposal(message, rawOutput);
    }
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (name.trim().length === 0) {
      return;
    }
    createMutation.mutate();
  }

  const codexUnavailable = codexStatusQuery.data?.available === false;
  const visibleProposalProjectId =
    activeProposal?.projectId || proposalProjectId || projectsQuery.data?.[0]?.id || "";

  return (
    <main className="dashboard dashboard-with-panel">
      <div className="dashboard-main-column">
        <section className="dashboard-header">
          <div>
            <p className="eyebrow">StoryForge2</p>
            <h1>Projekty</h1>
            <p className="muted-text">
              Lokalny warsztat pisarski z kanonem, SQLite i Codex CLI Bridge.
            </p>
          </div>
          <form className="new-project-form" onSubmit={handleSubmit}>
            <label className="field-label">
              Nowy projekt
              <div className="inline-control new-project-title-control">
                <BookOpen size={16} aria-hidden="true" />
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Roboczy tytuł książki"
                />
                <button
                  type="button"
                  className="icon-button ai-inline-button"
                  aria-label="Generuj tytuł dla nowego projektu"
                  title="Generuj tytuł dla nowego projektu"
                  onClick={() => generateNewProjectTitleMutation.mutate()}
                  disabled={
                    generateNewProjectTitleMutation.isPending ||
                    createMutation.isPending ||
                    codexUnavailable ||
                    codexStatusQuery.isLoading
                  }
                >
                  {generateNewProjectTitleMutation.isPending ? (
                    <Loader2 size={16} className="spin-icon" />
                  ) : (
                    <Sparkles size={16} />
                  )}
                </button>
                <button
                  type="submit"
                  className="icon-button strong"
                  aria-label="Utwórz projekt"
                  title="Utwórz projekt"
                  disabled={createMutation.isPending || name.trim().length === 0}
                >
                  <Plus size={17} />
                </button>
              </div>
            </label>
            {createMutation.isError ? (
              <p className="warning-text">Nie udało się utworzyć projektu.</p>
            ) : null}
          </form>
        </section>

        <section className="project-list-section">
          <div className="section-title-row">
            <div>
              <p className="eyebrow">Biblioteka</p>
              <h2>Ostatnie projekty</h2>
            </div>
            <FolderOpen size={20} aria-hidden="true" />
          </div>

          {projectsQuery.isLoading ? (
            <p className="muted-text">Ładuję projekty...</p>
          ) : null}

          {projectsQuery.isError ? (
            <div className="empty-state">
              <h3>Backend desktopowy nie odpowiada</h3>
              <p>
                Uruchom aplikację przez Tauri, aby korzystać z lokalnej bazy
                SQLite i komend Rust.
              </p>
            </div>
          ) : null}

          {projectsQuery.data?.length === 0 ? (
            <div className="empty-state">
              <h3>Jeszcze nie ma projektów</h3>
              <p>Utwórz pierwszy projekt, a StoryForge2 założy książkę i bazę.</p>
            </div>
          ) : null}

          <div className="project-grid">
            {projectsQuery.data?.map((project) => {
              const coverSrc = coverImageSource(project.coverImagePath);
              const displayTitle = project.workingTitle || project.name;
              const generating =
                generateTitleMutation.isPending &&
                generateTitleMutation.variables === project.id;

              return (
                <article className="project-card-shell" key={project.id}>
                  <Link
                    className="project-card book-card"
                    to="/projects/$projectId/concept"
                    params={{ projectId: project.id }}
                  >
                    <span className="project-cover-art">
                      {coverSrc ? (
                        <img src={coverSrc} alt="" />
                      ) : (
                        <span className="project-card-icon">
                          <BookOpen size={28} />
                        </span>
                      )}
                    </span>
                    <span className="project-card-copy">
                      <strong>{displayTitle}</strong>
                      <small>{project.name}</small>
                      <time>{formatLocalDateTime(project.updatedAt)}</time>
                    </span>
                  </Link>
                  <button
                    type="button"
                    className="icon-button project-card-ai-button"
                    onClick={() => generateTitleMutation.mutate(project.id)}
                    disabled={
                      generating ||
                      codexUnavailable ||
                      codexStatusQuery.isLoading ||
                      !project.activeBookId
                    }
                    title="Generuj tytuł roboczy z AI"
                    aria-label={`Generuj tytuł roboczy z AI dla projektu ${displayTitle}`}
                  >
                    {generating ? (
                      <Loader2 size={16} className="spin-icon" />
                    ) : (
                      <Sparkles size={16} />
                    )}
                  </button>
                </article>
              );
            })}
          </div>

          {aiError ? <p className="warning-text">{aiError}</p> : null}
        </section>
      </div>

      <aside className="dashboard-side-panel">
        <CodexStatusPanel compact />
        {visibleProposalProjectId ? (
          <AiProposalPanel
            projectId={visibleProposalProjectId}
            onAcceptValue={
              visibleProposalProjectId === NEW_PROJECT_PROPOSAL_ID
                ? (value) => setName(value)
                : undefined
            }
          />
        ) : (
          <section className="context-section compact">
            <div className="section-title-row">
              <div>
                <p className="eyebrow">Propozycje</p>
                <h2>Panel AI</h2>
              </div>
              <Sparkles size={18} aria-hidden="true" />
            </div>
            <p className="muted-text">
              Wybierz projekt i uruchom generowanie tytułu roboczego.
            </p>
          </section>
        )}
      </aside>
    </main>
  );
}

class GenerationError extends Error {
  rawOutput: string;

  constructor(message: string, rawOutput = "") {
    super(message);
    this.name = "GenerationError";
    this.rawOutput = rawOutput;
  }
}
