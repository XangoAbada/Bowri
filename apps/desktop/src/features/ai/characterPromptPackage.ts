import type {
  AIAction,
  Book,
  Character,
  CharacterMemory,
  CharacterMemoryLink,
  CharacterRelation,
  CharacterWorkspace,
  Project,
  VisualAsset
} from "../../shared/api/types";
import type { PromptContextControl, PromptContextSource } from "./promptPackage";

export type CharacterFieldKey =
  | "characterProfile"
  | "characterRelation"
  | "characterMemory"
  | "characterType"
  | "name"
  | "aliasesJson"
  | "role"
  | "shortDescription"
  | "externalGoal"
  | "internalNeed"
  | "wound"
  | "falseBelief"
  | "secret"
  | "strengthsJson"
  | "weaknessesJson"
  | "voiceNotes"
  | "arcSummary"
  | "knowledgeNotes"
  | "visualPrompt"
  | "relationDescription"
  | "relationHistory"
  | "relationConflict"
  | "relationOpinion"
  | "relationSecret"
  | "relationChangeOverTime"
  | "memoryTitle"
  | "memorySummary"
  | "memoryDetails"
  | "memorySubject"
  | "memoryEmotion"
  | "memoryLinkDescription"
  | "characterImage";

type CharacterContextKey =
  | CharacterFieldKey
  | "bookCore"
  | "styleGuide"
  | "allCharacters"
  | "targetCharacter"
  | "targetRelations"
  | "targetMemories"
  | "allMemories"
  | "memoryLinks"
  | "targetRelation"
  | "targetMemory"
  | "targetMemoryLink";

export type CharacterPromptEntity =
  | Character
  | CharacterRelation
  | CharacterMemory
  | CharacterMemoryLink;

export type CharacterFieldConfig = {
  key: CharacterFieldKey;
  label: string;
  action: AIAction;
  targetKind: "character" | "relation" | "memory" | "memoryLink" | "image";
  userInstruction: string;
};

export type CharacterPromptPackage = {
  id: string;
  projectId: string;
  bookId: string;
  action: AIAction;
  locale: "pl" | "en";
  userInstruction: string;
  context: {
    targetField: CharacterFieldKey;
    targetEntityId?: string;
    targetEntityLabel?: string;
    targetEntitySnapshot?: unknown;
    book: Pick<
      Book,
      | "workingTitle"
      | "premise"
      | "expandedPremise"
      | "genre"
      | "subgenre"
      | "settingSketch"
      | "targetAudience"
      | "tone"
      | "styleGuide"
      | "pointOfView"
    >;
    workspace: {
      characters: Character[];
      relations: CharacterRelation[];
      memories: CharacterMemory[];
      memoryLinks: CharacterMemoryLink[];
      visualAssets: VisualAsset[];
    };
    generationMode: "generate" | "expand";
    targetFieldCurrentValue: string;
    contextControl?: PromptContextControl;
  };
  outputContract: {
    kind: "character_field_suggestion" | "character_profile" | "character_relation" | "character_memory" | "character_image";
    format: "json" | "png";
    schema: unknown;
  };
  generationOptions: {
    providerId: "codex-cli-bridge";
    feature?: "image_generation";
    mode?: "fresh";
    outputFormat?: "png";
    aspectRatio?: "4:5";
  };
  imagePrompt?: string;
  negativePrompt?: string;
};

export const characterFieldConfigs: Record<CharacterFieldKey, CharacterFieldConfig> = {
  characterProfile: field("characterProfile", "Pelny profil postaci", "generate_character_field", "character", "Wygeneruj kompletny tekstowy profil jednej nowej postaci do powiesci. Nie generuj obrazu ani sciezki obrazu. Uwzglednij rodzaj postaci: moze to byc czlowiek, zwierze, ozywiony przedmiot, istota albo inny byt pasujacy do ksiazki."),
  characterRelation: field("characterRelation", "Pelna relacja", "generate_character_relation_field", "relation", "Wygeneruj kompletny szkic relacji miedzy wskazanymi postaciami: typ, opis, historie, konflikt, opinie, zaufanie, sekret i zmiane w czasie. Nie tworz nowych postaci."),
  characterMemory: field("characterMemory", "Pelne wspomnienie", "generate_character_memory_field", "memory", "Wygeneruj kompletne wspomnienie dla wskazanej postaci: tytul, opis, szczegoly, typ, temat, emocje i waznosc. Nie tworz obrazu ani nowych postaci."),
  characterType: field("characterType", "Rodzaj postaci", "generate_character_field", "character", "Wygeneruj tylko rodzaj postaci: czlowiek, zwierze, istota, ozywiony przedmiot albo inny precyzyjny typ."),
  name: field("name", "Imie / nazwa", "generate_character_field", "character", "Wygeneruj tylko imie lub nazwe postaci."),
  aliasesJson: field("aliasesJson", "Aliasy", "generate_character_field", "character", "Wygeneruj tylko liste aliasow postaci jako JSON array stringow."),
  role: field("role", "Rola fabularna", "generate_character_field", "character", "Wygeneruj tylko role fabularna postaci."),
  shortDescription: field("shortDescription", "Krotki opis", "generate_character_field", "character", "Wygeneruj tylko krotki opis postaci przydatny podczas pisania powiesci."),
  externalGoal: field("externalGoal", "Cel zewnetrzny", "generate_character_field", "character", "Wygeneruj tylko zewnetrzny cel postaci."),
  internalNeed: field("internalNeed", "Potrzeba wewnetrzna", "generate_character_field", "character", "Wygeneruj tylko wewnetrzna potrzebe postaci."),
  wound: field("wound", "Rana", "generate_character_field", "character", "Wygeneruj tylko rane psychologiczna lub fabularna postaci."),
  falseBelief: field("falseBelief", "Falszywe przekonanie", "generate_character_field", "character", "Wygeneruj tylko falszywe przekonanie postaci."),
  secret: field("secret", "Sekret", "generate_character_field", "character", "Wygeneruj tylko sekret postaci."),
  strengthsJson: field("strengthsJson", "Sily", "generate_character_field", "character", "Wygeneruj tylko liste sil postaci jako JSON array stringow."),
  weaknessesJson: field("weaknessesJson", "Slabosci", "generate_character_field", "character", "Wygeneruj tylko liste slabosci postaci jako JSON array stringow."),
  voiceNotes: field("voiceNotes", "Glos postaci", "generate_character_field", "character", "Wygeneruj tylko notatki o sposobie mowienia i glosie postaci."),
  arcSummary: field("arcSummary", "Luk przemiany", "generate_character_field", "character", "Wygeneruj tylko streszczenie luku przemiany postaci."),
  knowledgeNotes: field("knowledgeNotes", "Wiedza postaci", "generate_character_field", "character", "Wygeneruj tylko notatki o wiedzy postaci, pomylkach, domyslach i tajemnicach."),
  visualPrompt: field("visualPrompt", "Prompt wizualny", "generate_character_field", "character", "Wygeneruj tylko prompt wizualny postaci, bez generowania obrazu."),
  relationDescription: field("relationDescription", "Opis relacji", "generate_character_relation_field", "relation", "Wygeneruj tylko opis relacji miedzy dwiema postaciami."),
  relationHistory: field("relationHistory", "Historia relacji", "generate_character_relation_field", "relation", "Wygeneruj tylko historie relacji."),
  relationConflict: field("relationConflict", "Konflikt relacji", "generate_character_relation_field", "relation", "Wygeneruj tylko konflikt ukryty lub jawny w relacji."),
  relationOpinion: field("relationOpinion", "Opinia", "generate_character_relation_field", "relation", "Wygeneruj tylko opinie postaci A o postaci B."),
  relationSecret: field("relationSecret", "Sekret relacji", "generate_character_relation_field", "relation", "Wygeneruj tylko sekret zwiazany z relacja."),
  relationChangeOverTime: field("relationChangeOverTime", "Zmiana w czasie", "generate_character_relation_field", "relation", "Wygeneruj tylko zmiane relacji w czasie historii."),
  memoryTitle: field("memoryTitle", "Tytul wspomnienia", "generate_character_memory_field", "memory", "Wygeneruj tylko tytul wspomnienia."),
  memorySummary: field("memorySummary", "Opis wspomnienia", "generate_character_memory_field", "memory", "Wygeneruj tylko zwiezly opis wspomnienia."),
  memoryDetails: field("memoryDetails", "Szczegoly wspomnienia", "generate_character_memory_field", "memory", "Wygeneruj tylko szczegoly wspomnienia przydatne podczas pisania scen."),
  memorySubject: field("memorySubject", "Temat wspomnienia", "generate_character_memory_field", "memory", "Wygeneruj tylko temat, osobe, miejsce lub wydarzenie, ktorego dotyczy wspomnienie."),
  memoryEmotion: field("memoryEmotion", "Emocja", "generate_character_memory_field", "memory", "Wygeneruj tylko dominujaca emocje wspomnienia."),
  memoryLinkDescription: field("memoryLinkDescription", "Opis polaczenia", "generate_character_memory_field", "memoryLink", "Wygeneruj tylko opis polaczenia miedzy dwoma wspomnieniami."),
  characterImage: field("characterImage", "Obraz postaci", "generate_character_image", "image", "Wygeneruj obraz reprezentujacy postac na podstawie profilu i kontekstu powiesci.")
};

const defaultContext: Record<CharacterFieldKey, CharacterContextKey[]> = Object.fromEntries(
  Object.keys(characterFieldConfigs).map((key) => [
    key,
    ["bookCore", "styleGuide", "allCharacters", "targetCharacter", "targetRelations", "targetMemories"]
  ])
) as Record<CharacterFieldKey, CharacterContextKey[]>;

defaultContext.characterImage = [
  "bookCore",
  "styleGuide",
  "targetCharacter",
  "targetRelations",
  "targetMemories"
];
defaultContext.memoryLinkDescription = [
  "targetMemoryLink",
  "targetMemory",
  "allMemories",
  "memoryLinks"
];

const contextLabels: Record<CharacterContextKey, string> = {
  ...Object.fromEntries(
    Object.values(characterFieldConfigs).map((config) => [config.key, config.label])
  ) as Record<CharacterFieldKey, string>,
  bookCore: "Rdzen ksiazki",
  styleGuide: "Style guide",
  allCharacters: "Wszystkie postacie",
  targetCharacter: "Docelowa postac",
  targetRelations: "Relacje postaci",
  targetMemories: "Wspomnienia postaci",
  allMemories: "Wszystkie wspomnienia",
  memoryLinks: "Polaczenia wspomnien",
  targetRelation: "Docelowa relacja",
  targetMemory: "Docelowe wspomnienie",
  targetMemoryLink: "Docelowe polaczenie wspomnien"
};

export function buildCharacterPromptPackage(
  project: Project,
  book: Book,
  workspace: CharacterWorkspace,
  fieldKey: CharacterFieldKey,
  targetEntity?: CharacterPromptEntity,
  contextControl?: PromptContextControl
): CharacterPromptPackage {
  const config = characterFieldConfigs[fieldKey];
  const currentValue = currentCharacterFieldValue(fieldKey, targetEntity);
  const packageBase: CharacterPromptPackage = {
    id: createPromptId(config.action),
    projectId: project.id,
    bookId: book.id,
    action: config.action,
    locale: project.language === "en" ? "en" : "pl",
    userInstruction: config.userInstruction,
    context: {
      targetField: fieldKey,
      targetEntityId: targetEntity ? characterEntityId(targetEntity) : undefined,
      targetEntityLabel: targetEntity ? characterEntityLabel(workspace, targetEntity) : undefined,
      ...(targetEntity ? { targetEntitySnapshot: targetEntity } : {}),
      book: compactBook(book),
      workspace: {
        characters: workspace.characters,
        relations: workspace.relations,
        memories: workspace.memories,
        memoryLinks: workspace.memoryLinks,
        visualAssets: workspace.visualAssets
      },
      generationMode: currentValue.trim() ? "expand" : "generate",
      targetFieldCurrentValue: currentValue,
      contextControl: contextControl ?? defaultCharacterContextControl(fieldKey)
    },
    outputContract: {
      kind: characterOutputKind(fieldKey),
      format: fieldKey === "characterImage" ? "png" : "json",
      schema: characterSuggestionSchema(fieldKey)
    },
    generationOptions: {
      providerId: "codex-cli-bridge"
    }
  };

  if (fieldKey === "characterImage") {
    const imagePrompt = renderCharacterImagePrompt(book, targetEntity as Character | undefined);
    return {
      ...packageBase,
      generationOptions: {
        providerId: "codex-cli-bridge",
        feature: "image_generation",
        mode: "fresh",
        outputFormat: "png",
        aspectRatio: "4:5"
      },
      imagePrompt,
      negativePrompt:
        "No text, labels, watermark, UI frame, low quality, extra limbs, distorted face, blurry details, duplicate character, or cropped head."
    };
  }

  return packageBase;
}

export function renderCharacterPromptPackage(promptPackage: CharacterPromptPackage): string {
  if (promptPackage.context.targetField === "characterImage") {
    return `Generate one portrait/reference PNG character image with $imagegen.
Create it from scratch as a fresh image generation. Do not edit, reuse, vary, or derive from any existing image.
StoryForge2 final target path:
{OUTPUT_FILE}

Image brief:
${promptPackage.imagePrompt}

Avoid:
${promptPackage.negativePrompt}

Return only compact JSON after generation:
{"imagePath":"<actual PNG path or image session directory>"}
`;
  }

  const config = characterFieldConfigs[promptPackage.context.targetField];
  const scopeRule =
    promptPackage.context.targetField === "characterProfile"
      ? "- Wygeneruj komplet pol tekstowych profilu postaci. Nie generuj obrazu, pliku ani assetu."
      : promptPackage.context.targetField === "characterRelation"
        ? "- Wygeneruj komplet pol tekstowych jednej relacji. Nie tworz ani nie zapisuj postaci."
      : promptPackage.context.targetField === "characterMemory"
        ? "- Wygeneruj komplet pol tekstowych jednego wspomnienia. Nie tworz ani nie zapisuj postaci."
      : `- Wygeneruj tylko docelowe pole "${config.label}".`;
  return `# Role
Jestes asystentem pisarskim pracujacym wewnatrz StoryForge2.

# Task
${promptPackage.userInstruction}

# Hard Rules
- Pisz po polsku, chyba ze projekt ma inny jezyk.
- Dla locale "pl" uzywaj poprawnych polskich znakow.
- Nie zapisuj danych. Zwroc tylko propozycje jako JSON.
${scopeRule}
- Nie aktualizuj innych pol, postaci, relacji, wspomnien ani obrazow.
- Odpowiedz wylacznie poprawnym JSON bez trailing commas.

${renderAuthorPriority(promptPackage.context.contextControl)}

# Book Context
${renderBookContext(promptPackage.context.book, promptPackage.context.contextControl)}

# Character Workspace
${renderWorkspaceContext(promptPackage)}

# Current Work
Docelowe pole: ${promptPackage.context.targetField} (${config.label}).
Docelowy element: ${promptPackage.context.targetEntityLabel ?? "(brak)"}
Migawka docelowego elementu: ${JSON.stringify(promptPackage.context.targetEntitySnapshot ?? null)}
Obecna wartosc pola: ${emptyFallback(promptPackage.context.targetFieldCurrentValue)}
Tryb: ${promptPackage.context.generationMode}.

# Output Contract
Zwroc JSON:
${JSON.stringify(promptPackage.outputContract.schema, null, 2)}
`;
}

export function characterPromptContextSources(fieldKey: CharacterFieldKey): PromptContextSource[] {
  const required: PromptContextSource = {
    key: fieldKey,
    label: characterFieldConfigs[fieldKey].label,
    required: true
  };

  return [
    required,
    ...defaultContext[fieldKey]
      .filter((key) => key !== fieldKey)
      .map((key) => ({
        key,
        label: contextLabels[key],
        required: false
      }))
  ];
}

export function characterPromptContextSource(
  fieldKey: CharacterFieldKey,
  targetEntity?: CharacterPromptEntity
): PromptContextSource {
  return {
    key: `character-field:${fieldKey}:${targetEntity ? characterEntityId(targetEntity) : "global"}`,
    label: `Pole: ${characterFieldConfigs[fieldKey].label}`,
    required: false
  };
}

export function characterEntityId(entity: CharacterPromptEntity): string {
  if ("fromMemoryId" in entity) {
    return entity.id;
  }
  return entity.id;
}

function field(
  key: CharacterFieldKey,
  label: string,
  action: AIAction,
  targetKind: CharacterFieldConfig["targetKind"],
  userInstruction: string
): CharacterFieldConfig {
  return { key, label, action, targetKind, userInstruction };
}

function defaultCharacterContextControl(fieldKey: CharacterFieldKey): PromptContextControl {
  const sources = characterPromptContextSources(fieldKey);
  return {
    includedContextKeys: sources.map((source) => source.key),
    authorPriorityComment: "",
    contextSources: sources
  };
}

function characterOutputKind(fieldKey: CharacterFieldKey): CharacterPromptPackage["outputContract"]["kind"] {
  if (fieldKey === "characterImage") {
    return "character_image";
  }
  if (fieldKey === "characterProfile") {
    return "character_profile";
  }
  if (fieldKey === "characterRelation") {
    return "character_relation";
  }
  if (fieldKey === "characterMemory") {
    return "character_memory";
  }
  return "character_field_suggestion";
}

function compactBook(book: Book): CharacterPromptPackage["context"]["book"] {
  return {
    workingTitle: book.workingTitle ?? "",
    premise: book.premise ?? "",
    expandedPremise: book.expandedPremise ?? "",
    genre: book.genre ?? "",
    subgenre: book.subgenre ?? "",
    settingSketch: book.settingSketch ?? "",
    targetAudience: book.targetAudience ?? "",
    tone: book.tone ?? "",
    styleGuide: book.styleGuide ?? "",
    pointOfView: book.pointOfView ?? ""
  };
}

function renderBookContext(
  book: CharacterPromptPackage["context"]["book"],
  contextControl?: PromptContextControl
): string {
  if (!isIncluded("bookCore", contextControl)) {
    return "(pominieto przez autora)";
  }

  return [
    `Tytul roboczy: ${emptyFallback(book.workingTitle)}`,
    `Premisa: ${emptyFallback(book.premise)}`,
    `Rozszerzona premisa: ${emptyFallback(book.expandedPremise)}`,
    `Gatunek: ${emptyFallback([book.genre, book.subgenre].filter(Boolean).join(", "))}`,
    `Odbiorca / ton / POV: ${emptyFallback([book.targetAudience, book.tone, book.pointOfView].filter(Boolean).join(", "))}`,
    isIncluded("styleGuide", contextControl) ? `Style guide: ${emptyFallback(book.styleGuide)}` : ""
  ].filter(Boolean).join("\n");
}

function renderWorkspaceContext(promptPackage: CharacterPromptPackage): string {
  const { workspace, targetEntityId, contextControl } = promptPackage.context;
  const targetCharacter = findTargetCharacter(workspace, targetEntityId);
  return [
    isIncluded("allCharacters", contextControl)
      ? `Postacie: ${JSON.stringify(workspace.characters.map(compactCharacter))}`
      : "",
    isIncluded("targetCharacter", contextControl)
      ? `Docelowa postac: ${JSON.stringify(compactCharacter(targetCharacter))}`
      : "",
    isIncluded("targetRelations", contextControl)
      ? `Relacje postaci: ${JSON.stringify(workspace.relations.filter((relation) => relation.fromCharacterId === targetCharacter?.id || relation.toCharacterId === targetCharacter?.id).map(compactRelation))}`
      : "",
    isIncluded("targetMemories", contextControl)
      ? `Wspomnienia postaci: ${JSON.stringify(workspace.memories.filter((memory) => memory.characterId === targetCharacter?.id).map(compactMemory))}`
      : "",
    isIncluded("allMemories", contextControl)
      ? `Wszystkie wspomnienia: ${JSON.stringify(workspace.memories.map(compactMemory))}`
      : "",
    isIncluded("memoryLinks", contextControl)
      ? `Polaczenia wspomnien: ${JSON.stringify(workspace.memoryLinks)}`
      : "",
    renderManualFieldContext(promptPackage)
  ].filter(Boolean).join("\n") || "(brak wybranego kontekstu postaci)";
}

function renderManualFieldContext(promptPackage: CharacterPromptPackage): string {
  const contextControl = promptPackage.context.contextControl;
  if (!contextControl) {
    return "";
  }

  const selected = contextControl.contextSources.filter(
    (source) =>
      source.key.startsWith("character-field:") &&
      isIncluded(source.key, contextControl)
  );
  if (selected.length === 0) {
    return "";
  }

  return `Dodatkowe pola dodane przez autora: ${JSON.stringify(selected)}`;
}

function findTargetCharacter(
  workspace: CharacterPromptPackage["context"]["workspace"],
  targetEntityId?: string
): Character | null {
  const direct = workspace.characters.find((character) => character.id === targetEntityId);
  if (direct) {
    return direct;
  }
  const relation = workspace.relations.find((item) => item.id === targetEntityId);
  if (relation) {
    return workspace.characters.find((item) => item.id === relation.fromCharacterId) ?? null;
  }
  const memory = workspace.memories.find((item) => item.id === targetEntityId);
  if (memory) {
    return workspace.characters.find((item) => item.id === memory.characterId) ?? null;
  }
  return null;
}

function characterEntityLabel(
  workspace: CharacterWorkspace,
  entity: CharacterPromptEntity
): string {
  if ("name" in entity) {
    return entity.name;
  }
  if ("fromCharacterId" in entity) {
    const from = workspace.characters.find((item) => item.id === entity.fromCharacterId);
    const to = workspace.characters.find((item) => item.id === entity.toCharacterId);
    return `${from?.name ?? "Postac"} -> ${to?.name ?? "Postac"}`;
  }
  if ("characterId" in entity) {
    return entity.title;
  }
  return entity.description || "Polaczenie wspomnien";
}

function currentCharacterFieldValue(
  fieldKey: CharacterFieldKey,
  entity?: CharacterPromptEntity
): string {
  if (fieldKey === "characterProfile") {
    return "";
  }

  if (!entity) {
    return "";
  }
  const record = entity as Record<string, unknown>;
  const map: Partial<Record<CharacterFieldKey, string>> = {
    characterRelation: "",
    characterMemory: "",
    characterType: String(record.characterType ?? ""),
    name: String(record.name ?? ""),
    aliasesJson: String(record.aliasesJson ?? ""),
    role: String(record.role ?? ""),
    shortDescription: String(record.shortDescription ?? ""),
    externalGoal: String(record.externalGoal ?? ""),
    internalNeed: String(record.internalNeed ?? ""),
    wound: String(record.wound ?? ""),
    falseBelief: String(record.falseBelief ?? ""),
    secret: String(record.secret ?? ""),
    strengthsJson: String(record.strengthsJson ?? ""),
    weaknessesJson: String(record.weaknessesJson ?? ""),
    voiceNotes: String(record.voiceNotes ?? ""),
    arcSummary: String(record.arcSummary ?? ""),
    knowledgeNotes: String(record.knowledgeNotes ?? ""),
    visualPrompt: String(record.visualPrompt ?? ""),
    relationDescription: String(record.description ?? ""),
    relationHistory: String(record.history ?? ""),
    relationConflict: String(record.conflict ?? ""),
    relationOpinion: String(record.opinion ?? ""),
    relationSecret: String(record.secret ?? ""),
    relationChangeOverTime: String(record.changeOverTime ?? ""),
    memoryTitle: String(record.title ?? ""),
    memorySummary: String(record.summary ?? ""),
    memoryDetails: String(record.details ?? ""),
    memorySubject: String(record.subject ?? ""),
    memoryEmotion: String(record.emotion ?? ""),
    memoryLinkDescription: String(record.description ?? ""),
    characterImage: String(record.visualPrompt ?? "")
  };
  return map[fieldKey] ?? "";
}

function characterSuggestionSchema(fieldKey: CharacterFieldKey): unknown {
  if (fieldKey === "characterImage") {
    return {
      version: 1,
      kind: "character_image",
      imagePath: "string",
      prompt: "string",
      negativePrompt: "string",
      warnings: ["string"]
    };
  }

  if (fieldKey === "characterProfile") {
    return {
      version: 1,
      kind: "character_profile",
      summary: "string",
      character: {
        characterType: "person | animal | creature | object | spirit | other",
        name: "string",
        aliases: ["string"],
        role: "string",
        shortDescription: "string",
        externalGoal: "string",
        internalNeed: "string",
        wound: "string",
        falseBelief: "string",
        secret: "string",
        strengths: ["string"],
        weaknesses: ["string"],
        voiceNotes: "string",
        arcSummary: "string",
        knowledgeNotes: "string",
        visualPrompt: "string"
      },
      warnings: ["string"]
    };
  }

  if (fieldKey === "characterRelation") {
    return {
      version: 1,
      kind: "character_relation",
      summary: "string",
      relation: {
        relationType: "rodzina | przyjazn | romans | rywalizacja | mentor | wrog | sojusz | zaleznosc | tajemnica | inne",
        description: "string",
        history: "string",
        conflict: "string",
        opinion: "string",
        trustLevel: 0,
        secret: "string",
        changeOverTime: "string"
      },
      warnings: ["string"]
    };
  }

  if (fieldKey === "characterMemory") {
    return {
      version: 1,
      kind: "character_memory",
      summary: "string",
      memory: {
        title: "string",
        summary: "string",
        details: "string",
        memoryType: "wydarzenie | miejsce | osoba | przedmiot | sekret | sen | trauma | inne",
        subject: "string",
        emotion: "string",
        importance: 0
      },
      warnings: ["string"]
    };
  }

  return {
    version: 1,
    kind: "character_field_suggestion",
    field: fieldKey,
    summary: "string",
    value: fieldKey.endsWith("Json") ? ["string"] : "string",
    warnings: ["string"]
  };
}

function renderCharacterImagePrompt(book: Book, character?: Character): string {
  return [
    "Format: portrait 4:5 character reference image, polished raster illustration, no text.",
    optionalLine("Book", [book.workingTitle, book.genre, book.tone].filter(Boolean).join(", ")),
    optionalLine("World and mood", compact(book.settingSketch || book.premise, 220)),
    optionalLine("Character", character ? compact(`${character.name}, ${character.characterType}, ${character.role}. ${character.shortDescription}`, 260) : ""),
    optionalLine("Inner life", character ? compact([character.externalGoal, character.internalNeed, character.wound, character.falseBelief].filter(Boolean).join("; "), 240) : ""),
    optionalLine("Voice and arc", character ? compact([character.voiceNotes, character.arcSummary].filter(Boolean).join("; "), 220) : ""),
    optionalLine("Visual prompt", character?.visualPrompt ?? ""),
    optionalLine("Design note", compact(book.styleGuide, 180))
  ].filter(Boolean).join("\n");
}

function compactCharacter(character: Character | null | undefined) {
  return character ? {
    id: character.id,
    type: character.characterType,
    name: character.name,
    role: character.role,
    description: character.shortDescription,
    goal: character.externalGoal,
    need: character.internalNeed,
    voice: character.voiceNotes,
    arc: character.arcSummary,
    status: character.status
  } : null;
}

function compactRelation(relation: CharacterRelation) {
  return {
    id: relation.id,
    fromCharacterId: relation.fromCharacterId,
    toCharacterId: relation.toCharacterId,
    relationType: relation.relationType,
    description: relation.description,
    conflict: relation.conflict,
    opinion: relation.opinion,
    trustLevel: relation.trustLevel
  };
}

function compactMemory(memory: CharacterMemory) {
  return {
    id: memory.id,
    characterId: memory.characterId,
    title: memory.title,
    summary: memory.summary,
    subject: memory.subject,
    emotion: memory.emotion,
    importance: memory.importance
  };
}

function renderAuthorPriority(contextControl?: PromptContextControl): string {
  const comment = contextControl?.authorPriorityComment.trim();
  return comment ? `# Author Priority\nKomentarz autora ma najwyzszy priorytet:\n${comment}` : "";
}

function isIncluded(key: string, contextControl?: PromptContextControl): boolean {
  if (!contextControl) {
    return true;
  }
  const requiredKeys = new Set(
    contextControl.contextSources
      .filter((source) => source.required)
      .map((source) => source.key)
  );
  return requiredKeys.has(key) || contextControl.includedContextKeys.includes(key);
}

function optionalLine(label: string, value: string): string {
  return value.trim() ? `${label}: ${value.trim()}` : "";
}

function compact(value: string, maxLength = 200): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= maxLength
    ? normalized
    : `${normalized.slice(0, maxLength - 1).trim()}...`;
}

function emptyFallback(value: string | undefined | null): string {
  return value?.trim() ? value : "(brak)";
}

function createPromptId(action: AIAction): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${action}:${crypto.randomUUID()}`;
  }
  return `${action}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`;
}
