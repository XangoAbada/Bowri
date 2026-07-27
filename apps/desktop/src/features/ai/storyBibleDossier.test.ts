import { describe, expect, it } from "vitest";
import type {
  Book,
  BookPlan,
  Character,
  CharacterWorkspace,
  Project,
  WorldWorkspace
} from "../../shared/api/types";
import { buildStoryBibleDossier, EMPTY_MARKER } from "./storyBibleDossier";

const LONG_TEXT = `A${"ą".repeat(2999)}`;

const project = { id: "project-1", name: "Zatoka", language: "pl" } as Project;

const book = {
  id: "book-1",
  projectId: "project-1",
  title: "Zatoka Cieni",
  workingTitle: "Zatoka",
  premise: LONG_TEXT,
  expandedPremise: "",
  protagonistSummary: "Kaja, latarniczka",
  protagonistGoal: "Odnaleźć brata",
  centralConflict: "Morze zabiera tych, których kocha",
  antagonistForce: "Prąd Zapomnienia",
  stakes: "",
  settingSketch: "Rybacka osada na północy",
  endingDirection: "",
  genre: "fantasy",
  subgenre: "",
  targetAudience: "young adult",
  tone: "melancholijny",
  styleGuide: "Krótkie zdania.",
  pointOfView: "pierwsza osoba",
  targetWordCount: 90000,
  themesJson: '["pamięć","strata"]',
  unwantedThemes: "",
  alternativeTitlesJson: "[]",
  coverImagePath: "",
  coverPrompt: "TEGO NIE MA BYĆ W DOSSIER",
  coverNegativePrompt: "",
  coverGeneratedAt: null,
  storySoFar: "STRESZCZENIE AI, KTOREGO NIE MA BYC",
  storySoFarStale: 0,
  status: "draft",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-02T00:00:00Z"
} as Book;

function characterFixture(index: number, overrides: Partial<Character> = {}): Character {
  return {
    id: `character-${index}`,
    projectId: "project-1",
    characterType: "human",
    name: `Postać ${index}`,
    aliasesJson: '["Alias"]',
    role: "poboczna",
    shortDescription: `Opis ${index}`,
    appearance: "",
    temperament: "",
    likesDislikes: "",
    innerWorld: "",
    worldview: "",
    secret: "",
    voiceNotes: "",
    mannerisms: "",
    origin: "",
    family: "",
    background: "",
    knowledgeNotes: "",
    visualPrompt: "PROMPT GRAFICZNY POZA DOSSIER",
    imageAssetId: null,
    status: "active",
    orderIndex: index,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides
  } as Character;
}

const emptyPlan = {
  planVersion: { id: "plan-version-1", name: "v1" },
  planVersions: [],
  structure: null,
  acts: [],
  beats: [],
  threads: [],
  chapters: [],
  chapterThreads: [],
  chapterBeats: [],
  scenes: [],
  sceneCharacters: [],
  sceneThreads: [],
  sceneWorldElements: [],
  sceneWorldRules: []
} as unknown as BookPlan;

const emptyWorld = {
  elements: [],
  rules: [],
  elementCharacters: [],
  elementThreads: [],
  elementChapters: [],
  elementScenes: [],
  elementRules: [],
  ruleThreads: [],
  ruleChapters: [],
  ruleScenes: [],
  visualAssets: []
} as unknown as WorldWorkspace;

function workspaceWith(characters: Character[]): CharacterWorkspace {
  return {
    characters,
    relations: [],
    memories: [],
    memoryLinks: [],
    visualAssets: []
  } as unknown as CharacterWorkspace;
}

function dossierFor(
  characters: CharacterWorkspace = workspaceWith([]),
  plan: BookPlan = emptyPlan,
  world: WorldWorkspace = emptyWorld
) {
  return buildStoryBibleDossier({ project, book, plan, characters, world });
}

describe("buildStoryBibleDossier — brak obcinania", () => {
  it("przenosi pole dłuższe niż MAX_FIELD_CHARS w całości", () => {
    const dossier = dossierFor();

    expect(dossier.text).toContain(LONG_TEXT);
    expect(dossier.text).not.toContain("…");
  });

  it("nie gubi żadnej postaci przy 40 postaciach", () => {
    const characters = Array.from({ length: 40 }, (_, index) => characterFixture(index + 1));
    const dossier = dossierFor(workspaceWith(characters));

    for (const character of characters) {
      expect(dossier.text).toContain(`[character:${character.id}]`);
    }
    expect(dossier.counts.character).toBe(40);
    expect(dossier.knownIds.character.size).toBe(40);
  });

  it("nie dokłada żadnej informacji o pominiętych wpisach", () => {
    const characters = Array.from({ length: 40 }, (_, index) => characterFixture(index + 1));
    const dossier = dossierFor(workspaceWith(characters));

    expect(dossier.text).not.toContain("pominięto");
    expect(dossier.text).not.toContain("Ograniczono kontekst");
  });
});

describe("buildStoryBibleDossier — puste pola i wykluczenia", () => {
  it("renderuje puste pole jawnie, zamiast je pomijać", () => {
    const dossier = dossierFor();

    expect(dossier.text).toContain(`- Stawki: ${EMPTY_MARKER}`);
    expect(dossier.text).toContain(`- Kierunek zakończenia: ${EMPTY_MARKER}`);
  });

  it("nie wpuszcza prozy, streszczeń AI ani promptów graficznych", () => {
    const dossier = dossierFor(workspaceWith([characterFixture(1)]));

    expect(dossier.text).not.toContain("STRESZCZENIE AI");
    expect(dossier.text).not.toContain("TEGO NIE MA BYĆ W DOSSIER");
    expect(dossier.text).not.toContain("PROMPT GRAFICZNY POZA DOSSIER");
  });

  it("rozwija tablice JSON na czytelną listę", () => {
    const dossier = dossierFor();

    expect(dossier.text).toContain("- Motywy: pamięć, strata");
    expect(dossier.text).toContain(`- Alternatywne tytuły: ${EMPTY_MARKER}`);
  });
});

describe("buildStoryBibleDossier — identyfikatory i hash", () => {
  it("zna id koncepcji i wszystkich encji", () => {
    const dossier = dossierFor(workspaceWith([characterFixture(1)]));

    expect(dossier.knownIds.concept.has("book-1")).toBe(true);
    expect(dossier.knownIds.character.has("character-1")).toBe(true);
    expect(dossier.knownIds.character.has("character-999")).toBe(false);
    expect(dossier.text).toContain(`[concept:${book.id}]`);
  });

  it("jest deterministyczny — ten sam wsad daje ten sam hash", () => {
    const first = dossierFor(workspaceWith([characterFixture(1)]));
    const second = dossierFor(workspaceWith([characterFixture(1)]));

    expect(second.hash).toBe(first.hash);
    expect(second.estimatedTokens).toBe(first.estimatedTokens);
  });

  it("zmienia hash po edycji dowolnego pola", () => {
    const before = dossierFor(workspaceWith([characterFixture(1)]));
    const after = dossierFor(
      workspaceWith([characterFixture(1, { secret: "Zabiła własnego ojca." })])
    );

    expect(after.hash).not.toBe(before.hash);
  });
});
