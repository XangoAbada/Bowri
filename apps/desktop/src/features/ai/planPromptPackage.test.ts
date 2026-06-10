import { describe, expect, it } from "vitest";
import type { Beat, Book, BookPlan, Project } from "../../shared/api/types";
import {
  buildPlanPromptPackage,
  renderPlanPromptPackage
} from "./planPromptPackage";

const project: Project = {
  id: "project-1",
  name: "Cienie Drukarni",
  language: "pl",
  activeBookId: "book-1",
  settingsJson: "{}",
  createdAt: "2026-06-05T12:00:00Z",
  updatedAt: "2026-06-05T12:00:00Z"
};

const book: Book = {
  id: "book-1",
  projectId: "project-1",
  title: "",
  workingTitle: "Cienie Drukarni",
  premise: "Zecerka odkrywa, ze drukowane sny zmieniaja wspomnienia miasta.",
  protagonistSummary: "Zecerka pilnujaca miejskiego archiwum snow.",
  protagonistGoal: "Zatrzymac druk falszywych wspomnien.",
  expandedPremise: "Drukarnia przechowuje sny miasta.",
  logline: "Zecerka musi zatrzymac druk wspomnien.",
  centralConflict: "Prawda kontra wygodna pamiec miasta.",
  antagonistForce: "Cech drukarzy kontrolujacy pamiec.",
  stakes: "Miasto moze utracic wspolna tozsamosc.",
  settingSketch: "Deszczowe miasto drukarni i nocnych gazet.",
  endingDirection: "Bohaterka ujawnia prawde.",
  genre: "fantasy",
  subgenre: "urban fantasy",
  targetAudience: "adult",
  tone: "mroczny",
  styleGuide: "Krotkie zdania w scenach napiecia.",
  pointOfView: "trzecia osoba ograniczona",
  targetWordCount: 85000,
  themesJson: JSON.stringify(["pamiec", "tozsamosc"]),
  unwantedThemes: "Bez gore.",
  alternativeTitlesJson: "[]",
  coverImagePath: "",
  coverPrompt: "",
  coverNegativePrompt: "",
  coverGeneratedAt: null,
  status: "draft",
  createdAt: "2026-06-05T12:00:00Z",
  updatedAt: "2026-06-05T12:00:00Z"
};

const beat: Beat & { chapterId?: string | null } = {
  id: "beat-1",
  bookId: "book-1",
  name: "Pierwszy falszywy sen",
  role: "Inciting incident",
  description: "Bohaterka znajduje odbitke snu, ktorego nikt nie snil.",
  orderIndex: 0,
  createdAt: "2026-06-05T12:00:00Z",
  updatedAt: "2026-06-05T12:00:00Z",
  chapterId: "chapter-1"
};

const plan: BookPlan = {
  structure: {
    id: "structure-1",
    bookId: "book-1",
    structureType: "three_act",
    description: "Klasyczna struktura trzech aktow.",
    notes: "",
    status: "draft",
    createdAt: "2026-06-05T12:00:00Z",
    updatedAt: "2026-06-05T12:00:00Z"
  },
  acts: [
    {
      id: "act-1",
      bookId: "book-1",
      name: "Poczatek",
      purpose: "Uruchomic sledztwo.",
      summary: "",
      startPercent: 0,
      endPercent: 25,
      color: "#3f8f6b",
      orderIndex: 0,
      createdAt: "2026-06-05T12:00:00Z",
      updatedAt: "2026-06-05T12:00:00Z"
    }
  ],
  beats: [beat],
  threads: [
    {
      id: "thread-1",
      bookId: "book-1",
      name: "Pamiec miasta",
      description: "Watek kontroli wspomnien.",
      color: "#3f8f6b",
      status: "planned",
      orderIndex: 0,
      createdAt: "2026-06-05T12:00:00Z",
      updatedAt: "2026-06-05T12:00:00Z"
    }
  ],
  chapters: [
    {
      id: "chapter-1",
      bookId: "book-1",
      actId: "act-1",
      number: 1,
      workingTitle: "Drukowany sen",
      summary: "Pierwszy trop.",
      purpose: "Pokazac anomalie.",
      conflict: "Bohaterka ryzykuje prace.",
      turningPoint: "Odnajduje falszywa odbitke.",
      targetWordCount: 3000,
      orderIndex: 0,
      createdAt: "2026-06-05T12:00:00Z",
      updatedAt: "2026-06-05T12:00:00Z"
    }
  ],
  chapterThreads: [{ chapterId: "chapter-1", threadId: "thread-1", description: "" }],
  chapterBeats: [{ chapterId: "chapter-1", beatId: "beat-1" }]
};

describe("buildPlanPromptPackage", () => {
  it("renders beat fields as single-field AI suggestions with beat and plan context", () => {
    for (const field of ["beatName", "beatRole", "beatDescription"] as const) {
      const promptPackage = buildPlanPromptPackage(project, book, plan, field, beat);
      const prompt = renderPlanPromptPackage(promptPackage);

      expect(promptPackage.action).toBe("generate_beat_field");
      expect(promptPackage.outputContract.format).toBe("json");
      expect(prompt).toContain(`Docelowe pole: ${field}`);
      expect(prompt).toContain('"kind": "book_plan_suggestion"');
      expect(prompt).toContain('"value": "string"');
      expect(prompt).toContain(beat.name);
      expect(prompt).toContain(beat.role);
      expect(prompt).toContain(beat.description);
      expect(prompt).toContain("Drukowany sen");
      expect(prompt).toContain("Pamiec miasta");
      expect(prompt).toContain(book.premise);
    }
  });
});
