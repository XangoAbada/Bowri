import { characterFieldConfigs } from "./characterPromptPackage";
import { planFieldConfigs } from "./planPromptPackage";
import { conceptFieldConfigs, longConceptFields } from "./promptPackage";
import { worldFieldConfigs } from "./worldPromptPackage";

// Pola encji, które burza mózgów może aktualizować. Klucz = nazwa kolumny w
// Upsert*Input (to nią posługuje się entityFieldUpdate), etykieta pochodzi z
// konfiguracji pól używanej przez resztę aplikacji, żeby nazwy w modalu zgadzały
// się z nazwami w edytorach postaci, świata i planu.
//
// Świadomie POZA listą: name, status, orderIndex, imageAssetId, aliasesJson,
// visualPrompt, characterType, elementType, color. Zmiana nazwy encji z bocznego
// panelu psuje dedup po nazwach, etykiety relacji na kartach planu i identyfikację
// encji w toczącej się rozmowie.

export type BrainstormEntityKind = "character" | "worldElement" | "worldRule" | "plotThread";

export type EntityFieldTarget = {
  /** Klucz kolumny w Upsert*Input. */
  key: string;
  label: string;
  /** Pola jednolinijkowe nie dostają trybu „Dopisz" w modalu. */
  multiline: boolean;
};

type LabelledConfig = Record<string, { label: string } | undefined>;

function labelFrom(configs: LabelledConfig, configKey: string, fallback: string): string {
  return configs[configKey]?.label ?? fallback;
}

/** Klucze konfiguracji pól nie zawsze równają się kolumnom (świat, plan). */
function characterField(key: string, multiline = true): EntityFieldTarget {
  return { key, label: labelFrom(characterFieldConfigs as LabelledConfig, key, key), multiline };
}

function worldField(key: string, configKey: string, multiline = true): EntityFieldTarget {
  return { key, label: labelFrom(worldFieldConfigs as LabelledConfig, configKey, key), multiline };
}

function planField(key: string, configKey: string, multiline = true): EntityFieldTarget {
  return { key, label: labelFrom(planFieldConfigs as LabelledConfig, configKey, key), multiline };
}

export const BRAINSTORM_ENTITY_FIELDS: Record<BrainstormEntityKind, EntityFieldTarget[]> = {
  character: [
    characterField("role", false),
    characterField("shortDescription"),
    characterField("appearance"),
    characterField("temperament"),
    characterField("likesDislikes"),
    characterField("innerWorld"),
    characterField("worldview"),
    characterField("secret"),
    characterField("voiceNotes"),
    characterField("mannerisms"),
    characterField("origin"),
    characterField("family"),
    characterField("background"),
    characterField("knowledgeNotes")
  ],
  worldElement: [
    worldField("summary", "elementSummary"),
    worldField("details", "elementDetails"),
    worldField("storyPurpose", "elementStoryPurpose"),
    worldField("constraints", "elementConstraints")
  ],
  worldRule: [
    worldField("description", "ruleDescription"),
    worldField("scope", "ruleScope"),
    worldField("cost", "ruleCost"),
    worldField("limitation", "ruleLimitation"),
    worldField("exceptions", "ruleExceptions"),
    worldField("violationConsequences", "ruleViolationConsequences"),
    worldField("sceneExamples", "ruleSceneExamples")
  ],
  plotThread: [
    planField("description", "threadDescription"),
    planField("resolution", "threadResolution")
  ]
};

// --- Koncepcja książki: rodzaj używany przez audyt spójności, nie przez burzę mózgów ---
//
// Tekstowe pola BookConceptInput. Świadomie POZA listą: title i workingTitle
// (zmiana tytułu z bocznego panelu psuje identyfikację projektu), themesJson
// i alternativeTitlesJson (tablice JSON, nie zwykły tekst) oraz targetWordCount
// (liczba). Zapis idzie przez update_book_concept, który dla każdej kolumny
// używa COALESCE, więc wysłanie jednego pola jest prawdziwym patchem.

const CONCEPT_FIELD_KEYS = [
  "premise",
  "expandedPremise",
  "protagonistSummary",
  "protagonistGoal",
  "centralConflict",
  "antagonistForce",
  "stakes",
  "settingSketch",
  "endingDirection",
  "genre",
  "subgenre",
  "targetAudience",
  "tone",
  "styleGuide",
  "pointOfView",
  "unwantedThemes"
] as const;

export type ConceptFieldTargetKey = (typeof CONCEPT_FIELD_KEYS)[number];

export const CONCEPT_FIELD_TARGETS: EntityFieldTarget[] = CONCEPT_FIELD_KEYS.map((key) => ({
  key,
  label: labelFrom(conceptFieldConfigs as LabelledConfig, key, key),
  multiline: (longConceptFields as string[]).includes(key)
}));

/** Rodzaje encji z patchem pojedynczego pola — burza mózgów plus koncepcja. */
export type EntityFieldKind = BrainstormEntityKind | "concept";

export const ENTITY_FIELD_TARGETS: Record<EntityFieldKind, EntityFieldTarget[]> = {
  ...BRAINSTORM_ENTITY_FIELDS,
  concept: CONCEPT_FIELD_TARGETS
};

export function isEntityFieldKind(value: unknown): value is EntityFieldKind {
  return value === "concept" || isBrainstormEntityKind(value);
}

export function isEntityFieldAllowed(kind: EntityFieldKind, field: string): boolean {
  return ENTITY_FIELD_TARGETS[kind].some((target) => target.key === field);
}

export function entityKindLabel(kind: EntityFieldKind): string {
  switch (kind) {
    case "concept":
      return "Koncepcja";
    case "character":
      return "Postać";
    case "worldElement":
      return "Element świata";
    case "worldRule":
      return "Reguła świata";
    case "plotThread":
      return "Wątek";
  }
}

/**
 * Sekcja promptu audytu: pełna whitelista pól wraz z koncepcją. Odrębna od
 * renderEntityFieldWhitelist, bo tamta idzie do promptu burzy mózgów, która
 * koncepcji nie dotyka.
 */
export function renderAuditFieldWhitelist(): string {
  return (Object.keys(ENTITY_FIELD_TARGETS) as EntityFieldKind[])
    .map((kind) => {
      const fields = ENTITY_FIELD_TARGETS[kind]
        .map((target) => `${target.key} (${target.label})`)
        .join(", ");
      return `${kind}: ${fields}`;
    })
    .join("\n");
}

export function isBrainstormEntityKind(value: unknown): value is BrainstormEntityKind {
  return (
    value === "character" ||
    value === "worldElement" ||
    value === "worldRule" ||
    value === "plotThread"
  );
}

export function isBrainstormEntityField(kind: BrainstormEntityKind, field: string): boolean {
  return BRAINSTORM_ENTITY_FIELDS[kind].some((target) => target.key === field);
}

export function entityFieldTarget(
  kind: EntityFieldKind,
  field: string
): EntityFieldTarget | null {
  return ENTITY_FIELD_TARGETS[kind].find((target) => target.key === field) ?? null;
}

export function entityFieldLabel(kind: EntityFieldKind, field: string): string {
  return entityFieldTarget(kind, field)?.label ?? field;
}

/** Sekcja promptu: co wolno aktualizować, z etykietami zrozumiałymi dla modelu. */
export function renderEntityFieldWhitelist(): string {
  return (Object.keys(BRAINSTORM_ENTITY_FIELDS) as BrainstormEntityKind[])
    .map((kind) => {
      const fields = BRAINSTORM_ENTITY_FIELDS[kind]
        .map((target) => `${target.key} (${target.label})`)
        .join(", ");
      return `${kind}: ${fields}`;
    })
    .join("\n");
}
