import type { AIAction, AiLogEntry } from "../../shared/api/types";
import {
  BOOK_COVER_FIELD,
  CHARACTER_IMAGE_FIELD,
  EXPORT_ARTWORK_FIELD,
  type ActiveAiProposal,
  type AiPromptSnapshot,
  type AiProposalScope,
  type AiTaskFieldKey,
  type ParsedAiProposal
} from "./proposalStore";
import {
  editableFieldsFromParsed,
  parseProposalResult,
  selectedFieldsFromParsed
} from "./AiProposalPanel";
import { conceptFieldConfigs, type ConceptFieldKey } from "./promptPackage";
import { planFieldConfigs, type PlanFieldKey } from "./planPromptPackage";
import { characterFieldConfigs, type CharacterFieldKey } from "./characterPromptPackage";
import { worldFieldConfigs, type WorldFieldKey } from "./worldPromptPackage";
import type { SceneEditorFieldKey } from "./sceneEditorPromptPackage";
import { SCENE_STORY_BIBLE_AUDIT_FIELD } from "./sceneStoryBibleAuditPromptPackage";
import { SCENE_CRITIQUE_FIELD } from "./sceneCritiquePromptPackage";
import { CONSISTENCY_AUDIT_FIELD } from "./consistencyAuditPromptPackage";
import i18n from "../../shared/i18n";

/** Pola, dla których `parseProposalResult` potrafi zbudować propozycję z odpowiedzi. */
type ParsableFieldKey =
  | ConceptFieldKey
  | PlanFieldKey
  | CharacterFieldKey
  | WorldFieldKey
  | SceneEditorFieldKey
  | typeof SCENE_STORY_BIBLE_AUDIT_FIELD
  | typeof SCENE_CRITIQUE_FIELD
  | typeof CONSISTENCY_AUDIT_FIELD;

/**
 * Propozycja odtworzona z wpisu logu AI. `stored` to snapshot zapisany w tabeli
 * `ai_proposals` (zawiera ręczne edycje autora), `reconstructed` powstaje z pakietu
 * promptu i surowej odpowiedzi, gdy log nie ma dowiązanej propozycji — starsze wpisy
 * i przebiegi, które zakończyły się błędem, zostały zapisane bez powiązania.
 */
export type LogEntryProposal = {
  proposal: ActiveAiProposal;
  source: "stored" | "reconstructed";
};

const SCENE_EDITOR_FIELDS = [
  "draftScene",
  "continueScene",
  "rewriteSelection",
  "expandSelection"
];

/** Pola obrazowe wymagają promptu graficznego — bez niego runner kolejki od razu zawodzi. */
const IMAGE_FIELDS: AiTaskFieldKey[] = [
  BOOK_COVER_FIELD,
  CHARACTER_IMAGE_FIELD,
  EXPORT_ARTWORK_FIELD
];

/**
 * Dane żądania wystarczające do ponownego zakolejkowania generacji z poziomu logu AI.
 * Zwraca `null` dla wpisów, które nie przechodzą przez kolejkę propozycji (burza mózgów,
 * podsumowania ciągłości, tytuł nowego projektu) — tych nie da się ponowić w tym miejscu.
 */
export function promptSnapshotFromLogEntry(
  entry: AiLogEntry,
  fallbackBookId: string
): AiPromptSnapshot | null {
  const stored = storedSnapshotFromLogEntry(entry);
  if (stored) {
    return stored;
  }

  return reconstructedSnapshotFromLogEntry(entry, fallbackBookId);
}

/**
 * Propozycja gotowa do zastosowania z poziomu logu. Dla wpisów bez zapisanego snapshotu
 * odtwarzamy ją z pakietu promptu i surowej odpowiedzi — dokładnie tak, jak zrobiłby to
 * runner kolejki po udanej generacji.
 */
export function proposalFromLogEntry(
  entry: AiLogEntry,
  fallbackBookId: string
): LogEntryProposal | null {
  const stored = storedProposalFromLogEntry(entry);
  if (stored) {
    return {
      proposal: {
        ...stored,
        aiRunId: entry.id,
        rawOutput: stored.rawOutput || entry.rawOutput || "",
        status: "success"
      },
      source: "stored"
    };
  }

  // Obrazów nie da się odtworzyć z samego przebiegu: ścieżka wygenerowanego pliku i czas
  // generacji żyją tylko w snapshocie propozycji, a bez nich akceptacja i tak zawodzi.
  const snapshot = reconstructedSnapshotFromLogEntry(entry, fallbackBookId);
  const rawOutput = entry.rawOutput?.trim() ? entry.rawOutput : "";
  if (!snapshot || !rawOutput || isImageField(snapshot.field)) {
    return null;
  }

  let parsed: ParsedAiProposal;
  try {
    parsed = parseProposalResult(rawOutput, snapshot.field as ParsableFieldKey, snapshot.action);
  } catch {
    return null;
  }

  const now = new Date().toISOString();
  return {
    proposal: {
      ...snapshot,
      id: reconstructedProposalId(entry),
      aiRunId: entry.id,
      status: "success",
      rawOutput,
      parsed,
      editableValue: parsed.textValue,
      editableFields: editableFieldsFromParsed(parsed),
      selectedFields: selectedFieldsFromParsed(parsed),
      errorMessage: "",
      createdAt: entry.createdAt || now,
      updatedAt: entry.completedAt || entry.createdAt || now
    },
    source: "reconstructed"
  };
}

/** Czyste dane żądania — bez wyniku poprzedniego przebiegu i bez jego identyfikatora. */
export function snapshotForRetry(snapshot: AiPromptSnapshot): AiPromptSnapshot {
  return {
    scope: snapshot.scope,
    projectId: snapshot.projectId,
    bookId: snapshot.bookId,
    field: snapshot.field,
    action: snapshot.action,
    promptPackageId: snapshot.promptPackageId,
    promptPackageJson: snapshot.promptPackageJson,
    prompt: snapshot.prompt,
    ...(snapshot.coverPrompt ? { coverPrompt: snapshot.coverPrompt } : {}),
    ...(snapshot.coverNegativePrompt
      ? { coverNegativePrompt: snapshot.coverNegativePrompt }
      : {})
  };
}

/**
 * Identyfikator odtworzonej propozycji wyprowadzamy z identyfikatora przebiegu, żeby
 * kolejne zastosowania tego samego wpisu trafiały w ten sam rekord `ai_proposals`
 * i nie rozdwajały wiersza w logu (zapytanie historii dołącza propozycje po `ai_run_id`).
 */
export function reconstructedProposalId(entry: AiLogEntry): string {
  return `${entry.action}:log:${entry.id}`;
}

function storedProposalFromLogEntry(entry: AiLogEntry): ActiveAiProposal | null {
  if (!entry.proposalSnapshot || typeof entry.proposalSnapshot !== "object") {
    return null;
  }

  const proposal = entry.proposalSnapshot as ActiveAiProposal;
  if (
    !proposal.id ||
    !proposal.projectId ||
    !proposal.bookId ||
    !proposal.field ||
    !proposal.action ||
    !proposal.promptPackageId ||
    !proposal.promptPackageJson ||
    !proposal.prompt
  ) {
    return null;
  }

  return proposal;
}

function storedSnapshotFromLogEntry(entry: AiLogEntry): AiPromptSnapshot | null {
  const proposal = storedProposalFromLogEntry(entry);
  if (!proposal) {
    return null;
  }

  const scope = proposal.scope ?? scopeFor(proposal.field);
  if (!scope) {
    return null;
  }

  return snapshotForRetry({ ...proposal, scope });
}

function reconstructedSnapshotFromLogEntry(
  entry: AiLogEntry,
  fallbackBookId: string
): AiPromptSnapshot | null {
  const promptPackage = recordOf(entry.promptPackageJson);
  if (!promptPackage || !entry.prompt.trim()) {
    return null;
  }

  const context = recordOf(promptPackage.context) ?? {};
  const action = entry.action as AIAction;
  const field = fieldFor(entry.action, context, promptPackage);
  if (!field) {
    return null;
  }

  const scope = scopeFor(field);
  if (!scope) {
    return null;
  }

  const bookId =
    stringOf(promptPackage.bookId) || stringOf(context.bookId) || fallbackBookId;
  const promptPackageId = stringOf(promptPackage.id) || promptPackageIdFor(field, context);
  if (!bookId || !promptPackageId) {
    return null;
  }

  const imagePrompts = imagePromptsFor(field, entry, promptPackage);
  if (isImageField(field) && !imagePrompts) {
    return null;
  }

  return {
    scope,
    projectId: entry.projectId,
    bookId,
    field,
    action,
    promptPackageId,
    promptPackageJson: promptPackage,
    prompt: entry.prompt,
    ...(imagePrompts ?? {})
  };
}

function fieldFor(
  action: string,
  context: Record<string, unknown>,
  promptPackage: Record<string, unknown>
): AiTaskFieldKey | null {
  if (action === "generate_cover_image") {
    return BOOK_COVER_FIELD;
  }

  if (action === "generate_export_artwork" || promptPackage.kind === "export_artwork") {
    return EXPORT_ARTWORK_FIELD;
  }

  const targetField = stringOf(context.targetField);
  if (!targetField) {
    return null;
  }

  if (targetField === "characterImage") {
    return CHARACTER_IMAGE_FIELD;
  }

  return isKnownField(targetField) ? (targetField as AiTaskFieldKey) : null;
}

function scopeFor(field: AiTaskFieldKey): AiProposalScope | null {
  if (field === BOOK_COVER_FIELD) {
    return "bookCover";
  }

  if (field === EXPORT_ARTWORK_FIELD) {
    return "export";
  }

  if (field === CHARACTER_IMAGE_FIELD || field in characterFieldConfigs) {
    return "characters";
  }

  if (field === SCENE_STORY_BIBLE_AUDIT_FIELD || field === SCENE_CRITIQUE_FIELD) {
    return "sceneEditor";
  }

  if (field === CONSISTENCY_AUDIT_FIELD) {
    return "consistencyAudit";
  }

  if (SCENE_EDITOR_FIELDS.includes(field)) {
    return "sceneEditor";
  }

  if (field in planFieldConfigs) {
    return "bookPlan";
  }

  if (field in worldFieldConfigs) {
    return "world";
  }

  if (field in conceptFieldConfigs) {
    return "bookConcept";
  }

  return null;
}

function isKnownField(field: string): boolean {
  return (
    field in conceptFieldConfigs ||
    field in planFieldConfigs ||
    field in characterFieldConfigs ||
    field in worldFieldConfigs ||
    SCENE_EDITOR_FIELDS.includes(field) ||
    field === SCENE_STORY_BIBLE_AUDIT_FIELD ||
    field === SCENE_CRITIQUE_FIELD ||
    field === CONSISTENCY_AUDIT_FIELD
  );
}

function isImageField(field: AiTaskFieldKey): boolean {
  return IMAGE_FIELDS.includes(field);
}

/**
 * Prompty graficzne trzymane są w pakiecie promptu pod różnymi nazwami: okładka ma
 * `coverPrompt`, obraz postaci `imagePrompt`, a grafika eksportu przenosi prompt obrazu
 * jako prompt główny przebiegu.
 */
function imagePromptsFor(
  field: AiTaskFieldKey,
  entry: AiLogEntry,
  promptPackage: Record<string, unknown>
): Pick<AiPromptSnapshot, "coverPrompt" | "coverNegativePrompt"> | null {
  if (!isImageField(field)) {
    return null;
  }

  const negativePrompt =
    stringOf(promptPackage.negativePrompt) ||
    (field === EXPORT_ARTWORK_FIELD ? i18n.t("export.artworkNegativePrompt") : "");
  const imagePrompt =
    stringOf(promptPackage.coverPrompt) ||
    stringOf(promptPackage.imagePrompt) ||
    (field === EXPORT_ARTWORK_FIELD ? entry.prompt : "");

  if (!imagePrompt || !negativePrompt) {
    return null;
  }

  return { coverPrompt: imagePrompt, coverNegativePrompt: negativePrompt };
}

/** Grafika eksportu nie ma identyfikatora pakietu — składamy go tak jak ekran eksportu. */
function promptPackageIdFor(
  field: AiTaskFieldKey,
  context: Record<string, unknown>
): string {
  if (field !== EXPORT_ARTWORK_FIELD) {
    return "";
  }

  const relatedType = stringOf(context.relatedType) || "book";
  const relatedId = stringOf(context.targetEntityId);
  return relatedId ? `export-artwork:${relatedType}:${relatedId}` : "";
}

function recordOf(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringOf(value: unknown): string {
  return typeof value === "string" ? value : "";
}
