import type {
  AcceptGeneratedBookCoverInput,
  Act,
  AiLogEntry,
  AiRunResult,
  Beat,
  Book,
  BookCoverResult,
  BookConceptInput,
  BookPlan,
  Chapter,
  CodexCliStatus,
  CodexModelCatalog,
  CreateProjectInput,
  GenerateBookCoverInput,
  GenerateNewProjectTitleRequest,
  MoveBeatToChapterInput,
  PlotThread,
  Project,
  ProjectDetails,
  ProjectSummary,
  ReorderPlanItemsInput,
  RunCodexPromptRequest,
  SaveStoryStructureInput,
  StoryStructure,
  UpsertActInput,
  UpsertBeatInput,
  UpsertChapterInput,
  UpsertPlotThreadInput
} from "./types";

const STORAGE_KEY = "storyforge2.browserPreview.projects";

type BrowserPreviewState = {
  projects: ProjectDetails[];
  aiRuns: AiLogEntry[];
  plans: Record<string, BookPlan>;
};

let memoryState: BrowserPreviewState = {
  projects: [],
  aiRuns: [],
  plans: {}
};

export function isTauriRuntime(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return "__TAURI_INTERNALS__" in window;
}

export async function browserCreateProject(
  input: CreateProjectInput
): Promise<ProjectDetails> {
  const name = input.name.trim();
  if (!name) {
    throw new Error("Project name cannot be empty.");
  }

  const state = readState();
  const now = new Date().toISOString();
  const projectId = createId();
  const bookId = createId();

  const project: Project = {
    id: projectId,
    name,
    language: input.language ?? "pl",
    createdAt: now,
    updatedAt: now,
    activeBookId: bookId,
    settingsJson: "{}"
  };

  const book: Book = {
    id: bookId,
    projectId,
    title: "",
    workingTitle: name,
    premise: "",
    protagonistSummary: "",
    protagonistGoal: "",
    expandedPremise: "",
    logline: "",
    centralConflict: "",
    antagonistForce: "",
    stakes: "",
    settingSketch: "",
    endingDirection: "",
    genre: "",
    subgenre: "",
    targetAudience: "",
    tone: "",
    styleGuide: "",
    pointOfView: "",
    targetWordCount: null,
    themesJson: "[]",
    unwantedThemes: "",
    alternativeTitlesJson: "[]",
    coverImagePath: "",
    coverPrompt: "",
    coverNegativePrompt: "",
    coverGeneratedAt: null,
    status: "draft",
    createdAt: now,
    updatedAt: now
  };

  const details = { project, book };
  state.projects.unshift(details);
  writeState(state);
  return details;
}

export async function browserListProjects(): Promise<ProjectSummary[]> {
  return readState()
    .projects.map(({ project, book }) => ({
      id: project.id,
      name: project.name,
      language: project.language,
      updatedAt: project.updatedAt,
      activeBookId: project.activeBookId,
      workingTitle: book.workingTitle,
      coverImagePath: book.coverImagePath ?? ""
    }))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function browserGetProject(
  projectId: string
): Promise<ProjectDetails> {
  const details = readState().projects.find(
    ({ project }) => project.id === projectId
  );

  if (!details) {
    throw new Error("Project not found in browser preview storage.");
  }

  return normalizeDetails(details);
}

export async function browserGetBookPlan(bookId: string): Promise<BookPlan> {
  const state = readState();
  return normalizePlan(state.plans[bookId]);
}

export async function browserSaveStoryStructure(
  input: SaveStoryStructureInput
): Promise<StoryStructure> {
  const state = readState();
  const plan = ensurePlan(state, input.bookId);
  const now = new Date().toISOString();
  const structure: StoryStructure = {
    id: input.id ?? plan.structure?.id ?? createId(),
    bookId: input.bookId,
    structureType: input.structureType,
    description: input.description,
    notes: input.notes,
    status: input.status ?? plan.structure?.status ?? "draft",
    createdAt: plan.structure?.createdAt ?? now,
    updatedAt: now
  };
  plan.structure = structure;
  touchBook(state, input.bookId, now);
  writeState(state);
  return structure;
}

export async function browserUpsertAct(input: UpsertActInput): Promise<Act> {
  const state = readState();
  const plan = ensurePlan(state, input.bookId);
  const now = new Date().toISOString();
  const existing = input.id
    ? plan.acts.find((item) => item.id === input.id)
    : undefined;
  const act: Act = {
    id: existing?.id ?? input.id ?? createId(),
    bookId: input.bookId,
    name: input.name,
    purpose: input.purpose,
    summary: input.summary,
    startPercent: input.startPercent,
    endPercent: input.endPercent,
    orderIndex: input.orderIndex,
    color: input.color,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };

  plan.acts = upsertById(plan.acts, act);
  touchBook(state, input.bookId, now);
  writeState(state);
  return act;
}

export async function browserDeleteAct(id: string): Promise<void> {
  const state = readState();
  for (const plan of Object.values(state.plans)) {
    plan.acts = plan.acts.filter((item) => item.id !== id);
    plan.chapters = plan.chapters.map((item) =>
      item.actId === id ? { ...item, actId: null } : item
    );
  }
  writeState(state);
}

export async function browserUpsertBeat(input: UpsertBeatInput): Promise<Beat> {
  const state = readState();
  const plan = ensurePlan(state, input.bookId);
  const now = new Date().toISOString();
  const existing = input.id
    ? plan.beats.find((item) => item.id === input.id)
    : undefined;
  const beat: Beat = {
    id: existing?.id ?? input.id ?? createId(),
    bookId: input.bookId,
    name: input.name,
    description: input.description,
    role: input.role,
    orderIndex: input.orderIndex,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };

  plan.beats = upsertById(plan.beats, beat);
  touchBook(state, input.bookId, now);
  writeState(state);
  return beat;
}

export async function browserMoveBeatToChapter(
  input: MoveBeatToChapterInput
): Promise<void> {
  const state = readState();
  const plan = ensurePlan(state, input.bookId);
  const now = new Date().toISOString();
  const beat = plan.beats.find((item) => item.id === input.beatId);

  if (!beat) {
    throw new Error("Nie znaleziono beatu.");
  }

  if (
    input.chapterId &&
    !plan.chapters.some((chapter) => chapter.id === input.chapterId)
  ) {
    throw new Error("Nie znaleziono rozdziału.");
  }

  plan.beats = plan.beats.map((item) =>
    item.id === input.beatId
      ? { ...item, orderIndex: input.orderIndex, updatedAt: now }
      : item
  );
  plan.chapterBeats = [
    ...plan.chapterBeats.filter((item) => item.beatId !== input.beatId),
    ...(input.chapterId ? [{ chapterId: input.chapterId, beatId: input.beatId }] : [])
  ];
  touchBook(state, input.bookId, now);
  writeState(state);
}

export async function browserDeleteBeat(id: string): Promise<void> {
  const state = readState();
  for (const plan of Object.values(state.plans)) {
    plan.beats = plan.beats.filter((item) => item.id !== id);
    plan.chapterBeats = plan.chapterBeats.filter((item) => item.beatId !== id);
  }
  writeState(state);
}

export async function browserUpsertPlotThread(
  input: UpsertPlotThreadInput
): Promise<PlotThread> {
  const state = readState();
  const plan = ensurePlan(state, input.bookId);
  const now = new Date().toISOString();
  const existing = input.id
    ? plan.threads.find((item) => item.id === input.id)
    : undefined;
  const thread: PlotThread = {
    id: existing?.id ?? input.id ?? createId(),
    bookId: input.bookId,
    name: input.name,
    description: input.description,
    color: input.color,
    status: input.status,
    orderIndex: input.orderIndex,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };

  plan.threads = upsertById(plan.threads, thread);
  touchBook(state, input.bookId, now);
  writeState(state);
  return thread;
}

export async function browserDeletePlotThread(id: string): Promise<void> {
  const state = readState();
  for (const plan of Object.values(state.plans)) {
    plan.threads = plan.threads.filter((item) => item.id !== id);
    plan.chapterThreads = plan.chapterThreads.filter((item) => item.threadId !== id);
  }
  writeState(state);
}

export async function browserUpsertChapter(
  input: UpsertChapterInput
): Promise<Chapter> {
  const state = readState();
  const plan = ensurePlan(state, input.bookId);
  const now = new Date().toISOString();
  const existing = input.id
    ? plan.chapters.find((item) => item.id === input.id)
    : undefined;
  const chapter: Chapter = {
    id: existing?.id ?? input.id ?? createId(),
    bookId: input.bookId,
    actId: input.actId ?? null,
    number: input.number,
    workingTitle: input.workingTitle,
    summary: input.summary,
    purpose: input.purpose,
    conflict: input.conflict,
    turningPoint: input.turningPoint,
    targetWordCount: input.targetWordCount ?? null,
    orderIndex: input.orderIndex,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };

  plan.chapters = upsertById(plan.chapters, chapter);
  plan.chapterThreads = [
    ...plan.chapterThreads.filter((item) => item.chapterId !== chapter.id),
    ...uniqueIds(input.threadIds).map((threadId) => ({
      chapterId: chapter.id,
      threadId
    }))
  ];
  const beatIds = uniqueIds(input.beatIds);
  const beatIdSet = new Set(beatIds);
  plan.chapterBeats = [
    ...plan.chapterBeats.filter(
      (item) => item.chapterId !== chapter.id && !beatIdSet.has(item.beatId)
    ),
    ...beatIds.map((beatId) => ({
      chapterId: chapter.id,
      beatId
    }))
  ];
  touchBook(state, input.bookId, now);
  writeState(state);
  return chapter;
}

export async function browserDeleteChapter(id: string): Promise<void> {
  const state = readState();
  for (const plan of Object.values(state.plans)) {
    plan.chapters = plan.chapters.filter((item) => item.id !== id);
    plan.chapterThreads = plan.chapterThreads.filter((item) => item.chapterId !== id);
    plan.chapterBeats = plan.chapterBeats.filter((item) => item.chapterId !== id);
  }
  writeState(state);
}

export async function browserReorderPlanItems(
  input: ReorderPlanItemsInput
): Promise<void> {
  const state = readState();
  const ids = new Map(input.orderedIds.map((id, index) => [id, index]));
  for (const plan of Object.values(state.plans)) {
    if (input.itemType === "acts") {
      plan.acts = plan.acts.map((item) => reorderItem(item, ids));
    }
    if (input.itemType === "beats") {
      plan.beats = plan.beats.map((item) => reorderItem(item, ids));
    }
    if (input.itemType === "threads") {
      plan.threads = plan.threads.map((item) => reorderItem(item, ids));
    }
    if (input.itemType === "chapters") {
      plan.chapters = plan.chapters.map((item) => reorderItem(item, ids));
    }
  }
  writeState(state);
}

export async function browserListAiRuns(projectId: string): Promise<AiLogEntry[]> {
  return readState()
    .aiRuns.filter((run) => run.projectId === projectId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function browserUpdateBookConcept(
  bookId: string,
  input: BookConceptInput
): Promise<Book> {
  const state = readState();
  const details = state.projects.find(({ book }) => book.id === bookId);

  if (!details) {
    throw new Error("Book not found in browser preview storage.");
  }

  const now = new Date().toISOString();
  details.book = {
    ...details.book,
    ...definedOnly(input),
    updatedAt: now
  };
  details.project = {
    ...details.project,
    updatedAt: now
  };

  writeState(state);
  return details.book;
}

export async function browserCheckCodexCli(
  codexPath?: string
): Promise<CodexCliStatus> {
  return {
    available: false,
    path: codexPath || "codex",
    authLikelyReady: null,
    message:
      "Podgląd Vite działa bez backendu Tauri. Uruchom aplikację desktopową, aby sprawdzić Codex CLI."
  };
}

export async function browserListCodexModels(
  _codexPath?: string
): Promise<CodexModelCatalog> {
  return {
    fallback: true,
    models: [
      {
        slug: "gpt-5.5",
        displayName: "GPT-5.5",
        defaultReasoningLevel: "medium",
        supportedReasoningLevels: [
          { effort: "low", description: "Szybciej, mniej planowania" },
          { effort: "medium", description: "Dobry balans" },
          { effort: "high", description: "Glebsze rozumowanie" },
          { effort: "xhigh", description: "Najglebsze rozumowanie" }
        ]
      }
    ],
    errorMessage:
      "Podgląd Vite nie może odczytać katalogu modeli Codex CLI bez backendu Tauri."
  };
}

export async function browserRunCodexPrompt(
  request: RunCodexPromptRequest
): Promise<AiRunResult> {
  const now = new Date().toISOString();
  const id = createId();
  const errorMessage =
    "Podgląd Vite nie może uruchomić codex exec. Użyj aplikacji Tauri desktop.";

  appendAiRun({
    id,
    projectId: request.projectId,
    providerId: "codex-cli-bridge",
    model: request.model ?? "",
    reasoningEffort: request.reasoningEffort ?? "",
    action: request.action,
    promptPackageJson: request.promptPackageJson,
    prompt: request.prompt,
    rawOutput: null,
    status: "error",
    errorMessage,
    createdAt: now,
    completedAt: now
  });

  return {
    id,
    providerId: "codex-cli-bridge",
    promptPackageId: request.promptPackageId,
    action: request.action,
    status: "error",
    rawOutput: null,
    errorMessage,
    durationMs: 0
  };
}

export async function browserGenerateNewProjectTitle(
  request: GenerateNewProjectTitleRequest
): Promise<AiRunResult> {
  const seedTitle = extractSeedTitle(request.promptPackageJson);
  const value = seedTitle
    ? `Sekret ${seedTitle}`
    : "Sekret Trzeciego Dnia";

  return {
    id: createId(),
    providerId: "codex-cli-bridge",
    promptPackageId: request.promptPackageId,
    action: request.action,
    status: "success",
    rawOutput: JSON.stringify({
      version: 1,
      kind: "concept_field_suggestion",
      field: "workingTitle",
      summary: value,
      value,
      values: [],
      rationale: "Browser preview generated a deterministic title.",
      warnings: []
    }),
    durationMs: 0
  };
}

function extractSeedTitle(promptPackageJson: unknown): string {
  if (
    promptPackageJson &&
    typeof promptPackageJson === "object" &&
    "context" in promptPackageJson
  ) {
    const context = (promptPackageJson as { context?: { seedTitle?: unknown } })
      .context;
    if (typeof context?.seedTitle === "string") {
      return context.seedTitle.trim();
    }
  }

  return "";
}

export async function browserGenerateBookCover(
  input: GenerateBookCoverInput
): Promise<BookCoverResult> {
  const state = readState();
  const details = state.projects.find(
    ({ project, book }) => project.id === input.projectId && book.id === input.bookId
  );

  if (!details) {
    throw new Error("Book not found in browser preview storage.");
  }

  const now = new Date().toISOString();
  const aiRunId = createId();
  const imagePath = createCoverDataUrl(
    details.book.workingTitle || details.project.name,
    input.coverPrompt
  );

  const rawOutput = JSON.stringify({
    version: 1,
    kind: "book_cover_image",
    imagePath,
    warnings: ["Browser preview generated a local placeholder data URL."]
  });

  appendAiRun({
    id: aiRunId,
    projectId: input.projectId,
    providerId: "codex-cli-bridge",
    model: input.model ?? "",
    reasoningEffort: input.reasoningEffort ?? "",
    action: "generate_cover_image",
    promptPackageJson: input.promptPackageJson,
    prompt: input.prompt,
    rawOutput,
    status: "success",
    errorMessage: null,
    createdAt: now,
    completedAt: now
  });

  return {
    book: details.book,
    aiRun: {
      id: aiRunId,
      providerId: "codex-cli-bridge",
      promptPackageId: input.promptPackageId,
      action: "generate_cover_image",
      status: "success",
      rawOutput,
      durationMs: 0
    },
    imagePath,
    prompt: input.coverPrompt,
    negativePrompt: input.coverNegativePrompt,
    generatedAt: now
  };
}

export async function browserAcceptGeneratedBookCover(
  input: AcceptGeneratedBookCoverInput
): Promise<Book> {
  const state = readState();
  const details = state.projects.find(({ book }) => book.id === input.bookId);

  if (!details) {
    throw new Error("Book not found in browser preview storage.");
  }

  const now = new Date().toISOString();
  details.book = {
    ...details.book,
    coverImagePath: input.imagePath,
    coverPrompt: input.coverPrompt,
    coverNegativePrompt: input.coverNegativePrompt,
    coverGeneratedAt: input.generatedAt,
    updatedAt: now
  };
  details.project = {
    ...details.project,
    updatedAt: now
  };

  writeState(state);
  return details.book;
}

function readState(): BrowserPreviewState {
  if (typeof window === "undefined") {
    return memoryState;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { projects: [], aiRuns: [], plans: {} };
    }

    const parsed = JSON.parse(raw) as BrowserPreviewState;
    return Array.isArray(parsed.projects)
      ? {
          projects: parsed.projects,
          aiRuns: Array.isArray(parsed.aiRuns)
            ? parsed.aiRuns.map((run) => ({
                ...run,
                model: run.model ?? "",
                reasoningEffort: run.reasoningEffort ?? ""
              }))
            : [],
          plans: normalizePlans(parsed.plans)
        }
      : { projects: [], aiRuns: [], plans: {} };
  } catch {
    return memoryState;
  }
}

function writeState(state: BrowserPreviewState): void {
  memoryState = state;

  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    memoryState = state;
  }
}

function definedOnly(input: BookConceptInput): BookConceptInput {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined)
  ) as BookConceptInput;
}

function appendAiRun(entry: AiLogEntry): void {
  const state = readState();
  state.aiRuns.unshift(entry);
  writeState(state);
}

function ensurePlan(state: BrowserPreviewState, bookId: string): BookPlan {
  const plan = normalizePlan(state.plans[bookId]);
  state.plans[bookId] = plan;
  return plan;
}

function normalizePlans(plans: BrowserPreviewState["plans"] | undefined): Record<string, BookPlan> {
  if (!plans || typeof plans !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(plans).map(([bookId, plan]) => [bookId, normalizePlan(plan)])
  );
}

function normalizePlan(plan: Partial<BookPlan> | undefined): BookPlan {
  return {
    structure: plan?.structure ?? null,
    acts: Array.isArray(plan?.acts) ? plan.acts : [],
    beats: Array.isArray(plan?.beats) ? plan.beats : [],
    threads: Array.isArray(plan?.threads) ? plan.threads : [],
    chapters: Array.isArray(plan?.chapters) ? plan.chapters : [],
    chapterThreads: Array.isArray(plan?.chapterThreads) ? plan.chapterThreads : [],
    chapterBeats: Array.isArray(plan?.chapterBeats) ? plan.chapterBeats : []
  };
}

function upsertById<Item extends { id: string }>(items: Item[], nextItem: Item): Item[] {
  const index = items.findIndex((item) => item.id === nextItem.id);
  if (index === -1) {
    return [...items, nextItem];
  }

  return items.map((item) => (item.id === nextItem.id ? nextItem : item));
}

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
}

function reorderItem<Item extends { id: string; orderIndex: number }>(
  item: Item,
  orderedIds: Map<string, number>
): Item {
  const orderIndex = orderedIds.get(item.id);
  return orderIndex === undefined ? item : { ...item, orderIndex };
}

function touchBook(
  state: BrowserPreviewState,
  bookId: string,
  updatedAt: string
): void {
  const details = state.projects.find(({ book }) => book.id === bookId);
  if (!details) {
    return;
  }

  details.book = { ...details.book, updatedAt };
  details.project = { ...details.project, updatedAt };
}

function normalizeDetails(details: ProjectDetails): ProjectDetails {
  return {
    project: details.project,
    book: {
      ...details.book,
      protagonistSummary: details.book.protagonistSummary ?? "",
      protagonistGoal: details.book.protagonistGoal ?? "",
      expandedPremise: details.book.expandedPremise ?? "",
      centralConflict: details.book.centralConflict ?? "",
      antagonistForce: details.book.antagonistForce ?? "",
      stakes: details.book.stakes ?? "",
      settingSketch: details.book.settingSketch ?? "",
      endingDirection: details.book.endingDirection ?? "",
      themesJson: details.book.themesJson ?? "[]",
      unwantedThemes: details.book.unwantedThemes ?? "",
      alternativeTitlesJson: details.book.alternativeTitlesJson ?? "[]",
      coverImagePath: details.book.coverImagePath ?? "",
      coverPrompt: details.book.coverPrompt ?? "",
      coverNegativePrompt: details.book.coverNegativePrompt ?? "",
      coverGeneratedAt: details.book.coverGeneratedAt ?? null
    }
  };
}

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function createCoverDataUrl(title: string, prompt: string): string {
  const safeTitle = escapeSvg(title || "Untitled");
  const safePrompt = escapeSvg(prompt.slice(0, 120));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200" viewBox="0 0 800 1200"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#263c35"/><stop offset="0.55" stop-color="#a86f25"/><stop offset="1" stop-color="#f5f1e8"/></linearGradient></defs><rect width="800" height="1200" fill="url(#g)"/><rect x="54" y="54" width="692" height="1092" fill="none" stroke="#fffdf8" stroke-width="6" opacity=".75"/><circle cx="400" cy="420" r="170" fill="#fffdf8" opacity=".22"/><text x="400" y="850" text-anchor="middle" font-family="Georgia, serif" font-size="58" fill="#fffdf8" font-weight="700">${safeTitle}</text><text x="400" y="930" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="24" fill="#fffdf8" opacity=".78">${safePrompt}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function escapeSvg(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
