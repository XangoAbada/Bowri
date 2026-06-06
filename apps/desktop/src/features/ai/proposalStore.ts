import { create } from "zustand";
import type { AIAction } from "../../shared/api/types";
import type { NormalizedConceptFieldSuggestion } from "./conceptFieldSuggestion";
import type { NormalizedPremiseDevelopment } from "./premiseDevelopment";
import type {
  ConceptFieldKey,
  NewProjectTitlePromptPackage,
  PromptPackage
} from "./promptPackage";

export type AiProposalStatus = "running" | "success" | "error";
export type AiProposalScope = "bookConcept" | "newProject";
export const NEW_PROJECT_PROPOSAL_ID = "__new_project__";
export type ParsedAiProposal =
  | NormalizedConceptFieldSuggestion
  | NormalizedPremiseDevelopment;

export type AiPromptSnapshot = {
  scope?: AiProposalScope;
  projectId: string;
  bookId: string;
  field: ConceptFieldKey;
  action: AIAction;
  promptPackageId: string;
  promptPackageJson: PromptPackage | NewProjectTitlePromptPackage;
  prompt: string;
};

export type ActiveAiProposal = AiPromptSnapshot & {
  status: AiProposalStatus;
  aiRunId?: string;
  rawOutput: string;
  parsed?: ParsedAiProposal;
  editableValue: string;
  editableFields: Partial<Record<ConceptFieldKey, string>>;
  selectedFields: Partial<Record<ConceptFieldKey, boolean>>;
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
    > &
      Partial<Pick<ActiveAiProposal, "editableFields" | "selectedFields">>
  ) => void;
  failProposal: (errorMessage: string, rawOutput?: string) => void;
  setEditableValue: (value: string) => void;
  setEditableField: (field: ConceptFieldKey, value: string) => void;
  toggleSelectedField: (field: ConceptFieldKey) => void;
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
        editableFields: {},
        selectedFields: {},
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
  setEditableField: (field, value) =>
    set((state) =>
      state.activeProposal
        ? {
            activeProposal: {
              ...state.activeProposal,
              editableFields: {
                ...state.activeProposal.editableFields,
                [field]: value
              }
            }
          }
        : state
    ),
  toggleSelectedField: (field) =>
    set((state) =>
      state.activeProposal
        ? {
            activeProposal: {
              ...state.activeProposal,
              selectedFields: {
                ...state.activeProposal.selectedFields,
                [field]: !state.activeProposal.selectedFields[field]
              }
            }
          }
        : state
    ),
  clearProposal: () => set({ activeProposal: null })
}));
