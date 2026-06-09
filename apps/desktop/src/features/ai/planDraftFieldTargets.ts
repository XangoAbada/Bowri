import type { PlanFieldKey } from "./planPromptPackage";

type DraftFieldHandler = (field: PlanFieldKey, value: string) => void;

const draftFieldTargets = new Map<string, DraftFieldHandler>();

export function registerPlanDraftFieldTarget(
  targetId: string,
  handler: DraftFieldHandler
) {
  draftFieldTargets.set(targetId, handler);
}

export function unregisterPlanDraftFieldTarget(targetId: string) {
  draftFieldTargets.delete(targetId);
}

export function applyPlanDraftField(
  targetId: string,
  field: PlanFieldKey,
  value: string
): boolean {
  const handler = draftFieldTargets.get(targetId);
  if (!handler) {
    return false;
  }

  handler(field, value);
  return true;
}
