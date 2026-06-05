import type {
  AiRunResult,
  Book,
  BookConceptInput,
  CodexCliStatus,
  CreateProjectInput,
  Project,
  ProjectDetails,
  ProjectSummary,
  RunCodexPromptRequest
} from "./types";

const STORAGE_KEY = "storyforge2.browserPreview.projects";

type BrowserPreviewState = {
  projects: ProjectDetails[];
};

let memoryState: BrowserPreviewState = {
  projects: []
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
    logline: "",
    genre: "",
    subgenre: "",
    targetAudience: "",
    tone: "",
    styleGuide: "",
    pointOfView: "",
    targetWordCount: null,
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
      workingTitle: book.workingTitle
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

  return details;
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
      "Podglad Vite dziala bez backendu Tauri. Uruchom aplikacje desktopowa, aby sprawdzic Codex CLI."
  };
}

export async function browserRunCodexPrompt(
  request: RunCodexPromptRequest
): Promise<AiRunResult> {
  return {
    id: createId(),
    providerId: "codex-cli-bridge",
    promptPackageId: request.promptPackageId,
    action: request.action,
    status: "error",
    rawOutput: null,
    errorMessage:
      "Podglad Vite nie moze uruchomic codex exec. Uzyj aplikacji Tauri desktop.",
    durationMs: 0
  };
}

function readState(): BrowserPreviewState {
  if (typeof window === "undefined") {
    return memoryState;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { projects: [] };
    }

    const parsed = JSON.parse(raw) as BrowserPreviewState;
    return Array.isArray(parsed.projects) ? parsed : { projects: [] };
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

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
