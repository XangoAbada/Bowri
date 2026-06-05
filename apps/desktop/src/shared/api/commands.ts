import { invoke } from "@tauri-apps/api/core";
import {
  browserCheckCodexCli,
  browserCreateProject,
  browserGetProject,
  browserListProjects,
  browserRunCodexPrompt,
  browserUpdateBookConcept,
  isTauriRuntime
} from "./browserDevCommands";
import type {
  AiRunResult,
  Book,
  BookConceptInput,
  CodexCliStatus,
  CreateProjectInput,
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

export function runCodexPrompt(
  request: RunCodexPromptRequest
): Promise<AiRunResult> {
  if (!isTauriRuntime()) {
    return browserRunCodexPrompt(request);
  }

  return invoke("run_codex_prompt", { request });
}
