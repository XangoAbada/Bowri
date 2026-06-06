import { beforeEach, describe, expect, it } from "vitest";
import {
  browserCreateProject,
  browserGenerateBookCover,
  browserGetProject,
  browserListProjects,
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

  it("stores browser-preview cover metadata in project summaries", async () => {
    const created = await browserCreateProject({
      name: "Projekt z okładką",
      language: "pl"
    });

    await browserGenerateBookCover({
      projectId: created.project.id,
      bookId: created.book.id,
      promptPackageId: "generate_cover_image:test",
      promptPackageJson: {},
      prompt: "cover prompt",
      coverPrompt: "dark cover",
      coverNegativePrompt: "watermark"
    });

    const listed = await browserListProjects();
    const opened = await browserGetProject(created.project.id);

    expect(listed[0].coverImagePath).toContain("data:image/svg+xml");
    expect(opened.book.coverPrompt).toBe("dark cover");
    expect(opened.book.coverNegativePrompt).toBe("watermark");
  });
});
