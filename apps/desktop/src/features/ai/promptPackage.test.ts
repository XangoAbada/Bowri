import { describe, expect, it } from "vitest";
import {
  buildConceptFieldPromptPackage,
  renderPromptPackage
} from "./promptPackage";
import type { Book, Project } from "../../shared/api/types";

const project: Project = {
  id: "project-1",
  name: "Cienie Drukarni",
  language: "pl",
  createdAt: "2026-06-05T12:00:00Z",
  updatedAt: "2026-06-05T12:00:00Z",
  activeBookId: "book-1",
  settingsJson: "{}"
};

const book: Book = {
  id: "book-1",
  projectId: "project-1",
  title: "",
  workingTitle: "Cienie Drukarni",
  premise: "Zecerka odkrywa, ze drukowane sny zmieniaja wspomnienia miasta.",
  logline: "",
  genre: "fantasy",
  subgenre: "",
  targetAudience: "adult",
  tone: "mroczny, liryczny",
  styleGuide: "Krotkie zdania w scenach napiecia.",
  pointOfView: "",
  targetWordCount: null,
  status: "draft",
  createdAt: "2026-06-05T12:00:00Z",
  updatedAt: "2026-06-05T12:00:00Z"
};

describe("renderPromptPackage", () => {
  it("renders a concept field contract and relevant context", () => {
    const promptPackage = buildConceptFieldPromptPackage(
      project,
      book,
      "premise"
    );
    const prompt = renderPromptPackage(promptPackage);

    expect(promptPackage.action).toBe("generate_premise");
    expect(prompt).toContain("# Role");
    expect(prompt).toContain("# Output Contract");
    expect(prompt).toContain("concept_field_suggestion");
    expect(prompt).toContain("Docelowe pole: premise");
    expect(prompt).toContain(book.premise);
    expect(prompt).toContain(book.genre);
    expect(prompt).toContain(book.targetAudience);
    expect(prompt).toContain(book.styleGuide);
  });
});
