import { describe, expect, it } from "vitest";
import {
  characterProfileInputFromProposal,
  characterRelationDraftFromDiscovery,
  discoveryCanGenerate,
  parseProposalResult,
  proposalCanAccept
} from "./AiProposalPanel";
import { SCENE_STORY_BIBLE_AUDIT_FIELD } from "./sceneStoryBibleAuditPromptPackage";
import type { ActiveAiProposal } from "./proposalStore";
import type { SceneDiscovery } from "./sceneDiscoveryStore";

describe("parseProposalResult", () => {
  it("parses thread chapter field responses as plan suggestions", () => {
    const parsed = parseProposalResult(
      JSON.stringify({
        version: 1,
        kind: "book_plan_suggestion",
        field: "threadChapterDescription",
        summary: "Opis przebiegu wątku.",
        value: "Wątek odsłania nowy trop w tym rozdziale.",
        warnings: []
      }),
      "threadChapterDescription",
      "generate_thread_chapter_field"
    );

    expect(parsed.kind).toBe("book_plan_suggestion");
    expect(parsed.textValue).toBe("Wątek odsłania nowy trop w tym rozdziale.");
  });

  it("keeps character *Json fields as a JSON array string", () => {
    const parsed = parseProposalResult(
      JSON.stringify({
        version: 1,
        kind: "character_field_suggestion",
        field: "strengthsJson",
        summary: "Siły postaci",
        value: ["Silna wola", "Empatia"],
        warnings: []
      }),
      "strengthsJson",
      "generate_character_field"
    );

    expect(parsed.textValue).toBe(JSON.stringify(["Silna wola", "Empatia"]));
  });

  it("round-trips an empty character *Json field as [] instead of losing content", () => {
    const parsed = parseProposalResult(
      JSON.stringify({
        version: 1,
        kind: "character_field_suggestion",
        field: "aliasesJson",
        value: [],
        warnings: []
      }),
      "aliasesJson",
      "generate_character_field"
    );

    expect(parsed.textValue).toBe("[]");
  });

  it("coerces an array returned for a scalar character field into readable text", () => {
    const parsed = parseProposalResult(
      JSON.stringify({
        version: 1,
        kind: "character_field_suggestion",
        field: "role",
        value: ["mentor", "przewodnik"],
        warnings: []
      }),
      "role",
      "generate_character_field"
    );

    expect(parsed.textValue).toBe("mentor, przewodnik");
    expect(parsed.textValue).not.toBe("[]");
  });

  it("coerces a world field value returned as an array into readable text", () => {
    const parsed = parseProposalResult(
      JSON.stringify({
        version: 1,
        kind: "world_field_suggestion",
        field: "elementSummary",
        value: ["Miasto na wodzie", "zasilane parą"],
        warnings: []
      }),
      "elementSummary",
      "generate_world_element_field"
    );

    expect(parsed.textValue).toBe("Miasto na wodzie, zasilane parą");
    expect(parsed.textValue).not.toBe("[object Object]");
  });

  it("keeps a plain string world field value unchanged", () => {
    const parsed = parseProposalResult(
      JSON.stringify({
        version: 1,
        kind: "world_field_suggestion",
        field: "elementSummary",
        value: "Miasto na wodzie zasilane parą.",
        warnings: []
      }),
      "elementSummary",
      "generate_world_element_field"
    );

    expect(parsed.textValue).toBe("Miasto na wodzie zasilane parą.");
  });

  it("maps accepted character profile JSON into a character upsert input", () => {
    const rawOutput = JSON.stringify({
      version: 1,
      kind: "character_profile",
      summary: "Nowa postać",
      character: {
        characterType: "person",
        name: "Marta",
        aliases: ["Matka"],
        role: "nieobecna matka",
        shortDescription: "Centralna nieobecność w historii.",
        externalGoal: "Ukryć długi.",
        internalNeed: "Odzyskać kontrolę.",
        wound: "Wstyd po upadku rodziny.",
        falseBelief: "Miłość wymaga milczenia.",
        secret: "Zostawiła list.",
        strengths: ["determinacja"],
        weaknesses: ["unikanie rozmów"],
        voiceNotes: "Lakoniczna.",
        arcSummary: "Wpływa na decyzje córki po śmierci.",
        knowledgeNotes: "Wie o bankowym liście.",
        visualPrompt: "Zmęczona kobieta w płaszczu."
      },
      warnings: []
    });
    const proposal = {
      projectId: "project-1",
      rawOutput,
      editableValue: rawOutput
    } as ActiveAiProposal;

    const input = characterProfileInputFromProposal(proposal, {
      targetEntitySnapshot: {
        id: "audit-character:1",
        projectId: "project-1",
        status: "draft",
        orderIndex: 3
      }
    });

    expect(input).toMatchObject({
      id: "audit-character:1",
      projectId: "project-1",
      characterType: "person",
      name: "Marta",
      role: "nieobecna matka",
      status: "draft",
      orderIndex: 3
    });
    expect(input.aliasesJson).toBe(JSON.stringify(["Matka"]));
    expect(input.strengthsJson).toBe(JSON.stringify(["determinacja"]));
    expect(input.weaknessesJson).toBe(JSON.stringify(["unikanie rozmów"]));
  });

  it("builds a character relation target only when audit candidates point to two existing characters", () => {
    const characters = [
      { id: "char-1", projectId: "project-1", name: "Marta" },
      { id: "char-2", projectId: "project-1", name: "Tomasz" }
    ] as Parameters<typeof characterRelationDraftFromDiscovery>[1];
    const discovery: SceneDiscovery = {
      id: "discovery-1",
      projectId: "project-1",
      bookId: "book-1",
      sceneId: "scene-1",
      kind: "characterRelation",
      title: "Marta i Tomasz",
      reason: "Napięta relacja rodzinna.",
      evidence: "Nie rozmawiają o długach.",
      relatedCharacterIds: ["char-1", "char-2"],
      suggestedType: "rodzina",
      createdAt: ""
    };

    expect(discoveryCanGenerate(discovery, characters)).toBe(true);
    expect(characterRelationDraftFromDiscovery(discovery, characters)).toMatchObject({
      projectId: "project-1",
      fromCharacterId: "char-1",
      toCharacterId: "char-2",
      relationType: "rodzina",
      description: "Napięta relacja rodzinna.",
      history: "Nie rozmawiają o długach."
    });

    expect(discoveryCanGenerate({ ...discovery, relatedCharacterIds: ["char-1"] }, characters)).toBe(false);
  });

  it("does not allow accepting completed scene audit proposals", () => {
    const proposal = {
      field: SCENE_STORY_BIBLE_AUDIT_FIELD,
      scope: "sceneEditor",
      editableValue: "Analiza zakończona",
      rawOutput: "{}",
      selectedFields: {},
      editableFields: {}
    } as ActiveAiProposal;

    expect(proposalCanAccept(proposal)).toBe(false);
  });
});
