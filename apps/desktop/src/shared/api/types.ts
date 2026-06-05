export type Project = {
  id: string;
  name: string;
  language: string;
  createdAt: string;
  updatedAt: string;
  activeBookId: string | null;
  settingsJson: string;
};

export type Book = {
  id: string;
  projectId: string;
  title: string;
  workingTitle: string;
  premise: string;
  logline: string;
  genre: string;
  subgenre: string;
  targetAudience: string;
  tone: string;
  styleGuide: string;
  pointOfView: string;
  targetWordCount: number | null;
  coverImagePath: string;
  coverPrompt: string;
  coverNegativePrompt: string;
  coverGeneratedAt: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type ProjectSummary = {
  id: string;
  name: string;
  language: string;
  updatedAt: string;
  activeBookId: string | null;
  workingTitle: string;
  coverImagePath: string;
};

export type ProjectDetails = {
  project: Project;
  book: Book;
};

export type CreateProjectInput = {
  name: string;
  language?: string;
};

export type BookConceptInput = {
  title?: string;
  workingTitle?: string;
  premise?: string;
  logline?: string;
  genre?: string;
  subgenre?: string;
  targetAudience?: string;
  tone?: string;
  styleGuide?: string;
  pointOfView?: string;
  targetWordCount?: number | null;
};

export type AIAction =
  | "generate_working_title"
  | "generate_premise"
  | "suggest_genre"
  | "suggest_target_audience"
  | "suggest_tone"
  | "generate_style_guide"
  | "generate_cover_image";

export type ReasoningEffort = "low" | "medium" | "high" | "xhigh";

export type CodexCliStatus = {
  available: boolean;
  path?: string;
  version?: string;
  authLikelyReady?: boolean | null;
  message?: string;
};

export type CodexModelReasoningLevel = {
  effort: ReasoningEffort | string;
  description?: string;
};

export type CodexModel = {
  slug: string;
  displayName: string;
  description?: string;
  defaultReasoningLevel?: ReasoningEffort | string;
  supportedReasoningLevels?: CodexModelReasoningLevel[];
};

export type CodexModelCatalog = {
  models: CodexModel[];
  fallback: boolean;
  errorMessage?: string | null;
};

export type RunCodexPromptRequest = {
  projectId: string;
  action: AIAction;
  promptPackageId: string;
  promptPackageJson: unknown;
  prompt: string;
  codexPath?: string;
  timeoutSeconds?: number;
  model?: string;
  reasoningEffort?: ReasoningEffort;
};

export type GenerateNewProjectTitleRequest = {
  action: Extract<AIAction, "generate_working_title">;
  promptPackageId: string;
  promptPackageJson: unknown;
  prompt: string;
  codexPath?: string;
  timeoutSeconds?: number;
  model?: string;
  reasoningEffort?: ReasoningEffort;
};

export type AiRunResult = {
  id: string;
  providerId: string;
  promptPackageId: string;
  action: string;
  status: "success" | "error" | "cancelled" | "timeout" | string;
  rawOutput?: string | null;
  stderr?: string | null;
  errorMessage?: string | null;
  durationMs: number;
};

export type GenerateBookCoverInput = {
  projectId: string;
  bookId: string;
  promptPackageId: string;
  promptPackageJson: unknown;
  prompt: string;
  coverPrompt: string;
  coverNegativePrompt: string;
  codexPath?: string;
  timeoutSeconds?: number;
  model?: string;
  reasoningEffort?: ReasoningEffort;
};

export type BookCoverResult = {
  book: Book;
  aiRun: AiRunResult;
  imagePath: string;
  prompt: string;
  negativePrompt: string;
  generatedAt: string;
};

export type CoverGenerationProgressEvent = {
  projectId: string;
  bookId: string;
  aiRunId: string;
  phase: "queued" | "request" | "streaming" | "partial" | "final" | "saved" | "error" | string;
  message: string;
  partialImageDataUrl?: string | null;
  progress?: number | null;
};
