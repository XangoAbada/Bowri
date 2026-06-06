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
    label: "Tytul finalny",
    action: "generate_title",
    userInstruction: "Wygeneruj jeden dopracowany tytul finalny dla tej ksiazki.",
    currentWork:
      "Autor chce tytul, ktory moze zastapic robocza nazwe i pasuje do obietnicy czytelniczej.",
    acceptsValues: false
  },
  workingTitle: {
    key: "workingTitle",
    label: "Tytul roboczy",
    action: "generate_working_title",
    userInstruction:
      "Wygeneruj jedna mocna propozycje tytulu roboczego dla tej ksiazki.",
    currentWork:
      "Autor chce tytul roboczy, ktory od razu niesie gatunek, ton i obietnice historii.",
    acceptsValues: false
  },
  premise: {
    key: "premise",
    label: "Premise",
    action: "expand_premise",
    userInstruction:
      "Rozwin surowa premise w strukturalny fundament koncepcji ksiazki.",
    currentWork:
      "Autor chce premise, logline, konflikt centralny, stawki i tematy, ktore moze zaakceptowac czesciowo.",
    acceptsValues: false
  },
  expandedPremise: {
    key: "expandedPremise",
    label: "Rozszerzona premisa",
    action: "generate_expanded_premise",
    userInstruction:
      "Wygeneruj rozszerzona premise tej ksiazki w jednym zwartym akapicie.",
    currentWork:
      "Autor chce szerszy opis rdzenia historii bez przechodzenia jeszcze do planu rozdzialow.",
    acceptsValues: false
  },
  logline: {
    key: "logline",
    label: "Logline",
    action: "generate_logline",
    userInstruction:
      "Wygeneruj zwiezly logline tej ksiazki: bohater, cel, przeszkoda i stawka.",
    currentWork:
      "Autor chce jednozdaniowy logline, ktory klarownie komunikuje obietnice historii.",
    acceptsValues: false
  },
  centralConflict: {
    key: "centralConflict",
    label: "Konflikt centralny",
    action: "generate_central_conflict",
    userInstruction: "Wygeneruj klarowny konflikt centralny tej ksiazki.",
    currentWork:
      "Autor chce rdzen napiecia fabularnego, ktory bedzie napedzal decyzje bohatera.",
    acceptsValues: false
  },
  stakes: {
    key: "stakes",
    label: "Stawki",
    action: "generate_stakes",
    userInstruction: "Wygeneruj stawki osobiste i fabularne tej ksiazki.",
    currentWork:
      "Autor chce wiedziec, co bohater i swiat traca, jesli historia pojdzie zle.",
    acceptsValues: false
  },
  genre: {
    key: "genre",
    label: "Gatunek",
    action: "suggest_genre",
    userInstruction:
      "Zaproponuj najtrafniejszy zestaw gatunkow lub podgatunkow dla tej ksiazki.",
    currentWork:
      "Autor chce kilka etykiet gatunkowych, ktore pomoga pozniejszym promptom trzymac konwencje.",
    acceptsValues: true
  },
  subgenre: {
    key: "subgenre",
    label: "Podgatunek",
    action: "suggest_subgenre",
    userInstruction:
      "Zaproponuj podgatunek lub mieszanke podgatunkow dla tej ksiazki.",
    currentWork:
      "Autor chce doprecyzowac konwencje bez ograniczania glownego gatunku.",
    acceptsValues: true
  },
  targetAudience: {
    key: "targetAudience",
    label: "Odbiorcy",
    action: "suggest_target_audience",
    userInstruction:
      "Zaproponuj docelowych odbiorcow tej ksiazki jako krotkie etykiety.",
    currentWork:
      "Autor chce etykiety czytelnikow, ktore pomoga dopasowac jezyk, poziom mroku i tempo.",
    acceptsValues: true
  },
  tone: {
    key: "tone",
    label: "Ton",
    action: "suggest_tone",
    userInstruction:
      "Zaproponuj zestaw tonow narracyjnych pasujacych do tej ksiazki.",
    currentWork:
      "Autor chce etykiety tonu, ktore beda sterowac nastrojem i stylem pozniejszych generacji.",
    acceptsValues: true
  },
  pointOfView: {
    key: "pointOfView",
    label: "Punkt widzenia",
    action: "suggest_point_of_view",
    userInstruction:
      "Zaproponuj najlepszy punkt widzenia i tryb narracji dla tej ksiazki.",
    currentWork:
      "Autor chce decyzje narracyjna, ktora bedzie zasilac pozniejsze prompty scen.",
    acceptsValues: true
  },
  targetWordCount: {
    key: "targetWordCount",
    label: "Docelowa liczba slow",
    action: "suggest_target_word_count",
    userInstruction:
      "Zaproponuj docelowa liczbe slow dla tej ksiazki jako jedna liczbe.",
    currentWork:
      "Autor chce realistyczna dlugosc dopasowana do gatunku i odbiorcow.",
    acceptsValues: false
  },
  themesJson: {
    key: "themesJson",
    label: "Tematy",
    action: "suggest_themes",
    userInstruction: "Zaproponuj glowne tematy tej ksiazki jako krotkie etykiety.",
    currentWork:
      "Autor chce tematy, ktore beda wracac w planie, postaciach i scenach.",
    acceptsValues: true
  },
  unwantedThemes: {
    key: "unwantedThemes",
    label: "Granice i tematy niechciane",
    action: "suggest_unwanted_themes",
    userInstruction:
      "Zaproponuj granice tresci i tematy, ktorych ta ksiazka powinna unikac.",
    currentWork: "Autor chce jasne ograniczenia dla pozniejszych promptow AI.",
    acceptsValues: false
  },
  alternativeTitlesJson: {
    key: "alternativeTitlesJson",
    label: "Alternatywne tytuly",
    action: "generate_alternative_titles",
    userInstruction: "Wygeneruj liste alternatywnych tytulow dla tej ksiazki.",
    currentWork:
      "Autor chce warianty tytulu, ktore moze porownac z tytulem roboczym i finalnym.",
    acceptsValues: true
  },
  titleChoiceNote: {
    key: "titleChoiceNote",
    label: "Notatka wyboru tytulu",
    action: "generate_title_choice_note",
    userInstruction:
      "Napisz krotka notatke uzasadniajaca wybor tytulu tej ksiazki.",
    currentWork:
      "Autor chce zapamietac, dlaczego wybrany tytul najlepiej niesie obietnice historii.",
    acceptsValues: false
  },
  styleGuide: {
    key: "styleGuide",
    label: "Style guide",
    action: "generate_style_guide",
    userInstruction:
      "Wygeneruj praktyczny style guide dla tej ksiazki: jezyk, rytm, tempo, zakazy i preferencje.",
    currentWork:
      "Autor chce uzyteczne notatki stylu do wielokrotnego uzycia w promptach scen i redakcji.",
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
Jestes asystentem pisarskim pracujacym wewnatrz StoryForge2.

# Task
${promptPackage.userInstruction}

# Hard Rules
- Pisz po polsku, chyba ze projekt ma inny jezyk.
- Nie zapisuj ani nie zmieniaj kanonu; zwroc tylko propozycje.
- Uwzglednij wszystkie pola z Book Context, nawet jesli docelowe pole jest puste.
- Nie dodawaj komentarzy poza wymaganym JSON.
- Odpowiedz wylacznie poprawnym JSON bez trailing commas.

# Book Context
- Tytul finalny: ${emptyFallback(book.title)}
- Roboczy tytul: ${emptyFallback(book.workingTitle)}
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
- Docelowa liczba slow: ${book.targetWordCount ?? "(brak)"}
- Tematy: ${emptyFallback(renderJsonList(book.themesJson))}
- Granice i tematy niechciane: ${emptyFallback(book.unwantedThemes)}
- Alternatywne tytuly: ${emptyFallback(renderJsonList(book.alternativeTitlesJson))}
- Notatka wyboru tytulu: ${emptyFallback(book.titleChoiceNote)}
- Style guide: ${emptyFallback(book.styleGuide)}

# Current Work
Docelowe pole: ${targetField} (${config.label}).
${config.currentWork}

# Output Contract
Zwroc JSON:
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
      "Wygeneruj jedna mocna propozycje tytulu roboczego dla nowego projektu ksiazki.",
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
Jestes asystentem pisarskim pracujacym wewnatrz StoryForge2.

# Task
${promptPackage.userInstruction}

# Hard Rules
- Pisz po polsku, chyba ze projekt ma inny jezyk.
- Zwroc jedna propozycje, ktora moze od razu stac sie nazwa nowego projektu.
- Jesli autor wpisal szkic tytulu, potraktuj go jako inspiracje, a nie polecenie przepisania.
- Nie dodawaj komentarzy poza wymaganym JSON.
- Odpowiedz wylacznie poprawnym JSON bez trailing commas.

# New Project Seed
- Wpis autora: ${emptyFallback(promptPackage.context.seedTitle)}

# Current Work
Docelowe pole: workingTitle (Tytul roboczy).
Autor jest na dashboardzie i chce szybko nazwac nowy projekt ksiazki przed jego utworzeniem.

# Output Contract
Zwroc JSON:
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
