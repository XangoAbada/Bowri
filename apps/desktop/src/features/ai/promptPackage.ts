import type { AIAction, Book, Project } from "../../shared/api/types";

export type ConceptFieldKey =
  | "workingTitle"
  | "premise"
  | "genre"
  | "targetAudience"
  | "tone"
  | "styleGuide";

export type AIProviderId = "codex-cli-bridge";

export type PromptPackage = {
  id: string;
  projectId: string;
  action: AIAction;
  locale: "pl" | "en";
  userInstruction: string;
  context: {
    targetField: ConceptFieldKey;
    book: {
      workingTitle: string;
      premise: string;
      genre: string;
      targetAudience: string;
      tone: string;
      styleGuide: string;
    };
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

export const conceptFieldConfigs: Record<ConceptFieldKey, ConceptFieldConfig> = {
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
    action: "generate_premise",
    userInstruction:
      "Wygeneruj jedną klarowną premise w 1-2 zdaniach dla tej książki.",
    currentWork:
      "Autor chce premise z bohaterem, konfliktem, stawką i obietnicą historii.",
    acceptsValues: false
  },
  genre: {
    key: "genre",
    label: "Gatunek",
    action: "suggest_genre",
    userInstruction:
      "Zaproponuj najtrafniejszy zestaw gatunków lub podgatunków dla tej książki.",
    currentWork:
      "Autor chce kilka etykiet gatunkowych, które pomogą późniejszym promptom trzymać konwencje.",
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

  return {
    id: createPromptId(config.action),
    projectId: project.id,
    action: config.action,
    locale: project.language === "en" ? "en" : "pl",
    userInstruction: config.userInstruction,
    context: {
      targetField: field,
      book: {
        workingTitle: book.workingTitle,
        premise: book.premise,
        genre: book.genre,
        targetAudience: book.targetAudience,
        tone: book.tone,
        styleGuide: book.styleGuide
      }
    },
    outputContract: {
      kind: "concept_field_suggestion",
      format: "json",
      schema: {
        version: 1,
        kind: "concept_field_suggestion",
        field,
        summary: "string",
        value: config.acceptsValues ? "string | null" : "string",
        values: config.acceptsValues ? ["string"] : "[]",
        rationale: "string",
        warnings: ["string"]
      }
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
- Nie zapisuj ani nie zmieniaj kanonu; zwróć tylko propozycje.
- Uwzględnij wszystkie pola z Book Context, nawet jeśli docelowe pole jest puste.
- Nie dodawaj komentarzy poza wymaganym JSON.
- Odpowiedz wyłącznie poprawnym JSON bez trailing commas.

# Book Context
- Roboczy tytuł: ${emptyFallback(book.workingTitle)}
- Premise: ${emptyFallback(book.premise)}
- Gatunek: ${emptyFallback(book.genre)}
- Ton: ${emptyFallback(book.tone)}
- Odbiorcy: ${emptyFallback(book.targetAudience)}
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
      "Wygeneruj jedna mocna propozycje tytulu roboczego dla nowego projektu ksiazki.",
    context: {
      seedTitle
    },
    outputContract: {
      kind: "concept_field_suggestion",
      format: "json",
      schema: {
        version: 1,
        kind: "concept_field_suggestion",
        field,
        summary: "string",
        value: "string",
        values: "[]",
        rationale: "string",
        warnings: ["string"]
      }
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

function createPromptId(action: AIAction): string {
  if ("randomUUID" in crypto) {
    return `${action}:${crypto.randomUUID()}`;
  }

  return `${action}:${Date.now().toString(36)}:${Math.random()
    .toString(36)
    .slice(2)}`;
}

function emptyFallback(value: string): string {
  return value.trim().length > 0 ? value : "(brak)";
}
