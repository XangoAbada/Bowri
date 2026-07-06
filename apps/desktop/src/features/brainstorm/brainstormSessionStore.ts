import { create } from "zustand";

// Most między BrainstormPage (lokalny stan wyboru sesji) a globalnym
// AiProposalPanel w prawym sidebarze, który renderuje sugestie tej sesji.
// Ustawiane przy wejściu na widok, czyszczone przy wyjściu (null).
type BrainstormSessionState = {
  activeSessionId: string | null;
  setActiveSessionId: (id: string | null) => void;
};

export const useBrainstormSessionStore = create<BrainstormSessionState>((set) => ({
  activeSessionId: null,
  setActiveSessionId: (activeSessionId) => set({ activeSessionId })
}));
