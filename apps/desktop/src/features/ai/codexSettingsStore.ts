import { create } from "zustand";
import type { ReasoningEffort } from "../../shared/api/types";

const DEFAULT_CODEX_PATH = "codex";
const DEFAULT_MODEL = "gpt-5.5";
const DEFAULT_REASONING: ReasoningEffort = "medium";
const DEFAULT_TIMEOUT_SECONDS = 180;
const DEFAULT_CONTEXT_PANEL_WIDTH = 340;

const STORAGE_KEYS = {
  codexPath: "storyforge2.codex.path",
  model: "storyforge2.codex.model",
  reasoningEffort: "storyforge2.codex.reasoningEffort",
  timeoutSeconds: "storyforge2.codex.timeoutSeconds",
  contextPanelWidth: "storyforge2.layout.contextPanelWidth",
  contextPanelOpen: "storyforge2.layout.contextPanelOpen"
};

type CodexSettingsState = {
  codexPath: string;
  model: string;
  reasoningEffort: ReasoningEffort;
  timeoutSeconds: number;
  contextPanelWidth: number;
  contextPanelOpen: boolean;
  setCodexPath: (path: string) => void;
  setModel: (model: string) => void;
  setReasoningEffort: (effort: ReasoningEffort) => void;
  setTimeoutSeconds: (seconds: number) => void;
  setContextPanelWidth: (width: number) => void;
  setContextPanelOpen: (open: boolean) => void;
};

export const useCodexSettingsStore = create<CodexSettingsState>((set) => ({
  codexPath: readString(STORAGE_KEYS.codexPath, DEFAULT_CODEX_PATH),
  model: readString(STORAGE_KEYS.model, DEFAULT_MODEL),
  reasoningEffort: readReasoningEffort(
    STORAGE_KEYS.reasoningEffort,
    DEFAULT_REASONING
  ),
  timeoutSeconds: readNumber(
    STORAGE_KEYS.timeoutSeconds,
    DEFAULT_TIMEOUT_SECONDS
  ),
  contextPanelWidth: readNumber(
    STORAGE_KEYS.contextPanelWidth,
    DEFAULT_CONTEXT_PANEL_WIDTH
  ),
  contextPanelOpen: readString(STORAGE_KEYS.contextPanelOpen, "true") !== "false",
  setCodexPath: (codexPath) => {
    writeString(STORAGE_KEYS.codexPath, codexPath);
    set({ codexPath });
  },
  setModel: (model) => {
    writeString(STORAGE_KEYS.model, model);
    set({ model });
  },
  setReasoningEffort: (reasoningEffort) => {
    writeString(STORAGE_KEYS.reasoningEffort, reasoningEffort);
    set({ reasoningEffort });
  },
  setTimeoutSeconds: (timeoutSeconds) => {
    writeString(STORAGE_KEYS.timeoutSeconds, String(timeoutSeconds));
    set({ timeoutSeconds });
  },
  setContextPanelWidth: (contextPanelWidth) => {
    writeString(STORAGE_KEYS.contextPanelWidth, String(contextPanelWidth));
    set({ contextPanelWidth });
  },
  setContextPanelOpen: (contextPanelOpen) => {
    writeString(STORAGE_KEYS.contextPanelOpen, String(contextPanelOpen));
    set({ contextPanelOpen });
  }
}));

function readString(key: string, fallback: string): string {
  if (typeof window === "undefined") {
    return fallback;
  }

  return window.localStorage.getItem(key) || fallback;
}

function readNumber(key: string, fallback: number): number {
  const parsed = Number(readString(key, String(fallback)));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readReasoningEffort(
  key: string,
  fallback: ReasoningEffort
): ReasoningEffort {
  const value = readString(key, fallback);
  return isReasoningEffort(value) ? value : fallback;
}

function writeString(key: string, value: string): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, value);
}

function isReasoningEffort(value: string): value is ReasoningEffort {
  return ["low", "medium", "high", "xhigh"].includes(value);
}
