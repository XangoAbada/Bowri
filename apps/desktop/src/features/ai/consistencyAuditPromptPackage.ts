import type { AIAction, Book, Project } from "../../shared/api/types";
import {
  ENTITY_FIELD_TARGETS,
  isEntityFieldAllowed,
  renderAuditFieldWhitelist,
  type EntityFieldKind
} from "./brainstormEntityTargets";
import { parseModelJson } from "./modelJson";
import type { DossierEntityKind, StoryBibleDossier } from "./storyBibleDossier";

// Audyt spójności całego projektu: pięć przebiegów wymiarowych plus synteza.
// Każdy przebieg dostaje IDENTYCZNE, pełne dossier (patrz storyBibleDossier.ts)
// i różni się wyłącznie zadanym pytaniem. Dzięki temu żaden wymiar nie analizuje
// projektu w oderwaniu od pozostałych, a synteza może rozstrzygać sprzeczne
// zalecenia mając ten sam materiał pod ręką.

export const CONSISTENCY_AUDIT_FIELD = "__consistency_audit__";

export type AuditDimension =
  | "concept"
  | "characters"
  | "world"
  | "threads"
  | "crossCutting"
  | "synthesis";

/** Przebiegi wymiarowe uruchamiane równolegle w kolejce (szeregowo w praktyce). */
export const AUDIT_DIMENSIONS: readonly AuditDimension[] = [
  "concept",
  "characters",
  "world",
  "threads",
  "crossCutting"
];

/** Wszystkie przebiegi audytu wraz z syntezą — do liczników postępu. */
export const AUDIT_PASS_COUNT = AUDIT_DIMENSIONS.length + 1;

export type ConsistencyFindingKind =
  | "contradiction"
  | "gap"
  | "weakness"
  | "duplication"
  | "unusedElement"
  | "missingPayoff";

export type ConsistencyFindingSeverity = "blocker" | "major" | "minor";

/** Encje, dla których istnieje ścieżka zapisu pojedynczego pola. */
export type ConsistencyPatchTargetKind = EntityFieldKind;

export type ConsistencyPatch = {
  targetKind: ConsistencyPatchTargetKind;
  /** Dla "concept" to bookId. */
  targetId: string;
  targetLabel: string;
  field: string;
  mode: "replace" | "append";
  /** Treść, którą model widział w dossier — podstawa diffu i wykrycia zmian. */
  currentValueExcerpt: string;
  proposedValue: string;
  rationale: string;
};

export type ConsistencyEvidence = {
  kind: DossierEntityKind;
  id: string;
  label: string;
  field?: string;
  quote?: string;
};

export type ConsistencyFinding = {
  id?: string;
  dimension: AuditDimension;
  kind: ConsistencyFindingKind;
  severity: ConsistencyFindingSeverity;
  title: string;
  description: string;
  evidence: ConsistencyEvidence[];
  /**
   * Jedna uwaga może wymagać zmian w kilku encjach (np. wygląd całej obsady).
   * Pusta tablica = uwaga bez automatycznej poprawki (rozdziały, sceny, akty, beaty…).
   */
  patches: ConsistencyPatch[];
};

export type NormalizedConsistencyAudit = {
  kind: "consistency_audit";
  dimension: AuditDimension;
  summary: string;
  textValue: string;
  findings: ConsistencyFinding[];
  warnings: string[];
};

export type ConsistencyAuditPromptPackage = {
  id: string;
  projectId: string;
  bookId: string;
  action: AIAction;
  locale: "pl" | "en";
  userInstruction: string;
  context: {
    targetField: typeof CONSISTENCY_AUDIT_FIELD;
    /** Spina sześć przebiegów w jeden audyt — czyta to koordynator w runnerze. */
    auditId: string;
    dimension: AuditDimension;
    /** Odróżnia przebiegi w dedupie kolejki propozycji. */
    targetEntityId: string;
    dossierHash: string;
    dossierText: string;
    entityCounts: Record<DossierEntityKind, number>;
    /** Tylko dla syntezy: uwagi z przebiegów wymiarowych. */
    priorFindings?: ConsistencyFinding[];
  };
  outputContract: {
    kind: "consistency_audit";
    format: "json";
  };
  generationOptions: {
    providerId: "codex-cli-bridge";
  };
};

export const AUDIT_DIMENSION_LABELS: Record<AuditDimension, string> = {
  concept: "Koncepcja",
  characters: "Postacie",
  world: "Świat i reguły",
  threads: "Wątki i plan",
  crossCutting: "Spójność całości",
  synthesis: "Synteza"
};

export const CONSISTENCY_FINDING_KIND_LABELS: Record<ConsistencyFindingKind, string> = {
  contradiction: "Sprzeczność",
  gap: "Luka",
  weakness: "Słaby punkt",
  duplication: "Duplikat",
  unusedElement: "Nieużyty element",
  missingPayoff: "Brak payoffu"
};

export const CONSISTENCY_FINDING_SEVERITY_LABELS: Record<ConsistencyFindingSeverity, string> = {
  blocker: "Krytyczne",
  major: "Istotne",
  minor: "Drobne"
};

export const CONSISTENCY_SEVERITY_ORDER: readonly ConsistencyFindingSeverity[] = [
  "blocker",
  "major",
  "minor"
];

// ---------------------------------------------------------------------------
// Zadania poszczególnych przebiegów
// ---------------------------------------------------------------------------

type DimensionSpec = {
  instruction: string;
  focus: string;
};

const DIMENSION_SPECS: Record<AuditDimension, DimensionSpec> = {
  concept: {
    instruction:
      "Sprawdź, czy koncepcja książki trzyma się razem jako jedna obietnica dla czytelnika.",
    focus: `- Czy premisa, konflikt centralny, stawki i kierunek zakończenia opisują tę samą historię?
- Czy cel protagonisty zderza się z siłą antagonistyczną, czy mijają się bokiem?
- Czy stawki są konkretne i rosnące, czy ogólnikowe ("los świata")?
- Czy zakończenie odpowiada na pytanie postawione w premisie?
- Czy gatunek, podgatunek, ton, odbiorca i perspektywa narracyjna nie przeczą sobie ani premisie?
- Czy motywy są obecne w konflikcie i stawkach, czy tylko zadeklarowane?
- Czy przewodnik stylu daje się pogodzić z tonem i perspektywą?
- Czy szkic świata obiecuje coś, czego reszta koncepcji nie wykorzystuje?`
  },
  characters: {
    instruction: "Sprawdź spójność i kompletność obsady oraz jej relacji i wspomnień.",
    focus: `- Czy któryś profil jest wewnętrznie sprzeczny (temperament vs manieryzmy, światopogląd vs tło, wygląd vs pochodzenie)?
- Czy postacie o istotnych rolach nie mają nieuzupełnionych pól kluczowych dla ich funkcji?
- Czy opisy tej samej pary postaci widziane z dwóch stron są zgodne (opinia, konflikt, historia)?
- Czy poziom zaufania w relacji zgadza się z jej opisem i konfliktem?
- Czy wspomnienia postaci dają się pogodzić z jej tłem, pochodzeniem i rodziną?
- Czy sekret postaci jest znany komuś, kto nie powinien go znać (pola "co postać wie")?
- Czy głosy postaci są odróżnialne, czy kilka ma identyczny sposób mówienia?
- Czy dwie postacie nie dublują tej samej roli fabularnej bez powodu?`
  },
  world: {
    instruction: "Sprawdź spójność świata i jego reguł.",
    focus: `- Czy każda reguła ma koszt, ograniczenie i konsekwencje naruszenia, czy jest darmowa?
- Czy dwie reguły nie przeczą sobie wzajemnie ani nie pokrywają się?
- Czy zasięg reguły jest określony, czy da się ją stosować dowolnie?
- Czy istnieją reguły bez powiązanych elementów świata i elementy bez reguł, które ich wymagają?
- Czy element świata ma cel fabularny, czy jest ozdobą?
- Czy ograniczenia elementu nie są sprzeczne z jego opisem lub z regułą, do której jest przypięty?
- Czy wyjątki od reguł nie unieważniają samych reguł?
- Czy elementy oznaczone jako lokacje są realnie używane przez sceny i rozdziały?`
  },
  threads: {
    instruction: "Sprawdź wątki i strukturę planu.",
    focus: `- Czy każdy wątek ma zawiązanie, eskalację i payoff (pole rozwiązania) w konkretnych rozdziałach?
- Czy któryś wątek nie jest przypisany do ani jednego rozdziału lub sceny?
- Czy rozdziały mają cel, konflikt i punkt zwrotny, czy tylko streszczenie?
- Czy przypisania rozdziałów do aktów zgadzają się z zakresami procentowymi aktów?
- Czy beaty pokrywają wybraną strukturę fabularną, czy zostawiają dziury?
- Czy znaczniki czasu scen tworzą spójną chronologię?
- Czy sceny mają POV i lokację tam, gdzie to potrzebne?
- Czy suma docelowych liczb słów rozdziałów daje się pogodzić z celem książki?`
  },
  crossCutting: {
    instruction:
      "Znajdź sprzeczności MIĘDZY warstwami projektu — to jedyny przebieg, który ma szukać wyłącznie kolizji krzyżowych.",
    focus: `- Czy postać wie lub potrafi coś, czego reguła świata zabrania?
- Czy wątek albo rozdział wymaga elementu świata, którego w projekcie nie ma?
- Czy plan realizuje ton, gatunek i perspektywę zapowiedziane w koncepcji?
- Czy stawki z koncepcji mają odzwierciedlenie w konfliktach rozdziałów?
- Czy sekret postaci nie jest ujawniany w rozdziale wcześniejszym niż wymaga tego jej wątek?
- Czy wspomnienia postaci nie kolidują z chronologią scen i rozdziałów?
- Czy siła antagonistyczna z koncepcji ma reprezentację w obsadzie, świecie i wątkach?
- Czy protagonista z koncepcji to ta sama postać, która prowadzi wątek główny?
- Ignoruj problemy zamknięte w jednej warstwie — te wychwytują pozostałe przebiegi.`
  },
  synthesis: {
    instruction:
      "Scal uwagi z pięciu przebiegów w jedną listę poprawek, po której autor może przejść z góry na dół.",
    focus: `- Scal uwagi opisujące ten sam problem w jedną, zachowując wszystkie dowody.
- Scalając uwagi, scal też ich poprawki: usuń duplikaty wskazujące to samo pole tej samej encji, zostawiając lepszą treść. Poprawki dotyczące różnych encji zachowaj wszystkie — to one pozwalają autorowi zastosować zmianę encja po encji.
- Usuń uwagi, które nie mają oparcia w dossier.
- Rozstrzygnij sprzeczne zalecenia: wybierz jedno i uzasadnij w polu rationale.
- Ustaw kolejność stosowania: poprawka nadrzędna (koncepcja) przed poprawką, która się na niej opiera.
- Skoryguj wagi: krytyczne jest to, co blokuje rozpoczęcie pisania, nie to, co da się dopisać później.
- Nie wymyślaj nowych problemów, których nie ma w materiale wejściowym.
- Zwróć KOMPLETNĄ listę wynikową — to ona zastąpi uwagi z przebiegów wymiarowych.`
  }
};

export function auditActionFor(dimension: AuditDimension): AIAction {
  return dimension === "synthesis" ? "synthesize_consistency_audit" : "analyze_consistency";
}

/** Identyfikator celu w kolejce — bez niego dedup zlałby pięć przebiegów w jeden. */
export function auditPassTargetId(auditId: string, dimension: AuditDimension): string {
  return `${auditId}:${dimension}`;
}

export function buildConsistencyAuditPromptPackage({
  project,
  book,
  auditId,
  dimension,
  dossier,
  priorFindings
}: {
  project: Project;
  book: Book;
  auditId: string;
  dimension: AuditDimension;
  dossier: StoryBibleDossier;
  priorFindings?: ConsistencyFinding[];
}): ConsistencyAuditPromptPackage {
  const action = auditActionFor(dimension);
  return {
    id: createPromptId(action),
    projectId: project.id,
    bookId: book.id,
    action,
    locale: project.language === "en" ? "en" : "pl",
    userInstruction: DIMENSION_SPECS[dimension].instruction,
    context: {
      targetField: CONSISTENCY_AUDIT_FIELD,
      auditId,
      dimension,
      targetEntityId: auditPassTargetId(auditId, dimension),
      dossierHash: dossier.hash,
      dossierText: dossier.text,
      entityCounts: dossier.counts,
      ...(dimension === "synthesis" ? { priorFindings: priorFindings ?? [] } : {})
    },
    outputContract: {
      kind: "consistency_audit",
      format: "json"
    },
    generationOptions: {
      providerId: "codex-cli-bridge"
    }
  };
}

export function renderConsistencyAuditPromptPackage(
  promptPackage: ConsistencyAuditPromptPackage
): string {
  const { context } = promptPackage;
  const spec = DIMENSION_SPECS[context.dimension];
  const isSynthesis = context.dimension === "synthesis";

  return `# Role
Jesteś redaktorem prowadzącym i konsultantem fabularnym pracującym wewnątrz Bowri. Autor jeszcze nie zaczął pisać — kończy przygotowania i chce wejść w pisanie ze spójnym projektem. Twoja lista poprawek jest ostatnim etapem przed pierwszym rozdziałem.

# Task
${promptPackage.userInstruction}

Wymiar tego przebiegu: ${AUDIT_DIMENSION_LABELS[context.dimension]}.

${spec.focus}

# Hard Rules
- Pisz po polsku, chyba że projekt ma inny język.
- Dla locale "pl" używaj poprawnych polskich znaków.
- Dossier poniżej jest KOMPLETNY: zawiera każdą encję i każde pole projektu. Nic nie zostało skrócone ani pominięte ze względu na rozmiar. Nie zakładaj, że czegoś nie widzisz.
- Pole opisane jako "— (nieuzupełnione)" jest faktycznie puste w projekcie. Jeśli jest potrzebne, zgłoś to jako lukę (kind: "gap"). Jeśli nie jest potrzebne, milcz.
- Nie zgłaszaj uwag o brakującej prozie, streszczeniach ani okładce — te dane świadomie nie wchodzą do audytu.
- Nie chwal. Nie parafrazuj dossier. Każda uwaga musi wskazywać konkretny problem, który autor może naprawić.
- Każda uwaga o rodzaju "contradiction" musi mieć w polu "evidence" co najmniej dwie pozycje: obie strony sprzeczności.
- W "evidence" wolno wskazywać wyłącznie identyfikatory obecne w dossier, przepisane znak w znak z nagłówka \`[rodzaj:id]\`.
- Jeżeli umiesz podać gotową treść naprawiającą problem, dopisz ją do tablicy "patches". W przeciwnym razie ustaw "patches": [] i zostaw sam opis.
- Jedna uwaga może nieść KILKA poprawek — po jednej na każdą encję, którą trzeba zmienić. Jeżeli problem dotyczy sześciu postaci, podaj sześć poprawek zamiast opisywać zmianę słowami.
- Para ("targetKind", "targetId", "field") musi być unikalna w obrębie uwagi. Nie rozbijaj jednej zmiany na dwie poprawki tego samego pola — złóż ją w jedną treść.
- "targetId" MUSI być identyfikatorem z dossier. Nigdy nie wymyślaj identyfikatora tylko po to, by dołożyć poprawkę — uwaga bez poprawek jest w porządku.
- "field" MUSI należeć do whitelisty poniżej. Pola spoza whitelisty (rozdziały, sceny, akty, beaty, relacje, wspomnienia) opisuj tekstem i pomijaj w "patches".
- "proposedValue" to GOTOWA, kompletna treść pola do wklejenia — nie instrukcja, nie polecenie, nie streszczenie zmiany.
- Przy "mode": "replace" nowa treść musi zachować wszystkie prawdziwe ustalenia z obecnej treści pola. Przy "append" podaj wyłącznie fragment do dopisania.
- "currentValueExcerpt" to dosłowny początek treści, którą widzisz w dossier (do 200 znaków) — służy do wykrycia, że autor zmienił pole po analizie.
- Nie proponuj tworzenia nowych encji ani ich usuwania. Poprawiasz to, co istnieje.
- Nie ograniczaj się liczbą uwag. Zgłoś wszystko, co realnie zagraża spójności, i nic ponad to.
- Odpowiedz wyłącznie poprawnym JSON bez trailing commas.

# Patch Field Whitelist
Rodzaj encji: dozwolone pola (etykieta w aplikacji).
${renderAuditFieldWhitelist()}
${isSynthesis ? `\n# Prior Findings\nUwagi z pięciu przebiegów wymiarowych, do scalenia:\n${JSON.stringify(context.priorFindings ?? [], null, 2)}\n` : ""}
# Story Bible — pełne dossier projektu
${context.dossierText}

# Output Contract
Zwróć JSON:
{
  "version": 1,
  "kind": "consistency_audit",
  "dimension": "${context.dimension}",
  "summary": "Ogólna ocena tego wymiaru dla autora (2-4 zdania)",
  "findings": [
    {
      "kind": "contradiction | gap | weakness | duplication | unusedElement | missingPayoff",
      "severity": "blocker | major | minor",
      "title": "Krótki tytuł problemu",
      "description": "Na czym polega problem i dlaczego zagraża spójności",
      "evidence": [
        {
          "kind": "concept | character | relation | memory | memoryLink | worldElement | worldRule | plotThread | act | beat | chapter | scene",
          "id": "identyfikator przepisany z dossier",
          "label": "nazwa encji dla autora",
          "field": "opcjonalnie: pole, w którym siedzi problem",
          "quote": "opcjonalnie: dosłowny fragment z dossier"
        }
      ],
      "patches": [
        {
          "targetKind": "concept | character | worldElement | worldRule | plotThread",
          "targetId": "identyfikator z dossier (dla concept: identyfikator koncepcji)",
          "targetLabel": "nazwa encji dla autora",
          "field": "pole z whitelisty",
          "mode": "replace | append",
          "currentValueExcerpt": "dosłowny początek obecnej treści pola",
          "proposedValue": "gotowa, kompletna treść pola",
          "rationale": "dlaczego ta treść usuwa problem"
        }
      ]
    }
  ],
  "warnings": ["opcjonalne ostrzeżenia, np. że projekt jest zbyt pusty do sensownej analizy"]
}`;
}

export function parseConsistencyAuditResult(rawOutput: string): NormalizedConsistencyAudit {
  const parsed = parseModelJson(rawOutput, "Audyt spójności");
  const record =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};

  if (record.kind !== "consistency_audit") {
    throw new Error(
      `AI zwróciło nieprawidłowy typ audytu spójności (kind: ${JSON.stringify(record.kind ?? null)}, oczekiwano "consistency_audit").`
    );
  }

  const dimension = normalizeDimension(record.dimension);
  const rawFindings = Array.isArray(record.findings) ? record.findings : [];
  const findings = rawFindings
    .map((value) => normalizeFinding(value, dimension))
    .filter((finding): finding is ConsistencyFinding => Boolean(finding));

  return {
    kind: "consistency_audit",
    dimension,
    summary:
      typeof record.summary === "string" && record.summary.trim()
        ? record.summary.trim()
        : "Audyt zakończony",
    textValue: `Audyt spójności: ${AUDIT_DIMENSION_LABELS[dimension]}`,
    findings,
    warnings: Array.isArray(record.warnings)
      ? record.warnings.filter((item): item is string => typeof item === "string")
      : []
  };
}

// ---------------------------------------------------------------------------
// Normalizacja
// ---------------------------------------------------------------------------

function normalizeFinding(value: unknown, dimension: AuditDimension): ConsistencyFinding | null {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const title = stringValue(record.title);
  const description = stringValue(record.description);
  if (!title && !description) {
    return null;
  }

  return {
    id: stringValue(record.id) || undefined,
    // Model rzadko powtarza wymiar w każdej uwadze — brak pola oznacza wymiar
    // przebiegu, nie wymiar domyślny.
    dimension: knownDimension(record.dimension) ?? dimension,
    kind: normalizeFindingKind(record.kind),
    severity: normalizeSeverity(record.severity),
    title: title || description.slice(0, 80),
    description: description || title,
    evidence: normalizeEvidence(record.evidence),
    patches: normalizePatches(record.patches, record.patch)
  };
}

/**
 * Podnosi uwagę zapisaną w bazie do bieżącego kształtu. Raporty sprzed
 * wprowadzenia `patches` trzymają w findings_json pojedyncze `patch` — bez tej
 * konwersji prompt syntezy dostałby dwa różne kontrakty naraz.
 */
export function upgradeStoredFinding(value: unknown): ConsistencyFinding | null {
  return normalizeFinding(value, "crossCutting");
}

function normalizeEvidence(value: unknown): ConsistencyEvidence[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => {
      const record =
        item && typeof item === "object" && !Array.isArray(item)
          ? (item as Record<string, unknown>)
          : {};
      const id = stringValue(record.id);
      const kind = normalizeDossierKind(record.kind);
      if (!id || !kind) {
        return null;
      }
      const field = stringValue(record.field);
      const quote = stringValue(record.quote);
      return {
        kind,
        id,
        label: stringValue(record.label) || id,
        ...(field ? { field } : {}),
        ...(quote ? { quote } : {})
      } satisfies ConsistencyEvidence;
    })
    .filter((item): item is ConsistencyEvidence => Boolean(item));
}

/**
 * Patch bez celu, pola z whitelisty albo bez gotowej treści jest bezużyteczny —
 * degradujemy go do null, żeby uwaga została jako opis, ale nigdy nie trafiła
 * do zapisu. Zgodność targetId z realnymi encjami sprawdza dopiero koordynator,
 * bo parser nie zna dossier (sygnatura parserów w tym repo to (rawOutput)).
 */
/**
 * Lista poprawek uwagi. Przyjmuje bieżące `patches` oraz stare, pojedyncze
 * `patch` (odpowiedzi modelu sprzed zmiany kontraktu i raporty zapisane w bazie).
 *
 * Dwie poprawki tego samego pola są nie do pogodzenia: w trybie replace druga
 * poleciałaby na StaleFieldValueError, w append zdublowałaby tekst — dlatego
 * deduplikujemy po (targetKind, targetId, field), zostawiając pierwszą.
 */
function normalizePatches(value: unknown, legacy: unknown): ConsistencyPatch[] {
  const candidates = Array.isArray(value) ? value : [];
  if (!candidates.length && legacy) {
    candidates.push(legacy);
  }

  const seen = new Set<string>();
  const patches: ConsistencyPatch[] = [];
  for (const candidate of candidates) {
    const patch = normalizePatch(candidate);
    if (!patch) {
      continue;
    }
    const key = `${patch.targetKind}:${patch.targetId}:${patch.field}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    patches.push(patch);
  }
  return patches;
}

function normalizePatch(value: unknown): ConsistencyPatch | null {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  if (!record) {
    return null;
  }

  const targetKind = normalizePatchTargetKind(record.targetKind);
  const targetId = stringValue(record.targetId);
  const field = stringValue(record.field);
  const proposedValue = stringValue(record.proposedValue);
  if (!targetKind || !targetId || !field || !proposedValue) {
    return null;
  }
  if (!isEntityFieldAllowed(targetKind, field)) {
    return null;
  }

  return {
    targetKind,
    targetId,
    targetLabel: stringValue(record.targetLabel) || targetId,
    field,
    mode: record.mode === "append" ? "append" : "replace",
    currentValueExcerpt: stringValue(record.currentValueExcerpt),
    proposedValue,
    rationale: stringValue(record.rationale)
  };
}

function knownDimension(value: unknown): AuditDimension | null {
  return value === "concept" ||
    value === "characters" ||
    value === "world" ||
    value === "threads" ||
    value === "crossCutting" ||
    value === "synthesis"
    ? value
    : null;
}

function normalizeDimension(value: unknown): AuditDimension {
  return knownDimension(value) ?? "crossCutting";
}

function normalizeFindingKind(value: unknown): ConsistencyFindingKind {
  return value === "contradiction" ||
    value === "gap" ||
    value === "weakness" ||
    value === "duplication" ||
    value === "unusedElement" ||
    value === "missingPayoff"
    ? value
    : "weakness";
}

function normalizeSeverity(value: unknown): ConsistencyFindingSeverity {
  return value === "blocker" || value === "major" || value === "minor" ? value : "major";
}

function normalizeDossierKind(value: unknown): DossierEntityKind | null {
  return value === "concept" ||
    value === "character" ||
    value === "relation" ||
    value === "memory" ||
    value === "memoryLink" ||
    value === "worldElement" ||
    value === "worldRule" ||
    value === "plotThread" ||
    value === "act" ||
    value === "beat" ||
    value === "chapter" ||
    value === "scene"
    ? value
    : null;
}

function normalizePatchTargetKind(value: unknown): ConsistencyPatchTargetKind | null {
  return typeof value === "string" && value in ENTITY_FIELD_TARGETS
    ? (value as ConsistencyPatchTargetKind)
    : null;
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function createPromptId(action: AIAction): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${action}:${crypto.randomUUID()}`;
  }
  return `${action}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`;
}
