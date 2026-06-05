import { create } from "zustand";
import type { TitleSuggestionsResponse } from "./titleSuggestions";

export type TitleProposal = {
  projectId: string;
  bookId: string;
  aiRunId: string;
  promptPackageId: string;
  rawOutput: string;
  parsed: TitleSuggestionsResponse;
  selectedTitle: string;
};

type ProposalState = {
  titleProposal: TitleProposal | null;
  setTitleProposal: (proposal: TitleProposal) => void;
  selectTitle: (title: string) => void;
  clearTitleProposal: () => void;
};

export const useProposalStore = create<ProposalState>((set) => ({
  titleProposal: null,
  setTitleProposal: (proposal) => set({ titleProposal: proposal }),
  selectTitle: (selectedTitle) =>
    set((state) =>
      state.titleProposal
        ? { titleProposal: { ...state.titleProposal, selectedTitle } }
        : state
    ),
  clearTitleProposal: () => set({ titleProposal: null })
}));
