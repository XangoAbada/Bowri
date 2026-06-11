import type { CharacterFieldKey } from "./characterPromptPackage";

type CharacterDraftFieldApplier = (field: CharacterFieldKey, value: string) => boolean;

const draftTargets = new Map<string, CharacterDraftFieldApplier>();

export function registerCharacterDraftFieldTarget(
  targetId: string,
  applier: CharacterDraftFieldApplier
): void {
  draftTargets.set(targetId, applier);
}

export function unregisterCharacterDraftFieldTarget(targetId: string): void {
  draftTargets.delete(targetId);
}

export function applyCharacterDraftField(
  targetId: string,
  field: CharacterFieldKey,
  value: string
): boolean {
  return draftTargets.get(targetId)?.(field, value) ?? false;
}
