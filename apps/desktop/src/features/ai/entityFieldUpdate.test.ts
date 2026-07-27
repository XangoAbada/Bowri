import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Book, Character, ProjectDetails } from "../../shared/api/types";

vi.mock("../../shared/api/commands", () => ({
  getProject: vi.fn(),
  getBookPlan: vi.fn(),
  getCharacterWorkspace: vi.fn(),
  getWorldWorkspace: vi.fn(),
  updateBookConcept: vi.fn(),
  upsertCharacter: vi.fn(),
  upsertPlotThread: vi.fn(),
  upsertWorldElement: vi.fn(),
  upsertWorldRule: vi.fn()
}));

const commands = await import("../../shared/api/commands");
const {
  applyEntityFieldUpdate,
  EntityNotFoundError,
  StaleFieldValueError,
  UnknownEntityFieldError,
  mergeFieldValue
} = await import("./entityFieldUpdate");

const book = {
  id: "book-1",
  projectId: "project-1",
  premise: "Latarniczka szuka brata.",
  stakes: "",
  title: "Zatoka Cieni",
  tone: "melancholijny"
} as Book;

const character = {
  id: "character-1",
  projectId: "project-1",
  characterType: "human",
  name: "Kaja",
  aliasesJson: "[]",
  role: "protagonistka",
  shortDescription: "Latarniczka",
  appearance: "Wysoka",
  temperament: "",
  likesDislikes: "",
  innerWorld: "",
  worldview: "",
  secret: "Stara wina",
  voiceNotes: "",
  mannerisms: "",
  origin: "",
  family: "",
  background: "",
  knowledgeNotes: "",
  visualPrompt: "portret",
  imageAssetId: null,
  status: "active",
  orderIndex: 0
} as Character;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(commands.getProject).mockResolvedValue({
    project: { id: "project-1" },
    book
  } as ProjectDetails);
  vi.mocked(commands.getCharacterWorkspace).mockResolvedValue({
    characters: [character],
    relations: [],
    memories: [],
    memoryLinks: [],
    visualAssets: []
  } as never);
  vi.mocked(commands.updateBookConcept).mockResolvedValue(book);
  vi.mocked(commands.upsertCharacter).mockResolvedValue(character);
});

describe("mergeFieldValue", () => {
  it("dopisuje przez pustą linię, a przy pustym polu nie zostawia wcięcia", () => {
    expect(mergeFieldValue("Stare", "Nowe", "append")).toBe("Stare\n\nNowe");
    expect(mergeFieldValue("   ", "Nowe", "append")).toBe("Nowe");
    expect(mergeFieldValue("Stare", "Nowe", "replace")).toBe("Nowe");
  });
});

describe("applyEntityFieldUpdate — koncepcja", () => {
  it("wysyła dokładnie jedno pole koncepcji", async () => {
    const result = await applyEntityFieldUpdate({
      projectId: "project-1",
      bookId: "book-1",
      kind: "concept",
      entityId: "book-1",
      field: "stakes",
      value: "Zatoka pochłonie osadę.",
      mode: "replace"
    });

    expect(commands.updateBookConcept).toHaveBeenCalledWith("book-1", {
      stakes: "Zatoka pochłonie osadę."
    });
    expect(result).toEqual({
      entityId: "book-1",
      field: "stakes",
      previousValue: "",
      nextValue: "Zatoka pochłonie osadę."
    });
  });

  it("dopisuje do istniejącej treści pola koncepcji", async () => {
    await applyEntityFieldUpdate({
      projectId: "project-1",
      bookId: "book-1",
      kind: "concept",
      entityId: "book-1",
      field: "premise",
      value: "Morze pamięta.",
      mode: "append"
    });

    expect(commands.updateBookConcept).toHaveBeenCalledWith("book-1", {
      premise: "Latarniczka szuka brata.\n\nMorze pamięta."
    });
  });

  it("odrzuca tytuł, bo nie jest na whiteliście", async () => {
    await expect(
      applyEntityFieldUpdate({
        projectId: "project-1",
        bookId: "book-1",
        kind: "concept",
        entityId: "book-1",
        field: "title",
        value: "Inny tytuł",
        mode: "replace"
      })
    ).rejects.toThrow(UnknownEntityFieldError);
    expect(commands.updateBookConcept).not.toHaveBeenCalled();
  });

  it("nie zapisuje, gdy bookId nie zgadza się z aktywną książką projektu", async () => {
    await expect(
      applyEntityFieldUpdate({
        projectId: "project-1",
        bookId: "book-obcy",
        kind: "concept",
        entityId: "book-obcy",
        field: "stakes",
        value: "cokolwiek",
        mode: "replace"
      })
    ).rejects.toThrow(EntityNotFoundError);
    expect(commands.updateBookConcept).not.toHaveBeenCalled();
  });
});

describe("applyEntityFieldUpdate — kontrola świeżości", () => {
  it("odrzuca replace, gdy treść pola zmieniła się po wygenerowaniu poprawki", async () => {
    await expect(
      applyEntityFieldUpdate({
        projectId: "project-1",
        bookId: "book-1",
        kind: "concept",
        entityId: "book-1",
        field: "premise",
        value: "Nowa premisa.",
        mode: "replace",
        expectedCurrentPrefix: "Rybak szuka siostry."
      })
    ).rejects.toThrow(StaleFieldValueError);
    expect(commands.updateBookConcept).not.toHaveBeenCalled();
  });

  it("przepuszcza replace, gdy prefiks się zgadza", async () => {
    await applyEntityFieldUpdate({
      projectId: "project-1",
      bookId: "book-1",
      kind: "concept",
      entityId: "book-1",
      field: "premise",
      value: "Nowa premisa.",
      mode: "replace",
      expectedCurrentPrefix: "Latarniczka szuka"
    });

    expect(commands.updateBookConcept).toHaveBeenCalledWith("book-1", {
      premise: "Nowa premisa."
    });
  });

  it("nie sprawdza świeżości przy dopisywaniu — append nic nie kasuje", async () => {
    await applyEntityFieldUpdate({
      projectId: "project-1",
      bookId: "book-1",
      kind: "concept",
      entityId: "book-1",
      field: "premise",
      value: "Morze pamięta.",
      mode: "append",
      expectedCurrentPrefix: "Zupełnie inna treść."
    });

    expect(commands.updateBookConcept).toHaveBeenCalledWith("book-1", {
      premise: "Latarniczka szuka brata.\n\nMorze pamięta."
    });
  });
});

describe("applyEntityFieldUpdate — postać", () => {
  it("odsyła komplet pól, podmieniając tylko jedno", async () => {
    await applyEntityFieldUpdate({
      projectId: "project-1",
      bookId: "book-1",
      kind: "character",
      entityId: "character-1",
      field: "temperament",
      value: "Zamknięta w sobie.",
      mode: "replace"
    });

    const payload = vi.mocked(commands.upsertCharacter).mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(payload.temperament).toBe("Zamknięta w sobie.");
    expect(payload.name).toBe("Kaja");
    expect(payload.secret).toBe("Stara wina");
    expect(payload.appearance).toBe("Wysoka");
  });

  it("nie zapisuje encji o nieznanym identyfikatorze", async () => {
    await expect(
      applyEntityFieldUpdate({
        projectId: "project-1",
        bookId: "book-1",
        kind: "character",
        entityId: "character-halucynacja",
        field: "temperament",
        value: "cokolwiek",
        mode: "replace"
      })
    ).rejects.toThrow(EntityNotFoundError);
    expect(commands.upsertCharacter).not.toHaveBeenCalled();
  });
});
