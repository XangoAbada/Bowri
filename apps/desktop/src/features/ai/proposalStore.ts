import { create } from "zustand";
import type { AIAction } from "../../shared/api/types";
import type { NormalizedConceptFieldSuggestion } from "./conceptFieldSuggestion";
import type { ConceptFieldKey, PromptPackage } from "./promptPackage";

export type AiProposalStatus = "running" | "success" | "error";

export type AiPromptSnapshot = {
  projectId: string;
  bookId: string;
  field: ConceptFieldKey;
  action: AIAction;
  promptPackageId: string;
  promptPackageJson: PromptPackage;
  prompt: string;
};

export type ActiveAiProposal = AiPromptSnapshot & {
  status: AiProposalStatus;
  aiRunId?: string;
  rawOutput: string;
  parsed?: NormalizedConceptFieldSuggestion;
  editableValue: string;
  errorMessage: string;
  durationMs?: number;
  updatedAt: string;
};

type ProposalState = {
  activeProposal: ActiveAiProposal | null;
  startProposal: (snapshot: AiPromptSnapshot) => void;
  finishProposal: (
    result: Pick<
      ActiveAiProposal,
      "aiRunId" | "rawOutput" | "parsed" | "editableValue" | "durationMs"
    >
  ) => void;
  failProposal: (errorMessage: string, rawOutput?: string) => void;
  setEditableValue: (value: string) => void;
  clearProposal: () => void;
};

export const useProposalStore = create<ProposalState>((set) => ({
  activeProposal: null,
  startProposal: (snapshot) =>
    set({
      activeProposal: {
        ...snapshot,
        status: "running",
        rawOutput: "",
        editableValue: "",
        errorMessage: "",
        updatedAt: new Date().toISOString()
      }
    }),
  finishProposal: (result) =>
    set((state) =>
      state.activeProposal
        ? {
            activeProposal: {
              ...state.activeProposal,
              ...result,
              status: "success",
              errorMessage: "",
              updatedAt: new Date().toISOString()
            }
          }
        : state
    ),
  failProposal: (errorMessage, rawOutput = "") =>
    set((state) =>
      state.activeProposal
        ? {
            activeProposal: {
              ...state.activeProposal,
              status: "error",
              rawOutput,
              errorMessage,
              updatedAt: new Date().toISOString()
            }
          }
        : state
    ),
  setEditableValue: (editableValue) =>
    set((state) =>
      state.activeProposal
        ? {
            activeProposal: {
              ...state.activeProposal,
              editableValue
            }
          }
        : state
    ),
  clearProposal: () => set({ activeProposal: null })
}));
