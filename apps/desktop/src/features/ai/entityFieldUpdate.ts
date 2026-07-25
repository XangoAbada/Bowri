import {
  getBookPlan,
  getCharacterWorkspace,
  getWorldWorkspace,
  upsertCharacter,
  upsertPlotThread,
  upsertWorldElement,
  upsertWorldRule
} from "../../shared/api/commands";
import type {
  Character,
  PlotThread,
  WorldElement,
  WorldRule
} from "../../shared/api/types";
import {
  isBrainstormEntityField,
  type BrainstormEntityKind
} from "./brainstormEntityTargets";

// Zapis JEDNEGO pola istniejącej encji — ścieżka burzy mózgów, która uzupełnia
// story bible bez dodatkowego wywołania modelu.
//
// Osobny moduł (obok discoveryDrafts.ts) z tego samego powodu: panel sugestii
// nie może importować z AiProposalPanel, bo oba komponenty żyją w tym samym
// prawym sidebarze i powstałby cykl importów.

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

export type EntityFieldUpdate = {
  projectId: string;
  bookId: string;
  kind: BrainstormEntityKind;
  entityId: string;
  field: string;
  value: string;
  mode: "append" | "replace";
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
  if (!isBrainstormEntityField(update.kind, update.field)) {
    throw new UnknownEntityFieldError(update.field);
  }

  switch (update.kind) {
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

async function applyCharacterField(
  update: EntityFieldUpdate
): Promise<EntityFieldUpdateResult> {
  const workspace = await getCharacterWorkspace(update.projectId);
  const character = workspace.characters.find((item) => item.id === update.entityId);
  if (!character) {
    throw new EntityNotFoundError(update.entityId);
  }

  const previousValue = stringField(character, update.field);
  const nextValue = mergeFieldValue(previousValue, update.value, update.mode);
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
  const nextValue = mergeFieldValue(previousValue, update.value, update.mode);
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
  const nextValue = mergeFieldValue(previousValue, update.value, update.mode);
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
  const nextValue = mergeFieldValue(previousValue, update.value, update.mode);
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
  entity: Character | WorldElement | WorldRule | PlotThread,
  field: string
): string {
  const value = (entity as unknown as Record<string, unknown>)[field];
  return typeof value === "string" ? value : "";
}
