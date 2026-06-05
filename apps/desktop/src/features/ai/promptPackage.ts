import type { Book, Project } from "../../shared/api/types";

export type AIAction = "generate_titles";
export type AIProviderId = "codex-cli-bridge";

export type PromptPackage = {
  id: string;
  projectId: string;
  action: AIAction;
  locale: "pl" | "en";
  userInstruction: string;
  context: {
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
    kind: "title_suggestions";
    format: "json";
    schema: unknown;
  };
  generationOptions: {
    count: number;
    providerId: AIProviderId;
  };
};

export function buildGenerateTitlesPromptPackage(
  project: Project,
  book: Book,
  count = 20
): PromptPackage {
  return {
    id: createPromptId("generate_titles"),
    projectId: project.id,
    action: "generate_titles",
    locale: project.language === "en" ? "en" : "pl",
    userInstruction: `Wygeneruj ${count} propozycji tytulow dla tej ksiazki.`,
    context: {
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
      kind: "title_suggestions",
      format: "json",
      schema: {
        version: 1,
        kind: "title_suggestions",
        summary: "string",
        items: [
          {
            title: "string",
            subtitle: "string | null",
            rationale: "string",
            tone: "string",
            risk: "string"
          }
        ],
        warnings: ["string"]
      }
    },
    generationOptions: {
      count,
      providerId: "codex-cli-bridge"
    }
  };
}

export function renderPromptPackage(promptPackage: PromptPackage): string {
  const { book } = promptPackage.context;

  return `# Role
Jestes asystentem pisarskim pracujacym wewnatrz StoryForge2.

# Task
${promptPackage.userInstruction}

# Hard Rules
- Pisz po polsku, chyba ze projekt ma inny jezyk.
- Nie zapisuj ani nie zmieniaj kanonu; zwroc tylko propozycje.
- Nie dodawaj komentarzy poza wymaganym JSON.
- Odpowiedz wylacznie poprawnym JSON bez trailing commas.

# Book Context
- Roboczy tytul: ${emptyFallback(book.workingTitle)}
- Premise: ${emptyFallback(book.premise)}
- Gatunek: ${emptyFallback(book.genre)}
- Ton: ${emptyFallback(book.tone)}
- Odbiorcy: ${emptyFallback(book.targetAudience)}
- Style guide: ${emptyFallback(book.styleGuide)}

# Current Work
Autor prosi o warianty tytulow. Liczba propozycji: ${promptPackage.generationOptions.count}.

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
