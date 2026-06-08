import type {
  AIAction,
  Act,
  Beat,
  Book,
  BookPlan,
  Chapter,
  PlotThread,
  Project
} from "../../shared/api/types";
import type { PromptContextControl, PromptContextSource } from "./promptPackage";

export type PlanFieldKey =
  | "storyStructure"
  | "acts"
  | "actPurpose"
  | "actSummary"
  | "beatSheet"
  | "plotThreads"
  | "chapterPlan"
  | "chapterSummary"
  | "chapterPurpose"
  | "chapterConflict"
  | "chapterTurningPoint"
  | "planGaps";

export type PlanFieldConfig = {
  key: PlanFieldKey;
  label: string;
  action: AIAction;
  targetKind: "structure" | "act" | "beat" | "thread" | "chapter" | "audit";
  userInstruction: string;
};

export type PlanPromptPackage = {
  id: string;
  projectId: string;
  bookId: string;
  action: AIAction;
  locale: "pl" | "en";
  userInstruction: string;
  context: {
    targetField: PlanFieldKey;
    targetEntityId?: string;
    targetEntityLabel?: string;
    book: Pick<
      Book,
      | "workingTitle"
      | "premise"
      | "expandedPremise"
      | "logline"
      | "centralConflict"
      | "antagonistForce"
      | "stakes"
      | "settingSketch"
      | "endingDirection"
      | "genre"
      | "subgenre"
      | "targetAudience"
      | "tone"
      | "pointOfView"
      | "targetWordCount"
      | "themesJson"
      | "styleGuide"
    >;
    plan: {
      structureType: string;
      structureDescription: string;
      structureNotes: string;
      acts: Act[];
      beats: Beat[];
      threads: PlotThread[];
      chapters: Chapter[];
    };
    contextControl?: PromptContextControl;
  };
  outputContract: {
    kind: "book_plan_suggestion";
    format: "json";
    schema: unknown;
  };
  generationOptions: {
    providerId: "codex-cli-bridge";
  };
};

export const planFieldConfigs: Record<PlanFieldKey, PlanFieldConfig> = {
  storyStructure: {
    key: "storyStructure",
    label: "Struktura fabuly",
    action: "suggest_story_structure",
    targetKind: "structure",
    userInstruction:
      "Zaproponuj najlepsza strukture fabularna dla ksiazki i uzasadnij wybor."
  },
  acts: {
    key: "acts",
    label: "Akty",
    action: "generate_acts",
    targetKind: "act",
    userInstruction:
      "Rozbij historie na akty z zakresem fabuly, celem i zwiezlym streszczeniem."
  },
  actPurpose: {
    key: "actPurpose",
    label: "Cel aktu",
    action: "generate_act_field",
    targetKind: "act",
    userInstruction:
      "Wygeneruj albo dopracuj cel wybranego aktu, korzystajac z calego planu jako kontekstu."
  },
  actSummary: {
    key: "actSummary",
    label: "Streszczenie aktu",
    action: "generate_act_field",
    targetKind: "act",
    userInstruction:
      "Wygeneruj albo dopracuj streszczenie wybranego aktu bez zmiany pozostalych elementow."
  },
  beatSheet: {
    key: "beatSheet",
    label: "Beat sheet",
    action: "generate_beat_sheet",
    targetKind: "beat",
    userInstruction:
      "Wygeneruj beat sheet przypisany do aktow i watkow, gotowy do pozniejszego dopracowania."
  },
  plotThreads: {
    key: "plotThreads",
    label: "Watki",
    action: "generate_plot_threads",
    targetKind: "thread",
    userInstruction:
      "Zaproponuj watki fabularne wraz z rola i kolorem do mapy planu."
  },
  chapterPlan: {
    key: "chapterPlan",
    label: "Plan rozdzialow",
    action: "generate_chapter_plan",
    targetKind: "chapter",
    userInstruction:
      "Wygeneruj plan rozdzialow z celami, konfliktami, punktami zwrotnymi oraz przypisaniami do aktow, beatow i watkow."
  },
  chapterSummary: {
    key: "chapterSummary",
    label: "Streszczenie rozdzialu",
    action: "generate_chapter_field",
    targetKind: "chapter",
    userInstruction:
      "Wygeneruj albo dopracuj streszczenie wybranego rozdzialu."
  },
  chapterPurpose: {
    key: "chapterPurpose",
    label: "Cel rozdzialu",
    action: "generate_chapter_field",
    targetKind: "chapter",
    userInstruction:
      "Wygeneruj albo dopracuj cel fabularny wybranego rozdzialu."
  },
  chapterConflict: {
    key: "chapterConflict",
    label: "Konflikt rozdzialu",
    action: "generate_chapter_field",
    targetKind: "chapter",
    userInstruction:
      "Wygeneruj albo dopracuj konflikt wybranego rozdzialu."
  },
  chapterTurningPoint: {
    key: "chapterTurningPoint",
    label: "Punkt zwrotny",
    action: "generate_chapter_field",
    targetKind: "chapter",
    userInstruction:
      "Wygeneruj albo dopracuj punkt zwrotny wybranego rozdzialu."
  },
  planGaps: {
    key: "planGaps",
    label: "Luki planu",
    action: "find_plan_gaps",
    targetKind: "audit",
    userInstruction:
      "Znajdz luki, slabe napiecie, watki bez payoffu i rozdzialy bez celu."
  }
};

export function buildPlanPromptPackage(
  project: Project,
  book: Book,
  plan: BookPlan,
  field: PlanFieldKey,
  targetEntity?: Act | Beat | PlotThread | Chapter,
  contextControl?: PromptContextControl
): PlanPromptPackage {
  const config = planFieldConfigs[field];

  return {
    id: createPromptId(config.action),
    projectId: project.id,
    bookId: book.id,
    action: config.action,
    locale: project.language === "en" ? "en" : "pl",
    userInstruction: config.userInstruction,
    context: {
      targetField: field,
      targetEntityId: targetEntity?.id,
      targetEntityLabel: targetEntity
        ? "workingTitle" in targetEntity
          ? targetEntity.workingTitle
          : targetEntity.name
        : undefined,
      book: bookPlanContext(book),
      plan: {
        structureType: plan.structure?.structureType ?? "",
        structureDescription: plan.structure?.description ?? "",
        structureNotes: plan.structure?.notes ?? "",
        acts: plan.acts,
        beats: plan.beats,
        threads: plan.threads,
        chapters: plan.chapters
      },
      ...(contextControl ? { contextControl } : {})
    },
    outputContract: {
      kind: "book_plan_suggestion",
      format: "json",
      schema: planSuggestionSchema(field)
    },
    generationOptions: {
      providerId: "codex-cli-bridge"
    }
  };
}

export function renderPlanPromptPackage(promptPackage: PlanPromptPackage): string {
  const config = planFieldConfigs[promptPackage.context.targetField];
  const authorPriority = renderAuthorPriority(
    promptPackage.context.contextControl
  );

  return `# Role
Jestes asystentem pisarskim pracujacym wewnatrz StoryForge2.

# Task
${promptPackage.userInstruction}

# Hard Rules
- Pisz po polsku, chyba ze projekt ma inny jezyk.
- Dla locale "pl" uzywaj poprawnych polskich znakow.
- Nie zapisuj danych. Zwroc tylko propozycje jako JSON.
- Nie kasuj istniejacych aktow, beatow, watkow ani rozdzialow; proponuj zmiany i dodatki.
- Elementy planu, ktore odwolujesz, identyfikuj po id albo dokladnej nazwie.
- Odpowiedz wylacznie poprawnym JSON bez trailing commas.

${authorPriority}

# Book Context
${renderBookContext(promptPackage.context.book, promptPackage.context.contextControl)}

# Current Plan
${renderPlanContext(promptPackage.context.plan, promptPackage.context.contextControl)}

# Current Work
Docelowe pole: ${promptPackage.context.targetField} (${config.label}).
Docelowy element: ${promptPackage.context.targetEntityLabel ?? "(brak)"}

# Output Contract
Zwroc JSON:
${JSON.stringify(promptPackage.outputContract.schema, null, 2)}
`;
}

export function planPromptContextSources(field: PlanFieldKey): PromptContextSource[] {
  const required: PromptContextSource = {
    key: field,
    label: planFieldConfigs[field].label,
    required: true
  };

  return [
    required,
    { key: "bookCore", label: "Rdzen koncepcji", required: false },
    { key: "styleGuide", label: "Style guide", required: false },
    { key: "storyStructure", label: "Struktura planu", required: false },
    { key: "acts", label: "Akty", required: false },
    { key: "beats", label: "Beaty", required: false },
    { key: "plotThreads", label: "Watki", required: false },
    { key: "chapters", label: "Rozdzialy", required: false }
  ];
}

export function planPromptContextSource(field: PlanFieldKey): PromptContextSource {
  return {
    key: field,
    label: planFieldConfigs[field].label,
    required: false
  };
}

function bookPlanContext(book: Book): PlanPromptPackage["context"]["book"] {
  return {
    workingTitle: book.workingTitle ?? "",
    premise: book.premise ?? "",
    expandedPremise: book.expandedPremise ?? "",
    logline: book.logline ?? "",
    centralConflict: book.centralConflict ?? "",
    antagonistForce: book.antagonistForce ?? "",
    stakes: book.stakes ?? "",
    settingSketch: book.settingSketch ?? "",
    endingDirection: book.endingDirection ?? "",
    genre: book.genre ?? "",
    subgenre: book.subgenre ?? "",
    targetAudience: book.targetAudience ?? "",
    tone: book.tone ?? "",
    pointOfView: book.pointOfView ?? "",
    targetWordCount: book.targetWordCount ?? null,
    themesJson: book.themesJson ?? "[]",
    styleGuide: book.styleGuide ?? ""
  };
}

function renderBookContext(
  book: PlanPromptPackage["context"]["book"],
  contextControl?: PromptContextControl
): string {
  if (contextControl && !isContextKeyIncluded("bookCore", contextControl)) {
    return "(pominieto przez autora)";
  }

  return [
    `- Tytul roboczy: ${emptyFallback(book.workingTitle)}`,
    `- Premise: ${emptyFallback(book.premise)}`,
    `- Rozszerzona premisa: ${emptyFallback(book.expandedPremise)}`,
    `- Logline: ${emptyFallback(book.logline)}`,
    `- Konflikt centralny: ${emptyFallback(book.centralConflict)}`,
    `- Sila przeciwna: ${emptyFallback(book.antagonistForce)}`,
    `- Stawki: ${emptyFallback(book.stakes)}`,
    `- Setting: ${emptyFallback(book.settingSketch)}`,
    `- Kierunek zakonczenia: ${emptyFallback(book.endingDirection)}`,
    `- Gatunek: ${emptyFallback([book.genre, book.subgenre].filter(Boolean).join(", "))}`,
    `- Odbiorcy: ${emptyFallback(book.targetAudience)}`,
    `- Ton: ${emptyFallback(book.tone)}`,
    `- POV: ${emptyFallback(book.pointOfView)}`,
    `- Docelowa liczba slow: ${book.targetWordCount ?? "(brak)"}`,
    `- Tematy: ${emptyFallback(renderJsonList(book.themesJson))}`,
    `- Style guide: ${
      !contextControl || isContextKeyIncluded("styleGuide", contextControl)
        ? emptyFallback(book.styleGuide)
        : "(pominieto przez autora)"
    }`
  ].join("\n");
}

function renderPlanContext(
  plan: PlanPromptPackage["context"]["plan"],
  contextControl?: PromptContextControl
): string {
  const sections = [
    !contextControl || isContextKeyIncluded("storyStructure", contextControl)
      ? `Struktura: ${emptyFallback(plan.structureType)}; ${emptyFallback(plan.structureDescription)}`
      : "",
    !contextControl || isContextKeyIncluded("acts", contextControl)
      ? `Akty: ${JSON.stringify(plan.acts)}`
      : "",
    !contextControl || isContextKeyIncluded("beats", contextControl)
      ? `Beaty: ${JSON.stringify(plan.beats)}`
      : "",
    !contextControl || isContextKeyIncluded("plotThreads", contextControl)
      ? `Watki: ${JSON.stringify(plan.threads)}`
      : "",
    !contextControl || isContextKeyIncluded("chapters", contextControl)
      ? `Rozdzialy: ${JSON.stringify(plan.chapters)}`
      : ""
  ].filter(Boolean);

  return sections.length ? sections.join("\n") : "(brak wybranego kontekstu planu)";
}

function planSuggestionSchema(field: PlanFieldKey): unknown {
  return {
    version: 1,
    kind: "book_plan_suggestion",
    field,
    summary: "string",
    value: "string or structured object matching the requested plan element",
    structure: {
      structureType: "three_act | save_the_cat | heros_journey | mystery_outline | custom",
      description: "string",
      notes: "string"
    },
    acts: [
      {
        name: "string",
        purpose: "string",
        summary: "string",
        startPercent: 0,
        endPercent: 25,
        color: "#3f8f6b"
      }
    ],
    beats: [
      {
        name: "string",
        description: "string",
        role: "string",
        actNameOrId: "string",
        threadNamesOrIds: ["string"]
      }
    ],
    threads: [
      {
        name: "string",
        description: "string",
        color: "#3f8f6b",
        status: "planned"
      }
    ],
    chapters: [
      {
        number: 1,
        workingTitle: "string",
        summary: "string",
        purpose: "string",
        conflict: "string",
        turningPoint: "string",
        actNameOrId: "string",
        beatNamesOrIds: ["string"],
        threadNamesOrIds: ["string"],
        targetWordCount: 2500
      }
    ],
    warnings: ["string"]
  };
}

function renderAuthorPriority(contextControl?: PromptContextControl): string {
  const comment = contextControl?.authorPriorityComment.trim();
  return comment
    ? `# Author Priority\nKomentarz autora ma najwyzszy priorytet:\n${comment}`
    : "";
}

function isContextKeyIncluded(
  key: string,
  contextControl?: PromptContextControl
): boolean {
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

function renderJsonList(value: string | undefined | null): string {
  if (!value) {
    return "";
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item): item is string => typeof item === "string")
        .join(", ");
    }
  } catch {
    return value;
  }

  return value;
}

function emptyFallback(value: string | undefined | null): string {
  return value?.trim() ? value : "(brak)";
}

function createPromptId(action: AIAction): string {
  if ("randomUUID" in crypto) {
    return `${action}:${crypto.randomUUID()}`;
  }

  return `${action}:${Date.now().toString(36)}:${Math.random()
    .toString(36)
    .slice(2)}`;
}
