import type { AiSettings } from "../../shared/api/types";
import { CLAUDE_CLI_MODEL_MAP } from "./pricing";

// Jedno źródło prawdy dla rozmiaru okna kontekstu i estymacji tokenów.
// Analogicznie do pricing.ts: mapy per dostawca + switch, bo żaden provider
// nie zwraca okna kontekstu programowo (katalog Codeksa też nie — patrz
// CodexModelCatalog w shared/api/types.ts).

const OPENAI_CONTEXT_WINDOWS: Record<string, number> = {
  "gpt-5.5": 400_000,
  "gpt-5": 400_000,
  "gpt-4.1": 1_000_000
};

const ANTHROPIC_CONTEXT_WINDOWS: Record<string, number> = {
  "claude-opus-5": 200_000,
  "claude-opus-4-8": 200_000,
  // Wariant 1M kontekstu (patrz etykieta w textProviderInfo.CLAUDE_MODELS).
  "claude-opus-4-7": 1_000_000,
  "claude-sonnet-5": 200_000,
  "claude-sonnet-4-6": 200_000,
  "claude-haiku-4-5": 200_000,
  "claude-fable-5": 200_000
};

/** Okno przyjmowane, gdy modelu nie ma w katalogu — celowo ostrożne. */
const FALLBACK_CONTEXT_TOKENS = 128_000;

/** Zapas na odpowiedź modelu; kontekst wejściowy nigdy go nie zjada. */
export const DEFAULT_OUTPUT_RESERVE_TOKENS = 16_000;

/**
 * Domyślny udział okna oddawany historii brainstormu. Rozmowa leci w całości
 * przy KAŻDEJ turze, więc pełne okno oznaczałoby wielokrotnie wyższy rachunek
 * niż autor się spodziewa. Kto chce więcej — podnosi override w ustawieniach.
 */
export const DEFAULT_CONTEXT_SHARE = 0.25;

export type ContextWindowInfo = {
  totalTokens: number;
  source: "catalog" | "fallback";
};

export type ContextBudget = {
  /** Pełne okno modelu. */
  windowTokens: number;
  /** Ile wolno zająć wejściem (po odjęciu rezerwy i udziale/override). */
  budgetTokens: number;
  source: "override" | "catalog" | "fallback";
};

/**
 * Modele Codeksa bywają wariantami bazowego modelu ("gpt-5.5-codex"), a okno
 * kontekstu dziedziczą po rodzinie — inaczej niż cennik, którego nie zgadujemy.
 */
function openAiWindow(model: string): number | undefined {
  return OPENAI_CONTEXT_WINDOWS[model] ?? OPENAI_CONTEXT_WINDOWS[model.replace(/-codex$/, "")];
}

export function contextWindowFor(
  providerId: string,
  model: string | null | undefined
): ContextWindowInfo {
  const key = (model ?? "").trim();
  let window: number | undefined;
  switch (providerId) {
    case "anthropic-api":
      window = ANTHROPIC_CONTEXT_WINDOWS[key];
      break;
    case "claude-cli":
      window = ANTHROPIC_CONTEXT_WINDOWS[CLAUDE_CLI_MODEL_MAP[key] ?? key];
      break;
    case "openai-api":
    case "codex-cli":
      window = openAiWindow(key);
      break;
    default:
      window = undefined;
  }
  return window
    ? { totalTokens: window, source: "catalog" }
    : { totalTokens: FALLBACK_CONTEXT_TOKENS, source: "fallback" };
}

/**
 * Lustro backendowego estymatora (src-tauri/src/providers.rs, `estimate_from_text`):
 * ceil(chars / 4) liczone po punktach kodowych, nie po jednostkach UTF-16 — Rust
 * używa `chars().count()`, więc emoji i znaki spoza BMP muszą liczyć się tak samo.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(([...text].length + 3) / 4);
}

/**
 * Efektywny budżet wejścia dla bieżącego dostawcy i modelu.
 * `contextWindowOverride = 0` w ustawieniach oznacza tryb automatyczny.
 */
export function resolveContextBudget(
  settings: AiSettings | undefined,
  providerId: string,
  model: string | null | undefined
): ContextBudget {
  const { totalTokens, source } = contextWindowFor(providerId, model);
  const usable = Math.max(1_000, totalTokens - DEFAULT_OUTPUT_RESERVE_TOKENS);
  const override = settings?.contextWindowOverride ?? 0;
  if (override > 0) {
    return {
      windowTokens: totalTokens,
      budgetTokens: Math.min(override, usable),
      source: "override"
    };
  }
  return {
    windowTokens: totalTokens,
    budgetTokens: Math.min(Math.round(totalTokens * DEFAULT_CONTEXT_SHARE), usable),
    source
  };
}

/** Domyślny budżet pokazywany w ustawieniach jako podpowiedź przy trybie auto. */
export function automaticBudgetTokens(
  providerId: string,
  model: string | null | undefined
): number {
  return resolveContextBudget(undefined, providerId, model).budgetTokens;
}
