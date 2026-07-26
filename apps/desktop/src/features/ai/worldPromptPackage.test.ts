import { describe, expect, it } from "vitest";
import type { Book, BookPlan, CharacterWorkspace, Project, WorldWorkspace } from "../../shared/api/types";
import { WORLD_ELEMENT_TYPES } from "../../shared/api/worldElementTypes";
import {
  buildWorldPromptPackage,
  renderWorldPromptPackage,
  type WorldFieldKey
} from "./worldPromptPackage";

const project = { id: "project-1", language: "pl" } as Project;
const book = { id: "book-1", workingTitle: "Zatoka" } as Book;
const plan = { chapters: [], threads: [] } as unknown as BookPlan;
const characters = { characters: [], relations: [] } as unknown as CharacterWorkspace;
const world = { elements: [], rules: [] } as unknown as WorldWorkspace;

function packageFor(fieldKey: WorldFieldKey) {
  return buildWorldPromptPackage(project, book, plan, characters, world, fieldKey);
}

describe("worldSuggestionSchema", () => {
  it("dla pełnego elementu podaje listę dozwolonych typów zamiast jednej wartości", () => {
    const schema = packageFor("worldElement").outputContract.schema as Record<string, unknown>;

    expect(schema.type).not.toBe("location");
    for (const type of WORLD_ELEMENT_TYPES) {
      expect(String(schema.type)).toContain(type);
    }
  });

  it("dla samego pola typu dołącza allowedValues", () => {
    const schema = packageFor("elementType").outputContract.schema as Record<string, unknown>;

    expect(schema.allowedValues).toEqual([...WORLD_ELEMENT_TYPES]);
  });

  it("nie dokłada allowedValues do pozostałych pól elementu", () => {
    const schema = packageFor("elementSummary").outputContract.schema as Record<string, unknown>;

    expect(schema.allowedValues).toBeUndefined();
    expect(schema.value).toBe("string");
  });
});

describe("renderWorldPromptPackage", () => {
  it("zakazuje kopiowania typu ze schematu i z migawki przy generacji elementu", () => {
    const prompt = renderWorldPromptPackage(packageFor("worldElement"));

    expect(prompt).toContain("historical_event");
    expect(prompt).toContain("Nie kopiuj typu ze schematu ani z migawki");
  });

  it("dokłada tę samą regułę przy generacji samego pola typu", () => {
    const prompt = renderWorldPromptPackage(packageFor("elementType"));

    expect(prompt).toContain("Nie kopiuj typu ze schematu ani z migawki");
  });

  it("nie dokłada reguły typu do reguł świata", () => {
    const prompt = renderWorldPromptPackage(packageFor("worldRule"));

    expect(prompt).not.toContain("Nie kopiuj typu ze schematu");
  });
});
