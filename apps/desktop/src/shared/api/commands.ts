import { invoke } from "@tauri-apps/api/core";
import {
  browserAcceptGeneratedBookCover,
  browserCheckCodexCli,
  browserListCodexModels,
  browserListAiRuns,
  browserCreateProject,
  browserDeleteAct,
  browserDeleteBeat,
  browserDeleteChapter,
  browserDeletePlotThread,
  browserGetBookPlan,
  browserGetProject,
  browserListProjects,
  browserMoveBeatToChapter,
  browserReorderPlanItems,
  browserRunCodexPrompt,
  browserSaveStoryStructure,
  browserUpsertChapterThreadRelation,
  browserUpsertAct,
  browserUpsertBeat,
  browserUpsertChapter,
  browserUpsertPlotThread,
  browserUpdateBookConcept,
  browserGenerateBookCover,
  browserGenerateNewProjectTitle,
  isTauriRuntime
} from "./browserDevCommands";
import type {
  AcceptGeneratedBookCoverInput,
  AiRunResult,
  AiLogEntry,
  Act,
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
  ProjectDetails,
  ProjectSummary,
  ReorderPlanItemsInput,
  RunCodexPromptRequest,
  SaveStoryStructureInput,
  StoryStructure,
  UpsertActInput,
  UpsertBeatInput,
  UpsertChapterInput,
  UpsertChapterThreadInput,
  UpsertPlotThreadInput
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

export function getBookPlan(bookId: string): Promise<BookPlan> {
  if (!isTauriRuntime()) {
    return browserGetBookPlan(bookId);
  }

  return invoke("get_book_plan", { bookId });
}

export function saveStoryStructure(
  input: SaveStoryStructureInput
): Promise<StoryStructure> {
  if (!isTauriRuntime()) {
    return browserSaveStoryStructure(input);
  }

  return invoke("save_story_structure", { input });
}

export function upsertAct(input: UpsertActInput): Promise<Act> {
  if (!isTauriRuntime()) {
    return browserUpsertAct(input);
  }

  return invoke("upsert_act", { input });
}

export function deleteAct(id: string): Promise<void> {
  if (!isTauriRuntime()) {
    return browserDeleteAct(id);
  }

  return invoke("delete_act", { id });
}

export function upsertBeat(input: UpsertBeatInput): Promise<Beat> {
  if (!isTauriRuntime()) {
    return browserUpsertBeat(input);
  }

  return invoke("upsert_beat", { input });
}

export function deleteBeat(id: string): Promise<void> {
  if (!isTauriRuntime()) {
    return browserDeleteBeat(id);
  }

  return invoke("delete_beat", { id });
}

export function moveBeatToChapter(input: MoveBeatToChapterInput): Promise<void> {
  if (!isTauriRuntime()) {
    return browserMoveBeatToChapter(input);
  }

  return invoke("move_beat_to_chapter", { input });
}

export function upsertPlotThread(
  input: UpsertPlotThreadInput
): Promise<PlotThread> {
  if (!isTauriRuntime()) {
    return browserUpsertPlotThread(input);
  }

  return invoke("upsert_plot_thread", { input });
}

export function deletePlotThread(id: string): Promise<void> {
  if (!isTauriRuntime()) {
    return browserDeletePlotThread(id);
  }

  return invoke("delete_plot_thread", { id });
}

export function upsertChapter(input: UpsertChapterInput): Promise<Chapter> {
  if (!isTauriRuntime()) {
    return browserUpsertChapter(input);
  }

  return invoke("upsert_chapter", { input });
}

export function upsertChapterThreadRelation(
  input: UpsertChapterThreadInput
): Promise<void> {
  if (!isTauriRuntime()) {
    return browserUpsertChapterThreadRelation(input);
  }

  return invoke("upsert_chapter_thread_relation", { input });
}

export function deleteChapter(id: string): Promise<void> {
  if (!isTauriRuntime()) {
    return browserDeleteChapter(id);
  }

  return invoke("delete_chapter", { id });
}

export function reorderPlanItems(input: ReorderPlanItemsInput): Promise<void> {
  if (!isTauriRuntime()) {
    return browserReorderPlanItems(input);
  }

  return invoke("reorder_plan_items", { input });
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
