import type { Character, WorldElement, WorldRule } from "../../shared/api/types";
import type { SceneDiscovery } from "./sceneDiscoveryStore";

// Buduje szkic encji z odkrycia (analiza sceny lub burza mózgów) — wypełnia
// tylko pola wynikające z odkrycia, resztę AI dogeneruje w propozycji.
// Osobny moduł, żeby zarówno AiProposalPanel, jak i BrainstormSuggestionPanel
// mogły ich używać bez cyklicznego importu.

export function characterDraftFromDiscovery(discovery: SceneDiscovery): Character {
  const now = new Date().toISOString();
  return {
    id: `audit-character:${discovery.id}`,
    projectId: discovery.projectId,
    characterType: discovery.suggestedType || "person",
    name: discovery.title,
    aliasesJson: "[]",
    role: "",
    shortDescription: discovery.reason,
    appearance: "",
    externalGoal: "",
    internalNeed: "",
    wound: "",
    falseBelief: "",
    secret: "",
    strengthsJson: "[]",
    weaknessesJson: "[]",
    voiceNotes: "",
    arcSummary: "",
    knowledgeNotes: discovery.evidence,
    visualPrompt: "",
    imageAssetId: null,
    status: "draft",
    orderIndex: 0,
    createdAt: now,
    updatedAt: now
  };
}

export function worldElementDraftFromDiscovery(discovery: SceneDiscovery): WorldElement {
  const now = new Date().toISOString();
  return {
    id: `audit-world-element:${discovery.id}`,
    projectId: discovery.projectId,
    elementType: discovery.suggestedType || "location",
    name: discovery.title,
    summary: discovery.reason,
    details: discovery.evidence,
    storyPurpose: "",
    constraints: "",
    visualPrompt: "",
    imageAssetId: null,
    status: "draft",
    orderIndex: 0,
    createdAt: now,
    updatedAt: now
  };
}

export function worldRuleDraftFromDiscovery(discovery: SceneDiscovery): WorldRule {
  const now = new Date().toISOString();
  return {
    id: `audit-world-rule:${discovery.id}`,
    projectId: discovery.projectId,
    name: discovery.title,
    description: discovery.reason,
    scope: discovery.evidence,
    cost: "",
    limitation: "",
    exceptions: "",
    violationConsequences: "",
    sceneExamples: "",
    status: "draft",
    orderIndex: 0,
    createdAt: now,
    updatedAt: now
  };
}
