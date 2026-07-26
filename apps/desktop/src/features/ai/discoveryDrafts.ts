import type { Character, PlotThread, WorldElement, WorldRule } from "../../shared/api/types";
import { normalizeCharacterType } from "../../shared/api/characterTypes";
import { normalizeWorldElementType } from "../../shared/api/worldElementTypes";
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
    // Pusty rodzaj, gdy odkrycie go nie niesie (tak jest zawsze w burzy mózgów)
    // — "person" trafiało do migawki w prompcie i AI kopiowało je jako gotową
    // odpowiedź, przez co każda postać wychodziła jako człowiek.
    characterType: discovery.suggestedType ? normalizeCharacterType(discovery.suggestedType) : "",
    name: discovery.title,
    aliasesJson: "[]",
    role: "",
    shortDescription: discovery.reason,
    appearance: "",
    temperament: "",
    likesDislikes: "",
    innerWorld: "",
    worldview: "",
    secret: "",
    voiceNotes: "",
    mannerisms: "",
    origin: "",
    family: "",
    background: "",
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
    // Pusty typ, gdy odkrycie go nie niesie (tak jest zawsze w burzy mózgów) —
    // wpisanie tu "location" trafiało do migawki w prompcie i AI kopiowało je
    // jako gotową odpowiedź, przez co każdy element wychodził jako lokacja.
    elementType: discovery.suggestedType ? normalizeWorldElementType(discovery.suggestedType) : "",
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

// Wątek nie jest kandydatem Story Bible (SceneDiscovery["kind"] go nie zna), więc
// szkic budujemy wprost z sugestii burzy mózgów. Kluczowe jest unikalne id: bez
// niego wszystkie sugestie wątków mają identyczny cel propozycji i dedup w
// proposalStore sklejałby je w jedną pozycję kolejki.
export function plotThreadDraftFromSuggestion(
  suggestion: { id: string; title: string; value: string },
  bookId: string
): PlotThread {
  const now = new Date().toISOString();
  return {
    id: `brainstorm-thread:${suggestion.id}`,
    bookId,
    name: suggestion.title,
    description: suggestion.value,
    resolution: "",
    color: "",
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
