import {
  cancelActiveCodexRun,
  listActiveCodexRuns,
  markAiProposalAccepted,
  markAiProposalRejected,
  saveConsistencyAudit
} from "../../shared/api/commands";
import type {
  Book,
  BookPlan,
  CharacterWorkspace,
  Project,
  WorldWorkspace
} from "../../shared/api/types";
import {
  AUDIT_DIMENSIONS,
  auditActionFor,
  buildConsistencyAuditPromptPackage,
  CONSISTENCY_AUDIT_FIELD,
  renderConsistencyAuditPromptPackage,
  type AuditDimension,
  type ConsistencyFinding,
  type NormalizedConsistencyAudit
} from "./consistencyAuditPromptPackage";
import {
  auditScope,
  createAuditId,
  createFindingId,
  serializeAuditFindings,
  serializeAuditPasses,
  useConsistencyAuditStore,
  type ConsistencyAudit,
  type ConsistencyAuditReportFinding,
  type ConsistencyReportPatch
} from "./consistencyAuditStore";
import {
  applyEntityFieldUpdate,
  EntityNotFoundError,
  StaleFieldValueError
} from "./entityFieldUpdate";
import { useProposalStore } from "./proposalStore";
import { buildStoryBibleDossier, type StoryBibleDossier } from "./storyBibleDossier";

// Koordynator sześciu przebiegów audytu. Kolejka propozycji (useAiQueueRunner)
// jest ściśle szeregowa i traktuje każdą propozycję jako niezależną, więc
// łańcuch „pięć wymiarów, potem synteza" nie jest zmianą runnera, a reakcją na
// jego wynik: po każdym udanym przebiegu sprawdzamy, czy komplet jest gotowy,
// i dopiero wtedy wrzucamy syntezę do kolejki.

type AuditContext = {
  project: Project;
  book: Book;
  dossier: StoryBibleDossier;
  /** Zakres wybrany przy starcie — po nim liczy się domknięcie syntezą. */
  dimensions: AuditDimension[];
};

/**
 * Dossier i dane potrzebne do zbudowania promptu syntezy, per audyt, na czas
 * sesji. Do bazy nie idą: prompt każdego przebiegu jest już zapisany w ai_runs,
 * a raport potrzebuje tylko hasha. Skutek uboczny do zaakceptowania — po
 * restarcie aplikacji w połowie analizy synteza nie dopnie się sama i audyt
 * zostanie „częściowy"; strona Analiza pozwala go wtedy uruchomić od nowa.
 */
const auditContexts = new Map<string, AuditContext>();

export function startConsistencyAudit({
  project,
  book,
  plan,
  characters,
  world,
  dimensions
}: {
  project: Project;
  book: Book;
  plan: BookPlan;
  characters: CharacterWorkspace;
  world: WorldWorkspace;
  /** Zakres audytu; pominięty albo pusty oznacza wszystkie wymiary. */
  dimensions?: AuditDimension[];
}): { auditId: string; dossier: StoryBibleDossier } {
  const dossier = buildStoryBibleDossier({ project, book, plan, characters, world });
  const auditId = createAuditId();
  // Kolejność z AUDIT_DIMENSIONS, nie z wyboru autora: przebiegi mają lecieć
  // zawsze w tej samej kolejności, niezależnie od tego, co odklikał.
  const scope = dimensions?.length
    ? AUDIT_DIMENSIONS.filter((dimension) => dimensions.includes(dimension))
    : [...AUDIT_DIMENSIONS];
  auditContexts.set(auditId, { project, book, dossier, dimensions: scope });

  useConsistencyAuditStore.getState().startAudit({
    id: auditId,
    projectId: project.id,
    bookId: book.id,
    dossierHash: dossier.hash,
    dossierText: dossier.text,
    dimensions: scope
  });

  for (const dimension of scope) {
    enqueuePass({ project, book, auditId, dimension, dossier });
  }

  void persistConsistencyAudit(auditId);
  return { auditId, dossier };
}

/** Ponowne uruchomienie jednego przebiegu — po błędzie albo po anulowaniu. */
export function retryConsistencyAuditPass(
  auditId: string,
  dimension: AuditDimension
): boolean {
  const context = auditContexts.get(auditId);
  if (!context) {
    return false;
  }

  const store = useConsistencyAuditStore.getState();
  const audit = store.audits.find((item) => item.id === auditId);
  if (!audit) {
    return false;
  }

  store.setPassStatus(auditId, dimension, "queued", { errorMessage: "" });
  enqueuePass({
    project: context.project,
    book: context.book,
    auditId,
    dimension,
    dossier: context.dossier,
    priorFindings: dimension === "synthesis" ? collectPriorFindings(audit) : undefined
  });
  return true;
}

function enqueuePass({
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
}): void {
  const promptPackage = buildConsistencyAuditPromptPackage({
    project,
    book,
    auditId,
    dimension,
    dossier,
    priorFindings
  });

  // Id propozycji trafia do raportu, żeby „Przyjmij raport" wiedziało, co
  // rozliczyć — także po restarcie aplikacji. Przy trafieniu w dedup
  // enqueueProposal zwraca id propozycji już czekającej w kolejce, więc zapis
  // jest poprawny również wtedy.
  const { id } = useProposalStore.getState().enqueueProposal({
    scope: "consistencyAudit",
    projectId: project.id,
    bookId: book.id,
    field: CONSISTENCY_AUDIT_FIELD,
    action: auditActionFor(dimension),
    promptPackageId: promptPackage.id,
    promptPackageJson: promptPackage,
    prompt: renderConsistencyAuditPromptPackage(promptPackage)
  });
  useConsistencyAuditStore.getState().setPassProposalId(auditId, dimension, id);
}

// ---------------------------------------------------------------------------
// Reakcja na wynik przebiegu — wołane z side-effectu runnera kolejki
// ---------------------------------------------------------------------------

export type ConsistencyAuditPassRef = {
  auditId: string;
  dimension: AuditDimension;
  dossierHash: string;
};

/** Wyciąga namiary audytu z pakietu propozycji; null = to nie audyt spójności. */
export function consistencyAuditPassRef(
  promptPackageJson: unknown
): ConsistencyAuditPassRef | null {
  if (!promptPackageJson || typeof promptPackageJson !== "object") {
    return null;
  }
  const context = (promptPackageJson as { context?: unknown }).context;
  if (!context || typeof context !== "object") {
    return null;
  }
  const record = context as Record<string, unknown>;
  const auditId = typeof record.auditId === "string" ? record.auditId : "";
  const dimension = record.dimension;
  if (!auditId || !isAuditDimension(dimension)) {
    return null;
  }
  return {
    auditId,
    dimension,
    dossierHash: typeof record.dossierHash === "string" ? record.dossierHash : ""
  };
}

export function recordConsistencyAuditPass({
  ref,
  parsed,
  aiRunId
}: {
  ref: ConsistencyAuditPassRef;
  parsed: NormalizedConsistencyAudit;
  aiRunId?: string;
}): void {
  const dossier = auditContexts.get(ref.auditId)?.dossier;

  useConsistencyAuditStore.getState().setPassResult({
    auditId: ref.auditId,
    dimension: ref.dimension,
    summary: parsed.summary,
    findings: parsed.findings.map((finding) => toReportFinding(finding, dossier)),
    aiRunId
  });

  void persistConsistencyAudit(ref.auditId);
  advanceConsistencyAudit(ref.auditId);
}

export function recordConsistencyAuditFailure({
  ref,
  errorMessage,
  aiRunId
}: {
  ref: ConsistencyAuditPassRef;
  errorMessage: string;
  aiRunId?: string;
}): void {
  useConsistencyAuditStore
    .getState()
    .setPassStatus(ref.auditId, ref.dimension, "error", { errorMessage, aiRunId });
  void persistConsistencyAudit(ref.auditId);
}

export function markConsistencyAuditPassRunning(ref: ConsistencyAuditPassRef): void {
  useConsistencyAuditStore.getState().setPassStatus(ref.auditId, ref.dimension, "running");
}

/**
 * Domyka audyt: gdy wszystkie wymiary z zakresu mają wynik, dorzuca do kolejki
 * przebieg syntezy. Idempotentne — enqueueProposal deduplikuje po celu
 * (auditId:synthesis), więc powtórne wywołanie nie tworzy drugiej syntezy.
 *
 * Przy jednowymiarowym zakresie synteza nie ma czego scalać — jej "skipped"
 * wystawia store i tutaj nie robimy nic.
 */
export function advanceConsistencyAudit(auditId: string): void {
  const context = auditContexts.get(auditId);
  if (!context) {
    return;
  }
  const audit = useConsistencyAuditStore
    .getState()
    .audits.find((item) => item.id === auditId);
  if (!audit) {
    return;
  }

  const scope = auditScope(audit);
  if (scope.length < 2) {
    return;
  }

  const dimensionsDone = scope.every(
    (dimension) => audit.passes[dimension].status === "success"
  );
  if (!dimensionsDone || audit.passes.synthesis.status === "success") {
    return;
  }

  enqueuePass({
    project: context.project,
    book: context.book,
    auditId,
    dimension: "synthesis",
    dossier: context.dossier,
    priorFindings: collectPriorFindings(audit)
  });
}

export async function persistConsistencyAudit(auditId: string): Promise<void> {
  const audit = useConsistencyAuditStore
    .getState()
    .audits.find((item) => item.id === auditId);
  if (!audit) {
    return;
  }

  try {
    await saveConsistencyAudit({
      id: audit.id,
      projectId: audit.projectId,
      bookId: audit.bookId,
      status: audit.status,
      dossierHash: audit.dossierHash,
      summary: audit.summary,
      passesJson: serializeAuditPasses(audit),
      findingsJson: serializeAuditFindings(audit.findings)
    });
  } catch (error) {
    // Zapis raportu nie może wywrócić kolejki AI — raport zostaje w pamięci,
    // a autor widzi go do końca sesji.
    console.warn("Nie udało się zapisać audytu spójności", error);
  }
}

// ---------------------------------------------------------------------------
// Walidacja patchy
// ---------------------------------------------------------------------------

/**
 * Uwaga gotowa do pokazania w panelu. Patch wskazujący encję, której nie ma w
 * dossier, jest halucynacją: uwagę zostawiamy jako opis, ale odbieramy jej
 * przycisk „Zastosuj". Zgodność pola z whitelistą sprawdził już parser.
 */
export function toReportFinding(
  finding: ConsistencyFinding,
  dossier: StoryBibleDossier | undefined
): ConsistencyAuditReportFinding {
  const patches: ConsistencyReportPatch[] = finding.patches.map((patch) => {
    // Bez dossier (raport odtworzony z bazy po restarcie) nie mamy czym
    // zweryfikować celu — poprawka zostaje, weryfikacja spada na zapis, który
    // rzuca EntityNotFoundError zamiast tworzyć encję widmo.
    if (!dossier) {
      return { ...patch, status: "open", applicable: true };
    }

    const known = dossier.knownIds[patch.targetKind];
    if (!known || !known.has(patch.targetId)) {
      return {
        ...patch,
        status: "open",
        applicable: false,
        blockedReason: entityMissingReason(patch.targetKind, patch.targetId)
      };
    }
    return { ...patch, status: "open", applicable: true };
  });

  const applicable = patches.some((patch) => patch.applicable);
  return {
    ...finding,
    patches,
    id: finding.id || createFindingId(),
    status: "open",
    applicable,
    ...(patches.length && !applicable
      ? { applyBlockedReason: patches[0]?.blockedReason ?? "" }
      : {})
  };
}

function entityMissingReason(targetKind: string, targetId: string): string {
  return `AI wskazało encję, której nie ma w projekcie (${targetKind}: ${targetId}).`;
}

// ---------------------------------------------------------------------------
// Stosowanie poprawek
// ---------------------------------------------------------------------------

export type ApplyPatchOutcome =
  | { ok: true }
  | { ok: false; reason: "notApplicable" | "stale" | "notFound" | "error"; error?: unknown };

/**
 * Zapis jednej poprawki wraz z aktualizacją statusu w raporcie. Bez toastów i
 * bez unieważniania zapytań — te robi wywołujący, bo panel i log AI odświeżają
 * różne widoki. Stan czytamy ze store'u, a nie z propsów, żeby akcja zbiorcza
 * pracowała na aktualnych danych po każdym kroku.
 *
 * Wołać SZEREGOWO: applyEntityFieldUpdate dla wszystkich encji poza koncepcją
 * odsyła komplet pól encji, więc równoległe zapisy nadpisałyby się wzajemnie.
 */
export async function applyAuditPatch({
  auditId,
  findingId,
  patchIndex
}: {
  auditId: string;
  findingId: string;
  patchIndex: number;
}): Promise<ApplyPatchOutcome> {
  const store = useConsistencyAuditStore.getState();
  const audit = store.audits.find((item) => item.id === auditId);
  const finding = audit?.findings.find((item) => item.id === findingId);
  const patch = finding?.patches[patchIndex];
  if (!audit || !finding || !patch || !patch.applicable || patch.status !== "open") {
    return { ok: false, reason: "notApplicable" };
  }

  try {
    await applyEntityFieldUpdate({
      projectId: audit.projectId,
      bookId: audit.bookId,
      kind: patch.targetKind,
      entityId: patch.targetId,
      field: patch.field,
      value: patch.proposedValue,
      mode: patch.mode === "append" ? "append" : "replace",
      expectedCurrentPrefix: patch.currentValueExcerpt
    });
    store.setPatchStatus({ auditId, findingId, patchIndex, status: "applied" });
    void persistConsistencyAudit(auditId);
    return { ok: true };
  } catch (error) {
    // Autor zmienił pole po analizie — poprawka zostaje widoczna jako
    // nieaktualna, ale traci przycisk, żeby nie nadpisać jego pracy.
    if (error instanceof StaleFieldValueError) {
      store.setPatchStatus({ auditId, findingId, patchIndex, status: "stale" });
      void persistConsistencyAudit(auditId);
      return { ok: false, reason: "stale", error };
    }

    // Raport odtworzony z bazy nie miał dossier, więc halucynowany cel wychodzi
    // dopiero tutaj. Zdejmujemy „wykonalną", żeby przycisk przestał kusić.
    if (error instanceof EntityNotFoundError) {
      store.setPatchStatus({
        auditId,
        findingId,
        patchIndex,
        status: "open",
        applicable: false,
        blockedReason: entityMissingReason(patch.targetKind, patch.targetId)
      });
      void persistConsistencyAudit(auditId);
      return { ok: false, reason: "notFound", error };
    }

    return { ok: false, reason: "error", error };
  }
}

/** Widoki, które musi odświeżyć zapis poprawki — te same w panelu i w logu AI. */
export function consistencyAuditQueryKeys({
  projectId,
  bookId
}: {
  projectId: string;
  bookId: string;
}): unknown[][] {
  return [
    ["project", projectId],
    ["projects"],
    ["book-plan", bookId],
    ["character-workspace", projectId],
    ["world-workspace", projectId],
    ["consistency-audits", bookId]
  ];
}

// ---------------------------------------------------------------------------
// Rozliczenie raportu
// ---------------------------------------------------------------------------

/**
 * Propozycje kolejki należące do audytu. Sam zapis w raporcie nie wystarcza:
 * ponowienie przebiegu tworzy nową propozycję, a stara zostaje w skrzynce jako
 * nierozliczona — dlatego dokładamy skan store'u po auditId z pakietu promptu
 * (ten przeżywa restart, bo idzie do payload_json).
 */
export function auditProposalIds(auditId: string): string[] {
  const audit = useConsistencyAuditStore
    .getState()
    .audits.find((item) => item.id === auditId);
  const fromPasses = audit
    ? Object.values(audit.passes)
        .map((pass) => pass.proposalId)
        .filter((id): id is string => Boolean(id))
    : [];
  const fromStore = useProposalStore
    .getState()
    .proposals.filter(
      (proposal) => consistencyAuditPassRef(proposal.promptPackageJson)?.auditId === auditId
    )
    .map((proposal) => proposal.id);
  return [...new Set([...fromPasses, ...fromStore])];
}

/**
 * „Przyjmij raport": rozlicza przebiegi jako zaakceptowane i zamyka kartę w
 * panelu AI. Raport zostaje w bazie i na stronie Analiza wraz z uwagami, których
 * autor jeszcze nie zastosował.
 */
export async function acceptConsistencyAuditReport(
  auditId: string
): Promise<{ accepted: number; failed: number }> {
  const ids = auditProposalIds(auditId);
  const results = await Promise.allSettled(ids.map((id) => markAiProposalAccepted(id)));

  const clearProposal = useProposalStore.getState().clearProposal;
  let accepted = 0;
  let failed = 0;
  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      accepted += 1;
      // Tylko rozliczone znikają ze skrzynki: propozycja usunięta z pamięci mimo
      // nieudanego zapisu wróciłaby duchem przy następnej hydratacji.
      clearProposal(ids[index]);
      return;
    }
    failed += 1;
  });

  if (failed === 0) {
    useConsistencyAuditStore.getState().setAcknowledged(auditId, true);
    void persistConsistencyAudit(auditId);
  }

  return { accepted, failed };
}

// ---------------------------------------------------------------------------
// Sprzątanie przebiegów
// ---------------------------------------------------------------------------

/**
 * Zatrzymuje analizę na żądanie autora: ubija proces biegnącego przebiegu,
 * zdejmuje z kolejki te, które jeszcze nie ruszyły, i zostawia raport z tym, co
 * zdążyło się policzyć.
 *
 * Przebiegi zatrzymane dostają status "error" z jawnym komunikatem, a nie
 * "skipped" — skipped oznacza wymiar spoza zakresu, którego autor nie zamawiał.
 * Dzięki temu każdy z nich ma przycisk „Ponów przebieg".
 */
export async function stopConsistencyAudit(auditId: string): Promise<void> {
  const store = useProposalStore.getState();
  const auditStore = useConsistencyAuditStore.getState();
  const audit = auditStore.audits.find((item) => item.id === auditId);
  if (!audit) {
    return;
  }

  const ids = new Set(auditProposalIds(auditId));
  const running = store.proposals.find(
    (proposal) => ids.has(proposal.id) && proposal.status === "running"
  );
  if (running) {
    await cancelRunningProposal(running.projectId, running.aiRunId, running.action);
  }

  for (const id of ids) {
    store.clearProposal(id);
  }
  await Promise.allSettled([...ids].map((id) => markAiProposalRejected(id)));

  const stoppedMessage = "Analiza zatrzymana przez autora.";
  for (const dimension of [...AUDIT_DIMENSIONS, "synthesis" as AuditDimension]) {
    const status = audit.passes[dimension].status;
    if (status === "queued" || status === "running") {
      auditStore.setPassStatus(auditId, dimension, "error", {
        errorMessage: stoppedMessage
      });
    }
  }
  await persistConsistencyAudit(auditId);
}

/**
 * Usuwa przebiegi audytu z kolejki AI i z bazy.
 *
 * Bez tego usunięcie raportu zostawiało jego propozycje jako "queued": po
 * restarcie wracały przy hydratacji i — ponieważ runner kolejki jest ściśle
 * szeregowy — blokowały każdą następną analizę. Blokada była przy tym
 * niewidoczna, bo kafelki przebiegów audytu są odfiltrowane z kolejki
 * (AiProposalPanel), więc autor widział tylko „Czekam na wolne miejsce".
 */
export async function discardConsistencyAuditProposals(auditId: string): Promise<void> {
  const ids = auditProposalIds(auditId);
  if (!ids.length) {
    return;
  }

  const store = useProposalStore.getState();
  const running = store.proposals.find(
    (proposal) => ids.includes(proposal.id) && proposal.status === "running"
  );
  // Samo usunięcie ze store'u nie zatrzymuje procesu CLI — ten trzymałby slot
  // kolejki aż do timeoutu (dla audytu to pół godziny).
  if (running) {
    await cancelRunningProposal(running.projectId, running.aiRunId, running.action);
  }

  for (const id of ids) {
    store.clearProposal(id);
  }
  // Odrzucone w bazie, nie usunięte: hydratacja pomija wszystko, co nie jest
  // "pending", a wpis zostaje w logu AI.
  await Promise.allSettled(ids.map((id) => markAiProposalRejected(id)));
}

/**
 * Przebiegi wskazujące audyt, którego nie ma w store. Powstają, gdy raport
 * zniknie (usunięty przed tą poprawką albo z nieodczytywalnym JSON-em) — dla
 * kolejki są martwym balastem, który i tak nigdy nie zapisze wyniku, bo
 * recordConsistencyAuditPass nie ma czego zaktualizować.
 *
 * Wołać dopiero po hydratacji audytów ORAZ propozycji, inaczej skasuje
 * przebiegi audytu, który jeszcze się nie wczytał.
 */
export async function discardOrphanedConsistencyAuditProposals(): Promise<number> {
  const knownAudits = new Set(
    useConsistencyAuditStore.getState().audits.map((audit) => audit.id)
  );
  const orphans = useProposalStore.getState().proposals.filter((proposal) => {
    const ref = consistencyAuditPassRef(proposal.promptPackageJson);
    return Boolean(ref) && !knownAudits.has(ref!.auditId);
  });
  if (!orphans.length) {
    return 0;
  }

  const running = orphans.find((proposal) => proposal.status === "running");
  if (running) {
    await cancelRunningProposal(running.projectId, running.aiRunId, running.action);
  }

  const clearProposal = useProposalStore.getState().clearProposal;
  for (const proposal of orphans) {
    clearProposal(proposal.id);
  }
  await Promise.allSettled(orphans.map((proposal) => markAiProposalRejected(proposal.id)));
  return orphans.length;
}

/**
 * Zatrzymuje proces CLI biegnący dla propozycji. Propozycja poznaje swój
 * aiRunId dopiero po zakończeniu generacji, więc w trakcie trzeba go odszukać
 * wśród aktywnych runów — po akcji, tak samo jak robi to panel AI.
 */
async function cancelRunningProposal(
  projectId: string,
  aiRunId: string | undefined,
  action: string
): Promise<void> {
  try {
    let runId = aiRunId;
    if (!runId) {
      const runs = await listActiveCodexRuns(projectId);
      runId = runs.find((run) => run.action === action)?.aiRunId;
    }
    await cancelActiveCodexRun({ projectId, aiRunId: runId });
  } catch (error) {
    // Brak procesu do ubicia nie może wywrócić sprzątania — propozycja i tak
    // znika z kolejki, a run sam padnie na timeoucie.
    console.warn("Nie udało się anulować przebiegu audytu", error);
  }
}

function collectPriorFindings(audit: ConsistencyAudit): ConsistencyFinding[] {
  return auditScope(audit).flatMap(
    (dimension) => audit.rawFindingsByDimension[dimension] ?? []
  );
}

function isAuditDimension(value: unknown): value is AuditDimension {
  return (
    value === "synthesis" || AUDIT_DIMENSIONS.includes(value as AuditDimension)
  );
}

/** Testy potrzebują czystego stanu między przypadkami. */
export function resetConsistencyAuditContexts(): void {
  auditContexts.clear();
}
