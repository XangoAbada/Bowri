import { beforeEach, describe, expect, it } from "vitest";
import {
  browserCreateProject,
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
      name: "Projekt z podgladu",
      language: "pl"
    });

    const listed = await browserListProjects();
    const opened = await browserGetProject(created.project.id);

    expect(listed).toHaveLength(1);
    expect(listed[0].workingTitle).toBe("Projekt z podgladu");
    expect(opened.book.id).toBe(created.book.id);
  });

  it("updates concept fields without dropping existing values", async () => {
    const created = await browserCreateProject({
      name: "Projekt z podgladu",
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
});
