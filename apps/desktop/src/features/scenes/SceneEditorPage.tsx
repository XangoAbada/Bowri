import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bot,
  CheckCircle2,
  FileText,
  Loader2,
  MapPin,
  PenLine,
  Plus,
  Save,
  Sparkles,
  Target,
  Users
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getBookPlan,
  getCharacterWorkspace,
  getProject,
  getWorldWorkspace,
  setSceneRelations,
  upsertScene
} from "../../shared/api/commands";
import type {
  BookPlan,
  Chapter,
  CharacterWorkspace,
  Scene,
  UpsertSceneInput,
  WorldWorkspace
} from "../../shared/api/types";
import { buildScenePromptContext } from "../ai/scenePromptContext";
import {
  buildSceneEditorPromptPackage,
  renderSceneEditorPromptPackage,
  SceneEditorFieldKey
} from "../ai/sceneEditorPromptPackage";
import {
  registerSceneEditorProposalTarget,
  SceneEditorInsertMode,
  unregisterSceneEditorProposalTarget
} from "../ai/sceneEditorProposalTargets";
import {
  buildPlanPromptPackage,
  planFieldConfigs,
  PlanFieldKey,
  renderPlanPromptPackage
} from "../ai/planPromptPackage";
import {
  planPromptContextTargetId,
  promptContextControlForActiveTarget
} from "../ai/aiPromptContextStore";
import { pendingProposalStatus, useProposalStore } from "../ai/proposalStore";

type SceneEditorPageProps = {
  projectId: string;
};

type SceneVariant = {
  id: string;
  mode: SceneEditorInsertMode;
  text: string;
  createdAt: string;
};

const sceneTextFields: Array<{
  field: PlanFieldKey;
  label: string;
  key: "title" | "summary" | "goal" | "conflict" | "outcome";
  rows?: number;
}> = [
  { field: "sceneTitle", label: "Tytuł", key: "title" },
  { field: "sceneSummary", label: "Streszczenie", key: "summary", rows: 3 },
  { field: "sceneGoal", label: "Cel", key: "goal", rows: 2 },
  { field: "sceneConflict", label: "Konflikt", key: "conflict", rows: 2 },
  { field: "sceneOutcome", label: "Wynik", key: "outcome", rows: 2 }
];

export function SceneEditorPage({ projectId }: SceneEditorPageProps) {
  const queryClient = useQueryClient();
  const enqueueProposal = useProposalStore((state) => state.enqueueProposal);
  const proposals = useProposalStore((state) => state.proposals);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [draft, setDraft] = useState<UpsertSceneInput | null>(null);
  const [selectionText, setSelectionText] = useState("");
  const [customInstruction, setCustomInstruction] = useState("");
  const [insertMode, setInsertMode] = useState<SceneEditorInsertMode>("append_to_scene");
  const [statusText, setStatusText] = useState("Wybierz scenę");
  const [variants, setVariants] = useState<SceneVariant[]>([]);
  const lastSavedSignature = useRef("");

  const projectQuery = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProject(projectId),
    retry: 0
  });
  const bookId = projectQuery.data?.book.id;
  const planQuery = useQuery({
    queryKey: ["book-plan", bookId],
    queryFn: () => getBookPlan(bookId ?? ""),
    enabled: Boolean(bookId),
    retry: 0
  });
  const characterQuery = useQuery({
    queryKey: ["character-workspace", projectId],
    queryFn: () => getCharacterWorkspace(projectId),
    retry: 0
  });
  const worldQuery = useQuery({
    queryKey: ["world-workspace", projectId],
    queryFn: () => getWorldWorkspace(projectId),
    retry: 0
  });

  const plan = planQuery.data ?? emptyPlan();
  const characters = characterQuery.data ?? emptyCharacterWorkspace();
  const world = worldQuery.data ?? emptyWorldWorkspace();
  const selectedScene = selectedSceneId
    ? plan.scenes.find((scene) => scene.id === selectedSceneId) ?? null
    : plan.scenes[0] ?? null;
  const selectedChapter = selectedScene?.chapterId
    ? plan.chapters.find((chapter) => chapter.id === selectedScene.chapterId) ?? null
    : null;

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Pisz scenę tutaj..."
      })
    ],
    content: selectedScene?.manuscriptContent || "",
    editorProps: {
      attributes: {
        class: "scene-tiptap-surface"
      }
    },
    onUpdate: ({ editor: currentEditor }) => {
      setDraft((current) =>
        current
          ? {
              ...current,
              manuscriptContent: currentEditor.getHTML(),
              actualWordCount: countWords(currentEditor.getText())
            }
          : current
      );
    },
    onSelectionUpdate: ({ editor: currentEditor }) => {
      setSelectionText(selectedTextFromEditor(currentEditor));
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (input: UpsertSceneInput) => upsertScene(input),
    onSuccess: async (scene) => {
      setSelectedSceneId(scene.id);
      setStatusText(`Zapisano ${new Date().toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}`);
      await queryClient.invalidateQueries({ queryKey: ["book-plan", bookId] });
    },
    onError: (error) => {
      setStatusText(error instanceof Error ? error.message : String(error));
    }
  });

  useEffect(() => {
    if (!selectedScene && plan.scenes[0]) {
      setSelectedSceneId(plan.scenes[0].id);
    }
  }, [plan.scenes, selectedScene]);

  useEffect(() => {
    if (!selectedScene) {
      setDraft(null);
      editor?.commands.setContent("");
      return;
    }

    const nextDraft = sceneToInput(selectedScene);
    setDraft(nextDraft);
    lastSavedSignature.current = signature(nextDraft);
    editor?.commands.setContent(selectedScene.manuscriptContent || "", { emitUpdate: false });
    setSelectionText("");
    setVariants(loadVariants(selectedScene.id));
    setStatusText("Scena gotowa");
  }, [editor, selectedScene?.id]);

  useEffect(() => {
    if (!draft) {
      return;
    }

    const nextSignature = signature(draft);
    if (nextSignature === lastSavedSignature.current) {
      return;
    }

    setStatusText("Autosave...");
    const timeoutId = window.setTimeout(() => {
      lastSavedSignature.current = nextSignature;
      saveMutation.mutate(draft);
    }, 900);

    return () => window.clearTimeout(timeoutId);
  }, [draft, saveMutation]);

  useEffect(() => {
    if (!draft?.id || !editor) {
      return;
    }

    registerSceneEditorProposalTarget(draft.id, async (value, mode) => {
      if (mode === "save_as_variant") {
        const nextVariants = [
          { id: createLocalId(), mode, text: value, createdAt: new Date().toISOString() },
          ...variants
        ];
        setVariants(nextVariants);
        saveVariants(draft.id ?? "", nextVariants);
        return;
      }

      if (mode === "replace_selection" && selectionText) {
        editor.chain().focus().insertContent(value).run();
      } else if (mode === "insert_after_selection" && selectionText) {
        editor.chain().focus().insertContent(`${selectionText}\n\n${value}`).run();
      } else {
        editor.chain().focus().setTextSelection(editor.state.doc.content.size).insertContent(`\n\n${value}`).run();
      }
    });

    return () => unregisterSceneEditorProposalTarget(draft.id ?? "");
  }, [draft?.id, editor, selectionText, variants]);

  const lanes = useMemo(() => chapterLanes(plan), [plan]);
  const currentWordCount = draft?.actualWordCount ?? countWords(editor?.getText() ?? "");
  const targetWordCount = draft?.targetWordCount ?? selectedChapter?.targetWordCount ?? null;
  const pendingEditorStatus = selectedScene
    ? pendingProposalStatus(proposals, {
        projectId,
        bookId,
        scope: "sceneEditor",
        targetEntityId: selectedScene.id
      })
    : null;

  function createScene(chapter: Chapter | null) {
    if (!bookId) {
      return;
    }
    const orderIndex = plan.scenes.filter((scene) => (scene.chapterId ?? null) === (chapter?.id ?? null)).length;
    saveMutation.mutate({
      bookId,
      chapterId: chapter?.id ?? null,
      orderIndex,
      title: "Nowa scena",
      summary: "",
      goal: "",
      conflict: "",
      outcome: "",
      povCharacterId: null,
      locationId: null,
      targetWordCount: chapter?.targetWordCount ?? 1200,
      actualWordCount: 0,
      manuscriptContent: "",
      status: "planned"
    });
  }

  function updateDraft(patch: Partial<UpsertSceneInput>) {
    setDraft((current) => (current ? { ...current, ...patch } : current));
  }

  function queueSceneField(field: PlanFieldKey) {
    if (!projectQuery.data || !bookId || !draft || !selectedScene) {
      return;
    }
    const sceneEntity = draftToScene(selectedScene, draft);
    const targetId = planPromptContextTargetId(projectId, field, sceneEntity.id);
    const promptPackage = buildPlanPromptPackage(
      projectQuery.data.project,
      projectQuery.data.book,
      { ...plan, scenes: plan.scenes.map((scene) => (scene.id === sceneEntity.id ? sceneEntity : scene)) },
      field,
      sceneEntity,
      promptContextControlForActiveTarget(targetId)
    );

    enqueueProposal({
      scope: "bookPlan",
      projectId,
      bookId,
      field,
      action: promptPackage.action,
      promptPackageId: promptPackage.id,
      promptPackageJson: promptPackage,
      prompt: renderPlanPromptPackage(promptPackage)
    });
  }

  function queueEditorAction(field: SceneEditorFieldKey, mode: SceneEditorInsertMode = insertMode) {
    if (!projectQuery.data || !bookId || !selectedScene || !editor) {
      return;
    }
    const sceneContext = buildScenePromptContext({
      book: projectQuery.data.book,
      plan,
      characters,
      world,
      sceneId: selectedScene.id
    });
    if (!sceneContext) {
      return;
    }
    const promptPackage = buildSceneEditorPromptPackage({
      project: projectQuery.data.project,
      book: projectQuery.data.book,
      scene: selectedScene,
      sceneContext,
      characters,
      world,
      field,
      selectedText: selectionText,
      currentText: editor.getText(),
      customInstruction,
      insertMode: mode,
      contextControl: undefined
    });

    enqueueProposal({
      scope: "sceneEditor",
      projectId,
      bookId,
      field,
      action: promptPackage.action,
      promptPackageId: promptPackage.id,
      promptPackageJson: promptPackage,
      prompt: renderSceneEditorPromptPackage(promptPackage)
    });
  }

  async function updateRelations(kind: "characters" | "threads", id: string) {
    if (!bookId || !selectedScene) {
      return;
    }
    const characterIds = relationIds(plan.sceneCharacters, selectedScene.id, "characterId");
    const threadIds = relationIds(plan.sceneThreads, selectedScene.id, "threadId");
    await setSceneRelations({
      bookId,
      sceneId: selectedScene.id,
      characterIds: kind === "characters" ? toggleId(characterIds, id) : characterIds,
      threadIds: kind === "threads" ? toggleId(threadIds, id) : threadIds,
      elementIds: relationIds(plan.sceneWorldElements, selectedScene.id, "elementId"),
      ruleIds: relationIds(plan.sceneWorldRules, selectedScene.id, "ruleId")
    });
    await queryClient.invalidateQueries({ queryKey: ["book-plan", bookId] });
  }

  return (
    <div className="scene-editor-page">
      <aside className="scene-chapter-rail" aria-label="Rozdziały i sceny">
        <div className="scene-editor-toolbar">
          <div>
            <p className="eyebrow">Faza 7</p>
            <h2>Rozdziały</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            title="Dodaj scenę bez rozdziału"
            aria-label="Dodaj scenę bez rozdziału"
            onClick={() => createScene(null)}
          >
            <Plus size={16} />
          </button>
        </div>
        <div className="scene-chapter-list">
          {lanes.map(({ chapter, scenes }) => (
            <section className="scene-chapter-group" key={chapter?.id ?? "loose"}>
              <div className="scene-chapter-heading">
                <FileText size={15} />
                <span>{chapter ? `Rozdział ${chapter.number}` : "Bez rozdziału"}</span>
                <button type="button" className="icon-button" title="Dodaj scenę" aria-label="Dodaj scenę" onClick={() => createScene(chapter)}>
                  <Plus size={14} />
                </button>
              </div>
              <p>{chapter?.workingTitle || chapter?.summary || "Sceny robocze"}</p>
              {scenes.map((scene) => (
                <button
                  type="button"
                  key={scene.id}
                  className={scene.id === selectedScene?.id ? "scene-list-item active" : "scene-list-item"}
                  onClick={() => setSelectedSceneId(scene.id)}
                >
                  <strong>{scene.title || "Scena bez tytułu"}</strong>
                  <span>{scene.actualWordCount || countWords(htmlToText(scene.manuscriptContent))} / {scene.targetWordCount ?? "?"} słów</span>
                </button>
              ))}
              {scenes.length === 0 ? <span className="scene-empty-note">Brak scen</span> : null}
            </section>
          ))}
        </div>
      </aside>

      <main className="scene-editor-workbench">
        {draft && selectedScene ? (
          <>
            <header className="scene-editor-header">
              <div>
                <p className="eyebrow">{selectedChapter ? `Rozdział ${selectedChapter.number}` : "Scena poza rozdziałem"}</p>
                <h2>{draft.title || "Scena bez tytułu"}</h2>
              </div>
              <span className="autosave-status">
                {saveMutation.isPending ? <Loader2 size={16} className="spin-icon" /> : <CheckCircle2 size={16} />}
                {statusText}
              </span>
            </header>

            <section className="scene-metadata-strip">
              <label className="field-label">
                Status
                <select value={draft.status} onChange={(event) => updateDraft({ status: event.target.value })}>
                  <option value="planned">Planowana</option>
                  <option value="draft">Szkic</option>
                  <option value="written">Napisana</option>
                  <option value="revision">Do redakcji</option>
                </select>
              </label>
              <label className="field-label">
                Cel słów
                <input type="number" min={0} value={draft.targetWordCount ?? ""} onChange={(event) => updateDraft({ targetWordCount: parseOptionalInt(event.target.value) })} />
              </label>
              <label className="field-label">
                POV
                <select value={draft.povCharacterId ?? ""} onChange={(event) => updateDraft({ povCharacterId: event.target.value || null })}>
                  <option value="">Brak</option>
                  {characters.characters.map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}
                </select>
              </label>
              <label className="field-label">
                Lokacja
                <select value={draft.locationId ?? ""} onChange={(event) => updateDraft({ locationId: event.target.value || null })}>
                  <option value="">Brak</option>
                  {world.elements.map((element) => <option key={element.id} value={element.id}>{element.name}</option>)}
                </select>
              </label>
            </section>

            <div className="scene-editor-grid">
              <section className="scene-editor-main">
                <div className="scene-field-grid">
                  {sceneTextFields.map((item) => (
                    <label className="field-label scene-editor-field" key={item.field}>
                      <span>
                        {item.label}
                        <button type="button" className="icon-button" title={`Generuj: ${item.label}`} aria-label={`Generuj: ${item.label}`} onClick={() => queueSceneField(item.field)}>
                          <Sparkles size={14} />
                        </button>
                      </span>
                      {item.rows ? (
                        <textarea value={String(draft[item.key] ?? "")} rows={item.rows} onChange={(event) => updateDraft({ [item.key]: event.target.value })} />
                      ) : (
                        <input value={String(draft[item.key] ?? "")} onChange={(event) => updateDraft({ [item.key]: event.target.value })} />
                      )}
                    </label>
                  ))}
                </div>

                <div className="scene-editor-stats">
                  <span><PenLine size={15} /> {currentWordCount.toLocaleString("pl-PL")} słów</span>
                  <span><Target size={15} /> Cel: {targetWordCount ? targetWordCount.toLocaleString("pl-PL") : "brak"}</span>
                  <span>{pendingEditorStatus ? "AI pracuje nad sceną" : "Gotowe na AI"}</span>
                </div>

                <div className="scene-editor-actions">
                  <button type="button" className="primary-button" onClick={() => queueEditorAction("draftScene", "append_to_scene")}>
                    <Bot size={16} />
                    Napisz szkic
                  </button>
                  <button type="button" className="secondary-button" onClick={() => queueEditorAction("continueScene", "append_to_scene")}>
                    <Sparkles size={16} />
                    Kontynuuj
                  </button>
                  <select value={insertMode} onChange={(event) => setInsertMode(event.target.value as SceneEditorInsertMode)} title="Tryb wstawienia wyniku AI">
                    <option value="replace_selection">Zastąp zaznaczenie</option>
                    <option value="insert_after_selection">Wstaw po zaznaczeniu</option>
                    <option value="append_to_scene">Dodaj na końcu sceny</option>
                    <option value="save_as_variant">Zapisz jako wariant</option>
                  </select>
                  <input value={customInstruction} onChange={(event) => setCustomInstruction(event.target.value)} placeholder="Własna instrukcja dla AI" />
                </div>

                {selectionText ? (
                  <div className="scene-selection-popover" role="toolbar" aria-label="AI dla zaznaczenia">
                    <span>{countWords(selectionText)} słów zaznaczenia</span>
                    <button type="button" onClick={() => queueEditorAction("rewriteSelection", insertMode)}>Przepisz</button>
                    <button type="button" onClick={() => queueEditorAction("expandSelection", insertMode)}>Rozwiń</button>
                    <button type="button" onClick={() => queueEditorAction("rewriteSelection", insertMode)}>Popraw dialog</button>
                    <button type="button" onClick={() => queueEditorAction("expandSelection", insertMode)}>Dodaj napięcie</button>
                  </div>
                ) : null}

                <EditorContent editor={editor} className="scene-editor-frame" />
              </section>

              <aside className="scene-context-sidebar">
                <SceneRelationPanel
                  title="Postacie"
                  icon={<Users size={16} />}
                  items={characters.characters.map((character) => ({ id: character.id, label: character.name, description: character.role }))}
                  selectedIds={relationIds(plan.sceneCharacters, selectedScene.id, "characterId")}
                  onToggle={(id) => updateRelations("characters", id)}
                />
                <SceneRelationPanel
                  title="Wątki"
                  icon={<Target size={16} />}
                  items={plan.threads.map((thread) => ({ id: thread.id, label: thread.name, description: thread.status }))}
                  selectedIds={relationIds(plan.sceneThreads, selectedScene.id, "threadId")}
                  onToggle={(id) => updateRelations("threads", id)}
                />
                <section className="scene-context-box">
                  <h3><MapPin size={16} /> Story Bible</h3>
                  <p>{world.rules.length} reguł świata, {characters.memories.length} notatek wiedzy postaci.</p>
                  <button type="button" className="secondary-button" onClick={() => queueEditorAction("rewriteSelection", "save_as_variant")}>
                    <Sparkles size={16} />
                    Sprawdź spójność
                  </button>
                </section>
                <section className="scene-context-box">
                  <h3>Warianty AI</h3>
                  {variants.map((variant) => (
                    <button type="button" className="scene-variant-item" key={variant.id} onClick={() => editor?.chain().focus().setTextSelection(editor.state.doc.content.size).insertContent(`\n\n${variant.text}`).run()}>
                      <span>{new Date(variant.createdAt).toLocaleString("pl-PL")}</span>
                      <strong>{variant.mode}</strong>
                    </button>
                  ))}
                  {variants.length === 0 ? <p>Brak zapisanych wariantów dla tej sceny.</p> : null}
                </section>
              </aside>
            </div>
          </>
        ) : (
          <section className="scene-empty-workbench">
            <h2>Brak sceny do edycji</h2>
            <p>Dodaj pierwszą scenę z listy rozdziałów, żeby rozpocząć pisanie.</p>
            <button type="button" className="primary-button" onClick={() => createScene(plan.chapters[0] ?? null)}>
              <Plus size={16} />
              Dodaj scenę
            </button>
          </section>
        )}
      </main>
    </div>
  );
}

function SceneRelationPanel({
  title,
  icon,
  items,
  selectedIds,
  onToggle
}: {
  title: string;
  icon: ReactNode;
  items: Array<{ id: string; label: string; description: string }>;
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <section className="scene-context-box">
      <h3>{icon}{title}</h3>
      <div className="scene-context-chip-list">
        {items.map((item) => {
          const selected = selectedIds.includes(item.id);
          return (
            <button
              type="button"
              className={selected ? "scene-context-chip selected" : "scene-context-chip"}
              key={item.id}
              title={item.description || item.label}
              onClick={() => onToggle(item.id)}
            >
              {selected ? "-" : "+"} {item.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function chapterLanes(plan: BookPlan): Array<{ chapter: Chapter | null; scenes: Scene[] }> {
  return [
    ...[...plan.chapters]
      .sort((left, right) => left.orderIndex - right.orderIndex || left.number - right.number)
      .map((chapter) => ({
        chapter,
        scenes: orderedScenes(plan.scenes.filter((scene) => scene.chapterId === chapter.id))
      })),
    {
      chapter: null,
      scenes: orderedScenes(plan.scenes.filter((scene) => !scene.chapterId))
    }
  ];
}

function orderedScenes(scenes: Scene[]): Scene[] {
  return [...scenes].sort((left, right) => left.orderIndex - right.orderIndex || left.title.localeCompare(right.title, "pl-PL"));
}

function sceneToInput(scene: Scene): UpsertSceneInput {
  return {
    id: scene.id,
    bookId: scene.bookId,
    chapterId: scene.chapterId,
    orderIndex: scene.orderIndex,
    title: scene.title,
    summary: scene.summary,
    goal: scene.goal,
    conflict: scene.conflict,
    outcome: scene.outcome,
    povCharacterId: scene.povCharacterId,
    locationId: scene.locationId,
    targetWordCount: scene.targetWordCount,
    actualWordCount: scene.actualWordCount,
    manuscriptContent: scene.manuscriptContent,
    status: scene.status
  };
}

function draftToScene(scene: Scene, draft: UpsertSceneInput): Scene {
  return {
    ...scene,
    chapterId: draft.chapterId ?? null,
    title: draft.title,
    summary: draft.summary,
    goal: draft.goal,
    conflict: draft.conflict,
    outcome: draft.outcome,
    povCharacterId: draft.povCharacterId ?? null,
    locationId: draft.locationId ?? null,
    targetWordCount: draft.targetWordCount ?? null,
    actualWordCount: draft.actualWordCount ?? null,
    manuscriptContent: draft.manuscriptContent ?? "",
    status: draft.status
  };
}

function relationIds<T extends { sceneId: string }>(items: T[], sceneId: string, key: keyof T): string[] {
  return items
    .filter((item) => item.sceneId === sceneId)
    .map((item) => item[key])
    .filter((value) => typeof value === "string") as string[];
}

function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function htmlToText(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ");
}

function selectedTextFromEditor(editor: Editor): string {
  const { from, to, empty } = editor.state.selection;
  return empty ? "" : editor.state.doc.textBetween(from, to, "\n").trim();
}

function parseOptionalInt(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
}

function signature(input: UpsertSceneInput): string {
  return JSON.stringify(input);
}

function createLocalId(): string {
  return "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`;
}

function variantsKey(sceneId: string): string {
  return `storyforge2:scene-variants:${sceneId}`;
}

function loadVariants(sceneId: string): SceneVariant[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(variantsKey(sceneId)) ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter(isSceneVariant) : [];
  } catch {
    return [];
  }
}

function saveVariants(sceneId: string, variants: SceneVariant[]) {
  window.localStorage.setItem(variantsKey(sceneId), JSON.stringify(variants.slice(0, 12)));
}

function isSceneVariant(value: unknown): value is SceneVariant {
  return Boolean(value && typeof value === "object" && "text" in value && "createdAt" in value);
}

function emptyPlan(): BookPlan {
  const now = new Date().toISOString();
  const planVersion = {
    id: "",
    bookId: "",
    name: "Plan główny",
    description: "",
    isActive: true,
    createdAt: now,
    updatedAt: now
  };
  return {
    planVersion,
    planVersions: [planVersion],
    structure: null,
    acts: [],
    beats: [],
    threads: [],
    chapters: [],
    chapterThreads: [],
    chapterBeats: [],
    scenes: [],
    sceneCharacters: [],
    sceneThreads: [],
    sceneWorldElements: [],
    sceneWorldRules: []
  };
}

function emptyCharacterWorkspace(): CharacterWorkspace {
  return { characters: [], relations: [], memories: [], memoryLinks: [], visualAssets: [] };
}

function emptyWorldWorkspace(): WorldWorkspace {
  return {
    elements: [],
    rules: [],
    elementCharacters: [],
    elementThreads: [],
    elementChapters: [],
    elementScenes: [],
    elementRules: [],
    ruleThreads: [],
    ruleChapters: [],
    ruleScenes: [],
    visualAssets: []
  };
}
