import type {
  Book,
  BookPlan,
  CharacterWorkspace,
  Chapter,
  PlotThread,
  Scene,
  WorldElement,
  WorldRule,
  WorldWorkspace
} from "../../shared/api/types";

export type SceneContinuityEntry = {
  title: string;
  summary: string;
  outcome: string;
  timeMarker: string;
  /** Automatyczne streszczenie faktycznej prozy sceny (pełniejsze niż plan). */
  autoSummary: string;
};

export type PreviousChapterSummary = {
  number: number;
  workingTitle: string;
  /** Auto-streszczenie prozy rozdziału; fallback: ręczne summary z planu. */
  summary: string;
};

export type StyleReferenceExcerpt = {
  sceneTitle: string;
  excerpt: string;
};

export type ScenePromptContext = {
  book: Pick<
    Book,
    "id" | "title" | "workingTitle" | "premise" | "styleGuide" | "pointOfView" | "tone" | "unwantedThemes"
  >;
  chapter: Chapter | null;
  scene: Scene;
  /** Skondensowane "story so far" całej książki (auto-generowane). */
  storySoFar: string;
  /** Streszczenia 2-3 rozdziałów bezpośrednio poprzedzających bieżący. */
  previousChapters: PreviousChapterSummary[];
  /** Scena bezpośrednio poprzedzająca (w rozdziale lub ostatnia z poprzedniego rozdziału). */
  previousScene: (SceneContinuityEntry & { textTail: string }) | null;
  /** Metadane wcześniejszych scen bieżącego rozdziału — "co się dotąd wydarzyło". */
  chapterSoFar: SceneContinuityEntry[];
  povCharacter: {
    id: string;
    name: string;
    voiceNotes: string;
    knowledgeNotes: string;
  } | null;
  characters: Array<{ id: string; name: string; role: string; voiceNotes: string; knowledgeNotes: string }>;
  /** Fragmenty scen oznaczonych gwiazdką — few-shot wzorzec stylu prozy. */
  styleReferences: StyleReferenceExcerpt[];
  threads: PlotThread[];
  location: WorldElement | null;
  worldElements: WorldElement[];
  relevantRules: WorldRule[];
};

export function buildScenePromptContext({
  book,
  plan,
  characters,
  world,
  sceneId
}: {
  book: Book;
  plan: BookPlan;
  characters: CharacterWorkspace;
  world: WorldWorkspace;
  sceneId: string;
}): ScenePromptContext | null {
  const scene = plan.scenes.find((item) => item.id === sceneId);
  if (!scene) {
    return null;
  }

  const chapter = scene.chapterId
    ? plan.chapters.find((item) => item.id === scene.chapterId) ?? null
    : null;
  const chapterScenes = plan.scenes
    .filter((item) => item.chapterId && item.chapterId === scene.chapterId)
    .sort((a, b) => a.orderIndex - b.orderIndex);
  const sceneIndex = chapterScenes.findIndex((item) => item.id === scene.id);
  const earlierScenes = sceneIndex > 0 ? chapterScenes.slice(0, sceneIndex) : [];
  const previousSceneSource =
    earlierScenes[earlierScenes.length - 1] ?? lastSceneOfPreviousChapter(plan, chapter);
  const sceneCharacterIds = unique(
    plan.sceneCharacters.filter((item) => item.sceneId === scene.id).map((item) => item.characterId)
  );
  const sceneThreadIds = unique(
    plan.sceneThreads.filter((item) => item.sceneId === scene.id).map((item) => item.threadId)
  );
  const sceneElementIds = unique([
    ...(scene.locationId ? [scene.locationId] : []),
    ...plan.sceneWorldElements.filter((item) => item.sceneId === scene.id).map((item) => item.elementId)
  ]);
  const explicitRuleIds = plan.sceneWorldRules
    .filter((item) => item.sceneId === scene.id)
    .map((item) => item.ruleId);
  const elementRuleIds = world.elementRules
    .filter((item) => sceneElementIds.includes(item.elementId))
    .map((item) => item.ruleId);
  const threadRuleIds = world.ruleThreads
    .filter((item) => sceneThreadIds.includes(item.threadId))
    .map((item) => item.ruleId);
  const chapterThreadIds = chapter
    ? plan.chapterThreads.filter((item) => item.chapterId === chapter.id).map((item) => item.threadId)
    : [];
  const chapterRuleIds = world.ruleThreads
    .filter((item) => chapterThreadIds.includes(item.threadId))
    .map((item) => item.ruleId);
  const relevantRuleIds = unique([
    ...explicitRuleIds,
    ...elementRuleIds,
    ...threadRuleIds,
    ...chapterRuleIds
  ]);
  const pov = scene.povCharacterId
    ? characters.characters.find((item) => item.id === scene.povCharacterId) ?? null
    : null;

  return {
    book: {
      id: book.id,
      title: book.title,
      workingTitle: book.workingTitle,
      premise: book.premise,
      styleGuide: book.styleGuide,
      pointOfView: book.pointOfView,
      tone: book.tone,
      unwantedThemes: book.unwantedThemes
    },
    chapter,
    scene,
    storySoFar: book.storySoFar,
    previousChapters: previousChapterSummaries(plan, chapter),
    previousScene: previousSceneSource
      ? {
          ...continuityEntry(previousSceneSource),
          textTail: manuscriptTail(previousSceneSource.manuscriptContent)
        }
      : null,
    chapterSoFar: earlierScenes.map(continuityEntry),
    povCharacter: pov
      ? {
          id: pov.id,
          name: pov.name,
          voiceNotes: pov.voiceNotes,
          knowledgeNotes: pov.knowledgeNotes
        }
      : null,
    characters: sceneCharacterIds
      .map((id) => characters.characters.find((item) => item.id === id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .map((item) => ({
        id: item.id,
        name: item.name,
        role: item.role,
        voiceNotes: item.voiceNotes,
        knowledgeNotes: item.knowledgeNotes
      })),
    styleReferences: styleReferenceExcerpts(plan, scene.id),
    threads: sceneThreadIds
      .map((id) => plan.threads.find((item) => item.id === id))
      .filter((item): item is PlotThread => Boolean(item)),
    location: scene.locationId
      ? world.elements.find((item) => item.id === scene.locationId) ?? null
      : null,
    worldElements: sceneElementIds
      .map((id) => world.elements.find((item) => item.id === id))
      .filter((item): item is WorldElement => Boolean(item)),
    relevantRules: relevantRuleIds
      .map((id) => world.rules.find((item) => item.id === id))
      .filter((item): item is WorldRule => Boolean(item))
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function continuityEntry(scene: Scene): SceneContinuityEntry {
  return {
    title: scene.title,
    summary: scene.summary,
    outcome: scene.outcome,
    timeMarker: scene.timeMarker,
    autoSummary: scene.autoSummary
  };
}

/** Streszczenia maks. 3 rozdziałów poprzedzających bieżący (od najstarszego). */
function previousChapterSummaries(
  plan: BookPlan,
  chapter: Chapter | null
): PreviousChapterSummary[] {
  if (!chapter) {
    return [];
  }
  const orderedChapters = [...plan.chapters].sort((a, b) => a.orderIndex - b.orderIndex);
  const chapterIndex = orderedChapters.findIndex((item) => item.id === chapter.id);
  if (chapterIndex <= 0) {
    return [];
  }
  return orderedChapters
    .slice(Math.max(0, chapterIndex - 3), chapterIndex)
    .map((item) => ({
      number: item.number,
      workingTitle: item.workingTitle,
      summary: item.autoSummary || item.summary
    }))
    .filter((item) => item.summary.trim());
}

function lastSceneOfPreviousChapter(plan: BookPlan, chapter: Chapter | null): Scene | null {
  if (!chapter) {
    return null;
  }
  const orderedChapters = [...plan.chapters].sort((a, b) => a.orderIndex - b.orderIndex);
  const chapterIndex = orderedChapters.findIndex((item) => item.id === chapter.id);
  const previousChapter = chapterIndex > 0 ? orderedChapters[chapterIndex - 1] : null;
  if (!previousChapter) {
    return null;
  }
  const scenes = plan.scenes
    .filter((item) => item.chapterId === previousChapter.id)
    .sort((a, b) => a.orderIndex - b.orderIndex);
  return scenes[scenes.length - 1] ?? null;
}

/**
 * Ostatnie ~400 słów prozy poprzedniej sceny jako punkt zszycia tonu i rytmu
 * (manuscript to HTML z Tiptapa). 80 słów było za mało, by utrzymać ciągłość.
 */
function manuscriptTail(html: string, maxWords = 400): string {
  const words = manuscriptWords(html);
  return words.slice(Math.max(0, words.length - maxWords)).join(" ");
}

function manuscriptWords(html: string): string[] {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

/** ~400 słów ze środka prozy — otwarcia i finały scen bywają stylistycznie nietypowe. */
function manuscriptMiddleExcerpt(html: string, maxWords = 400): string {
  const words = manuscriptWords(html);
  if (words.length <= maxWords) {
    return words.join(" ");
  }
  const start = Math.floor((words.length - maxWords) / 2);
  return words.slice(start, start + maxWords).join(" ");
}

/** Maks. 2 sceny wzorcowe (bez bieżącej), w kolejności książki. */
function styleReferenceExcerpts(plan: BookPlan, currentSceneId: string): StyleReferenceExcerpt[] {
  const chapterOrder = new Map(plan.chapters.map((item) => [item.id, item.orderIndex]));
  const orderOf = (scene: Scene) =>
    scene.chapterId != null ? chapterOrder.get(scene.chapterId) ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
  return plan.scenes
    .filter(
      (item) =>
        item.id !== currentSceneId && Boolean(item.isStyleReference) && item.manuscriptContent.trim()
    )
    .sort((a, b) => orderOf(a) - orderOf(b) || a.orderIndex - b.orderIndex)
    .slice(0, 2)
    .map((item) => ({
      sceneTitle: item.title,
      excerpt: manuscriptMiddleExcerpt(item.manuscriptContent)
    }))
    .filter((item) => item.excerpt);
}
