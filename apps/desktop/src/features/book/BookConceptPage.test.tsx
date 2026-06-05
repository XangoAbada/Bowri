import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiProposalPanel } from "../ai/AiProposalPanel";
import { useProposalStore } from "../ai/proposalStore";
import { BookConceptPage } from "./BookConceptPage";
import type { ProjectDetails } from "../../shared/api/types";
import {
  checkCodexCli,
  getProject,
  runCodexPrompt,
  updateBookConcept
} from "../../shared/api/commands";

vi.mock("../../shared/api/commands", () => ({
  checkCodexCli: vi.fn(),
  getProject: vi.fn(),
  runCodexPrompt: vi.fn(),
  updateBookConcept: vi.fn()
}));

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
    workingTitle: "Stary tytul",
    premise: "Bohaterka szuka zaginionej siostry.",
    logline: "",
    genre: "kryminal",
    subgenre: "",
    targetAudience: "adult",
    tone: "napiety",
    styleGuide: "",
    pointOfView: "",
    targetWordCount: null,
    status: "draft",
    createdAt: "2026-06-05T12:00:00Z",
    updatedAt: "2026-06-05T12:00:00Z"
  }
};

const titleOutput = JSON.stringify({
  version: 1,
  kind: "title_suggestions",
  summary: "Testowe tytuly",
  items: [
    {
      title: "Siostra z mgly",
      rationale: "Podkresla tajemnice.",
      tone: "napiety",
      risk: ""
    }
  ],
  warnings: []
});

function renderWithQueryClient() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BookConceptPage projectId="project-1" />
      <AiProposalPanel projectId="project-1" />
    </QueryClientProvider>
  );
}

describe("BookConceptPage AI flow", () => {
  beforeEach(() => {
    vi.mocked(getProject).mockResolvedValue(projectDetails);
    vi.mocked(checkCodexCli).mockResolvedValue({
      available: true,
      path: "codex",
      version: "codex 1.0.0",
      authLikelyReady: null
    });
    vi.mocked(runCodexPrompt).mockResolvedValue({
      id: "run-1",
      providerId: "codex-cli-bridge",
      promptPackageId: "generate_titles:test",
      action: "generate_titles",
      status: "success",
      rawOutput: titleOutput,
      durationMs: 12
    });
    vi.mocked(updateBookConcept).mockResolvedValue({
      ...projectDetails.book,
      workingTitle: "Siostra z mgly"
    });
    useProposalStore.setState({ titleProposal: null });
  });

  it("shows title proposals and saves only after acceptance", async () => {
    renderWithQueryClient();

    expect(await screen.findByDisplayValue("Stary tytul")).toBeInTheDocument();
    const generateButton = screen.getByRole("button", { name: /Generuj tytuly/i });

    await waitFor(() => expect(generateButton).not.toBeDisabled());
    fireEvent.click(generateButton);

    expect(await screen.findByText("Siostra z mgly")).toBeInTheDocument();
    expect(updateBookConcept).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Akceptuj/i }));

    await waitFor(() =>
      expect(updateBookConcept).toHaveBeenCalledWith("book-1", {
        workingTitle: "Siostra z mgly"
      })
    );
  });
});
