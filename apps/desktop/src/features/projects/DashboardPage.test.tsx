import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCodexSettingsStore } from "../ai/codexSettingsStore";
import { useProposalStore } from "../ai/proposalStore";
import { DashboardPage } from "./DashboardPage";
import type { ProjectDetails, ProjectSummary } from "../../shared/api/types";
import {
  checkCodexCli,
  createProject,
  generateNewProjectTitle,
  getProject,
  listCodexModels,
  listProjects,
  runCodexPrompt,
  updateBookConcept
} from "../../shared/api/commands";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    className,
    params
  }: {
    children: ReactNode;
    className?: string;
    params?: { projectId?: string };
  }) => (
    <a className={className} href={`/projects/${params?.projectId ?? "x"}/concept`}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn()
}));

vi.mock("../../shared/api/commands", () => ({
  checkCodexCli: vi.fn(),
  createProject: vi.fn(),
  generateNewProjectTitle: vi.fn(),
  getProject: vi.fn(),
  listCodexModels: vi.fn(),
  listProjects: vi.fn(),
  runCodexPrompt: vi.fn(),
  updateBookConcept: vi.fn()
}));

const projectSummary: ProjectSummary = {
  id: "project-1",
  name: "Projekt testowy",
  language: "pl",
  updatedAt: "2026-06-05T12:00:00Z",
  activeBookId: "book-1",
  workingTitle: "Roboczy tytul",
  coverImagePath:
    "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22/%3E"
};

const projectDetails: ProjectDetails = {
  project: {
    id: "project-1",
    name: "Projekt testowy",
    language: "pl",
    createdAt: "2026-06-05T12:00:00Z",
    updatedAt: "2026-06-05T12:00:00Z",
    activeBookId: "book-1",
    settingsJson: "{}"
  },
  book: {
    id: "book-1",
    projectId: "project-1",
    title: "",
    workingTitle: "Roboczy tytul",
    premise: "Bohaterka szuka zaginionej siostry.",
    logline: "",
    genre: "kryminal",
    subgenre: "",
    targetAudience: "adult",
    tone: "napiety",
    styleGuide: "",
    pointOfView: "",
    targetWordCount: null,
    coverImagePath: projectSummary.coverImagePath,
    coverPrompt: "cover prompt",
    coverNegativePrompt: "watermark",
    coverGeneratedAt: "2026-06-05T12:00:00Z",
    status: "draft",
    createdAt: "2026-06-05T12:00:00Z",
    updatedAt: "2026-06-05T12:00:00Z"
  }
};

const titleOutput = JSON.stringify({
  version: 1,
  kind: "concept_field_suggestion",
  field: "workingTitle",
  summary: "Nowy tytul",
  value: "Siostra z mgly",
  values: [],
  rationale: "Podkresla tajemnice.",
  warnings: []
});

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <DashboardPage />
    </QueryClientProvider>
  );
}

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listProjects).mockResolvedValue([projectSummary]);
    vi.mocked(getProject).mockResolvedValue(projectDetails);
    vi.mocked(createProject).mockResolvedValue(projectDetails);
    vi.mocked(checkCodexCli).mockResolvedValue({
      available: true,
      path: "codex",
      version: "codex 1.0.0",
      authLikelyReady: null
    });
    vi.mocked(listCodexModels).mockResolvedValue({
      fallback: true,
      models: [],
      errorMessage: "fallback"
    });
    vi.mocked(runCodexPrompt).mockResolvedValue({
      id: "run-1",
      providerId: "codex-cli-bridge",
      promptPackageId: "generate_working_title:test",
      action: "generate_working_title",
      status: "success",
      rawOutput: titleOutput,
      durationMs: 10
    });
    vi.mocked(generateNewProjectTitle).mockResolvedValue({
      id: "new-title-run-1",
      providerId: "codex-cli-bridge",
      promptPackageId: "generate_working_title:new-project",
      action: "generate_working_title",
      status: "success",
      rawOutput: titleOutput,
      durationMs: 10
    });
    vi.mocked(updateBookConcept).mockResolvedValue({
      ...projectDetails.book,
      workingTitle: "Siostra z mgly"
    });
    useProposalStore.setState({ activeProposal: null });
    useCodexSettingsStore.setState({
      codexPath: "codex",
      model: "gpt-5.5",
      reasoningEffort: "medium",
      timeoutSeconds: 180
    });
  });

  it("renders book-shaped project cards with covers and accepts dashboard title proposals", async () => {
    const rendered = renderDashboard();

    expect(await screen.findByText("Roboczy tytul")).toBeInTheDocument();
    expect(rendered.container.querySelector(".project-cover-art img")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", {
        name: /Generuj tytul roboczy z AI dla projektu Roboczy tytul/i
      })
    );

    expect(await screen.findByDisplayValue("Siostra z mgly")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Akceptuj/i }));

    await waitFor(() =>
      expect(updateBookConcept).toHaveBeenCalledWith("book-1", {
        workingTitle: "Siostra z mgly"
      })
    );
  });

  it("shows a new project title in proposals and applies it after acceptance", async () => {
    renderDashboard();

    const generateButton = await screen.findByRole("button", {
      name: /Generuj tytul dla nowego projektu/i
    });
    await waitFor(() => expect(generateButton).not.toBeDisabled());
    const titleInput = screen.getByPlaceholderText("Roboczy tytul ksiazki");

    fireEvent.click(generateButton);

    expect(await screen.findByDisplayValue("Siostra z mgly")).toBeInTheDocument();
    expect(titleInput).toHaveValue("");
    expect(generateNewProjectTitle).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "generate_working_title",
        model: "gpt-5.5",
        reasoningEffort: "medium"
      })
    );

    fireEvent.click(screen.getByRole("button", { name: /Akceptuj/i }));

    await waitFor(() => expect(titleInput).toHaveValue("Siostra z mgly"));
    expect(createProject).not.toHaveBeenCalled();
    expect(updateBookConcept).not.toHaveBeenCalled();
  });
});
