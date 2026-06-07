import { invoke } from "@tauri-apps/api/core";
import {
  browserAcceptGeneratedBookCover,
  browserCheckCodexCli,
  browserListCodexModels,
  browserListAiRuns,
  browserCreateProject,
  browserGetProject,
  browserListProjects,
  browserRunCodexPrompt,
  browserUpdateBookConcept,
  browserGenerateBookCover,
  browserGenerateNewProjectTitle,
  isTauriRuntime
} from "./browserDevCommands";
import type {
  AcceptGeneratedBookCoverInput,
  AiRunResult,
  AiLogEntry,
  Book,
  BookCoverResult,
  BookConceptInput,
  CodexCliStatus,
  CodexModelCatalog,
  CreateProjectInput,
  GenerateBookCoverInput,
  GenerateNewProjectTitleRequest,
  ProjectDetails,
  ProjectSummary,
  RunCodexPromptRequest
} from "./types";

export function createProject(input: CreateProjectInput): Promise<ProjectDetails> {
  if (!isTauriRuntime()) {
    return browserCreateProject(input);
  }

  return invoke("create_project", { input });
}

export function listProjects(): Promise<ProjectSummary[]> {
  if (!isTauriRuntime()) {
    return browserListProjects();
  }

  return invoke("list_projects");
}

export function getProject(projectId: string): Promise<ProjectDetails> {
  if (!isTauriRuntime()) {
    return browserGetProject(projectId);
  }

  return invoke("get_project", { projectId });
}

export function listAiRuns(projectId: string): Promise<AiLogEntry[]> {
  if (!isTauriRuntime()) {
    return browserListAiRuns(projectId);
  }

  return invoke("list_ai_runs", { projectId });
}

export function updateBookConcept(
  bookId: string,
  input: BookConceptInput
): Promise<Book> {
  if (!isTauriRuntime()) {
    return browserUpdateBookConcept(bookId, input);
  }

  return invoke("update_book_concept", { bookId, input });
}

export function checkCodexCli(codexPath?: string): Promise<CodexCliStatus> {
  if (!isTauriRuntime()) {
    return browserCheckCodexCli(codexPath);
  }

  return invoke("check_codex_cli", { codexPath: codexPath || undefined });
}

export function listCodexModels(codexPath?: string): Promise<CodexModelCatalog> {
  if (!isTauriRuntime()) {
    return browserListCodexModels(codexPath);
  }

  return invoke("list_codex_models", { codexPath: codexPath || undefined });
}

export function runCodexPrompt(
  request: RunCodexPromptRequest
): Promise<AiRunResult> {
  if (!isTauriRuntime()) {
    return browserRunCodexPrompt(request);
  }

  return invoke("run_codex_prompt", { request });
}

export function generateNewProjectTitle(
  request: GenerateNewProjectTitleRequest
): Promise<AiRunResult> {
  if (!isTauriRuntime()) {
    return browserGenerateNewProjectTitle(request);
  }

  return invoke("generate_new_project_title", { request });
}

export function generateBookCover(
  input: GenerateBookCoverInput
): Promise<BookCoverResult> {
  if (!isTauriRuntime()) {
    return browserGenerateBookCover(input);
  }

  return invoke("generate_book_cover", { input });
}

export function acceptGeneratedBookCover(
  input: AcceptGeneratedBookCoverInput
): Promise<Book> {
  if (!isTauriRuntime()) {
    return browserAcceptGeneratedBookCover(input);
  }

  return invoke("accept_generated_book_cover", { input });
}
