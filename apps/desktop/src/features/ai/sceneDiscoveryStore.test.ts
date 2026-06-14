import { beforeEach, describe, expect, it } from "vitest";
import { useSceneDiscoveryStore } from "./sceneDiscoveryStore";

describe("sceneDiscoveryStore", () => {
  beforeEach(() => {
    useSceneDiscoveryStore.setState({
      discoveries: [],
      pendingAuditPrompts: [],
      pendingAssignments: []
    });
  });

  it("stores a pending scene audit prompt for the sidebar", () => {
    useSceneDiscoveryStore.getState().addAuditPrompt({
      projectId: "project-1",
      bookId: "book-1",
      sceneId: "scene-1",
      sceneTitle: "Nowa scena",
      analysisText: "Tekst sceny",
      sourceKind: "acceptedText"
    });

    expect(useSceneDiscoveryStore.getState().pendingAuditPrompts).toHaveLength(1);
    expect(useSceneDiscoveryStore.getState().pendingAuditPrompts[0]).toMatchObject({
      projectId: "project-1",
      sceneTitle: "Nowa scena"
    });
  });
});
