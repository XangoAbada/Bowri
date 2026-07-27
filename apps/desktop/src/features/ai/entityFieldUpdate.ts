import {
  getBookPlan,
  getCharacterWorkspace,
  getProject,
  getWorldWorkspace,
  updateBookConcept,
  upsertCharacter,
  upsertPlotThread,
  upsertWorldElement,
  upsertWorldRule
} from "../../shared/api/commands";
import type {
  Book,
  BookConceptInput,
  Character,
  PlotThread,
  WorldElement,
  WorldRule
} from "../../shared/api/types";
import {
  isEntityFieldAllowed,
  type EntityFieldKind
} from "./brainstormEntityTargets";

// Zapis JEDNEGO pola istniejącej encji. Ścieżka współdzielona przez burzę
// mózgów (uzupełnia story bible bez dodatkowego wywołania modelu) i audyt
// spójności (stosuje pojedynczą poprawkę z raportu).
//
// Osobny moduł (obok discoveryDrafts.ts) z tego samego powodu: panele sugestii
// nie mogą importować z AiProposalPanel, bo wszystkie żyją w tym samym prawym
// sidebarze i powstałby cykl importów.

export class EntityNotFoundError extends Error {
  constructor(public entityId: string) {
    super(`Nie znaleziono encji o identyfikatorze ${entityId}.`);
    this.name = "EntityNotFoundError";
  }
}

export class UnknownEntityFieldError extends Error {
  constructor(public field: string) {
    super(`Pole ${field} nie jest dozwolone do aktualizacji z burzy mózgów.`);
    this.name = "UnknownEntityFieldError";
  }
}

/**
 * Treść pola zmieniła się od czasu, gdy poprawka została wygenerowana. Rzucane
 * zamiast zapisu, bo `replace` z nieaktualnego raportu audytu wymazałby ręczną
 * pracę autora bez śladu.
 */
export class StaleFieldValueError extends Error {
  constructor(public field: string) {
    super(
      `Treść pola ${field} zmieniła się od wygenerowania tej poprawki. Uruchom analizę ponownie, żeby nie nadpisać własnych zmian.`
    );
    this.name = "StaleFieldValueError";
  }
}

export type EntityFieldUpdate = {
  projectId: string;
  bookId: string;
  kind: EntityFieldKind;
  /** Dla kind === "concept" nieużywane — celem jest książka wskazana przez bookId. */
  entityId: string;
  field: string;
  value: string;
  mode: "append" | "replace";
  /**
   * Początek treści, jaką pole miało w momencie tworzenia poprawki. Podawany
   * przez audyt spójności; przy niezgodności zapis jest odrzucany. Dla trybu
   * "append" bez znaczenia — dopisanie nic nie kasuje.
   */
  expectedCurrentPrefix?: string;
};

export type EntityFieldUpdateResult = {
  entityId: string;
  field: string;
  previousValue: string;
  nextValue: string;
};

/**
 * Docelowa treść pola. Czysta funkcja: tego samego wyniku używa podgląd
 * „Po zapisie" w modalu i faktyczny zapis, więc nie mogą się rozjechać.
 * Zachowanie identyczne z dopisywaniem do pól koncepcji.
 */
export function mergeFieldValue(
  current: string,
  incoming: string,
  mode: "append" | "replace"
): string {
  const trimmed = current.trim();
  return mode === "append" && trimmed ? `${trimmed}\n\n${incoming}` : incoming;
}

/**
 * Odczytuje encję, podmienia jedno pole i odsyła KOMPLET pozostałych wartości.
 * Upsert w backendzie nadpisuje cały wiersz, więc wysłanie samego jednego pola
 * wyzerowałoby resztę. Nieznane id kończy się błędem, a nie zapisem: przy braku
 * konfliktu `INSERT ... ON CONFLICT(id) DO UPDATE` utworzyłby po cichu nową
 * encję z halucynowanym identyfikatorem.
 */
export async function applyEntityFieldUpdate(
  update: EntityFieldUpdate
): Promise<EntityFieldUpdateResult> {
  if (!isEntityFieldAllowed(update.kind, update.field)) {
    throw new UnknownEntityFieldError(update.field);
  }

  switch (update.kind) {
    case "concept":
      return applyConceptField(update);
    case "character":
      return applyCharacterField(update);
    case "worldElement":
      return applyWorldElementField(update);
    case "worldRule":
      return applyWorldRuleField(update);
    case "plotThread":
      return applyPlotThreadField(update);
  }
}

function resultFor(
  update: EntityFieldUpdate,
  previousValue: string,
  nextValue: string
): EntityFieldUpdateResult {
  return { entityId: update.entityId, field: update.field, previousValue, nextValue };
}

/**
 * Docelowa treść pola z kontrolą świeżości. Porównanie po prefiksie, nie po
 * całości: audyt zapisuje w poprawce tylko początek widzianej treści (do 200
 * znaków), bo pełna kopia każdego pola podwoiłaby rozmiar raportu.
 */
function nextValueFor(update: EntityFieldUpdate, previousValue: string): string {
  const expected = update.expectedCurrentPrefix?.trim();
  if (update.mode === "replace" && expected) {
    const current = previousValue.trim();
    if (!current.startsWith(expected.slice(0, current.length))) {
      throw new StaleFieldValueError(update.field);
    }
  }
  return mergeFieldValue(previousValue, update.value, update.mode);
}

/**
 * Koncepcja książki. Jedyna encja, której nie trzeba odsyłać w całości:
 * update_book_concept ustawia każdą kolumnę przez COALESCE(?, kolumna), więc
 * pominięte pola zostają nietknięte. Wysyłamy dokładnie jedno pole.
 */
async function applyConceptField(
  update: EntityFieldUpdate
): Promise<EntityFieldUpdateResult> {
  const details = await getProject(update.projectId);
  if (!details.book || details.book.id !== update.bookId) {
    throw new EntityNotFoundError(update.bookId);
  }

  const previousValue = stringField(details.book, update.field);
  const nextValue = nextValueFor(update, previousValue);
  await updateBookConcept(update.bookId, {
    [update.field]: nextValue
  } as BookConceptInput);
  return resultFor({ ...update, entityId: update.bookId }, previousValue, nextValue);
}

async function applyCharacterField(
  update: EntityFieldUpdate
): Promise<EntityFieldUpdateResult> {
  const workspace = await getCharacterWorkspace(update.projectId);
  const character = workspace.characters.find((item) => item.id === update.entityId);
  if (!character) {
    throw new EntityNotFoundError(update.entityId);
  }

  const previousValue = stringField(character, update.field);
  const nextValue = nextValueFor(update, previousValue);
  await upsertCharacter({
    id: character.id,
    projectId: character.projectId,
    characterType: character.characterType,
    name: character.name,
    aliasesJson: character.aliasesJson,
    role: character.role,
    shortDescription: character.shortDescription,
    appearance: character.appearance,
    temperament: character.temperament,
    likesDislikes: character.likesDislikes,
    innerWorld: character.innerWorld,
    worldview: character.worldview,
    secret: character.secret,
    voiceNotes: character.voiceNotes,
    mannerisms: character.mannerisms,
    origin: character.origin,
    family: character.family,
    background: character.background,
    knowledgeNotes: character.knowledgeNotes,
    visualPrompt: character.visualPrompt,
    imageAssetId: character.imageAssetId,
    status: character.status,
    orderIndex: character.orderIndex,
    [update.field]: nextValue
  });
  return resultFor(update, previousValue, nextValue);
}

async function applyWorldElementField(
  update: EntityFieldUpdate
): Promise<EntityFieldUpdateResult> {
  const workspace = await getWorldWorkspace(update.projectId);
  const element = workspace.elements.find((item) => item.id === update.entityId);
  if (!element) {
    throw new EntityNotFoundError(update.entityId);
  }

  const previousValue = stringField(element, update.field);
  const nextValue = nextValueFor(update, previousValue);
  await upsertWorldElement({
    id: element.id,
    projectId: element.projectId,
    elementType: element.elementType,
    name: element.name,
    summary: element.summary,
    details: element.details,
    storyPurpose: element.storyPurpose,
    constraints: element.constraints,
    visualPrompt: element.visualPrompt,
    imageAssetId: element.imageAssetId,
    status: element.status,
    orderIndex: element.orderIndex,
    [update.field]: nextValue
  });
  return resultFor(update, previousValue, nextValue);
}

async function applyWorldRuleField(
  update: EntityFieldUpdate
): Promise<EntityFieldUpdateResult> {
  const workspace = await getWorldWorkspace(update.projectId);
  const rule = workspace.rules.find((item) => item.id === update.entityId);
  if (!rule) {
    throw new EntityNotFoundError(update.entityId);
  }

  const previousValue = stringField(rule, update.field);
  const nextValue = nextValueFor(update, previousValue);
  await upsertWorldRule({
    id: rule.id,
    projectId: rule.projectId,
    name: rule.name,
    description: rule.description,
    scope: rule.scope,
    cost: rule.cost,
    limitation: rule.limitation,
    exceptions: rule.exceptions,
    violationConsequences: rule.violationConsequences,
    sceneExamples: rule.sceneExamples,
    status: rule.status,
    orderIndex: rule.orderIndex,
    [update.field]: nextValue
  });
  return resultFor(update, previousValue, nextValue);
}

async function applyPlotThreadField(
  update: EntityFieldUpdate
): Promise<EntityFieldUpdateResult> {
  const plan = await getBookPlan(update.bookId);
  const thread = plan.threads.find((item) => item.id === update.entityId);
  if (!thread) {
    throw new EntityNotFoundError(update.entityId);
  }

  const previousValue = stringField(thread, update.field);
  const nextValue = nextValueFor(update, previousValue);
  await upsertPlotThread({
    id: thread.id,
    bookId: thread.bookId,
    name: thread.name,
    description: thread.description,
    resolution: thread.resolution,
    color: thread.color,
    status: thread.status,
    orderIndex: thread.orderIndex,
    [update.field]: nextValue
  });
  return resultFor(update, previousValue, nextValue);
}

/** Bieżąca wartość pola; pola encji z whitelisty są zawsze tekstowe. */
export function stringField(
  entity: Book | Character | WorldElement | WorldRule | PlotThread,
  field: string
): string {
  const value = (entity as unknown as Record<string, unknown>)[field];
  return typeof value === "string" ? value : "";
}
