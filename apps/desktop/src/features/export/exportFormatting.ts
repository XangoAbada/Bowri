import type {
  Book,
  BookPlan,
  Chapter,
  ExportContentMode,
  ExportSeparatorSettings,
  ExportStyleSettings,
  Scene,
  VisualAsset
} from "../../shared/api/types";

export const defaultChapterSeparator: ExportSeparatorSettings = {
  text: "Rozdział {number}. {title}",
  fontSize: 22,
  align: "center",
  spacingBefore: 28,
  spacingAfter: 18,
  line: false,
  color: "#2b2721",
  background: "#fffdf8",
  imageAssetId: null
};

export const defaultSceneSeparator: ExportSeparatorSettings = {
  text: "* * *",
  fontSize: 16,
  align: "center",
  spacingBefore: 18,
  spacingAfter: 18,
  line: false,
  color: "#6f5c42",
  background: "#fffdf8",
  imageAssetId: null
};

export const defaultExportStyle: ExportStyleSettings = {
  chapterSeparator: defaultChapterSeparator,
  sceneSeparator: defaultSceneSeparator,
  pageNumbers: true
};

export type ExportRenderOptions = {
  book: Book;
  plan: BookPlan;
  chapterIds: string[];
  contentMode: ExportContentMode;
  style: ExportStyleSettings;
  visualAssets?: VisualAsset[];
  previewLimit?: number;
};

export type ExportPreviewBlock =
  | { kind: "chapter"; id: string; text: string; image?: VisualAsset | null }
  | { kind: "summary"; id: string; text: string }
  | { kind: "scene"; id: string; text: string; image?: VisualAsset | null }
  | { kind: "body"; id: string; text: string };

export function selectedExportChapters(
  plan: BookPlan,
  chapterIds: string[]
): Chapter[] {
  const selected = new Set(chapterIds);
  return [...plan.chapters]
    .sort(compareChapters)
    .filter((chapter) => selected.size === 0 || selected.has(chapter.id));
}

export function scenesForChapter(plan: BookPlan, chapterId: string): Scene[] {
  return [...plan.scenes]
    .filter((scene) => scene.chapterId === chapterId)
    .sort(compareScenes);
}

export function buildExportPreviewBlocks({
  book,
  plan,
  chapterIds,
  contentMode,
  style,
  visualAssets = [],
  previewLimit
}: ExportRenderOptions): ExportPreviewBlock[] {
  const blocks: ExportPreviewBlock[] = [];
  const chapters = selectedExportChapters(plan, chapterIds);
  const limitedChapters =
    previewLimit && previewLimit > 0 ? chapters.slice(0, previewLimit) : chapters;

  for (const chapter of limitedChapters) {
    blocks.push({
      kind: "chapter",
      id: chapter.id,
      text: renderSeparator(style.chapterSeparator, chapter, book),
      image: assetById(visualAssets, style.chapterSeparator.imageAssetId)
    });

    if (contentMode === "manuscript_with_summaries" && chapter.summary.trim()) {
      blocks.push({
        kind: "summary",
        id: `${chapter.id}:summary`,
        text: chapter.summary.trim()
      });
    }

    const scenes = scenesForChapter(plan, chapter.id);
    scenes.forEach((scene, index) => {
      if (index > 0 || style.sceneSeparator.text.trim() || style.sceneSeparator.imageAssetId) {
        blocks.push({
          kind: "scene",
          id: scene.id,
          text: renderSeparator(style.sceneSeparator, chapter, book, scene),
          image: assetById(visualAssets, style.sceneSeparator.imageAssetId)
        });
      }

      const text = htmlToPlainText(scene.manuscriptContent).trim();
      if (text) {
        blocks.push({
          kind: "body",
          id: `${scene.id}:body`,
          text
        });
      }
    });
  }

  return blocks;
}

export function renderMarkdownExport(options: ExportRenderOptions): string {
  const blocks = buildExportPreviewBlocks(options);
  const parts = [`# ${options.book.title || options.book.workingTitle || "Manuskrypt"}`];

  for (const block of blocks) {
    if (block.kind === "chapter") {
      parts.push(`\n## ${block.text}`);
    } else if (block.kind === "summary") {
      parts.push(`\n> ${block.text}`);
    } else if (block.kind === "scene") {
      if (block.text.trim()) {
        parts.push(`\n${block.text}`);
      }
    } else {
      parts.push(`\n${block.text}`);
    }
  }

  return `${parts.join("\n")}\n`;
}

export function renderPlainTextExport(options: ExportRenderOptions): string {
  const blocks = buildExportPreviewBlocks(options);
  const parts = [options.book.title || options.book.workingTitle || "Manuskrypt"];

  for (const block of blocks) {
    if (block.kind === "summary") {
      parts.push(`Streszczenie: ${block.text}`);
    } else {
      parts.push(block.text);
    }
  }

  return `${parts.filter((part) => part.trim()).join("\n\n")}\n`;
}

export function renderSeparator(
  settings: ExportSeparatorSettings,
  chapter: Chapter,
  book: Pick<Book, "title" | "workingTitle">,
  scene?: Scene
): string {
  const title = chapter.workingTitle || `Rozdział ${chapter.number}`;
  return settings.text
    .replaceAll("{number}", String(chapter.number))
    .replaceAll("{title}", title)
    .replaceAll("{scene}", scene?.title || "")
    .replaceAll("{book}", book.title || book.workingTitle || "");
}

export function htmlToPlainText(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<li>/gi, "- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function assetById(
  visualAssets: VisualAsset[],
  id?: string | null
): VisualAsset | null {
  if (!id) {
    return null;
  }

  return visualAssets.find((asset) => asset.id === id) ?? null;
}

function compareChapters(left: Chapter, right: Chapter): number {
  return left.orderIndex - right.orderIndex || left.number - right.number;
}

function compareScenes(left: Scene, right: Scene): number {
  return left.orderIndex - right.orderIndex || left.createdAt.localeCompare(right.createdAt);
}
