import type {
  Act,
  Beat,
  Book,
  BookPlan,
  Chapter,
  Character,
  CharacterMemory,
  CharacterMemoryLink,
  CharacterRelation,
  CharacterWorkspace,
  PlotThread,
  Project,
  Scene,
  WorldElement,
  WorldRule,
  WorldWorkspace
} from "../../shared/api/types";
import { fnv1aHash } from "../../shared/text/plainText";
import { estimateTokens } from "./contextWindows";

// PEŁNE, NIEOBCINANE dossier projektu — jedyny kontekst audytu spójności.
//
// Ten plik świadomie NIE importuje niczego z promptContextLimits.ts i nie wolno
// tego zmienić. Cała reszta warstwy promptów oszczędza tokeny: MAX_FIELD_CHARS
// ścina pola do 600 znaków, renderCappedStoryBible przycina Story Bible do
// 24 000 znaków i pomija wpisy, a optionalLine wycina puste pola. Dla audytu
// każdy z tych mechanizmów produkuje fałszywy wynik:
//   - ucięte pole wygląda jak niedokończone zdanie, czyli fałszywa sprzeczność,
//   - pominięta encja to sprzeczność, której model nigdy nie zobaczy,
//   - pominięte puste pole to luka w projekcie, która staje się niewidoczna,
//     a wykrywanie luk jest jednym z celów analizy.
// Dlatego puste pola renderujemy JAWNIE jako EMPTY_MARKER.
//
// Poza dossier zostają wyłącznie dane, które nie są treścią projektu: proza scen
// (decyzja autora — audyt dotyczy przygotowań przed pisaniem), pola pochodne AI
// (autoSummary, storySoFar, *Stale, *SourceHash), zasoby graficzne
// (visualPrompt, imageAssetId, coverPrompt) oraz metadane techniczne
// (createdAt, updatedAt, orderIndex — orderIndex służy do sortowania).

export type DossierEntityKind =
  | "concept"
  | "character"
  | "relation"
  | "memory"
  | "memoryLink"
  | "worldElement"
  | "worldRule"
  | "plotThread"
  | "act"
  | "beat"
  | "chapter"
  | "scene";

export const DOSSIER_ENTITY_KINDS: readonly DossierEntityKind[] = [
  "concept",
  "character",
  "relation",
  "memory",
  "memoryLink",
  "worldElement",
  "worldRule",
  "plotThread",
  "act",
  "beat",
  "chapter",
  "scene"
];

export type StoryBibleDossier = {
  /** Pełny Markdown — wchodzi do promptu bez żadnego obcięcia. */
  text: string;
  /**
   * Hash treści dossier. Wskaźnik nieaktualności raportu (ten sam mechanizm co
   * scene_critiques.source_hash) oraz dowód, że wszystkie przebiegi jednego
   * audytu widziały dokładnie ten sam materiał.
   */
  hash: string;
  counts: Record<DossierEntityKind, number>;
  /**
   * Identyfikatory obecne w dossier. Model nie mógł ich wymyślić, więc patch
   * wskazujący na id spoza tego zbioru jest halucynacją i nie trafia do zapisu.
   */
  knownIds: Record<DossierEntityKind, Set<string>>;
  estimatedTokens: number;
};

/** Pole faktycznie puste w projekcie — nie to samo co pole pominięte. */
export const EMPTY_MARKER = "— (nieuzupełnione)";

export function buildStoryBibleDossier({
  project,
  book,
  plan,
  characters,
  world
}: {
  project: Project;
  book: Book;
  plan: BookPlan;
  characters: CharacterWorkspace;
  world: WorldWorkspace;
}): StoryBibleDossier {
  const index = buildIndex(plan, characters, world);
  const sections = [
    renderHeader(project, book, plan, characters, world),
    renderConcept(book),
    renderCharacters(characters, index),
    renderRelations(characters.relations, index),
    renderMemories(characters.memories, index),
    renderMemoryLinks(characters.memoryLinks, index),
    renderWorldElements(world, index),
    renderWorldRules(world, index),
    renderStructure(plan),
    renderThreads(plan, world, index),
    renderChapters(plan, world, index),
    renderScenes(plan, world, index)
  ];
  const text = sections.join("\n\n");

  return {
    text,
    hash: fnv1aHash(text),
    counts: {
      concept: 1,
      character: characters.characters.length,
      relation: characters.relations.length,
      memory: characters.memories.length,
      memoryLink: characters.memoryLinks.length,
      worldElement: world.elements.length,
      worldRule: world.rules.length,
      plotThread: plan.threads.length,
      act: plan.acts.length,
      beat: plan.beats.length,
      chapter: plan.chapters.length,
      scene: plan.scenes.length
    },
    knownIds: {
      concept: new Set([book.id]),
      character: idSet(characters.characters),
      relation: idSet(characters.relations),
      memory: idSet(characters.memories),
      memoryLink: idSet(characters.memoryLinks),
      worldElement: idSet(world.elements),
      worldRule: idSet(world.rules),
      plotThread: idSet(plan.threads),
      act: idSet(plan.acts),
      beat: idSet(plan.beats),
      chapter: idSet(plan.chapters),
      scene: idSet(plan.scenes)
    },
    estimatedTokens: estimateTokens(text)
  };
}

// ---------------------------------------------------------------------------
// Indeks nazw i powiązań — pozwala renderować referencje jako "nazwa [kind:id]"
// ---------------------------------------------------------------------------

type DossierIndex = {
  characterName: Map<string, string>;
  elementName: Map<string, string>;
  ruleName: Map<string, string>;
  threadName: Map<string, string>;
  actName: Map<string, string>;
  beatName: Map<string, string>;
  chapterLabel: Map<string, string>;
  sceneLabel: Map<string, string>;
  memoryLabel: Map<string, string>;
};

function buildIndex(
  plan: BookPlan,
  characters: CharacterWorkspace,
  world: WorldWorkspace
): DossierIndex {
  return {
    characterName: labelMap(characters.characters, (item) => item.name),
    elementName: labelMap(world.elements, (item) => item.name),
    ruleName: labelMap(world.rules, (item) => item.name),
    threadName: labelMap(plan.threads, (item) => item.name),
    actName: labelMap(plan.acts, (item) => item.name),
    beatName: labelMap(plan.beats, (item) => item.name),
    chapterLabel: labelMap(plan.chapters, (item) =>
      `Rozdział ${item.number}${item.workingTitle ? `: ${item.workingTitle}` : ""}`
    ),
    sceneLabel: labelMap(plan.scenes, (item) => item.title),
    memoryLabel: labelMap(characters.memories, (item) => item.title)
  };
}

function labelMap<T extends { id: string }>(
  items: T[],
  label: (item: T) => string
): Map<string, string> {
  return new Map(items.map((item) => [item.id, label(item).trim() || "(bez nazwy)"]));
}

function idSet<T extends { id: string }>(items: T[]): Set<string> {
  return new Set(items.map((item) => item.id));
}

// ---------------------------------------------------------------------------
// Sekcje
// ---------------------------------------------------------------------------

function renderHeader(
  project: Project,
  book: Book,
  plan: BookPlan,
  characters: CharacterWorkspace,
  world: WorldWorkspace
): string {
  return `# Dossier projektu: ${project.name || "(bez nazwy)"}

Ten dokument jest KOMPLETNYM zbiorem danych projektu przygotowanym do audytu
spójności: każda encja i każde pole treściowe. Nic nie zostało skrócone,
przycięte ani pominięte ze względu na rozmiar.

Pole opisane jako "${EMPTY_MARKER}" jest FAKTYCZNIE PUSTE w projekcie — to luka
do zgłoszenia, nie skutek obcięcia kontekstu.

Każda encja ma w nagłówku identyfikator w postaci \`[rodzaj:id]\`. Wskazując cel
poprawki, przepisuj ten identyfikator znak w znak.

Świadomie poza dossier: napisana proza scen, streszczenia generowane przez AI,
prompty i zasoby graficzne, znaczniki czasu utworzenia i modyfikacji.

## Zawartość
- Język projektu: ${project.language || "pl"}
- Aktywna wersja planu: ${plan.planVersion?.name || "(bez nazwy)"} [planVersion:${plan.planVersion?.id ?? ""}]
- Postacie: ${characters.characters.length}
- Relacje między postaciami: ${characters.relations.length}
- Wspomnienia postaci: ${characters.memories.length}
- Powiązania wspomnień: ${characters.memoryLinks.length}
- Elementy świata: ${world.elements.length}
- Reguły świata: ${world.rules.length}
- Wątki: ${plan.threads.length}
- Akty: ${plan.acts.length}
- Beaty: ${plan.beats.length}
- Rozdziały: ${plan.chapters.length}
- Sceny: ${plan.scenes.length}`;
}

function renderConcept(book: Book): string {
  return `## 1. Koncepcja książki  [concept:${book.id}]

${lines([
    field("Tytuł", book.title),
    field("Tytuł roboczy", book.workingTitle),
    field("Alternatywne tytuły", jsonList(book.alternativeTitlesJson)),
    field("Premisa", book.premise),
    field("Rozwinięta premisa", book.expandedPremise),
    field("Protagonista (opis)", book.protagonistSummary),
    field("Cel protagonisty", book.protagonistGoal),
    field("Konflikt centralny", book.centralConflict),
    field("Siła antagonistyczna", book.antagonistForce),
    field("Stawki", book.stakes),
    field("Szkic świata", book.settingSketch),
    field("Kierunek zakończenia", book.endingDirection),
    field("Gatunek", book.genre),
    field("Podgatunek", book.subgenre),
    field("Odbiorca docelowy", book.targetAudience),
    field("Ton", book.tone),
    field("Przewodnik stylu", book.styleGuide),
    field("Perspektywa narracyjna", book.pointOfView),
    field("Docelowa liczba słów", numberValue(book.targetWordCount)),
    field("Motywy", jsonList(book.themesJson)),
    field("Motywy niepożądane", book.unwantedThemes),
    field("Status", book.status)
  ])}`;
}

function renderCharacters(characters: CharacterWorkspace, index: DossierIndex): string {
  const items = sorted(characters.characters);
  if (!items.length) {
    return `## 2. Postacie (0)\n\n(w projekcie nie ma ani jednej postaci)`;
  }

  const body = items.map((character, position) =>
    renderCharacter(character, position + 1, characters, index)
  );
  return `## 2. Postacie (${items.length})\n\n${body.join("\n\n")}`;
}

function renderCharacter(
  character: Character,
  position: number,
  characters: CharacterWorkspace,
  index: DossierIndex
): string {
  const outgoing = characters.relations.filter(
    (relation) => relation.fromCharacterId === character.id
  );
  const incoming = characters.relations.filter(
    (relation) => relation.toCharacterId === character.id
  );
  const memories = characters.memories.filter(
    (memory) => memory.characterId === character.id
  );

  return `### 2.${position}. Postać: ${character.name || "(bez imienia)"}  [character:${character.id}]

${lines([
    field("Rodzaj", character.characterType),
    field("Pseudonimy / aliasy", jsonList(character.aliasesJson)),
    field("Rola w fabule", character.role),
    field("Krótki opis", character.shortDescription),
    field("Wygląd", character.appearance),
    field("Temperament", character.temperament),
    field("Lubi / nie lubi", character.likesDislikes),
    field("Świat wewnętrzny", character.innerWorld),
    field("Światopogląd", character.worldview),
    field("Sekret", character.secret),
    field("Sposób mówienia", character.voiceNotes),
    field("Manieryzmy", character.mannerisms),
    field("Pochodzenie", character.origin),
    field("Rodzina", character.family),
    field("Tło / historia", character.background),
    field("Co postać wie (wiedza)", character.knowledgeNotes),
    field("Status", character.status),
    field(
      "Relacje wychodzące",
      refList(
        outgoing.map(
          (relation) =>
            `${index.characterName.get(relation.toCharacterId) ?? "(nieznana postać)"} [relation:${relation.id}]${relation.relationType ? ` · ${relation.relationType}` : ""}`
        )
      )
    ),
    field(
      "Relacje przychodzące",
      refList(
        incoming.map(
          (relation) =>
            `${index.characterName.get(relation.fromCharacterId) ?? "(nieznana postać)"} [relation:${relation.id}]${relation.relationType ? ` · ${relation.relationType}` : ""}`
        )
      )
    ),
    field(
      "Wspomnienia",
      refList(memories.map((memory) => `${memory.title || "(bez tytułu)"} [memory:${memory.id}]`))
    )
  ])}`;
}

function renderRelations(relations: CharacterRelation[], index: DossierIndex): string {
  if (!relations.length) {
    return `## 3. Relacje między postaciami (0)\n\n(brak zdefiniowanych relacji)`;
  }

  const body = relations.map((relation, position) => {
    const from = index.characterName.get(relation.fromCharacterId) ?? "(nieznana postać)";
    const to = index.characterName.get(relation.toCharacterId) ?? "(nieznana postać)";
    return `### 3.${position + 1}. ${from} → ${to}  [relation:${relation.id}]

${lines([
      field("Od", `${from} [character:${relation.fromCharacterId}]`),
      field("Do", `${to} [character:${relation.toCharacterId}]`),
      field("Rodzaj relacji", relation.relationType),
      field("Opis", relation.description),
      field("Historia", relation.history),
      field("Konflikt", relation.conflict),
      field("Opinia o drugiej stronie", relation.opinion),
      field("Poziom zaufania", scaleValue(relation.trustLevel, trustLabel)),
      field("Sekret w relacji", relation.secret),
      field("Zmiana w czasie", relation.changeOverTime),
      field("Status", relation.status)
    ])}`;
  });
  return `## 3. Relacje między postaciami (${relations.length})

Relacje są kierunkowe. Brak relacji zwrotnej nie jest błędem sam z siebie, ale
sprzeczne opisy tej samej pary postaci już tak.

${body.join("\n\n")}`;
}

function renderMemories(memories: CharacterMemory[], index: DossierIndex): string {
  if (!memories.length) {
    return `## 4. Wspomnienia postaci (0)\n\n(brak zdefiniowanych wspomnień)`;
  }

  const body = memories.map((memory, position) => {
    const owner = index.characterName.get(memory.characterId) ?? "(nieznana postać)";
    return `### 4.${position + 1}. ${memory.title || "(bez tytułu)"}  [memory:${memory.id}]

${lines([
      field("Postać", `${owner} [character:${memory.characterId}]`),
      field("Streszczenie", memory.summary),
      field("Szczegóły", memory.details),
      field("Rodzaj wspomnienia", memory.memoryType),
      field("Czego/kogo dotyczy", memory.subject),
      field("Emocja", memory.emotion),
      field("Waga", scaleValue(memory.importance, importanceLabel)),
      field("Status", memory.status)
    ])}`;
  });
  return `## 4. Wspomnienia postaci (${memories.length})\n\n${body.join("\n\n")}`;
}

function renderMemoryLinks(links: CharacterMemoryLink[], index: DossierIndex): string {
  if (!links.length) {
    return `## 5. Powiązania wspomnień (0)\n\n(brak powiązań)`;
  }

  const body = links.map((link) => {
    const from = index.memoryLabel.get(link.fromMemoryId) ?? "(nieznane wspomnienie)";
    const to = index.memoryLabel.get(link.toMemoryId) ?? "(nieznane wspomnienie)";
    return `- ${from} [memory:${link.fromMemoryId}] → ${to} [memory:${link.toMemoryId}] [memoryLink:${link.id}]
  - Rodzaj: ${textOrEmpty(link.linkType)}
  - Opis: ${textOrEmpty(link.description)}
  - Siła: ${textOrEmpty(scaleValue(link.strength, strengthLabel))}`;
  });
  return `## 5. Powiązania wspomnień (${links.length})\n\n${body.join("\n")}`;
}

function renderWorldElements(world: WorldWorkspace, index: DossierIndex): string {
  const items = sorted(world.elements);
  if (!items.length) {
    return `## 6. Elementy świata (0)\n\n(brak elementów świata)`;
  }

  const body = items.map((element, position) =>
    renderWorldElement(element, position + 1, world, index)
  );
  return `## 6. Elementy świata (${items.length})\n\n${body.join("\n\n")}`;
}

function renderWorldElement(
  element: WorldElement,
  position: number,
  world: WorldWorkspace,
  index: DossierIndex
): string {
  return `### 6.${position}. ${element.name || "(bez nazwy)"}  [worldElement:${element.id}]

${lines([
    field("Rodzaj elementu", element.elementType),
    field("Streszczenie", element.summary),
    field("Szczegóły", element.details),
    field("Cel fabularny", element.storyPurpose),
    field("Ograniczenia", element.constraints),
    field("Status", element.status),
    field(
      "Powiązane reguły",
      refList(
        world.elementRules
          .filter((link) => link.elementId === element.id)
          .map(
            (link) =>
              `${index.ruleName.get(link.ruleId) ?? "(nieznana reguła)"} [worldRule:${link.ruleId}]`
          )
      )
    ),
    field(
      "Powiązane postacie",
      refList(
        world.elementCharacters
          .filter((link) => link.elementId === element.id)
          .map(
            (link) =>
              `${index.characterName.get(link.characterId) ?? "(nieznana postać)"} [character:${link.characterId}]`
          )
      )
    ),
    field(
      "Powiązane wątki",
      refList(
        world.elementThreads
          .filter((link) => link.elementId === element.id)
          .map(
            (link) =>
              `${index.threadName.get(link.threadId) ?? "(nieznany wątek)"} [plotThread:${link.threadId}]`
          )
      )
    ),
    field(
      "Powiązane rozdziały",
      refList(
        world.elementChapters
          .filter((link) => link.elementId === element.id)
          .map(
            (link) =>
              `${index.chapterLabel.get(link.chapterId) ?? "(nieznany rozdział)"} [chapter:${link.chapterId}]`
          )
      )
    ),
    field(
      "Powiązane sceny",
      refList(
        world.elementScenes
          .filter((link) => link.elementId === element.id)
          .map(
            (link) =>
              `${index.sceneLabel.get(link.sceneId) ?? "(nieznana scena)"} [scene:${link.sceneId}]`
          )
      )
    )
  ])}`;
}

function renderWorldRules(world: WorldWorkspace, index: DossierIndex): string {
  const items = sorted(world.rules);
  if (!items.length) {
    return `## 7. Reguły świata (0)\n\n(brak reguł świata)`;
  }

  const body = items.map((rule, position) => renderWorldRule(rule, position + 1, world, index));
  return `## 7. Reguły świata (${items.length})\n\n${body.join("\n\n")}`;
}

function renderWorldRule(
  rule: WorldRule,
  position: number,
  world: WorldWorkspace,
  index: DossierIndex
): string {
  return `### 7.${position}. ${rule.name || "(bez nazwy)"}  [worldRule:${rule.id}]

${lines([
    field("Opis", rule.description),
    field("Zasięg", rule.scope),
    field("Koszt", rule.cost),
    field("Ograniczenie", rule.limitation),
    field("Wyjątki", rule.exceptions),
    field("Konsekwencje naruszenia", rule.violationConsequences),
    field("Przykłady scen", rule.sceneExamples),
    field("Status", rule.status),
    field(
      "Powiązane elementy",
      refList(
        world.elementRules
          .filter((link) => link.ruleId === rule.id)
          .map(
            (link) =>
              `${index.elementName.get(link.elementId) ?? "(nieznany element)"} [worldElement:${link.elementId}]`
          )
      )
    ),
    field(
      "Powiązane wątki",
      refList(
        world.ruleThreads
          .filter((link) => link.ruleId === rule.id)
          .map(
            (link) =>
              `${index.threadName.get(link.threadId) ?? "(nieznany wątek)"} [plotThread:${link.threadId}]`
          )
      )
    ),
    field(
      "Powiązane rozdziały",
      refList(
        world.ruleChapters
          .filter((link) => link.ruleId === rule.id)
          .map(
            (link) =>
              `${index.chapterLabel.get(link.chapterId) ?? "(nieznany rozdział)"} [chapter:${link.chapterId}]`
          )
      )
    ),
    field(
      "Powiązane sceny",
      refList(
        world.ruleScenes
          .filter((link) => link.ruleId === rule.id)
          .map(
            (link) =>
              `${index.sceneLabel.get(link.sceneId) ?? "(nieznana scena)"} [scene:${link.sceneId}]`
          )
      )
    )
  ])}`;
}

function renderStructure(plan: BookPlan): string {
  const structureBlock = plan.structure
    ? lines([
        field("Typ struktury", plan.structure.structureType),
        field("Opis", plan.structure.description),
        field("Notatki", plan.structure.notes),
        field("Status", plan.structure.status)
      ])
    : "(struktura fabularna nie została wybrana)";

  const acts = sorted(plan.acts);
  const actsBlock = acts.length
    ? acts
        .map(
          (act: Act, position) => `### 8.${position + 1}. Akt: ${act.name || "(bez nazwy)"}  [act:${act.id}]

${lines([
            field("Cel aktu", act.purpose),
            field("Streszczenie", act.summary),
            field("Zakres", `${act.startPercent}% – ${act.endPercent}%`)
          ])}`
        )
        .join("\n\n")
    : "(brak aktów)";

  const beats = sorted(plan.beats);
  const beatsBlock = beats.length
    ? beats
        .map(
          (beat: Beat) => `- ${beat.name || "(bez nazwy)"} [beat:${beat.id}]
  - Rola: ${textOrEmpty(beat.role)}
  - Opis: ${textOrEmpty(beat.description)}`
        )
        .join("\n")
    : "(brak beatów)";

  return `## 8. Struktura fabularna

${structureBlock}

### Akty (${acts.length})

${actsBlock}

### Beaty (${beats.length})

${beatsBlock}`;
}

function renderThreads(plan: BookPlan, world: WorldWorkspace, index: DossierIndex): string {
  const items = sorted(plan.threads);
  if (!items.length) {
    return `## 9. Wątki (0)\n\n(brak wątków)`;
  }

  const body = items.map((thread: PlotThread, position) => {
    const chapterLinks = plan.chapterThreads.filter((link) => link.threadId === thread.id);
    const sceneLinks = plan.sceneThreads.filter((link) => link.threadId === thread.id);
    return `### 9.${position + 1}. Wątek: ${thread.name || "(bez nazwy)"}  [plotThread:${thread.id}]

${lines([
      field("Opis", thread.description),
      field("Rozwiązanie / payoff", thread.resolution),
      field("Status", thread.status),
      field(
        "Rozdziały",
        refList(
          chapterLinks.map(
            (link) =>
              `${index.chapterLabel.get(link.chapterId) ?? "(nieznany rozdział)"} [chapter:${link.chapterId}]${link.description ? ` — ${link.description}` : ""}`
          )
        )
      ),
      field(
        "Sceny",
        refList(
          sceneLinks.map(
            (link) =>
              `${index.sceneLabel.get(link.sceneId) ?? "(nieznana scena)"} [scene:${link.sceneId}]`
          )
        )
      ),
      field(
        "Powiązane elementy świata",
        refList(
          world.elementThreads
            .filter((link) => link.threadId === thread.id)
            .map(
              (link) =>
                `${index.elementName.get(link.elementId) ?? "(nieznany element)"} [worldElement:${link.elementId}]`
            )
        )
      ),
      field(
        "Powiązane reguły świata",
        refList(
          world.ruleThreads
            .filter((link) => link.threadId === thread.id)
            .map(
              (link) =>
                `${index.ruleName.get(link.ruleId) ?? "(nieznana reguła)"} [worldRule:${link.ruleId}]`
            )
        )
      )
    ])}`;
  });
  return `## 9. Wątki (${items.length})\n\n${body.join("\n\n")}`;
}

function renderChapters(plan: BookPlan, world: WorldWorkspace, index: DossierIndex): string {
  const items = sortedChapters(plan.chapters);
  if (!items.length) {
    return `## 10. Rozdziały (0)\n\n(brak rozdziałów)`;
  }

  const body = items.map((chapter: Chapter, position) => {
    const scenes = plan.scenes
      .filter((scene) => scene.chapterId === chapter.id)
      .sort((a, b) => a.orderIndex - b.orderIndex);
    return `### 10.${position + 1}. Rozdział ${chapter.number}: ${chapter.workingTitle || "(bez tytułu)"}  [chapter:${chapter.id}]

${lines([
      field(
        "Akt",
        chapter.actId
          ? `${index.actName.get(chapter.actId) ?? "(nieznany akt)"} [act:${chapter.actId}]`
          : ""
      ),
      field("Streszczenie", chapter.summary),
      field("Cel rozdziału", chapter.purpose),
      field("Konflikt", chapter.conflict),
      field("Punkt zwrotny", chapter.turningPoint),
      field("Docelowa liczba słów", numberValue(chapter.targetWordCount)),
      field(
        "Wątki",
        refList(
          plan.chapterThreads
            .filter((link) => link.chapterId === chapter.id)
            .map(
              (link) =>
                `${index.threadName.get(link.threadId) ?? "(nieznany wątek)"} [plotThread:${link.threadId}]${link.description ? ` — ${link.description}` : ""}`
            )
        )
      ),
      field(
        "Beaty",
        refList(
          plan.chapterBeats
            .filter((link) => link.chapterId === chapter.id)
            .map(
              (link) => `${index.beatName.get(link.beatId) ?? "(nieznany beat)"} [beat:${link.beatId}]`
            )
        )
      ),
      field(
        "Elementy świata",
        refList(
          world.elementChapters
            .filter((link) => link.chapterId === chapter.id)
            .map(
              (link) =>
                `${index.elementName.get(link.elementId) ?? "(nieznany element)"} [worldElement:${link.elementId}]`
            )
        )
      ),
      field(
        "Reguły świata",
        refList(
          world.ruleChapters
            .filter((link) => link.chapterId === chapter.id)
            .map(
              (link) => `${index.ruleName.get(link.ruleId) ?? "(nieznana reguła)"} [worldRule:${link.ruleId}]`
            )
        )
      ),
      field(
        "Sceny",
        refList(scenes.map((scene) => `${scene.title || "(bez tytułu)"} [scene:${scene.id}]`))
      )
    ])}`;
  });
  return `## 10. Rozdziały (${items.length})\n\n${body.join("\n\n")}`;
}

function renderScenes(plan: BookPlan, world: WorldWorkspace, index: DossierIndex): string {
  const items = [...plan.scenes].sort((a, b) => a.orderIndex - b.orderIndex);
  if (!items.length) {
    return `## 11. Sceny (0)\n\n(brak scen)`;
  }

  const body = items.map((scene: Scene, position) => {
    return `### 11.${position + 1}. Scena: ${scene.title || "(bez tytułu)"}  [scene:${scene.id}]

${lines([
      field(
        "Rozdział",
        scene.chapterId
          ? `${index.chapterLabel.get(scene.chapterId) ?? "(nieznany rozdział)"} [chapter:${scene.chapterId}]`
          : ""
      ),
      field("Streszczenie", scene.summary),
      field("Cel sceny", scene.goal),
      field("Konflikt", scene.conflict),
      field("Wynik", scene.outcome),
      field("Znacznik czasu", scene.timeMarker),
      field(
        "Postać POV",
        scene.povCharacterId
          ? `${index.characterName.get(scene.povCharacterId) ?? "(nieznana postać)"} [character:${scene.povCharacterId}]`
          : ""
      ),
      field(
        "Lokacja",
        scene.locationId
          ? `${index.elementName.get(scene.locationId) ?? "(nieznany element)"} [worldElement:${scene.locationId}]`
          : ""
      ),
      field("Docelowa liczba słów", numberValue(scene.targetWordCount)),
      field("Status", scene.status),
      field(
        "Postacie w scenie",
        refList(
          plan.sceneCharacters
            .filter((link) => link.sceneId === scene.id)
            .map(
              (link) =>
                `${index.characterName.get(link.characterId) ?? "(nieznana postać)"} [character:${link.characterId}]`
            )
        )
      ),
      field(
        "Wątki",
        refList(
          plan.sceneThreads
            .filter((link) => link.sceneId === scene.id)
            .map(
              (link) =>
                `${index.threadName.get(link.threadId) ?? "(nieznany wątek)"} [plotThread:${link.threadId}]`
            )
        )
      ),
      field(
        "Elementy świata",
        refList(
          world.elementScenes
            .filter((link) => link.sceneId === scene.id)
            .map(
              (link) =>
                `${index.elementName.get(link.elementId) ?? "(nieznany element)"} [worldElement:${link.elementId}]`
            )
        )
      ),
      field(
        "Reguły świata",
        refList(
          world.ruleScenes
            .filter((link) => link.sceneId === scene.id)
            .map(
              (link) => `${index.ruleName.get(link.ruleId) ?? "(nieznana reguła)"} [worldRule:${link.ruleId}]`
            )
        )
      )
    ])}`;
  });
  return `## 11. Sceny (${items.length})

Sceny zawierają wyłącznie metadane planistyczne — napisana proza nie wchodzi do
tego audytu.

${body.join("\n\n")}`;
}

// ---------------------------------------------------------------------------
// Renderowanie pól
// ---------------------------------------------------------------------------

/**
 * Jedno pole encji. Puste zawsze trafia do dossier jako EMPTY_MARKER — inaczej
 * niż optionalLine z promptContextLimits, które puste pola wycina. Wartości
 * wielolinijkowe idą pod etykietą jako wcięty blok, w PEŁNEJ długości.
 */
function field(label: string, value: string): string {
  const text = value.trim();
  if (!text) {
    return `- ${label}: ${EMPTY_MARKER}`;
  }
  if (!text.includes("\n")) {
    return `- ${label}: ${text}`;
  }
  const block = text
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
  return `- ${label}:\n${block}`;
}

function lines(entries: string[]): string {
  return entries.join("\n");
}

function textOrEmpty(value: string): string {
  return value.trim() || EMPTY_MARKER;
}

function refList(items: string[]): string {
  return items.length ? items.join("; ") : "";
}

function numberValue(value: number | null): string {
  return typeof value === "number" ? String(value) : "";
}

/** Skala liczbowa z etykietą słowną — liczba sama nic modelowi nie mówi. */
function scaleValue(value: number, label: (value: number) => string): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "";
  }
  return `${value}/100 (${label(value)})`;
}

function trustLabel(value: number): string {
  if (value >= 75) return "wysokie zaufanie";
  if (value >= 45) return "umiarkowane zaufanie";
  if (value >= 20) return "niskie zaufanie";
  return "brak zaufania";
}

function importanceLabel(value: number): string {
  if (value >= 75) return "kluczowe";
  if (value >= 45) return "istotne";
  return "drobne";
}

function strengthLabel(value: number): string {
  if (value >= 75) return "silne";
  if (value >= 45) return "średnie";
  return "słabe";
}

/** aliasesJson, themesJson, alternativeTitlesJson — tablice JSON w kolumnie TEXT. */
function jsonList(json: string): string {
  const raw = (json ?? "").trim();
  if (!raw) {
    return "";
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => (typeof item === "string" ? item.trim() : String(item)))
        .filter(Boolean)
        .join(", ");
    }
  } catch {
    // Nieparsowalny JSON to też informacja — pokaż surową treść.
  }
  return raw;
}

function sorted<T extends { orderIndex: number; id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.orderIndex - b.orderIndex || a.id.localeCompare(b.id));
}

function sortedChapters(items: Chapter[]): Chapter[] {
  return [...items].sort(
    (a, b) => a.orderIndex - b.orderIndex || a.number - b.number || a.id.localeCompare(b.id)
  );
}
