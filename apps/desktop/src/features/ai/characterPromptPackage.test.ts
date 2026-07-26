import { describe, expect, it } from "vitest";
import type { Book, CharacterWorkspace, Project } from "../../shared/api/types";
import { CHARACTER_TYPES } from "../../shared/api/characterTypes";
import {
  buildCharacterPromptPackage,
  renderCharacterPromptPackage,
  type CharacterFieldKey
} from "./characterPromptPackage";

const project = { id: "project-1", language: "pl" } as Project;
const book = { id: "book-1", workingTitle: "Zatoka" } as Book;
const workspace = {
  characters: [],
  relations: [],
  memories: [],
  memoryLinks: [],
  visualAssets: []
} as unknown as CharacterWorkspace;

function packageFor(fieldKey: CharacterFieldKey) {
  return buildCharacterPromptPackage(project, book, workspace, fieldKey);
}

describe("characterSuggestionSchema", () => {
  it("dla pełnego profilu podaje listę dozwolonych rodzajów", () => {
    const schema = packageFor("characterProfile").outputContract.schema as {
      character: Record<string, unknown>;
    };

    for (const type of CHARACTER_TYPES) {
      expect(String(schema.character.characterType)).toContain(type);
    }
  });

  it("dla samego pola rodzaju dołącza allowedValues", () => {
    const schema = packageFor("characterType").outputContract.schema as Record<string, unknown>;

    expect(schema.allowedValues).toEqual([...CHARACTER_TYPES]);
    expect(schema.value).not.toBe("string");
  });

  it("nie dokłada allowedValues do pozostałych pól profilu", () => {
    const schema = packageFor("appearance").outputContract.schema as Record<string, unknown>;

    expect(schema.allowedValues).toBeUndefined();
    expect(schema.value).toBe("string");
  });
});

describe("renderCharacterPromptPackage", () => {
  it("zakazuje kopiowania rodzaju ze schematu i z migawki przy generacji profilu", () => {
    const prompt = renderCharacterPromptPackage(packageFor("characterProfile"));

    expect(prompt).toContain("spirit");
    expect(prompt).toContain("Nie kopiuj rodzaju ze schematu ani z migawki");
  });

  it("dokłada tę samą regułę przy generacji samego pola rodzaju", () => {
    const prompt = renderCharacterPromptPackage(packageFor("characterType"));

    expect(prompt).toContain("Nie kopiuj rodzaju ze schematu ani z migawki");
  });

  it("nie dokłada reguły rodzaju do relacji", () => {
    const prompt = renderCharacterPromptPackage(packageFor("characterRelation"));

    expect(prompt).not.toContain("Nie kopiuj rodzaju ze schematu");
  });
});
