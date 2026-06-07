import { describe, expect, it } from "vitest";
import {
  ActiveAiProposal,
  BOOK_COVER_FIELD,
  pendingProposalStatus
} from "./proposalStore";

describe("pendingProposalStatus", () => {
  it("returns the pending status for a matching proposal target", () => {
    const proposals = [
      proposal("queued-genre", "genre", "queued"),
      proposal("running-premise", "premise", "running")
    ];

    expect(
      pendingProposalStatus(proposals, {
        projectId: "project-1",
        field: "genre",
        scope: "bookConcept"
      })
    ).toBe("queued");
    expect(
      pendingProposalStatus(proposals, {
        projectId: "project-1",
        field: "premise",
        scope: "bookConcept"
      })
    ).toBe("running");
  });

  it("prefers running over queued when several pending proposals match", () => {
    const proposals = [
      proposal("queued-title", "workingTitle", "queued"),
      proposal("running-title", "workingTitle", "running")
    ];

    expect(
      pendingProposalStatus(proposals, {
        projectId: "project-1",
        field: "workingTitle"
      })
    ).toBe("running");
  });

  it("matches cover generation tasks by the generic queue target", () => {
    const proposals = [
      proposal("running-cover", BOOK_COVER_FIELD, "running", "bookCover")
    ];

    expect(
      pendingProposalStatus(proposals, {
        projectId: "project-1",
        bookId: "book-1",
        field: BOOK_COVER_FIELD,
        scope: "bookCover"
      })
    ).toBe("running");
  });
});

function proposal(
  id: string,
  field: ActiveAiProposal["field"],
  status: ActiveAiProposal["status"],
  scope: ActiveAiProposal["scope"] = "bookConcept"
): ActiveAiProposal {
  return {
    id,
    scope,
    projectId: "project-1",
    bookId: "book-1",
    field,
    action: "generate_premise",
    promptPackageId: `${id}:prompt`,
    promptPackageJson: {} as ActiveAiProposal["promptPackageJson"],
    prompt: "Prompt",
    status,
    rawOutput: "",
    editableValue: "",
    editableFields: {},
    selectedFields: {},
    errorMessage: "",
    createdAt: "2026-06-07T10:00:00Z",
    updatedAt: "2026-06-07T10:00:00Z"
  };
}
