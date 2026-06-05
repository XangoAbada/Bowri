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
  | "generate_style_guide";

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

export type AiRunResult = {
  id: string;
  providerId: "codex-cli-bridge";
  promptPackageId: string;
  action: string;
  status: "success" | "error" | "cancelled" | "timeout" | string;
  rawOutput?: string | null;
  stderr?: string | null;
  errorMessage?: string | null;
  durationMs: number;
};
