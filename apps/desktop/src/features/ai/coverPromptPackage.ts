import type { AIAction, Book, Project } from "../../shared/api/types";

export type CoverPromptPackage = {
  id: string;
  projectId: string;
  action: Extract<AIAction, "generate_cover_image">;
  locale: "pl" | "en";
  userInstruction: string;
  context: {
    book: {
      workingTitle: string;
      premise: string;
      genre: string;
      targetAudience: string;
      tone: string;
      styleGuide: string;
    };
  };
  outputContract: {
    kind: "book_cover_image";
    format: "png";
    schema: unknown;
  };
  generationOptions: {
    providerId: "openai-images-api";
    model: "gpt-image-2";
    streaming: true;
    partialImages: 2;
    aspectRatio: "2:3";
  };
  coverPrompt: string;
  negativePrompt: string;
};

export function buildBookCoverPromptPackage(
  project: Project,
  book: Book
): CoverPromptPackage {
  const coverPrompt = renderCoverVisualPrompt(book);
  const negativePrompt =
    "No watermark, no publisher logo, no author name, no mockup frame, no UI, no unreadable typography, no duplicate book covers, no gore.";

  return {
    id: createPromptId("generate_cover_image"),
    projectId: project.id,
    action: "generate_cover_image",
    locale: project.language === "en" ? "en" : "pl",
    userInstruction:
      "Generate a real raster working book cover image from the current concept data.",
    context: {
      book: {
        workingTitle: book.workingTitle,
        premise: book.premise,
        genre: book.genre,
        targetAudience: book.targetAudience,
        tone: book.tone,
        styleGuide: book.styleGuide
      }
    },
    outputContract: {
      kind: "book_cover_image",
      format: "png",
      schema: {
        version: 1,
        kind: "book_cover_image",
        imagePath: "string",
        prompt: "string",
        negativePrompt: "string",
        warnings: ["string"]
      }
    },
    generationOptions: {
      providerId: "openai-images-api",
      model: "gpt-image-2",
      streaming: true,
      partialImages: 2,
      aspectRatio: "2:3"
    },
    coverPrompt,
    negativePrompt
  };
}

export function renderBookCoverPromptPackage(
  promptPackage: CoverPromptPackage,
  outputFilePath = "{OUTPUT_FILE}"
): string {
  return `# Role
You are generating a working book cover asset for StoryForge2.

# Task
Generate one portrait PNG book cover image through the OpenAI Images API.
StoryForge2 will save the final image at this path:
${outputFilePath}

# Visual Prompt
${promptPackage.coverPrompt}

# Negative Prompt
${promptPackage.negativePrompt}

# Hard Rules
- The cover must be portrait with a 2:3 book-cover composition.
- Make a real raster image, not SVG, HTML, CSS, or a text-only placeholder.
- Do not place readable title text inside the image; StoryForge2 displays the title separately.
- Stream partial image previews when the provider returns them.

# Output Contract
Return JSON:
${JSON.stringify(promptPackage.outputContract.schema, null, 2)}
`;
}

export function renderCoverVisualPrompt(book: Book): string {
  return [
    "Use case: illustration-story",
    "Asset type: working book cover",
    `Primary request: a polished editorial cover for the working title "${emptyFallback(book.workingTitle)}"`,
    `Scene/backdrop: visual metaphor for this premise: ${emptyFallback(book.premise)}`,
    `Style/medium: sophisticated illustrated book-cover art, strong silhouette, tactile print texture`,
    `Composition/framing: portrait 2:3, central focal image, generous safe margins, no visible text`,
    `Lighting/mood: ${emptyFallback(book.tone)}`,
    `Genre cues: ${emptyFallback(book.genre)}`,
    `Audience: ${emptyFallback(book.targetAudience)}`,
    `Style notes: ${emptyFallback(book.styleGuide)}`,
    "Constraints: no text, no watermark, no logo, no author name, no series badge"
  ].join("\n");
}

function createPromptId(action: AIAction): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${action}:${crypto.randomUUID()}`;
  }

  return `${action}:${Date.now().toString(36)}:${Math.random()
    .toString(36)
    .slice(2)}`;
}

function emptyFallback(value: string): string {
  return value.trim().length > 0 ? value : "(missing)";
}
