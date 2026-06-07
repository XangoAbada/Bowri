import { beforeEach, describe, expect, it } from "vitest";
import {
  browserAcceptGeneratedBookCover,
  browserCreateProject,
  browserGenerateBookCover,
  browserGetProject,
  browserListAiRuns,
  browserListProjects,
  browserRunCodexPrompt,
  browserUpdateBookConcept
} from "./browserDevCommands";

describe("browser preview commands", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("creates, lists and opens a browser-preview project", async () => {
    const created = await browserCreateProject({
      name: "Projekt z podglądu",
      language: "pl"
    });

    const listed = await browserListProjects();
    const opened = await browserGetProject(created.project.id);

    expect(listed).toHaveLength(1);
    expect(listed[0].workingTitle).toBe("Projekt z podglądu");
    expect(listed[0].coverImagePath).toBe("");
    expect(opened.book.id).toBe(created.book.id);
  });

  it("updates concept fields without dropping existing values", async () => {
    const created = await browserCreateProject({
      name: "Projekt z podglądu",
      language: "pl"
    });

    await browserUpdateBookConcept(created.book.id, {
      premise: "Premisa testowa"
    });
    const updated = await browserUpdateBookConcept(created.book.id, {
      workingTitle: "Nowy tytuł"
    });

    expect(updated.workingTitle).toBe("Nowy tytuł");
    expect(updated.premise).toBe("Premisa testowa");
  });

  it("stores browser-preview cover metadata only after acceptance", async () => {
    const created = await browserCreateProject({
      name: "Projekt z okładką",
      language: "pl"
    });

    const generated = await browserGenerateBookCover({
      projectId: created.project.id,
      bookId: created.book.id,
      promptPackageId: "generate_cover_image:test",
      promptPackageJson: {},
      prompt: "cover prompt",
      coverPrompt: "dark cover",
      coverNegativePrompt: "watermark"
    });

    const listedBeforeAcceptance = await browserListProjects();
    const openedBeforeAcceptance = await browserGetProject(created.project.id);

    expect(listedBeforeAcceptance[0].coverImagePath).toBe("");
    expect(openedBeforeAcceptance.book.coverPrompt).toBe("");

    await browserAcceptGeneratedBookCover({
      bookId: created.book.id,
      imagePath: generated.imagePath,
      coverPrompt: generated.prompt,
      coverNegativePrompt: generated.negativePrompt,
      generatedAt: generated.generatedAt
    });

    const listed = await browserListProjects();
    const opened = await browserGetProject(created.project.id);

    expect(listed[0].coverImagePath).toContain("data:image/svg+xml");
    expect(opened.book.coverPrompt).toBe("dark cover");
    expect(opened.book.coverNegativePrompt).toBe("watermark");
  });

  it("stores browser-preview AI run logs for project actions", async () => {
    const created = await browserCreateProject({
      name: "Projekt z logiem",
      language: "pl"
    });

    await browserRunCodexPrompt({
      projectId: created.project.id,
      action: "generate_premise",
      promptPackageId: "generate_premise:test",
      promptPackageJson: {
        context: {
          targetField: "premise",
          generationMode: "generate"
        }
      },
      prompt: "# Role\nPrompt testowy",
      model: "gpt-5.5",
      reasoningEffort: "medium"
    });

    const logs = await browserListAiRuns(created.project.id);

    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      projectId: created.project.id,
      action: "generate_premise",
      prompt: "# Role\nPrompt testowy",
      model: "gpt-5.5",
      reasoningEffort: "medium",
      status: "error"
    });
  });
});
