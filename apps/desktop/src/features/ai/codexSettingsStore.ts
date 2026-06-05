import { create } from "zustand";

type CodexSettingsState = {
  codexPath: string;
  timeoutSeconds: number;
  setCodexPath: (path: string) => void;
  setTimeoutSeconds: (seconds: number) => void;
};

export const useCodexSettingsStore = create<CodexSettingsState>((set) => ({
  codexPath: "codex",
  timeoutSeconds: 180,
  setCodexPath: (codexPath) => set({ codexPath }),
  setTimeoutSeconds: (timeoutSeconds) => set({ timeoutSeconds })
}));
