import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiProposalPanel } from "../ai/AiProposalPanel";
import { useCodexSettingsStore } from "../ai/codexSettingsStore";
import { useProposalStore } from "../ai/proposalStore";
import { BookConceptPage } from "./BookConceptPage";
import type { AiRunResult, ProjectDetails } from "../../shared/api/types";
import {
  checkCodexCli,
  generateBookCover,
  getProject,
  runCodexPrompt,
  updateBookConcept
} from "../../shared/api/commands";

vi.mock("../../shared/api/commands", () => ({
  checkCodexCli: vi.fn(),
  generateBookCover: vi.fn(),
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
    expandedPremise: "",
    logline: "",
    centralConflict: "",
    stakes: "",
    genre: "kryminal",
    subgenre: "",
    targetAudience: "adult",
    tone: "napiety",
    styleGuide: "",
    pointOfView: "",
    targetWordCount: null,
    themesJson: "[]",
    unwantedThemes: "",
    alternativeTitlesJson: "[]",
    titleChoiceNote: "",
    coverImagePath: "",
    coverPrompt: "",
    coverNegativePrompt: "",
    coverGeneratedAt: null,
    status: "draft",
    createdAt: "2026-06-05T12:00:00Z",
    updatedAt: "2026-06-05T12:00:00Z"
  }
};

const conceptFieldOutput = JSON.stringify({
  version: 1,
  kind: "concept_field_suggestion",
  field: "workingTitle",
  summary: "Testowy tytul",
  value: "Siostra z mgly",
  values: [],
  rationale: "Podkresla tajemnice.",
  warnings: []
});

const premiseDevelopmentOutput = JSON.stringify({
  version: 1,
  kind: "premise_development",
  summary: "Archiwistka odkrywa, ze pamiec miasta jest falszowana.",
  logline: "Archiwistka musi zatrzymac druk falszywych wspomnien.",
  expandedPremise:
    "W miescie, gdzie gazety zmieniaja wspomnienia, archiwistka szuka zaginionej siostry i odkrywa mechanizm kontroli.",
  centralConflict: "Prawda kontra spokoj zbudowany na klamstwie.",
  stakes: "Jesli bohaterka przegra, miasto zapomni wlasna historie.",
  themes: ["pamiec", "tozsamosc"],
  risks: ["Pilnowac, aby magia druku miala koszt."],
  questionsForAuthor: ["Kto pierwszy zyskuje na falszowaniu pamieci?"]
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
    vi.clearAllMocks();
    vi.mocked(getProject).mockResolvedValue(projectDetails);
    vi.mocked(checkCodexCli).mockResolvedValue({
      available: true,
      path: "codex",
      version: "codex 1.0.0",
      authLikelyReady: null
    });
    vi.mocked(runCodexPrompt).mockResolvedValue(successfulRun());
    vi.mocked(generateBookCover).mockResolvedValue({
      book: {
        ...projectDetails.book,
        coverImagePath: "data:image/png;base64,test",
        coverPrompt: "cover prompt",
        coverNegativePrompt: "negative",
        coverGeneratedAt: "2026-06-05T12:05:00Z"
      },
      aiRun: {
        id: "cover-run-1",
        providerId: "codex-cli-bridge",
        promptPackageId: "generate_cover_image:test",
        action: "generate_cover_image",
        status: "success",
        rawOutput: "{}",
        durationMs: 12
      },
      imagePath: "data:image/png;base64,test",
      prompt: "cover prompt",
      negativePrompt: "negative",
      generatedAt: "2026-06-05T12:05:00Z"
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

  it("shows a field proposal immediately and saves only after acceptance", async () => {
    let resolveRun: (result: AiRunResult) => void = () => undefined;
    vi.mocked(runCodexPrompt).mockReturnValue(
      new Promise((resolve) => {
        resolveRun = resolve;
      })
    );

    renderWithQueryClient();

    expect(await screen.findByDisplayValue("Stary tytul")).toBeInTheDocument();
    const generateButton = screen.getByRole("button", {
      name: /Generuj Tytul roboczy z AI/i
    });

    await waitFor(() => expect(generateButton).not.toBeDisabled());
    fireEvent.click(generateButton);

    expect(await screen.findByText(/Zadanie jest w kolejce panelu/i)).toBeInTheDocument();
    expect(updateBookConcept).not.toHaveBeenCalled();

    resolveRun(successfulRun());

    expect(await screen.findByDisplayValue("Siostra z mgly")).toBeInTheDocument();
    expect(runCodexPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "generate_working_title",
        model: "gpt-5.5",
        reasoningEffort: "medium"
      })
    );

    fireEvent.click(screen.getByRole("button", { name: /Akceptuj/i }));

    await waitFor(() =>
      expect(updateBookConcept).toHaveBeenCalledWith("book-1", {
        workingTitle: "Siostra z mgly"
      })
    );
  });

  it("saves all phase 2 concept fields", async () => {
    renderWithQueryClient();

    expect(await screen.findByDisplayValue("Stary tytul")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Tytul finalny"), {
      target: { value: "Finalny tytul" }
    });
    fireEvent.change(screen.getByLabelText("Logline"), {
      target: { value: "Jedno zdanie sprzedajace historie." }
    });
    fireEvent.change(screen.getByLabelText("Docelowa liczba slow"), {
      target: { value: "85000" }
    });
    fireEvent.change(screen.getByLabelText("Alternatywne tytuly"), {
      target: { value: "Tytul A, Tytul B" }
    });
    fireEvent.click(screen.getByRole("button", { name: "fantasy" }));
    fireEvent.change(screen.getByLabelText("Wlasna opcja Gatunek"), {
      target: { value: "noir" }
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Dodaj wlasna opcje Gatunek/i })
    );
    fireEvent.click(screen.getByRole("button", { name: /Zapisz/i }));

    await waitFor(() =>
      expect(updateBookConcept).toHaveBeenCalledWith(
        "book-1",
        expect.objectContaining({
          title: "Finalny tytul",
          logline: "Jedno zdanie sprzedajace historie.",
          targetWordCount: 85000,
          alternativeTitlesJson: JSON.stringify(["Tytul A", "Tytul B"]),
          genre: "kryminal, fantasy, noir"
        })
      )
    );
  });

  it("renders an AI button for every phase 2 concept field", async () => {
    renderWithQueryClient();

    expect(await screen.findByDisplayValue("Stary tytul")).toBeInTheDocument();

    for (const label of [
      "Tytul finalny",
      "Tytul roboczy",
      "Alternatywne tytuly",
      "Notatka wyboru tytulu",
      "Premise",
      "Logline",
      "Konflikt centralny",
      "Rozszerzona premisa",
      "Stawki",
      "Gatunek",
      "Podgatunek",
      "Odbiorcy",
      "Ton",
      "Punkt widzenia",
      "Docelowa liczba slow",
      "Tematy",
      "Granice i tematy niechciane",
      "Style guide"
    ]) {
      expect(
        screen.getByRole("button", { name: `Generuj ${label} z AI` })
      ).toBeInTheDocument();
    }
  });

  it("accepts only selected fields from premise development", async () => {
    vi.mocked(runCodexPrompt).mockResolvedValue({
      id: "run-premise",
      providerId: "codex-cli-bridge",
      promptPackageId: "expand_premise:test",
      action: "expand_premise",
      status: "success",
      rawOutput: premiseDevelopmentOutput,
      durationMs: 12
    });

    renderWithQueryClient();

    expect(await screen.findByDisplayValue("Stary tytul")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /Generuj Premise z AI/i })
    );

    expect(
      await screen.findByDisplayValue("Archiwistka musi zatrzymac druk falszywych wspomnien.")
    ).toBeInTheDocument();
    fireEvent.click(getCheckboxByLabel("Rozszerzona premisa"));
    fireEvent.click(getCheckboxByLabel("Stawki"));
    fireEvent.click(getCheckboxByLabel("Tematy"));
    fireEvent.click(screen.getByRole("button", { name: /Akceptuj/i }));

    await waitFor(() =>
      expect(updateBookConcept).toHaveBeenCalledWith("book-1", {
        premise: "Archiwistka odkrywa, ze pamiec miasta jest falszowana.",
        logline: "Archiwistka musi zatrzymac druk falszywych wspomnien.",
        centralConflict: "Prawda kontra spokoj zbudowany na klamstwie."
      })
    );
  });

  it("generates a cover from current concept form values", async () => {
    renderWithQueryClient();

    const coverButton = await screen.findByRole("button", {
      name: /Utworz okladke/i
    });
    await waitFor(() => expect(coverButton).not.toBeDisabled());

    fireEvent.change(screen.getByLabelText("Premise"), {
      target: { value: "Nowa bohaterka znajduje mape ukryta w druku." }
    });
    fireEvent.click(coverButton);

    await waitFor(() =>
      expect(generateBookCover).toHaveBeenCalledWith(
        expect.objectContaining({
          coverPrompt: expect.stringContaining(
            "Nowa bohaterka znajduje mape ukryta w druku."
          ),
          codexPath: "codex",
          model: "gpt-5.5",
          reasoningEffort: "medium"
        })
      )
    );
  });
});

function successfulRun(): AiRunResult {
  return {
    id: "run-1",
    providerId: "codex-cli-bridge",
    promptPackageId: "generate_working_title:test",
    action: "generate_working_title",
    status: "success",
    rawOutput: conceptFieldOutput,
    durationMs: 12
  };
}

function getCheckboxByLabel(label: string): HTMLInputElement {
  const checkbox = screen
    .getAllByLabelText(label)
    .find(
      (element): element is HTMLInputElement =>
        element instanceof HTMLInputElement && element.type === "checkbox"
    );

  if (!checkbox) {
    throw new Error(`Checkbox not found for ${label}`);
  }

  return checkbox;
}
