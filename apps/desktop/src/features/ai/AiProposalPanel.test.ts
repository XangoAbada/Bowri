import { describe, expect, it } from "vitest";
import { parseProposalResult } from "./AiProposalPanel";

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
});
