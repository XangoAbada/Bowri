import { describe, expect, it } from "vitest";
import type { Book, BookPlan, Chapter, Scene } from "../../shared/api/types";
import {
  defaultExportStyle,
  renderPlainTextExport,
  selectedExportChapters
} from "./exportFormatting";

describe("exportFormatting", () => {
  it("orders exported chapters by order index and chapter number", () => {
    const plan = planWith([
      chapter("c2", 2, 20, "Drugi"),
      chapter("c1", 1, 10, "Pierwszy")
    ]);

    expect(selectedExportChapters(plan, []).map((item) => item.id)).toEqual(["c1", "c2"]);
  });

  it("renders manuscript text without leaking story bible fields", () => {
    const book = {
      ...baseBook(),
      styleGuide: "Tajny styl Story Bible",
      premise: "Tajna premisa"
    };
    const plan = planWith(
      [chapter("c1", 1, 0, "Start")],
      [scene("s1", "c1", 0, "<p>Widoczny tekst sceny.</p>")]
    );

    const text = renderPlainTextExport({
      book,
      plan,
      chapterIds: [],
      contentMode: "manuscript",
      style: defaultExportStyle
    });

    expect(text).toContain("Widoczny tekst sceny.");
    expect(text).not.toContain("Tajny styl Story Bible");
    expect(text).not.toContain("Tajna premisa");
  });
});

function planWith(chapters: Chapter[], scenes: Scene[] = []): BookPlan {
  return {
    planVersion: {
      id: "pv",
      bookId: "book",
      name: "Plan",
      description: "",
      isActive: true,
      createdAt: "",
      updatedAt: ""
    },
    planVersions: [],
    structure: null,
    acts: [],
    beats: [],
    threads: [],
    chapters,
    chapterThreads: [],
    chapterBeats: [],
    scenes,
    sceneCharacters: [],
    sceneThreads: [],
    sceneWorldElements: [],
    sceneWorldRules: []
  };
}

function chapter(id: string, number: number, orderIndex: number, workingTitle: string): Chapter {
  return {
    id,
    bookId: "book",
    actId: null,
    number,
    workingTitle,
    summary: "",
    purpose: "",
    conflict: "",
    turningPoint: "",
    targetWordCount: null,
    orderIndex,
    createdAt: "",
    updatedAt: ""
  };
}

function scene(
  id: string,
  chapterId: string,
  orderIndex: number,
  manuscriptContent: string
): Scene {
  return {
    id,
    bookId: "book",
    planVersionId: "pv",
    chapterId,
    orderIndex,
    title: "",
    summary: "",
    goal: "",
    conflict: "",
    outcome: "",
    povCharacterId: null,
    locationId: null,
    targetWordCount: null,
    actualWordCount: null,
    manuscriptContent,
    status: "draft",
    createdAt: "",
    updatedAt: ""
  };
}

function baseBook(): Book {
  return {
    id: "book",
    projectId: "project",
    title: "",
    workingTitle: "Książka",
    premise: "",
    protagonistSummary: "",
    protagonistGoal: "",
    expandedPremise: "",
    logline: "",
    centralConflict: "",
    antagonistForce: "",
    stakes: "",
    settingSketch: "",
    endingDirection: "",
    genre: "",
    subgenre: "",
    targetAudience: "",
    tone: "",
    styleGuide: "",
    pointOfView: "",
    targetWordCount: null,
    themesJson: "[]",
    unwantedThemes: "",
    alternativeTitlesJson: "[]",
    coverImagePath: "",
    coverPrompt: "",
    coverNegativePrompt: "",
    coverGeneratedAt: null,
    status: "draft",
    createdAt: "",
    updatedAt: ""
  };
}
