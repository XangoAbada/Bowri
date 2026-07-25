import type {
  AIAction,
  Book,
  BookPlan,
  BrainstormMessage,
  BrainstormSession,
  BrainstormSuggestion,
  BrainstormSuggestionKind,
  BrainstormSuggestionMode,
  BrainstormSuggestionStatus,
  CharacterWorkspace,
  Project,
  WorldWorkspace
} from "../../shared/api/types";
import {
  isBrainstormEntityField,
  isBrainstormEntityKind,
  renderEntityFieldWhitelist,
  type BrainstormEntityKind
} from "./brainstormEntityTargets";
import { parseModelJson } from "./modelJson";
import { estimateTokens } from "./contextWindows";
import {
  BRAINSTORM_SECTION_LIMITS,
  BRAINSTORM_STORY_BIBLE_CHAR_BUDGET,
  renderCappedStoryBible
} from "./promptContextLimits";
import type { ConceptFieldKey } from "./promptPackage";

export const BRAINSTORM_CHAT_FIELD = "__brainstorm_chat__";

// Tylko zwykłe pola tekstowe koncepcji — pola JSON (themesJson,
// alternativeTitlesJson) i liczbowe (targetWordCount) nie nadają się do
// prostego zastąp/dopisz.
export const BRAINSTORM_CONCEPT_FIELDS = [
  "title",
  "workingTitle",
  "premise",
  "protagonistSummary",
  "protagonistGoal",
  "expandedPremise",
  "centralConflict",
  "antagonistForce",
  "stakes",
  "settingSketch",
  "endingDirection",
  "genre",
  "subgenre",
  "targetAudience",
  "tone",
  "pointOfView",
  "unwantedThemes",
  "styleGuide"
] as const satisfies readonly ConceptFieldKey[];

export type BrainstormConceptField = (typeof BRAINSTORM_CONCEPT_FIELDS)[number];

export function isBrainstormConceptField(value: unknown): value is BrainstormConceptField {
  return (
    typeof value === "string" &&
    (BRAINSTORM_CONCEPT_FIELDS as readonly string[]).includes(value)
  );
}

/**
 * Sugestia prosto z odpowiedzi modelu — jeszcze bez id, klucza i statusu.
 * `op` rozstrzyga, czy powstaje nowy wpis, czy wzbogacamy istniejący.
 */
export type ParsedBrainstormSuggestion = {
  op: "create" | "revise";
  /** Klucz wskazany przez AI przy op="revise"; pusty, gdy go nie podało. */
  suggestionKey: string;
  kind: BrainstormSuggestionKind;
  conceptField?: string;
  mode: BrainstormSuggestionMode;
  targetEntityId?: string;
  targetField?: string;
  updateMode?: "append" | "replace";
  title: string;
  value: string;
  reason: string;
};

export type NormalizedBrainstormChat = {
  kind: "brainstorm_chat";
  reply: string;
  suggestions: ParsedBrainstormSuggestion[];
  stateSummary: string;
};

/**
 * Czy projekt ma już materiał (koncepcję albo story bible), na którym AI ma
 * oprzeć rozmowę — zamiast proponować historie od zera.
 */
export function hasBrainstormMaterial({
  book,
  plan,
  characters,
  world
}: {
  book: Book;
  plan: BookPlan | null;
  characters: CharacterWorkspace;
  world: WorldWorkspace;
}): boolean {
  return (
    BRAINSTORM_CONCEPT_FIELDS.some((field) => stringValue(book[field]).length > 0) ||
    characters.characters.length > 0 ||
    world.elements.length > 0 ||
    world.rules.length > 0 ||
    (plan?.threads.length ?? 0) > 0
  );
}

export type BrainstormChatPromptPackage = {
  id: string;
  projectId: string;
  bookId: string;
  action: AIAction;
  locale: "pl" | "en";
  userInstruction: string;
  context: {
    targetField: typeof BRAINSTORM_CHAT_FIELD;
    targetEntityId: string;
    sessionName: string;
    stateSummary: string;
    hasExistingMaterial: boolean;
    conceptFields: Record<BrainstormConceptField, string>;
    storyBible: {
      characters: CharacterWorkspace["characters"];
      relations: CharacterWorkspace["relations"];
      worldElements: WorldWorkspace["elements"];
      worldRules: WorldWorkspace["rules"];
      plotThreads: BookPlan["threads"];
    };
    conversation: Array<{ role: "user" | "assistant"; content: string }>;
    /** Ile starszych wiadomości nie zmieściło się w budżecie tokenów. */
    omittedMessageCount: number;
    userMessage: string;
    existingNames: string[];
    /** Sugestie czekające w panelu — AI może je wzbogacać zamiast dublować. */
    activeSuggestions: Array<{
      key: string;
      kind: BrainstormSuggestionKind;
      title: string;
      value: string;
      revision: number;
    }>;
    /** Id istniejących encji, w które AI może celować aktualizacją. */
    entityIndex: Record<BrainstormEntityKind, Array<{ id: string; name: string }>>;
  };
  outputContract: {
    kind: "brainstorm_chat";
    format: "json";
  };
  generationOptions: {
    providerId: "codex-cli-bridge";
  };
};

// Twardy cap pojedynczej wiadomości — jedna patologicznie długa nie może zjeść
// całego okna. Liczby wiadomości nie ograniczamy: o tym, ile się zmieści,
// decyduje budżet tokenowy w planBrainstormContext.
const HISTORY_MESSAGE_MAX_CHARS = 6_000;

/** Przycięcie treści wiadomości — wspólne dla planera i renderu. */
function capMessageContent(content: string): string {
  return content.length > HISTORY_MESSAGE_MAX_CHARS
    ? `${content.slice(0, HISTORY_MESSAGE_MAX_CHARS)}…`
    : content;
}

/** Wiersz historii w prompcie — jedno źródło prawdy dla estymaty i renderu. */
function formatConversationEntry(role: "user" | "assistant", content: string): string {
  return `${role === "user" ? "Autor" : "AI"}: ${content}`;
}

export type BrainstormContextPlan = {
  /** Wiadomości mieszczące się w budżecie, chronologicznie. */
  includedMessageIds: string[];
  /** Wiadomości poza oknem — widok wyszarza je na liście. */
  excludedMessageIds: string[];
  /** Prompt bez historii rozmowy (rola, reguły, koncepcja, story bible). */
  baseTokens: number;
  historyTokens: number;
  usedTokens: number;
  budgetTokens: number;
  windowTokens: number;
  source: "override" | "catalog" | "fallback";
};

export type BrainstormPromptInput = {
  project: Project;
  book: Book;
  plan: BookPlan | null;
  characters: CharacterWorkspace;
  world: WorldWorkspace;
  session: BrainstormSession;
  /** Pełna historia sesji BEZ bieżącej wiadomości autora. */
  messages: BrainstormMessage[];
  userMessage: string;
  /** Sugestie "pending" — kandydatki do wzbogacenia w tej turze. */
  activeSuggestions: BrainstormSuggestion[];
  /** Tytuły sugestii zastosowanych i odrzuconych — tych nie wskrzeszamy. */
  resolvedSuggestionTitles: string[];
  /** Brak planu = prompt bazowy bez historii (używany do estymaty). */
  contextPlan?: BrainstormContextPlan;
};

/** Podgląd treści sugestii w prompcie — pełne wartości rozdmuchałyby kontekst. */
const ACTIVE_SUGGESTION_PREVIEW_CHARS = 240;

export function buildBrainstormChatPromptPackage({
  project,
  book,
  plan,
  characters,
  world,
  session,
  messages,
  userMessage,
  activeSuggestions,
  resolvedSuggestionTitles,
  contextPlan
}: BrainstormPromptInput): BrainstormChatPromptPackage {
  const conceptFields = Object.fromEntries(
    BRAINSTORM_CONCEPT_FIELDS.map((field) => [field, stringValue(book[field])])
  ) as Record<BrainstormConceptField, string>;

  // Sugestie CZEKAJĄCE celowo NIE trafiają tutaj — inaczej reguła "nie duplikuj"
  // zakazywałaby modelowi wracać do własnej sugestii, żeby ją wzbogacić.
  const existingNames = [
    ...characters.characters.map((item) => item.name),
    ...world.elements.map((item) => item.name),
    ...world.rules.map((item) => item.name),
    ...(plan?.threads ?? []).map((item) => item.name),
    ...resolvedSuggestionTitles
  ].filter((name) => name.trim().length > 0);

  const hasExistingMaterial = hasBrainstormMaterial({ book, plan, characters, world });

  // Bez planu (render bazowy do estymaty) historia jest pusta — koszt samego
  // szkieletu promptu liczymy osobno od kosztu rozmowy.
  const includedIds = contextPlan ? new Set(contextPlan.includedMessageIds) : null;
  const includedMessages = includedIds
    ? messages.filter((message) => includedIds.has(message.id))
    : [];

  return {
    id: createPromptId("brainstorm_chat"),
    projectId: project.id,
    bookId: book.id,
    action: "brainstorm_chat",
    locale: project.language === "en" ? "en" : "pl",
    userInstruction:
      "Prowadź proaktywną burzę mózgów nad pomysłem na tę powieść i zbieraj konkretne sugestie do story bible.",
    context: {
      targetField: BRAINSTORM_CHAT_FIELD,
      targetEntityId: session.id,
      sessionName: session.name,
      stateSummary: session.stateSummary,
      hasExistingMaterial,
      conceptFields,
      storyBible: {
        characters: characters.characters,
        relations: characters.relations,
        worldElements: world.elements,
        worldRules: world.rules,
        plotThreads: plan?.threads ?? []
      },
      conversation: includedMessages.map((message) => ({
        role: message.role,
        content: capMessageContent(message.content)
      })),
      omittedMessageCount: contextPlan ? contextPlan.excludedMessageIds.length : 0,
      userMessage,
      existingNames,
      activeSuggestions: activeSuggestions.map((suggestion) => ({
        key: suggestion.key,
        kind: suggestion.kind,
        title: suggestion.title,
        value:
          suggestion.value.length > ACTIVE_SUGGESTION_PREVIEW_CHARS
            ? `${suggestion.value.slice(0, ACTIVE_SUGGESTION_PREVIEW_CHARS)}…`
            : suggestion.value,
        revision: suggestion.revision
      })),
      entityIndex: {
        character: characters.characters.map((item) => ({ id: item.id, name: item.name })),
        worldElement: world.elements.map((item) => ({ id: item.id, name: item.name })),
        worldRule: world.rules.map((item) => ({ id: item.id, name: item.name })),
        plotThread: (plan?.threads ?? []).map((item) => ({ id: item.id, name: item.name }))
      }
    },
    outputContract: {
      kind: "brainstorm_chat",
      format: "json"
    },
    generationOptions: {
      providerId: "codex-cli-bridge"
    }
  };
}

export function renderBrainstormChatPromptPackage(
  promptPackage: BrainstormChatPromptPackage
): string {
  const { context } = promptPackage;
  const conversationEntries = context.conversation
    .map((message) => formatConversationEntry(message.role, message.content))
    .join("\n\n");
  // Ucięta historia bez adnotacji uczy model, że rozmowa zaczyna się w środku;
  // z adnotacją sięga po podsumowanie stanu zamiast zgadywać.
  const omittedNote = context.omittedMessageCount
    ? `(pominięto ${context.omittedMessageCount} wcześniejszych wiadomości — opieraj się na podsumowaniu stanu powyżej)\n\n`
    : "";
  const conversationBlock = context.conversation.length
    ? `${omittedNote}${conversationEntries}`
    : "(początek rozmowy)";

  const materialStance = context.hasExistingMaterial
    ? `# Stan projektu
Projekt ma już materiał (wypełnione pola koncepcji lub wpisy w story bible poniżej). To jest JEDNA obowiązująca historia, nad którą pracujecie. Zacznij od tego, co już istnieje: odwołuj się do konkretów z koncepcji i story bible, pogłębiaj je i rozwijaj. Nie proponuj nowych, niezwiązanych historii, chyba że autor wprost poprosi o start od zera.`
    : `# Stan projektu
Projekt jest pusty — autor zaczyna od zera. Pomóż znaleźć pomysł: proponuj zalążki i prowadź od pierwszej iskry do zarysu historii.`;

  const starterTechnique = context.hasExistingMaterial
    ? "- Kierunki rozwoju: gdy autor utknął, zaproponuj 3-4 wyraźnie różne kierunki pogłębienia ISTNIEJĄCEJ historii (np. nowy wymiar konfliktu, druga strona antagonisty, koszt stawki, luka w świecie) — zawsze zakotwiczone w materiale projektu."
    : "- Startery od zera: gdy autor nie ma pomysłu albo utknął, zaproponuj 3-4 wyraźnie różne zalążki do wyboru (np. gatunek + konflikt + obraz + postać) i poproś o wybór lub modyfikację.";

  return `# Rola
Jesteś kreatywnym facylitatorem burzy mózgów nad pomysłem na powieść, pracującym wewnątrz Bowri. Twoim zadaniem jest wyciągnąć z autora jak najwięcej: doszlifować istniejący pomysł albo pomóc znaleźć go od zera. Prowadzisz rozmowę aktywnie — nie czekasz na polecenia.

${materialStance}

# Techniki
- Pytania pogłębiające: każdą odpowiedź kończ 1-2 konkretnymi pytaniami, które drążą temat (konsekwencje, motywacje, dziury logiczne, scenariusze "co jeśli").
${starterTechnique}
- Techniki kreatywne: stosuj jawnie odwrócenie założeń, łączenie odległych elementów, eskalację stawek — nazwij technikę, gdy jej używasz.
- Podsumowanie stanu: mniej więcej co 5 tur (albo po ważnym przełomie) zwróć w polu stateSummary zwięzłe podsumowanie ustaleń i wskaż w odpowiedzi białe plamy historii (np. brak antagonisty, niejasne stawki, pusty świat, brak wątków).

# Twarde reguły
- Pisz po polsku, chyba że projekt ma inny język. Dla locale "pl" używaj poprawnych polskich znaków.
- Gdy projekt ma już materiał, każda odpowiedź i każda sugestia musi być spójna z istniejącą koncepcją i story bible — rozwijasz tę historię, nie wymyślasz innej.
- Formatuj pole reply w Markdown dla czytelności: krótkie akapity oddzielone pustą linią, **pogrubienia** dla kluczowych pojęć oraz listy numerowane lub punktowane zamiast długich wyliczeń w jednym akapicie. Unikaj ścian tekstu; obsługiwane elementy to akapity, pogrubienia i listy (bez nagłówków, tabel i bloków kodu).
- Wybieralne opcje w treści reply (kierunki pogłębienia, warianty do rozważenia, tematy do wyboru) owijaj w podwójne nawiasy kwadratowe: [[Twarz stwórców]]. Renderują się jako klikalny przycisk, który autor przypina do swojej odpowiedzi. Etykieta ma być krótka (2-6 słów) i samowystarczalna, bo trafia dosłownie do wiadomości autora. Owijaj wyłącznie realne opcje wyboru — nie przypadkowe słowa czy całe zdania. Nie zagnieżdżaj [[…]] i nie łącz z **…**; etykieta nie może zawierać znaków ] ani |.
- Rozróżniaj [[…]] od suggestions: [[…]] to szybki wybór sterujący następną turą rozmowy, a suggestions to konkretny wpis do zapisania w story bible. Ta sama rzecz nie powinna być jednocześnie chipem i sugestią.
- Odpowiedz wyłącznie poprawnym JSON bez trailing commas, zgodnym z kontraktem wyjścia.
- Sugestie mogą mieć wyłącznie rodzaje: conceptField, character, worldElement, worldRule, plotThread.
- Wątki fabularne (plotThread) to jedyna encja planu, którą wolno sugerować — nigdy nie sugeruj rozdziałów, scen, aktów ani beatów.
- Dla kind=conceptField pole conceptField musi być jednym z: ${BRAINSTORM_CONCEPT_FIELDS.join(", ")}.
- Sugestię dodawaj tylko, gdy w rozmowie padło konkretne ustalenie lub mocny pomysł — nie zaśmiecaj panelu luźnymi wariacjami.
- Nie duplikuj encji ani sugestii wymienionych w sekcji "Istniejące nazwy".
- Pole value sugestii to gotowa, zwięzła treść do wstawienia (nie meta-opis).
- Wzbogacanie sugestii: gdy w rozmowie pojawia się nowy szczegół dotyczący sugestii z sekcji "Aktywne sugestie", zwróć ją ponownie z op="revise" i jej dokładnym suggestionKey. W polu value podaj PEŁNĄ, wzbogaconą treść (value zastępuje poprzednią, nie dokleja się do niej). Nie twórz drugiej sugestii o tym samym temacie.
- Aktualizacja istniejących encji: gdy ustalenie dotyczy postaci, elementu świata, reguły albo wątku, który JUŻ istnieje (sekcja "Encje docelowe"), nie proponuj nowej encji — zwróć sugestię z target.entityId (dokładne id z tej sekcji) oraz target.field (klucz z sekcji "Pola encji do aktualizacji"). W value podaj gotową treść samego tego pola. Ustaw target.mode="append", gdy treść ma dopisać się do dotychczasowej, albo "replace", gdy ma ją zastąpić.
- Nie zmyślaj identyfikatorów: jeśli nie ma pasującego id w sekcji "Encje docelowe", pomiń target i zaproponuj nową encję.

# Pola koncepcji (obecne wartości — puste pola to białe plamy)
${JSON.stringify(context.conceptFields)}

# Story bible
${renderCappedStoryBible(context.storyBible, {
  charBudget: BRAINSTORM_STORY_BIBLE_CHAR_BUDGET,
  sectionLimits: BRAINSTORM_SECTION_LIMITS
})}

# Podsumowanie dotychczasowej rozmowy
${context.stateSummary || "(brak — świeża sesja)"}

# Rozmowa (ostatnie wiadomości)
${conversationBlock}

# Nowa wiadomość autora
${context.userMessage}

# Istniejące nazwy (nie duplikuj)
${context.existingNames.length ? JSON.stringify(context.existingNames) : "(brak)"}

# Aktywne sugestie (czekają w panelu autora — możesz je wzbogacać zamiast dublować)
${context.activeSuggestions.length ? JSON.stringify(context.activeSuggestions) : "(brak)"}

# Encje docelowe (id do aktualizacji istniejących wpisów)
${JSON.stringify(context.entityIndex)}

# Pola encji do aktualizacji
${renderEntityFieldWhitelist()}

# Kontrakt wyjścia
Zwróć JSON:
{
  "version": 1,
  "kind": "brainstorm_chat",
  "reply": "konwersacyjna odpowiedź dla autora, zakończona 1-2 pytaniami pogłębiającymi; wybieralne opcje owijaj w [[etykieta]]",
  "suggestions": [
    {
      "op": "create | revise (domyślnie create)",
      "suggestionKey": "wymagane dla op=revise — dokładny key z sekcji 'Aktywne sugestie'",
      "kind": "conceptField | character | worldElement | worldRule | plotThread",
      "conceptField": "tylko dla kind=conceptField, np. premise",
      "target": {
        "entityId": "id z sekcji 'Encje docelowe' — tylko gdy uzupełniasz istniejącą encję",
        "field": "klucz pola z sekcji 'Pola encji do aktualizacji'",
        "mode": "append | replace"
      },
      "title": "nazwa robocza sugestii",
      "value": "gotowa proponowana treść",
      "reason": "dlaczego warto (1-2 zdania)"
    }
  ],
  "stateSummary": "opcjonalne aktualne podsumowanie stanu pomysłu (pomiń albo pusty string, gdy bez zmian)"
}`;
}

/**
 * Dzieli historię sesji na część mieszczącą się w budżecie tokenów i resztę.
 * Jedno źródło prawdy: tego samego planu używa builder promptu (co wysyłamy)
 * i widok czatu (co wyszarzamy) — inaczej pasek pokazywałby co innego, niż
 * model faktycznie dostaje.
 */
export function planBrainstormContext(
  input: BrainstormPromptInput,
  budget: {
    budgetTokens: number;
    windowTokens: number;
    source: "override" | "catalog" | "fallback";
  }
): BrainstormContextPlan {
  const basePackage = buildBrainstormChatPromptPackage({ ...input, contextPlan: undefined });
  const baseTokens = estimateTokens(renderBrainstormChatPromptPackage(basePackage));

  const included: string[] = [];
  let historyTokens = 0;
  // Od najnowszej wstecz; zatrzymujemy się na pierwszej, która się nie mieści —
  // dziura w środku rozmowy myli model bardziej niż krótsze okno.
  for (let index = input.messages.length - 1; index >= 0; index -= 1) {
    const message = input.messages[index];
    const entry = formatConversationEntry(message.role, capMessageContent(message.content));
    const entryTokens = estimateTokens(`${entry}\n\n`);
    if (baseTokens + historyTokens + entryTokens > budget.budgetTokens) {
      break;
    }
    historyTokens += entryTokens;
    included.push(message.id);
  }
  included.reverse();

  const includedSet = new Set(included);
  return {
    includedMessageIds: included,
    excludedMessageIds: input.messages
      .filter((message) => !includedSet.has(message.id))
      .map((message) => message.id),
    baseTokens,
    historyTokens,
    usedTokens: baseTokens + historyTokens,
    budgetTokens: budget.budgetTokens,
    windowTokens: budget.windowTokens,
    source: budget.source
  };
}

export function parseBrainstormChatResult(rawOutput: string): NormalizedBrainstormChat {
  const parsed = parseModelJson(rawOutput, "Brainstorming");
  const record =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};

  if (record.kind !== "brainstorm_chat") {
    throw new Error(
      `AI zwróciło nieprawidłowy typ odpowiedzi brainstormingu (kind: ${JSON.stringify(record.kind ?? null)}, oczekiwano "brainstorm_chat").`
    );
  }

  const reply = stringValue(record.reply);
  if (!reply) {
    throw new Error("AI zwróciło pustą odpowiedź brainstormingu.");
  }

  const rawSuggestions = Array.isArray(record.suggestions) ? record.suggestions : [];
  const suggestions = rawSuggestions
    .map(normalizeSuggestion)
    .filter((suggestion): suggestion is ParsedBrainstormSuggestion => Boolean(suggestion));

  return {
    kind: "brainstorm_chat",
    reply,
    suggestions,
    stateSummary: stringValue(record.stateSummary)
  };
}

/**
 * Sugestie zapisane przy wiadomości. Jedno źródło prawdy dla widoku brainstormu,
 * panelu propozycji i logu AI — kolumna trzyma surowy JSON, więc uszkodzony wpis
 * traktujemy jako brak sugestii zamiast wywracać render.
 */
export function parseBrainstormSuggestions(
  message: BrainstormMessage
): BrainstormSuggestion[] {
  try {
    const parsed = JSON.parse(message.suggestionsJson);
    return Array.isArray(parsed)
      ? parsed
          .map(normalizePersistedSuggestion)
          .filter((suggestion): suggestion is BrainstormSuggestion => Boolean(suggestion))
      : [];
  } catch {
    return [];
  }
}

/**
 * Sugestia z bazy uzupełniona o pola dodane później (klucz, rewizja, tryb).
 * Wpisy sprzed tej zmiany nie mają ich w JSON-ie — uzupełniamy przy KAŻDYM
 * odczycie i nie zapisujemy wstecz, więc stare sesje migrują się leniwie,
 * dopiero gdy autor albo AI faktycznie dotknie sugestii.
 */
function normalizePersistedSuggestion(value: unknown): BrainstormSuggestion | null {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const id = stringValue(record.id);
  const kind = normalizeKind(record.kind);
  const title = stringValue(record.title);
  const suggestionValue = stringValue(record.value);
  if (!id || !kind || !title || !suggestionValue) {
    return null;
  }

  const conceptField = stringValue(record.conceptField);
  const revision = Number(record.revision);
  const mode: BrainstormSuggestionMode = record.mode === "update" ? "update" : "create";
  const updateMode = record.updateMode === "append" ? "append" : undefined;
  const targetEntityId = mode === "update" ? stringValue(record.targetEntityId) : "";
  const targetField = mode === "update" ? stringValue(record.targetField) : "";

  return {
    id,
    key:
      stringValue(record.key) ||
      suggestionKey(kind, conceptField, title, {
        entityId: targetEntityId,
        field: targetField
      }),
    revision: Number.isFinite(revision) && revision > 0 ? Math.floor(revision) : 1,
    updatedByAiAt: stringValue(record.updatedByAiAt) || undefined,
    mode,
    kind,
    conceptField: kind === "conceptField" ? conceptField : undefined,
    targetEntityId: mode === "update" ? stringValue(record.targetEntityId) || undefined : undefined,
    targetField: mode === "update" ? stringValue(record.targetField) || undefined : undefined,
    updateMode: mode === "update" ? (updateMode ?? "replace") : undefined,
    title,
    value: suggestionValue,
    reason: stringValue(record.reason, "Wynika z rozmowy."),
    status: normalizeStatus(record.status)
  };
}

export type SessionSuggestion = BrainstormSuggestion & {
  messageId: string;
  messageCreatedAt: string;
};

/**
 * Sugestie całej sesji z adresem wiadomości, w której są zapisane. Jedno
 * źródło prawdy dla panelu propozycji, widoku brainstormu i budowy promptu.
 */
export function collectSessionSuggestions(
  messages: BrainstormMessage[]
): SessionSuggestion[] {
  return messages.flatMap((message) =>
    parseBrainstormSuggestions(message).map((suggestion) => ({
      ...suggestion,
      messageId: message.id,
      messageCreatedAt: message.createdAt
    }))
  );
}

/** Ile razy AI może wzbogacić jedną sugestię, zanim uznamy to za pętlę. */
const MAX_SUGGESTION_REVISION = 10;

export type BrainstormSuggestionMerge = {
  /** Nowe sugestie — zapisywane przy świeżej wiadomości asystenta. */
  created: BrainstormSuggestion[];
  /** Wzbogacone sugestie — nadpisywane w wiadomościach, w których już żyją. */
  revisions: Array<{ messageId: string; suggestion: BrainstormSuggestion }>;
  skipped: Array<{ title: string; reason: "blocked" | "revisionCap" }>;
};

/**
 * Scala sugestie z nowej tury ze stanem sesji. Zastępuje dawny dedup, który
 * powtórzony tytuł po prostu wyrzucał — przez co doprecyzowanie ustalone kilka
 * tur później przepadało zamiast trafić do istniejącej sugestii.
 */
export function mergeBrainstormSuggestions(
  incoming: ParsedBrainstormSuggestion[],
  context: {
    /** Sugestie o statusie "pending" — tylko one nadają się do wzbogacenia. */
    active: SessionSuggestion[];
    /** Nazwy encji oraz tytuły sugestii już zastosowanych lub odrzuconych. */
    blockedTitles: Iterable<string>;
  }
): BrainstormSuggestionMerge {
  const activeByKey = new Map(context.active.map((suggestion) => [suggestion.key, suggestion]));
  const blocked = new Set<string>();
  for (const title of context.blockedTitles) {
    blocked.add(title.trim().toLowerCase());
  }

  const created: BrainstormSuggestion[] = [];
  const revisions = new Map<string, { messageId: string; suggestion: BrainstormSuggestion }>();
  const skipped: BrainstormSuggestionMerge["skipped"] = [];
  const now = new Date().toISOString();
  // Klucze zużyte w tej turze — druga sugestia o tym samym kluczu nadpisuje
  // pierwszą, zamiast tworzyć bliźniaczy wpis.
  const usedKeys = new Set<string>();

  for (const suggestion of incoming) {
    const derivedKey = suggestionKey(
      suggestion.kind,
      suggestion.conceptField,
      suggestion.title,
      { entityId: suggestion.targetEntityId, field: suggestion.targetField }
    );
    // Halucynowany klucz nie może kosztować treści: nieznany klucz degradujemy
    // do zwykłego tworzenia, a nie odrzucamy.
    const target =
      (suggestion.op === "revise" && suggestion.suggestionKey
        ? activeByKey.get(suggestion.suggestionKey)
        : undefined) ?? activeByKey.get(derivedKey);

    if (target) {
      if (target.revision >= MAX_SUGGESTION_REVISION) {
        skipped.push({ title: suggestion.title, reason: "revisionCap" });
        continue;
      }
      // Rozpakowujemy jawnie: `messageId`/`messageCreatedAt` to adres wiadomości,
      // a nie część sugestii — nie mogą trafić do zapisywanego JSON-a.
      const { messageId, messageCreatedAt: _createdAt, ...stored } = target;
      revisions.set(target.key, {
        messageId,
        suggestion: {
          ...stored,
          // id, key i status zostają — panel i log AI adresują sugestię po id.
          mode: suggestion.mode,
          kind: suggestion.kind,
          conceptField: suggestion.conceptField,
          targetEntityId: suggestion.targetEntityId,
          targetField: suggestion.targetField,
          updateMode: suggestion.updateMode,
          title: suggestion.title,
          value: suggestion.value,
          reason: suggestion.reason,
          revision: target.revision + 1,
          updatedByAiAt: now
        }
      });
      continue;
    }

    // Blokada dotyczy wyłącznie TWORZENIA. Sugestia aktualizująca nosi zwykle
    // nazwę encji, której dotyczy ("Marta" → pole secret), więc lista
    // "nie duplikuj" odrzucałaby dokładnie te sugestie, o które chodzi.
    if (
      suggestion.mode === "create" &&
      (blocked.has(suggestion.title.trim().toLowerCase()) || blocked.has(derivedKey))
    ) {
      skipped.push({ title: suggestion.title, reason: "blocked" });
      continue;
    }

    const fresh: BrainstormSuggestion = {
      id: createSuggestionId(),
      key: derivedKey,
      revision: 1,
      mode: suggestion.mode,
      kind: suggestion.kind,
      conceptField: suggestion.conceptField,
      targetEntityId: suggestion.targetEntityId,
      targetField: suggestion.targetField,
      updateMode: suggestion.updateMode,
      title: suggestion.title,
      value: suggestion.value,
      reason: suggestion.reason,
      status: "pending"
    };
    if (usedKeys.has(derivedKey)) {
      const index = created.findIndex((item) => item.key === derivedKey);
      created[index] = { ...fresh, id: created[index].id };
      continue;
    }
    usedKeys.add(derivedKey);
    created.push(fresh);
  }

  return { created, revisions: [...revisions.values()], skipped };
}

/**
 * Stabilny adres sugestii w sesji. `id` jest losowe i powstaje na nowo przy
 * każdej turze, więc AI nie mogłoby się nim posłużyć; klucz derywujemy z
 * rodzaju i tytułu, dzięki czemu działa też dla wpisów sprzed tej zmiany.
 */
export function suggestionKey(
  kind: BrainstormSuggestionKind,
  conceptField: string | undefined,
  title: string,
  target?: { entityId?: string; field?: string }
): string {
  // Pola koncepcji adresujemy po polu: dwie propozycje na to samo pole i tak
  // są redundantne (zachowana semantyka dawnego dedupu).
  if (kind === "conceptField") {
    return `cf:${conceptField ?? ""}`;
  }
  // Aktualizacje adresujemy przez encję i pole — inaczej propozycja sekretu i
  // propozycja wyglądu tej samej postaci miałyby wspólny klucz i druga
  // nadpisywałaby pierwszą jako "rewizja".
  if (target?.entityId && target.field) {
    return `${kind}:${target.entityId}:${target.field}`;
  }
  return `${kind}:${slugifyTitle(title)}`;
}

function slugifyTitle(title: string): string {
  return (
    title
      .trim()
      .toLowerCase()
      // „ł" nie ma formy rozkładalnej w NFKD — bez tej podmiany polskie tytuły
      // gubiłyby litery i dawały klucze typu "atarnik".
      .replace(/ł/g, "l")
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "bez-nazwy"
  );
}

function normalizeStatus(value: unknown): BrainstormSuggestionStatus {
  return value === "applied" || value === "dismissed" ? value : "pending";
}

function normalizeSuggestion(value: unknown): ParsedBrainstormSuggestion | null {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const kind = normalizeKind(record.kind);
  const title = stringValue(record.title);
  const suggestionValue = stringValue(record.value);
  if (!kind || !title || !suggestionValue) {
    return null;
  }

  const conceptField = stringValue(record.conceptField);
  if (kind === "conceptField" && !isBrainstormConceptField(conceptField)) {
    return null;
  }

  const target = normalizeSuggestionTarget(kind, record.target);

  return {
    op: record.op === "revise" ? "revise" : "create",
    suggestionKey: stringValue(record.suggestionKey),
    kind,
    conceptField: kind === "conceptField" ? conceptField : undefined,
    mode: target ? "update" : "create",
    targetEntityId: target?.entityId,
    targetField: target?.field,
    updateMode: target?.mode,
    title,
    value: suggestionValue,
    reason: stringValue(record.reason, "Wynika z rozmowy.")
  };
}

/**
 * Cel aktualizacji encji. Niekompletny lub spoza whitelisty → null, czyli
 * degradacja do zwykłej sugestii tworzącej: treść zostaje, tylko trafi do
 * nowego wpisu zamiast do istniejącego. Pola koncepcji mają własną ścieżkę
 * (zastąp/dopisz na poziomie pola książki) i celu nigdy nie używają.
 */
function normalizeSuggestionTarget(
  kind: BrainstormSuggestionKind,
  value: unknown
): { entityId: string; field: string; mode: "append" | "replace" } | null {
  if (kind === "conceptField" || !isBrainstormEntityKind(kind)) {
    return null;
  }
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  if (!record) {
    return null;
  }
  const entityId = stringValue(record.entityId);
  const field = stringValue(record.field);
  if (!entityId || !isBrainstormEntityField(kind as BrainstormEntityKind, field)) {
    return null;
  }
  return {
    entityId,
    field,
    mode: record.mode === "append" ? "append" : "replace"
  };
}

function normalizeKind(value: unknown): BrainstormSuggestionKind | null {
  return value === "conceptField" ||
    value === "character" ||
    value === "worldElement" ||
    value === "worldRule" ||
    value === "plotThread"
    ? value
    : null;
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function createSuggestionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`;
}

function createPromptId(action: AIAction): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${action}:${crypto.randomUUID()}`;
  }
  return `${action}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`;
}
