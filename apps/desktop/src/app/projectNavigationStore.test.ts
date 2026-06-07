import { beforeEach, describe, expect, it } from "vitest";
import {
  defaultProjectReturnHref,
  projectLogReturnHref,
  useProjectNavigationStore
} from "./projectNavigationStore";

describe("projectNavigationStore", () => {
  beforeEach(() => {
    useProjectNavigationStore.setState({
      logReturnLocations: {},
      viewState: {}
    });
  });

  it("remembers the last non-log project location", () => {
    useProjectNavigationStore
      .getState()
      .rememberLogReturnLocation("project-1", "/projects/project-1/ai");

    expect(
      projectLogReturnHref(
        "project-1",
        useProjectNavigationStore.getState().logReturnLocations["project-1"]
      )
    ).toBe("/projects/project-1/ai");
  });

  it("falls back to concept when the remembered location is missing or points at the log", () => {
    expect(projectLogReturnHref("project-1")).toBe(
      defaultProjectReturnHref("project-1")
    );

    useProjectNavigationStore
      .getState()
      .rememberLogReturnLocation("project-1", "/projects/project-1/ai-log");

    expect(
      projectLogReturnHref(
        "project-1",
        useProjectNavigationStore.getState().logReturnLocations["project-1"]
      )
    ).toBe("/projects/project-1/concept");
  });
});
