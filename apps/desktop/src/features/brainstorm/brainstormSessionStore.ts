import { create } from "zustand";

// Most między BrainstormPage (lokalny stan wyboru sesji) a globalnym
// AiProposalPanel w prawym sidebarze, który renderuje sugestie tej sesji.
// Ustawiane przy wejściu na widok, czyszczone przy wyjściu (null).
type BrainstormSessionState = {
  activeSessionId: string | null;
  setActiveSessionId: (id: string | null) => void;
  /**
   * Trwa tura AI, która może nadpisać suggestions_json wcześniejszych
   * wiadomości (rewizje sugestii). Panel blokuje na ten czas swoje akcje —
   * obie ścieżki zapisują CAŁĄ tablicę sugestii jednej wiadomości, więc
   * równoległy zapis skasowałby jedną ze zmian.
   */
  isTurnInFlight: boolean;
  setTurnInFlight: (inFlight: boolean) => void;
};

export const useBrainstormSessionStore = create<BrainstormSessionState>((set) => ({
  activeSessionId: null,
  setActiveSessionId: (activeSessionId) => set({ activeSessionId }),
  isTurnInFlight: false,
  setTurnInFlight: (isTurnInFlight) => set({ isTurnInFlight })
}));
