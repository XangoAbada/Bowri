import type { AIAction, Book, Project } from "../../shared/api/types";

export type ConceptFieldKey =
  | "title"
  | "workingTitle"
  | "premise"
  | "expandedPremise"
  | "logline"
  | "centralConflict"
  | "stakes"
  | "genre"
  | "subgenre"
  | "targetAudience"
  | "tone"
  | "pointOfView"
  | "targetWordCount"
  | "themesJson"
  | "unwantedThemes"
  | "alternativeTitlesJson"
  | "titleChoiceNote"
  | "styleGuide";

export type AIProviderId = "codex-cli-bridge";

export type BookConceptPromptContext = Pick<
  Book,
  | "title"
  | "workingTitle"
  | "premise"
  | "expandedPremise"
  | "logline"
  | "centralConflict"
  | "stakes"
  | "genre"
  | "subgenre"
  | "targetAudience"
  | "tone"
  | "styleGuide"
  | "pointOfView"
  | "targetWordCount"
  | "themesJson"
  | "unwantedThemes"
  | "alternativeTitlesJson"
  | "titleChoiceNote"
>;

export type PromptPackage = {
  id: string;
  projectId: string;
  action: AIAction;
  locale: "pl" | "en";
  userInstruction: string;
  context: {
    targetField: ConceptFieldKey;
    book: BookConceptPromptContext;
  };
  outputContract: {
    kind: "concept_field_suggestion" | "premise_development";
    format: "json";
    schema: unknown;
  };
  generationOptions: {
    providerId: AIProviderId;
  };
};

export type NewProjectTitlePromptPackage = {
  id: string;
  action: Extract<AIAction, "generate_working_title">;
  locale: "pl" | "en";
  userInstruction: string;
  context: {
    seedTitle: string;
  };
  outputContract: {
    kind: "concept_field_suggestion";
    format: "json";
    schema: unknown;
  };
  generationOptions: {
    providerId: AIProviderId;
  };
};

export type ConceptFieldConfig = {
  key: ConceptFieldKey;
  label: string;
  action: AIAction;
  userInstruction: string;
  currentWork: string;
  acceptsValues: boolean;
};

export const listConceptFields: ConceptFieldKey[] = [
  "genre",
  "subgenre",
  "targetAudience",
  "tone",
  "pointOfView",
  "themesJson",
  "alternativeTitlesJson"
];

export const longConceptFields: ConceptFieldKey[] = [
  "premise",
  "expandedPremise",
  "centralConflict",
  "stakes",
  "unwantedThemes",
  "titleChoiceNote",
  "styleGuide"
];

export const conceptFieldConfigs: Record<ConceptFieldKey, ConceptFieldConfig> = {
  title: {
    key: "title",
    label: "Tytuł finalny",
    action: "generate_title",
    userInstruction: "Wygeneruj jeden dopracowany tytuł finalny dla tej książki.",
    currentWork:
      "Autor chce tytuł, który może zastąpić roboczą nazwę i pasuje do obietnicy czytelniczej.",
    acceptsValues: false
  },
  workingTitle: {
    key: "workingTitle",
    label: "Tytuł roboczy",
    action: "generate_working_title",
    userInstruction:
      "Wygeneruj jedną mocną propozycję tytułu roboczego dla tej książki.",
    currentWork:
      "Autor chce tytuł roboczy, który od razu niesie gatunek, ton i obietnicę historii.",
    acceptsValues: false
  },
  premise: {
    key: "premise",
    label: "Premise",
    action: "expand_premise",
    userInstruction:
      "Rozwiń surową premise w strukturalny fundament koncepcji książki.",
    currentWork:
      "Autor chce premise, logline, konflikt centralny, stawki i tematy, które może zaakceptować częściowo.",
    acceptsValues: false
  },
  expandedPremise: {
    key: "expandedPremise",
    label: "Rozszerzona premisa",
    action: "generate_expanded_premise",
    userInstruction:
      "Wygeneruj rozszerzoną premise tej książki w jednym zwartym akapicie.",
    currentWork:
      "Autor chce szerszy opis rdzenia historii bez przechodzenia jeszcze do planu rozdziałów.",
    acceptsValues: false
  },
  logline: {
    key: "logline",
    label: "Logline",
    action: "generate_logline",
    userInstruction:
      "Wygeneruj zwięzły logline tej książki: bohater, cel, przeszkoda i stawka.",
    currentWork:
      "Autor chce jednozdaniowy logline, który klarownie komunikuje obietnicę historii.",
    acceptsValues: false
  },
  centralConflict: {
    key: "centralConflict",
    label: "Konflikt centralny",
    action: "generate_central_conflict",
    userInstruction: "Wygeneruj klarowny konflikt centralny tej książki.",
    currentWork:
      "Autor chce rdzeń napięcia fabularnego, który będzie napędzał decyzje bohatera.",
    acceptsValues: false
  },
  stakes: {
    key: "stakes",
    label: "Stawki",
    action: "generate_stakes",
    userInstruction: "Wygeneruj stawki osobiste i fabularne tej książki.",
    currentWork:
      "Autor chce wiedzieć, co bohater i świat tracą, jeśli historia pójdzie źle.",
    acceptsValues: false
  },
  genre: {
    key: "genre",
    label: "Gatunek",
    action: "suggest_genre",
    userInstruction:
      "Zaproponuj najtrafniejszy zestaw gatunków lub podgatunków dla tej książki.",
    currentWork:
      "Autor chce kilka etykiet gatunkowych, które pomogą późniejszym promptom trzymać konwencję.",
    acceptsValues: true
  },
  subgenre: {
    key: "subgenre",
    label: "Podgatunek",
    action: "suggest_subgenre",
    userInstruction:
      "Zaproponuj podgatunek lub mieszankę podgatunków dla tej książki.",
    currentWork:
      "Autor chce doprecyzować konwencję bez ograniczania głównego gatunku.",
    acceptsValues: true
  },
  targetAudience: {
    key: "targetAudience",
    label: "Odbiorcy",
    action: "suggest_target_audience",
    userInstruction:
      "Zaproponuj docelowych odbiorców tej książki jako krótkie etykiety.",
    currentWork:
      "Autor chce etykiety czytelników, które pomogą dopasować język, poziom mroku i tempo.",
    acceptsValues: true
  },
  tone: {
    key: "tone",
    label: "Ton",
    action: "suggest_tone",
    userInstruction:
      "Zaproponuj zestaw tonów narracyjnych pasujących do tej książki.",
    currentWork:
      "Autor chce etykiety tonu, które będą sterować nastrojem i stylem późniejszych generacji.",
    acceptsValues: true
  },
  pointOfView: {
    key: "pointOfView",
    label: "Punkt widzenia",
    action: "suggest_point_of_view",
    userInstruction:
      "Zaproponuj najlepszy punkt widzenia i tryb narracji dla tej książki.",
    currentWork:
      "Autor chce decyzję narracyjną, która będzie zasilać późniejsze prompty scen.",
    acceptsValues: true
  },
  targetWordCount: {
    key: "targetWordCount",
    label: "Docelowa liczba słów",
    action: "suggest_target_word_count",
    userInstruction:
      "Zaproponuj docelową liczbę słów dla tej książki jako jedną liczbę.",
    currentWork:
      "Autor chce realistyczną długość dopasowaną do gatunku i odbiorców.",
    acceptsValues: false
  },
  themesJson: {
    key: "themesJson",
    label: "Tematy",
    action: "suggest_themes",
    userInstruction: "Zaproponuj główne tematy tej książki jako krótkie etykiety.",
    currentWork:
      "Autor chce tematy, które będą wracać w planie, postaciach i scenach.",
    acceptsValues: true
  },
  unwantedThemes: {
    key: "unwantedThemes",
    label: "Granice i tematy niechciane",
    action: "suggest_unwanted_themes",
    userInstruction:
      "Zaproponuj granice treści i tematy, których ta książka powinna unikać.",
    currentWork: "Autor chce jasne ograniczenia dla późniejszych promptów AI.",
    acceptsValues: false
  },
  alternativeTitlesJson: {
    key: "alternativeTitlesJson",
    label: "Alternatywne tytuły",
    action: "generate_alternative_titles",
    userInstruction: "Wygeneruj listę alternatywnych tytułów dla tej książki.",
    currentWork:
      "Autor chce warianty tytułu, które może porównać z tytułem roboczym i finalnym.",
    acceptsValues: true
  },
  titleChoiceNote: {
    key: "titleChoiceNote",
    label: "Notatka wyboru tytułu",
    action: "generate_title_choice_note",
    userInstruction:
      "Napisz krótką notatkę uzasadniającą wybór tytułu tej książki.",
    currentWork:
      "Autor chce zapamiętać, dlaczego wybrany tytuł najlepiej niesie obietnicę historii.",
    acceptsValues: false
  },
  styleGuide: {
    key: "styleGuide",
    label: "Style guide",
    action: "generate_style_guide",
    userInstruction:
      "Wygeneruj praktyczny style guide dla tej książki: język, rytm, tempo, zakazy i preferencje.",
    currentWork:
      "Autor chce użyteczne notatki stylu do wielokrotnego użycia w promptach scen i redakcji.",
    acceptsValues: false
  }
};

export function buildConceptFieldPromptPackage(
  project: Project,
  book: Book,
  field: ConceptFieldKey
): PromptPackage {
  const config = conceptFieldConfigs[field];
  const isPremiseDevelopment = config.action === "expand_premise";

  return {
    id: createPromptId(config.action),
    projectId: project.id,
    action: config.action,
    locale: project.language === "en" ? "en" : "pl",
    userInstruction: config.userInstruction,
    context: {
      targetField: field,
      book: bookConceptContext(book)
    },
    outputContract: {
      kind: isPremiseDevelopment
        ? "premise_development"
        : "concept_field_suggestion",
      format: "json",
      schema: isPremiseDevelopment
        ? premiseDevelopmentSchema()
        : conceptFieldSuggestionSchema(field, config.acceptsValues)
    },
    generationOptions: {
      providerId: "codex-cli-bridge"
    }
  };
}

export function renderPromptPackage(promptPackage: PromptPackage): string {
  const { book, targetField } = promptPackage.context;
  const config = conceptFieldConfigs[targetField];

  return `# Role
Jesteś asystentem pisarskim pracującym wewnątrz StoryForge2.

# Task
${promptPackage.userInstruction}

# Hard Rules
- Pisz po polsku, chyba że projekt ma inny język.
- Dla locale "pl" używaj poprawnych polskich znaków.
- Nie zapisuj ani nie zmieniaj kanonu; zwróć tylko propozycję.
- Uwzględnij wszystkie pola z Book Context, nawet jeśli docelowe pole jest puste.
- Nie dodawaj komentarzy poza wymaganym JSON.
- Odpowiedz wyłącznie poprawnym JSON bez trailing commas.

# Book Context
- Tytuł finalny: ${emptyFallback(book.title)}
- Roboczy tytuł: ${emptyFallback(book.workingTitle)}
- Premise: ${emptyFallback(book.premise)}
- Rozszerzona premisa: ${emptyFallback(book.expandedPremise)}
- Logline: ${emptyFallback(book.logline)}
- Konflikt centralny: ${emptyFallback(book.centralConflict)}
- Stawki: ${emptyFallback(book.stakes)}
- Gatunek: ${emptyFallback(book.genre)}
- Podgatunek: ${emptyFallback(book.subgenre)}
- Ton: ${emptyFallback(book.tone)}
- Odbiorcy: ${emptyFallback(book.targetAudience)}
- Punkt widzenia: ${emptyFallback(book.pointOfView)}
- Docelowa liczba słów: ${book.targetWordCount ?? "(brak)"}
- Tematy: ${emptyFallback(renderJsonList(book.themesJson))}
- Granice i tematy niechciane: ${emptyFallback(book.unwantedThemes)}
- Alternatywne tytuły: ${emptyFallback(renderJsonList(book.alternativeTitlesJson))}
- Notatka wyboru tytułu: ${emptyFallback(book.titleChoiceNote)}
- Style guide: ${emptyFallback(book.styleGuide)}

# Current Work
Docelowe pole: ${targetField} (${config.label}).
${config.currentWork}

# Output Contract
Zwróć JSON:
${JSON.stringify(promptPackage.outputContract.schema, null, 2)}
`;
}

export function buildNewProjectTitlePromptPackage(
  seedTitle: string,
  locale: "pl" | "en" = "pl"
): NewProjectTitlePromptPackage {
  const field: ConceptFieldKey = "workingTitle";

  return {
    id: createPromptId("generate_working_title"),
    action: "generate_working_title",
    locale,
    userInstruction:
      "Wygeneruj jedną mocną propozycję tytułu roboczego dla nowego projektu książki.",
    context: {
      seedTitle
    },
    outputContract: {
      kind: "concept_field_suggestion",
      format: "json",
      schema: conceptFieldSuggestionSchema(field, false)
    },
    generationOptions: {
      providerId: "codex-cli-bridge"
    }
  };
}

export function renderNewProjectTitlePromptPackage(
  promptPackage: NewProjectTitlePromptPackage
): string {
  return `# Role
Jesteś asystentem pisarskim pracującym wewnątrz StoryForge2.

# Task
${promptPackage.userInstruction}

# Hard Rules
- Pisz po polsku, chyba że projekt ma inny język.
- Dla locale "pl" używaj poprawnych polskich znaków.
- Zwróć jedną propozycję, która może od razu stać się nazwą nowego projektu.
- Jeśli autor wpisał szkic tytułu, potraktuj go jako inspirację, a nie polecenie przepisania.
- Nie dodawaj komentarzy poza wymaganym JSON.
- Odpowiedz wyłącznie poprawnym JSON bez trailing commas.

# New Project Seed
- Wpis autora: ${emptyFallback(promptPackage.context.seedTitle)}

# Current Work
Docelowe pole: workingTitle (Tytuł roboczy).
Autor jest na dashboardzie i chce szybko nazwać nowy projekt książki przed jego utworzeniem.

# Output Contract
Zwróć JSON:
${JSON.stringify(promptPackage.outputContract.schema, null, 2)}
`;
}

function bookConceptContext(book: Book): BookConceptPromptContext {
  return {
    title: book.title ?? "",
    workingTitle: book.workingTitle ?? "",
    premise: book.premise ?? "",
    expandedPremise: book.expandedPremise ?? "",
    logline: book.logline ?? "",
    centralConflict: book.centralConflict ?? "",
    stakes: book.stakes ?? "",
    genre: book.genre ?? "",
    subgenre: book.subgenre ?? "",
    targetAudience: book.targetAudience ?? "",
    tone: book.tone ?? "",
    styleGuide: book.styleGuide ?? "",
    pointOfView: book.pointOfView ?? "",
    targetWordCount: book.targetWordCount ?? null,
    themesJson: book.themesJson ?? "[]",
    unwantedThemes: book.unwantedThemes ?? "",
    alternativeTitlesJson: book.alternativeTitlesJson ?? "[]",
    titleChoiceNote: book.titleChoiceNote ?? ""
  };
}

function conceptFieldSuggestionSchema(
  field: ConceptFieldKey,
  acceptsValues: boolean
): unknown {
  return {
    version: 1,
    kind: "concept_field_suggestion",
    field,
    summary: "string",
    value: acceptsValues ? "string | null" : "string",
    values: acceptsValues ? ["string"] : "[]",
    rationale: "string",
    warnings: ["string"]
  };
}

function premiseDevelopmentSchema(): unknown {
  return {
    version: 1,
    kind: "premise_development",
    summary: "concise premise sentence",
    logline: "string",
    expandedPremise: "string",
    centralConflict: "string",
    stakes: "string",
    themes: ["string"],
    risks: ["string"],
    questionsForAuthor: ["string"]
  };
}

function createPromptId(action: AIAction): string {
  if ("randomUUID" in crypto) {
    return `${action}:${crypto.randomUUID()}`;
  }

  return `${action}:${Date.now().toString(36)}:${Math.random()
    .toString(36)
    .slice(2)}`;
}

function emptyFallback(value: string | undefined | null): string {
  return value?.trim().length ? value : "(brak)";
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
