import {
  Bot,
  Check,
  ChevronRight,
  Clock3,
  FileText,
  Flag,
  GitBranch,
  LayoutList,
  Loader2,
  Map,
  MoreHorizontal,
  Plus,
  Route,
  Save,
  Sparkles,
  Target,
  Trash2
} from "lucide-react";
import { FormEvent, ReactNode, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteAct,
  deleteBeat,
  deleteChapter,
  deletePlotThread,
  getBookPlan,
  getProject,
  saveStoryStructure,
  upsertAct,
  upsertBeat,
  upsertChapter,
  upsertPlotThread
} from "../../shared/api/commands";
import type {
  Act,
  Beat,
  BookPlan,
  Chapter,
  PlotThread,
  SaveStoryStructureInput,
  UpsertActInput,
  UpsertBeatInput,
  UpsertChapterInput,
  UpsertPlotThreadInput
} from "../../shared/api/types";
import { useProjectNavigationStore } from "../../app/projectNavigationStore";
import {
  buildPlanPromptPackage,
  planFieldConfigs,
  planPromptContextSource,
  PlanFieldKey,
  renderPlanPromptPackage
} from "../ai/planPromptPackage";
import {
  createPlanPromptContextTarget,
  planPromptContextTargetId,
  promptContextControlForActiveTarget,
  useAiPromptContextStore
} from "../ai/aiPromptContextStore";
import {
  ActiveAiProposal,
  pendingProposalStatus,
  useProposalStore
} from "../ai/proposalStore";

type BookPlanPageProps = {
  projectId: string;
};

type PlanStep = "structure" | "acts" | "beats" | "threads" | "chapters";
type PlanMode = "wizard" | "preview";
type SelectedPlanItem =
  | { type: "structure"; id: string }
  | { type: "act"; id: string }
  | { type: "beat"; id: string }
  | { type: "thread"; id: string }
  | { type: "chapter"; id: string };

const planSteps: Array<{ key: PlanStep; label: string; icon: typeof Map }> = [
  { key: "structure", label: "Struktura", icon: Map },
  { key: "acts", label: "Akty", icon: Flag },
  { key: "beats", label: "Beaty", icon: Target },
  { key: "threads", label: "Wątki", icon: GitBranch },
  { key: "chapters", label: "Rozdziały", icon: FileText }
];

const structureOptions = [
  { value: "three_act", label: "Trzy akty" },
  { value: "save_the_cat", label: "Save the Cat" },
  { value: "heros_journey", label: "Hero's Journey" },
  { value: "mystery_outline", label: "Mystery outline" },
  { value: "custom", label: "Custom" }
];

const actColors = ["#3f8f6b", "#4f8fd9", "#8b5cf6", "#f59e42", "#d94f8f"];

export function BookPlanPage({ projectId }: BookPlanPageProps) {
  const queryClient = useQueryClient();
  const activeStep = normalizePlanStep(
    useProjectNavigationStore((state) => state.viewState[projectId]?.planStep)
  );
  const storedMode = useProjectNavigationStore(
    (state) => state.viewState[projectId]?.planMode
  );
  const setProjectViewState = useProjectNavigationStore(
    (state) => state.setProjectViewState
  );
  const enqueueProposal = useProposalStore((state) => state.enqueueProposal);
  const proposals = useProposalStore((state) => state.proposals);
  const setEditableValue = useProposalStore((state) => state.setEditableValue);
  const clearProposal = useProposalStore((state) => state.clearProposal);
  const activatePromptContextTarget = useAiPromptContextStore(
    (state) => state.activateTarget
  );
  const closePromptContextTarget = useAiPromptContextStore(
    (state) => state.closeTarget
  );
  const [selectedItem, setSelectedItem] = useState<SelectedPlanItem | null>(null);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

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
  const plan = planQuery.data ?? emptyPlan();
  const mode: PlanMode =
    storedMode === "preview" && isPlanReady(plan) ? "preview" : "wizard";

  const invalidatePlan = async () => {
    await queryClient.invalidateQueries({ queryKey: ["book-plan", bookId] });
    await queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    await queryClient.invalidateQueries({ queryKey: ["projects"] });
  };

  const structureMutation = useMutation({
    mutationFn: (input: SaveStoryStructureInput) => saveStoryStructure(input),
    onSuccess: async () => {
      setMessage("Zapisano strukturę planu.");
      await invalidatePlan();
    },
    onError: showError
  });
  const actMutation = useMutation({
    mutationFn: (input: UpsertActInput) => upsertAct(input),
    onSuccess: async (act) => {
      setSelectedItem({ type: "act", id: act.id });
      setMessage("Zapisano akt.");
      await invalidatePlan();
    },
    onError: showError
  });
  const beatMutation = useMutation({
    mutationFn: (input: UpsertBeatInput) => upsertBeat(input),
    onSuccess: async (beat) => {
      setSelectedItem({ type: "beat", id: beat.id });
      setMessage("Zapisano beat.");
      await invalidatePlan();
    },
    onError: showError
  });
  const threadMutation = useMutation({
    mutationFn: (input: UpsertPlotThreadInput) => upsertPlotThread(input),
    onSuccess: async (thread) => {
      setSelectedItem({ type: "thread", id: thread.id });
      setMessage("Zapisano wątek.");
      await invalidatePlan();
    },
    onError: showError
  });
  const chapterMutation = useMutation({
    mutationFn: (input: UpsertChapterInput) => upsertChapter(input),
    onSuccess: async (chapter) => {
      setSelectedItem({ type: "chapter", id: chapter.id });
      setMessage("Zapisano rozdział.");
      await invalidatePlan();
    },
    onError: showError
  });
  const deleteMutation = useMutation({
    mutationFn: async (item: SelectedPlanItem) => {
      if (item.type === "act") {
        await deleteAct(item.id);
      }
      if (item.type === "beat") {
        await deleteBeat(item.id);
      }
      if (item.type === "thread") {
        await deletePlotThread(item.id);
      }
      if (item.type === "chapter") {
        await deleteChapter(item.id);
      }
    },
    onSuccess: async () => {
      setSelectedItem(null);
      setMessage("Usunięto element planu.");
      await invalidatePlan();
    },
    onError: showError
  });

  const planProposals = proposals
    .filter((proposal) => proposal.projectId === projectId && proposal.scope === "bookPlan")
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const selectedDetails = selectedItem
    ? selectedItemDetails(selectedItem, plan)
    : null;

  function showError(error: unknown) {
    setErrorMessage(error instanceof Error ? error.message : String(error));
  }

  function selectStep(step: PlanStep) {
    setProjectViewState(projectId, "planStep", step);
    setProjectViewState(projectId, "planMode", "wizard");
  }

  function selectMode(nextMode: PlanMode) {
    setProjectViewState(projectId, "planMode", nextMode);
  }

  function queuePlanGeneration(
    field: PlanFieldKey,
    targetEntity?: Act | Beat | PlotThread | Chapter
  ) {
    setErrorMessage("");
    if (!projectQuery.data || !bookId) {
      setErrorMessage("Brak danych projektu.");
      return;
    }

    const targetId = planPromptContextTargetId(projectId, field, targetEntity?.id);
    const contextControl = promptContextControlForActiveTarget(targetId);
    const usedPromptContext = Boolean(contextControl);
    const promptPackage = buildPlanPromptPackage(
      projectQuery.data.project,
      projectQuery.data.book,
      plan,
      field,
      targetEntity,
      contextControl
    );
    const prompt = renderPlanPromptPackage(promptPackage);

    enqueueProposal({
      scope: "bookPlan",
      projectId,
      bookId,
      field,
      action: promptPackage.action,
      promptPackageId: promptPackage.id,
      promptPackageJson: promptPackage,
      prompt
    });

    if (usedPromptContext) {
      closePromptContextTarget(targetId);
    }
  }

  function activatePlanPromptContext(
    field: PlanFieldKey,
    targetEntity?: Act | Beat | PlotThread | Chapter
  ) {
    const targetId = planPromptContextTargetId(projectId, field, targetEntity?.id);
    const loading = pendingProposalStatus(proposals, {
      projectId,
      bookId,
      field,
      scope: "bookPlan"
    });

    activatePromptContextTarget(
      createPlanPromptContextTarget(projectId, field, targetEntity?.id, {
        submitLabel: "Wyślij do AI",
        submitDisabled: Boolean(loading),
        submitDisabledReason: loading
          ? `Pole "${planFieldConfigs[field].label}" jest już w kolejce AI.`
          : undefined,
        onSubmit: () => queuePlanGeneration(field, targetEntity)
      })
    );
  }

  async function applyProposal(proposal: ActiveAiProposal) {
    try {
      if (!bookId) {
        throw new Error("Brak aktywnej książki.");
      }

      const payload = JSON.parse(proposal.editableValue || proposal.rawOutput);
      await applyPlanPayload(payload, proposal, {
        bookId,
        plan,
        saveStructure: (input) => structureMutation.mutateAsync(input),
        saveAct: (input) => actMutation.mutateAsync(input),
        saveBeat: (input) => beatMutation.mutateAsync(input),
        saveThread: (input) => threadMutation.mutateAsync(input),
        saveChapter: (input) => chapterMutation.mutateAsync(input)
      });
      clearProposal(proposal.id);
      setMessage("Zastosowano propozycję AI do planu.");
      await invalidatePlan();
    } catch (error) {
      showError(error);
    }
  }

  if (projectQuery.isLoading || planQuery.isLoading) {
    return (
      <section className="plan-page">
        <p className="muted-text">Ładuję plan...</p>
      </section>
    );
  }

  if (projectQuery.isError || planQuery.isError || !projectQuery.data || !bookId) {
    return (
      <section className="plan-page">
        <p className="warning-text">Nie można wczytać danych planu.</p>
      </section>
    );
  }

  return (
    <section className="plan-page">
      <header className="plan-page-header">
        <div>
          <p className="eyebrow">Plan powieści</p>
          <h2>Od struktury aktów do rozdziałów</h2>
          <p>
            Prowadź historię krok po kroku, a po ułożeniu rozdziałów przejdź do
            podglądu całej konstrukcji.
          </p>
        </div>
        <div className="plan-header-actions">
          <button
            type="button"
            className={mode === "wizard" ? "secondary-button active" : "ghost-button"}
            onClick={() => selectMode("wizard")}
          >
            <LayoutList size={16} />
            Kreator
          </button>
          <button
            type="button"
            className={mode === "preview" ? "secondary-button active" : "ghost-button"}
            onClick={() => selectMode("preview")}
            disabled={!isPlanReady(plan)}
            title={
              isPlanReady(plan)
                ? "Otwórz podgląd planu."
                : "Dodaj akty i rozdziały, aby odblokować podgląd."
            }
          >
            <Route size={16} />
            Podgląd
          </button>
        </div>
      </header>

      {message ? <p className="success-text">{message}</p> : null}
      {errorMessage ? <p className="warning-text">{errorMessage}</p> : null}

      {planProposals.length > 0 ? (
        <PlanProposalStrip
          proposals={planProposals}
          onApply={applyProposal}
          onChange={setEditableValue}
          onDismiss={clearProposal}
        />
      ) : null}

      {mode === "preview" ? (
        <PlanPreview
          plan={plan}
          selectedItem={selectedItem}
          onSelect={setSelectedItem}
        />
      ) : (
        <div className="plan-workspace">
          <aside className="plan-stepper" aria-label="Kroki planu">
            {planSteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <button
                  type="button"
                  key={step.key}
                  className={activeStep === step.key ? "plan-step active" : "plan-step"}
                  onClick={() => selectStep(step.key)}
                  aria-current={activeStep === step.key ? "step" : undefined}
                >
                  <span>{index + 1}</span>
                  <Icon size={17} />
                  {step.label}
                  <ChevronRight size={15} />
                </button>
              );
            })}
          </aside>

          <div className="plan-builder">
            {activeStep === "structure" ? (
              <StructureStep
                bookId={bookId}
                plan={plan}
                saving={structureMutation.isPending}
                onSave={(input) => structureMutation.mutate(input)}
                onGenerate={(field) => queuePlanGeneration(field)}
                onActivatePrompt={activatePlanPromptContext}
              />
            ) : null}
            {activeStep === "acts" ? (
              <ActsStep
                bookId={bookId}
                plan={plan}
                saving={actMutation.isPending}
                onSave={(input) => actMutation.mutate(input)}
                onDelete={(item) => deleteMutation.mutate(item)}
                onSelect={setSelectedItem}
                onGenerate={queuePlanGeneration}
                onActivatePrompt={activatePlanPromptContext}
              />
            ) : null}
            {activeStep === "beats" ? (
              <BeatsStep
                bookId={bookId}
                plan={plan}
                saving={beatMutation.isPending}
                onSave={(input) => beatMutation.mutate(input)}
                onDelete={(item) => deleteMutation.mutate(item)}
                onSelect={setSelectedItem}
                onGenerate={queuePlanGeneration}
                onActivatePrompt={activatePlanPromptContext}
              />
            ) : null}
            {activeStep === "threads" ? (
              <ThreadsStep
                bookId={bookId}
                plan={plan}
                saving={threadMutation.isPending}
                onSave={(input) => threadMutation.mutate(input)}
                onDelete={(item) => deleteMutation.mutate(item)}
                onSelect={setSelectedItem}
                onGenerate={queuePlanGeneration}
                onActivatePrompt={activatePlanPromptContext}
              />
            ) : null}
            {activeStep === "chapters" ? (
              <ChaptersStep
                bookId={bookId}
                plan={plan}
                saving={chapterMutation.isPending}
                onSave={(input) => chapterMutation.mutate(input)}
                onDelete={(item) => deleteMutation.mutate(item)}
                onSelect={setSelectedItem}
                onGenerate={queuePlanGeneration}
                onActivatePrompt={activatePlanPromptContext}
              />
            ) : null}
          </div>

          <PlanDetailsPanel details={selectedDetails} plan={plan} />
        </div>
      )}
    </section>
  );
}

type StepProps = {
  bookId: string;
  plan: BookPlan;
  saving: boolean;
  onGenerate: (field: PlanFieldKey, targetEntity?: Act | Beat | PlotThread | Chapter) => void;
  onActivatePrompt: (
    field: PlanFieldKey,
    targetEntity?: Act | Beat | PlotThread | Chapter
  ) => void;
};

function StructureStep({
  bookId,
  plan,
  saving,
  onSave,
  onGenerate,
  onActivatePrompt
}: StepProps & {
  onSave: (input: SaveStoryStructureInput) => void;
}) {
  const [structureType, setStructureType] = useState(
    plan.structure?.structureType ?? "three_act"
  );
  const [description, setDescription] = useState(plan.structure?.description ?? "");
  const [notes, setNotes] = useState(plan.structure?.notes ?? "");

  function submit(event: FormEvent) {
    event.preventDefault();
    onSave({
      id: plan.structure?.id,
      bookId,
      structureType,
      description,
      notes,
      status: "draft"
    });
  }

  return (
    <PlanCard
      title="Struktura fabuły"
      icon={<Map size={18} />}
      action={
        <PlanAiActions
          field="storyStructure"
          onGenerate={() => onGenerate("storyStructure")}
          onActivatePrompt={() => onActivatePrompt("storyStructure")}
        />
      }
    >
      <form className="plan-form" onSubmit={submit}>
        <label className="field-label">
          Typ struktury
          <select
            value={structureType}
            onChange={(event) => setStructureType(event.target.value)}
          >
            {structureOptions.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          Opis struktury
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            onFocus={() => onActivatePrompt("storyStructure")}
            rows={5}
          />
        </label>
        <label className="field-label">
          Notatki do planu
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            onFocus={() => onActivatePrompt("storyStructure")}
            rows={4}
          />
        </label>
        <button type="submit" className="primary-button" disabled={saving}>
          <Save size={16} />
          {saving ? "Zapisuję" : "Zapisz strukturę"}
        </button>
      </form>
    </PlanCard>
  );
}

function ActsStep({
  bookId,
  plan,
  saving,
  onSave,
  onDelete,
  onSelect,
  onGenerate,
  onActivatePrompt
}: StepProps & {
  onSave: (input: UpsertActInput) => void;
  onDelete: (item: SelectedPlanItem) => void;
  onSelect: (item: SelectedPlanItem) => void;
}) {
  return (
    <PlanCard
      title="Akty"
      icon={<Flag size={18} />}
      action={
        <PlanAiActions
          field="acts"
          onGenerate={() => onGenerate("acts")}
          onActivatePrompt={() => onActivatePrompt("acts")}
        />
      }
    >
      <div className="plan-grid-list">
        {plan.acts.map((act) => (
          <ActForm
            key={act.id}
            bookId={bookId}
            act={act}
            saving={saving}
            onSave={onSave}
            onDelete={() => onDelete({ type: "act", id: act.id })}
            onSelect={() => onSelect({ type: "act", id: act.id })}
            onGenerate={(field) => onGenerate(field, act)}
            onActivatePrompt={(field) => onActivatePrompt(field, act)}
          />
        ))}
        <ActForm
          bookId={bookId}
          saving={saving}
          orderIndex={plan.acts.length}
          onSave={onSave}
          onDelete={undefined}
          onSelect={undefined}
          onGenerate={onGenerate}
          onActivatePrompt={onActivatePrompt}
        />
      </div>
    </PlanCard>
  );
}

function ActForm({
  bookId,
  act,
  orderIndex = 0,
  saving,
  onSave,
  onDelete,
  onSelect,
  onGenerate,
  onActivatePrompt
}: {
  bookId: string;
  act?: Act;
  orderIndex?: number;
  saving: boolean;
  onSave: (input: UpsertActInput) => void;
  onDelete?: () => void;
  onSelect?: () => void;
  onGenerate: (field: PlanFieldKey, targetEntity?: Act) => void;
  onActivatePrompt: (field: PlanFieldKey, targetEntity?: Act) => void;
}) {
  const [name, setName] = useState(act?.name ?? `Akt ${orderIndex + 1}`);
  const [purpose, setPurpose] = useState(act?.purpose ?? "");
  const [summary, setSummary] = useState(act?.summary ?? "");
  const [startPercent, setStartPercent] = useState(act?.startPercent ?? orderIndex * 25);
  const [endPercent, setEndPercent] = useState(act?.endPercent ?? (orderIndex + 1) * 25);
  const [color, setColor] = useState(act?.color ?? actColors[orderIndex % actColors.length]);

  function submit(event: FormEvent) {
    event.preventDefault();
    onSave({
      id: act?.id,
      bookId,
      name,
      purpose,
      summary,
      startPercent,
      endPercent,
      orderIndex: act?.orderIndex ?? orderIndex,
      color
    });
  }

  return (
    <form className="plan-entity-card" onSubmit={submit}>
      <button
        type="button"
        className="plan-link-title"
        onClick={onSelect}
        disabled={!act}
        aria-label={act ? `Otwórz akt ${act.name}` : "Nowy akt"}
      >
        <span style={{ background: color }} />
        {act ? act.name : "Nowy akt"}
      </button>
      <label className="field-label">
        Nazwa
        <input value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <PlanInlineField
        label="Cel aktu"
        value={purpose}
        rows={3}
        field="actPurpose"
        entity={act}
        onChange={setPurpose}
        onGenerate={onGenerate}
        onActivatePrompt={onActivatePrompt}
      />
      <PlanInlineField
        label="Streszczenie aktu"
        value={summary}
        rows={4}
        field="actSummary"
        entity={act}
        onChange={setSummary}
        onGenerate={onGenerate}
        onActivatePrompt={onActivatePrompt}
      />
      <div className="plan-form-row">
        <label className="field-label">
          Start %
          <input
            type="number"
            min={0}
            max={100}
            value={startPercent}
            onChange={(event) => setStartPercent(Number(event.target.value))}
          />
        </label>
        <label className="field-label">
          Koniec %
          <input
            type="number"
            min={0}
            max={100}
            value={endPercent}
            onChange={(event) => setEndPercent(Number(event.target.value))}
          />
        </label>
        <label className="field-label">
          Kolor
          <input
            type="color"
            value={color}
            onChange={(event) => setColor(event.target.value)}
            aria-label="Kolor aktu"
          />
        </label>
      </div>
      <EntityActions saving={saving} onDelete={onDelete} />
    </form>
  );
}

function BeatsStep({
  bookId,
  plan,
  saving,
  onSave,
  onDelete,
  onSelect,
  onGenerate,
  onActivatePrompt
}: StepProps & {
  onSave: (input: UpsertBeatInput) => void;
  onDelete: (item: SelectedPlanItem) => void;
  onSelect: (item: SelectedPlanItem) => void;
}) {
  return (
    <PlanCard
      title="Beaty"
      icon={<Target size={18} />}
      action={
        <PlanAiActions
          field="beatSheet"
          onGenerate={() => onGenerate("beatSheet")}
          onActivatePrompt={() => onActivatePrompt("beatSheet")}
        />
      }
    >
      <div className="plan-grid-list">
        {plan.beats.map((beat) => (
          <BeatForm
            key={beat.id}
            bookId={bookId}
            beat={beat}
            plan={plan}
            saving={saving}
            onSave={onSave}
            onDelete={() => onDelete({ type: "beat", id: beat.id })}
            onSelect={() => onSelect({ type: "beat", id: beat.id })}
          />
        ))}
        <BeatForm
          bookId={bookId}
          plan={plan}
          saving={saving}
          orderIndex={plan.beats.length}
          onSave={onSave}
        />
      </div>
    </PlanCard>
  );
}

function BeatForm({
  bookId,
  beat,
  plan,
  orderIndex = 0,
  saving,
  onSave,
  onDelete,
  onSelect
}: {
  bookId: string;
  beat?: Beat;
  plan: BookPlan;
  orderIndex?: number;
  saving: boolean;
  onSave: (input: UpsertBeatInput) => void;
  onDelete?: () => void;
  onSelect?: () => void;
}) {
  const beatThreadIds = plan.beatThreads
    .filter((item) => item.beatId === beat?.id)
    .map((item) => item.threadId);
  const [name, setName] = useState(beat?.name ?? `Beat ${orderIndex + 1}`);
  const [description, setDescription] = useState(beat?.description ?? "");
  const [role, setRole] = useState(beat?.role ?? "");
  const [actId, setActId] = useState(beat?.actId ?? plan.acts[0]?.id ?? "");
  const [threadIds, setThreadIds] = useState(beatThreadIds);

  function submit(event: FormEvent) {
    event.preventDefault();
    onSave({
      id: beat?.id,
      bookId,
      actId: actId || null,
      name,
      description,
      role,
      orderIndex: beat?.orderIndex ?? orderIndex,
      threadIds
    });
  }

  return (
    <form className="plan-entity-card" onSubmit={submit}>
      <button
        type="button"
        className="plan-link-title"
        onClick={onSelect}
        disabled={!beat}
        aria-label={beat ? `Otwórz beat ${beat.name}` : "Nowy beat"}
      >
        <Target size={15} />
        {beat ? beat.name : "Nowy beat"}
      </button>
      <label className="field-label">
        Nazwa
        <input value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <label className="field-label">
        Akt
        <select value={actId} onChange={(event) => setActId(event.target.value)}>
          <option value="">Bez aktu</option>
          {plan.acts.map((act) => (
            <option value={act.id} key={act.id}>
              {act.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field-label">
        Rola
        <input value={role} onChange={(event) => setRole(event.target.value)} />
      </label>
      <label className="field-label">
        Opis
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={4}
        />
      </label>
      <RelationPicker
        label="Wątki"
        items={plan.threads}
        selectedIds={threadIds}
        onChange={setThreadIds}
      />
      <EntityActions saving={saving} onDelete={onDelete} />
    </form>
  );
}

function ThreadsStep({
  bookId,
  plan,
  saving,
  onSave,
  onDelete,
  onSelect,
  onGenerate,
  onActivatePrompt
}: StepProps & {
  onSave: (input: UpsertPlotThreadInput) => void;
  onDelete: (item: SelectedPlanItem) => void;
  onSelect: (item: SelectedPlanItem) => void;
}) {
  return (
    <PlanCard
      title="Wątki"
      icon={<GitBranch size={18} />}
      action={
        <PlanAiActions
          field="plotThreads"
          onGenerate={() => onGenerate("plotThreads")}
          onActivatePrompt={() => onActivatePrompt("plotThreads")}
        />
      }
    >
      <div className="plan-grid-list compact">
        {plan.threads.map((thread) => (
          <ThreadForm
            key={thread.id}
            bookId={bookId}
            thread={thread}
            saving={saving}
            onSave={onSave}
            onDelete={() => onDelete({ type: "thread", id: thread.id })}
            onSelect={() => onSelect({ type: "thread", id: thread.id })}
          />
        ))}
        <ThreadForm
          bookId={bookId}
          saving={saving}
          orderIndex={plan.threads.length}
          onSave={onSave}
        />
      </div>
    </PlanCard>
  );
}

function ThreadForm({
  bookId,
  thread,
  orderIndex = 0,
  saving,
  onSave,
  onDelete,
  onSelect
}: {
  bookId: string;
  thread?: PlotThread;
  orderIndex?: number;
  saving: boolean;
  onSave: (input: UpsertPlotThreadInput) => void;
  onDelete?: () => void;
  onSelect?: () => void;
}) {
  const [name, setName] = useState(thread?.name ?? `Wątek ${orderIndex + 1}`);
  const [description, setDescription] = useState(thread?.description ?? "");
  const [color, setColor] = useState(thread?.color ?? actColors[orderIndex % actColors.length]);
  const [status, setStatus] = useState(thread?.status ?? "planned");

  function submit(event: FormEvent) {
    event.preventDefault();
    onSave({
      id: thread?.id,
      bookId,
      name,
      description,
      color,
      status,
      orderIndex: thread?.orderIndex ?? orderIndex
    });
  }

  return (
    <form className="plan-entity-card" onSubmit={submit}>
      <button
        type="button"
        className="plan-link-title"
        onClick={onSelect}
        disabled={!thread}
        aria-label={thread ? `Otwórz wątek ${thread.name}` : "Nowy wątek"}
      >
        <span style={{ background: color }} />
        {thread ? thread.name : "Nowy wątek"}
      </button>
      <label className="field-label">
        Nazwa
        <input value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <label className="field-label">
        Opis
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={4}
        />
      </label>
      <div className="plan-form-row">
        <label className="field-label">
          Status
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="planned">Planowany</option>
            <option value="active">Aktywny</option>
            <option value="resolved">Domknięty</option>
          </select>
        </label>
        <label className="field-label">
          Kolor
          <input
            type="color"
            value={color}
            onChange={(event) => setColor(event.target.value)}
          />
        </label>
      </div>
      <EntityActions saving={saving} onDelete={onDelete} />
    </form>
  );
}

function ChaptersStep({
  bookId,
  plan,
  saving,
  onSave,
  onDelete,
  onSelect,
  onGenerate,
  onActivatePrompt
}: StepProps & {
  onSave: (input: UpsertChapterInput) => void;
  onDelete: (item: SelectedPlanItem) => void;
  onSelect: (item: SelectedPlanItem) => void;
}) {
  return (
    <PlanCard
      title="Rozdziały"
      icon={<FileText size={18} />}
      action={
        <PlanAiActions
          field="chapterPlan"
          onGenerate={() => onGenerate("chapterPlan")}
          onActivatePrompt={() => onActivatePrompt("chapterPlan")}
        />
      }
    >
      <div className="plan-grid-list">
        {plan.chapters.map((chapter) => (
          <ChapterForm
            key={chapter.id}
            bookId={bookId}
            chapter={chapter}
            plan={plan}
            saving={saving}
            onSave={onSave}
            onDelete={() => onDelete({ type: "chapter", id: chapter.id })}
            onSelect={() => onSelect({ type: "chapter", id: chapter.id })}
            onGenerate={(field) => onGenerate(field, chapter)}
            onActivatePrompt={(field) => onActivatePrompt(field, chapter)}
          />
        ))}
        <ChapterForm
          bookId={bookId}
          plan={plan}
          saving={saving}
          orderIndex={plan.chapters.length}
          onSave={onSave}
          onGenerate={onGenerate}
          onActivatePrompt={onActivatePrompt}
        />
      </div>
    </PlanCard>
  );
}

function ChapterForm({
  bookId,
  chapter,
  plan,
  orderIndex = 0,
  saving,
  onSave,
  onDelete,
  onSelect,
  onGenerate,
  onActivatePrompt
}: {
  bookId: string;
  chapter?: Chapter;
  plan: BookPlan;
  orderIndex?: number;
  saving: boolean;
  onSave: (input: UpsertChapterInput) => void;
  onDelete?: () => void;
  onSelect?: () => void;
  onGenerate: (field: PlanFieldKey, targetEntity?: Chapter) => void;
  onActivatePrompt: (field: PlanFieldKey, targetEntity?: Chapter) => void;
}) {
  const chapterThreadIds = plan.chapterThreads
    .filter((item) => item.chapterId === chapter?.id)
    .map((item) => item.threadId);
  const chapterBeatIds = plan.chapterBeats
    .filter((item) => item.chapterId === chapter?.id)
    .map((item) => item.beatId);
  const [number, setNumber] = useState(chapter?.number ?? orderIndex + 1);
  const [workingTitle, setWorkingTitle] = useState(
    chapter?.workingTitle ?? `Rozdział ${orderIndex + 1}`
  );
  const [summary, setSummary] = useState(chapter?.summary ?? "");
  const [purpose, setPurpose] = useState(chapter?.purpose ?? "");
  const [conflict, setConflict] = useState(chapter?.conflict ?? "");
  const [turningPoint, setTurningPoint] = useState(chapter?.turningPoint ?? "");
  const [targetWordCount, setTargetWordCount] = useState(
    chapter?.targetWordCount?.toString() ?? ""
  );
  const [actId, setActId] = useState(chapter?.actId ?? plan.acts[0]?.id ?? "");
  const [threadIds, setThreadIds] = useState(chapterThreadIds);
  const [beatIds, setBeatIds] = useState(chapterBeatIds);

  function submit(event: FormEvent) {
    event.preventDefault();
    onSave({
      id: chapter?.id,
      bookId,
      actId: actId || null,
      number,
      workingTitle,
      summary,
      purpose,
      conflict,
      turningPoint,
      targetWordCount: parseOptionalPositiveInt(targetWordCount),
      orderIndex: chapter?.orderIndex ?? orderIndex,
      threadIds,
      beatIds
    });
  }

  return (
    <form className="plan-entity-card chapter" onSubmit={submit}>
      <button
        type="button"
        className="plan-link-title"
        onClick={onSelect}
        disabled={!chapter}
        aria-label={chapter ? `Otwórz rozdział ${chapter.workingTitle}` : "Nowy rozdział"}
      >
        <FileText size={15} />
        {chapter ? `Rozdział ${chapter.number}` : "Nowy rozdział"}
      </button>
      <div className="plan-form-row">
        <label className="field-label">
          Numer
          <input
            type="number"
            min={1}
            value={number}
            onChange={(event) => setNumber(Number(event.target.value))}
          />
        </label>
        <label className="field-label">
          Akt
          <select value={actId} onChange={(event) => setActId(event.target.value)}>
            <option value="">Bez aktu</option>
            {plan.acts.map((act) => (
              <option value={act.id} key={act.id}>
                {act.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="field-label">
        Tytuł roboczy
        <input
          value={workingTitle}
          onChange={(event) => setWorkingTitle(event.target.value)}
        />
      </label>
      <PlanInlineField
        label="Streszczenie"
        value={summary}
        rows={4}
        field="chapterSummary"
        entity={chapter}
        onChange={setSummary}
        onGenerate={onGenerate}
        onActivatePrompt={onActivatePrompt}
      />
      <PlanInlineField
        label="Cel"
        value={purpose}
        rows={3}
        field="chapterPurpose"
        entity={chapter}
        onChange={setPurpose}
        onGenerate={onGenerate}
        onActivatePrompt={onActivatePrompt}
      />
      <PlanInlineField
        label="Konflikt"
        value={conflict}
        rows={3}
        field="chapterConflict"
        entity={chapter}
        onChange={setConflict}
        onGenerate={onGenerate}
        onActivatePrompt={onActivatePrompt}
      />
      <PlanInlineField
        label="Punkt zwrotny"
        value={turningPoint}
        rows={3}
        field="chapterTurningPoint"
        entity={chapter}
        onChange={setTurningPoint}
        onGenerate={onGenerate}
        onActivatePrompt={onActivatePrompt}
      />
      <label className="field-label">
        Target word count
        <input
          value={targetWordCount}
          onChange={(event) => setTargetWordCount(event.target.value)}
        />
      </label>
      <RelationPicker
        label="Beaty"
        items={plan.beats}
        selectedIds={beatIds}
        onChange={setBeatIds}
      />
      <RelationPicker
        label="Wątki"
        items={plan.threads}
        selectedIds={threadIds}
        onChange={setThreadIds}
      />
      <EntityActions saving={saving} onDelete={onDelete} />
    </form>
  );
}

function PlanInlineField<T extends Act | Chapter | undefined>({
  label,
  value,
  rows,
  field,
  entity,
  onChange,
  onGenerate,
  onActivatePrompt
}: {
  label: string;
  value: string;
  rows: number;
  field: PlanFieldKey;
  entity: T;
  onChange: (value: string) => void;
  onGenerate: (field: PlanFieldKey, targetEntity?: NonNullable<T>) => void;
  onActivatePrompt: (field: PlanFieldKey, targetEntity?: NonNullable<T>) => void;
}) {
  return (
    <label className="field-label plan-inline-field">
      <span className="plan-inline-label-row">
        {label}
        <PlanAiActions
          field={field}
          targetEntity={entity}
          onGenerate={() => onGenerate(field, entity as NonNullable<T>)}
          onActivatePrompt={() => onActivatePrompt(field, entity as NonNullable<T>)}
        />
      </span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => onActivatePrompt(field, entity as NonNullable<T>)}
        rows={rows}
      />
    </label>
  );
}

function PlanAiActions({
  field,
  targetEntity,
  onGenerate,
  onActivatePrompt
}: {
  field: PlanFieldKey;
  targetEntity?: Act | Beat | PlotThread | Chapter;
  onGenerate: () => void;
  onActivatePrompt: () => void;
}) {
  const activeTargetId = useAiPromptContextStore((state) => state.activeTargetId);
  const activeTarget = useAiPromptContextStore((state) =>
    activeTargetId ? state.targets[activeTargetId] : null
  );
  const addContextSourceToActiveTarget = useAiPromptContextStore(
    (state) => state.addContextSourceToActiveTarget
  );
  const proposals = useProposalStore((state) => state.proposals);
  const loading = pendingProposalStatus(proposals, {
    field,
    scope: "bookPlan"
  });
  const running = loading === "running";
  const queued = loading === "queued";
  const fieldAlreadyInContext = Boolean(
    activeTarget?.sources.some((source) => source.key === field)
  );

  return (
    <span className="ai-field-actions plan-ai-actions">
      <button
        type="button"
        className="icon-button ai-field-button"
        onClick={onGenerate}
        disabled={queued || running || (targetEntity === undefined && isEntityField(field))}
        title={`Generuj ${planFieldConfigs[field].label} z AI`}
        aria-label={`Generuj ${planFieldConfigs[field].label} z AI`}
      >
        {running ? (
          <Loader2 size={15} className="spin-icon" />
        ) : queued ? (
          <Clock3 size={15} />
        ) : (
          <Sparkles size={15} />
        )}
        <span>{running ? "Generuje" : queued ? "W kolejce" : "AI"}</span>
      </button>
      <button
        type="button"
        className="icon-button ai-context-add-button"
        onClick={(event) => {
          event.stopPropagation();
          addContextSourceToActiveTarget(planPromptContextSource(field));
        }}
        onFocus={onActivatePrompt}
        disabled={!activeTarget || fieldAlreadyInContext}
        title="Dodaj pole planu do aktywnego kontekstu promptu."
        aria-label={`Dodaj ${planFieldConfigs[field].label} do kontekstu promptu`}
      >
        <Plus size={14} />
      </button>
    </span>
  );
}

function PlanProposalStrip({
  proposals,
  onApply,
  onChange,
  onDismiss
}: {
  proposals: ActiveAiProposal[];
  onApply: (proposal: ActiveAiProposal) => void;
  onChange: (id: string, value: string) => void;
  onDismiss: (id: string) => void;
}) {
  return (
    <section className="plan-proposal-strip" aria-label="Propozycje AI planu">
      <div className="section-title-row">
        <div>
          <p className="eyebrow">AI</p>
          <h3>Propozycje do planu</h3>
        </div>
        <Bot size={18} />
      </div>
      {proposals.map((proposal) => (
        <article className="plan-proposal-card" key={proposal.id}>
          <div className="plan-proposal-heading">
            <strong>
              {planFieldConfigs[proposal.field as PlanFieldKey]?.label ?? "Plan"}
            </strong>
            <span className={proposal.status === "success" ? "status-pill ready" : "status-pill"}>
              {proposal.status === "running" ? "Generuje" : proposal.status === "queued" ? "W kolejce" : proposal.status === "success" ? "Gotowe" : "Błąd"}
            </span>
          </div>
          {proposal.status === "success" ? (
            <textarea
              value={proposal.editableValue}
              onChange={(event) => onChange(proposal.id, event.target.value)}
              rows={8}
              aria-label="Edytuj propozycję planu przed zastosowaniem"
            />
          ) : (
            <p className="muted-text">
              {proposal.errorMessage || "Propozycja jest jeszcze przetwarzana."}
            </p>
          )}
          <div className="button-row">
            <button
              type="button"
              className="primary-button"
              onClick={() => onApply(proposal)}
              disabled={proposal.status !== "success"}
            >
              <Check size={16} />
              Zastosuj
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={() => onDismiss(proposal.id)}
              disabled={proposal.status === "running"}
            >
              Odrzuć
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}

function PlanPreview({
  plan,
  selectedItem,
  onSelect
}: {
  plan: BookPlan;
  selectedItem: SelectedPlanItem | null;
  onSelect: (item: SelectedPlanItem) => void;
}) {
  const totalWords = plan.chapters.reduce(
    (sum, chapter) => sum + (chapter.targetWordCount ?? 0),
    0
  );

  return (
    <div className="plan-preview-layout">
      <div className="plan-preview-main">
        <section className="plan-preview-section">
          <div className="section-title-row">
            <div>
              <p className="eyebrow">Akty i rozdziały</p>
              <h3>Mapa fabuły</h3>
            </div>
            <MoreHorizontal size={18} />
          </div>
          <div className="act-timeline">
            {plan.acts.map((act) => (
              <button
                type="button"
                key={act.id}
                className={
                  selectedItem?.type === "act" && selectedItem.id === act.id
                    ? "act-timeline-card active"
                    : "act-timeline-card"
                }
                onClick={() => onSelect({ type: "act", id: act.id })}
                aria-label={`Otwórz akt ${act.name}`}
              >
                <span style={{ background: act.color }} />
                <strong>{act.name}</strong>
                <small>{act.startPercent} - {act.endPercent}% fabuły</small>
                <em>{chaptersForAct(plan, act.id).length} rozdz.</em>
              </button>
            ))}
          </div>
        </section>

        <section className="plan-preview-section">
          {plan.acts.map((act) => (
            <div className="act-chapter-band" key={act.id}>
              <button
                type="button"
                className="act-band-heading"
                onClick={() => onSelect({ type: "act", id: act.id })}
                aria-label={`Otwórz akt ${act.name}`}
              >
                <span style={{ background: act.color }} />
                <strong>{act.name}</strong>
                <small>{act.purpose || "Bez celu aktu"}</small>
              </button>
              <div className="chapter-card-row">
                {chaptersForAct(plan, act.id).map((chapter) => (
                  <button
                    type="button"
                    key={chapter.id}
                    className="chapter-preview-card"
                    onClick={() => onSelect({ type: "chapter", id: chapter.id })}
                    aria-label={`Otwórz rozdział ${chapter.workingTitle}`}
                  >
                    <span>Rozdział {chapter.number}</span>
                    <strong>{chapter.workingTitle}</strong>
                    <small>{chapter.targetWordCount ?? 0} słów</small>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>

        <section className="plan-preview-section thread-map">
          <div className="section-title-row">
            <div>
              <p className="eyebrow">Wątki fabularne</p>
              <h3>Przebieg przez rozdziały</h3>
            </div>
          </div>
          {plan.threads.map((thread) => (
            <div className="thread-map-row" key={thread.id}>
              <button
                type="button"
                className="thread-map-label"
                onClick={() => onSelect({ type: "thread", id: thread.id })}
                aria-label={`Otwórz wątek ${thread.name}`}
              >
                <span style={{ background: thread.color }} />
                {thread.name}
              </button>
              <div className="thread-map-line">
                {plan.chapters.map((chapter) => {
                  const linked = plan.chapterThreads.some(
                    (item) => item.chapterId === chapter.id && item.threadId === thread.id
                  );
                  return (
                    <button
                      type="button"
                      key={chapter.id}
                      className={linked ? "thread-node linked" : "thread-node"}
                      onClick={() => onSelect({ type: "chapter", id: chapter.id })}
                      aria-label={`${thread.name} w rozdziale ${chapter.number}`}
                      title={chapter.workingTitle}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      </div>

      <aside className="plan-preview-sidebar">
        <PlanStat icon={<Flag size={18} />} value={plan.acts.length} label="Akty" />
        <PlanStat icon={<FileText size={18} />} value={plan.chapters.length} label="Rozdziały" />
        <PlanStat icon={<GitBranch size={18} />} value={plan.threads.length} label="Wątki" />
        <PlanStat icon={<Target size={18} />} value={totalWords} label="Słów planowanych" />
        <PlanDetailsPanel details={selectedItemDetails(selectedItem, plan)} plan={plan} compact />
      </aside>
    </div>
  );
}

function PlanDetailsPanel({
  details,
  plan,
  compact = false
}: {
  details: ReturnType<typeof selectedItemDetails>;
  plan: BookPlan;
  compact?: boolean;
}) {
  return (
    <aside className={compact ? "plan-details-panel compact" : "plan-details-panel"}>
      <div className="section-title-row">
        <div>
          <p className="eyebrow">Szczegóły</p>
          <h3>{details?.title ?? "Wybierz element"}</h3>
        </div>
      </div>
      {details ? (
        <>
          <p>{details.description || "Ten element nie ma jeszcze opisu."}</p>
          {details.meta.length > 0 ? (
            <dl>
              {details.meta.map((item) => (
                <div key={item.label}>
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </>
      ) : (
        <p className="muted-text">
          Kliknij akt, beat, wątek albo rozdział, aby zobaczyć przypisania i
          kontekst.
        </p>
      )}
      {!compact ? (
        <div className="plan-mini-summary">
          <span>{plan.acts.length} aktów</span>
          <span>{plan.beats.length} beatów</span>
          <span>{plan.threads.length} wątków</span>
          <span>{plan.chapters.length} rozdziałów</span>
        </div>
      ) : null}
    </aside>
  );
}

function RelationPicker<T extends { id: string; name?: string; workingTitle?: string }>({
  label,
  items,
  selectedIds,
  onChange
}: {
  label: string;
  items: T[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <fieldset className="relation-picker">
      <legend>{label}</legend>
      {items.length === 0 ? <p className="muted-text">Brak elementów.</p> : null}
      {items.map((item) => {
        const selected = selectedIds.includes(item.id);
        return (
          <label key={item.id}>
            <input
              type="checkbox"
              checked={selected}
              onChange={() =>
                onChange(
                  selected
                    ? selectedIds.filter((id) => id !== item.id)
                    : [...selectedIds, item.id]
                )
              }
            />
            <span>{item.name ?? item.workingTitle}</span>
          </label>
        );
      })}
    </fieldset>
  );
}

function EntityActions({
  saving,
  onDelete
}: {
  saving: boolean;
  onDelete?: () => void;
}) {
  return (
    <div className="button-row">
      <button type="submit" className="primary-button" disabled={saving}>
        <Save size={16} />
        {saving ? "Zapisuję" : "Zapisz"}
      </button>
      {onDelete ? (
        <button type="button" className="ghost-button" onClick={onDelete}>
          <Trash2 size={16} />
          Usuń
        </button>
      ) : null}
    </div>
  );
}

function PlanCard({
  title,
  icon,
  action,
  children
}: {
  title: string;
  icon: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="plan-card">
      <div className="section-title-row">
        <div className="plan-card-title">
          {icon}
          <h3>{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function PlanStat({
  icon,
  value,
  label
}: {
  icon: ReactNode;
  value: number;
  label: string;
}) {
  return (
    <div className="plan-stat">
      {icon}
      <strong>{value.toLocaleString("pl-PL")}</strong>
      <span>{label}</span>
    </div>
  );
}

type ApplyPlanContext = {
  bookId: string;
  plan: BookPlan;
  saveStructure: (input: SaveStoryStructureInput) => Promise<unknown>;
  saveAct: (input: UpsertActInput) => Promise<unknown>;
  saveBeat: (input: UpsertBeatInput) => Promise<unknown>;
  saveThread: (input: UpsertPlotThreadInput) => Promise<unknown>;
  saveChapter: (input: UpsertChapterInput) => Promise<unknown>;
};

async function applyPlanPayload(
  payload: unknown,
  proposal: ActiveAiProposal,
  context: ApplyPlanContext
) {
  const record = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const packageContext = "context" in proposal.promptPackageJson
    ? proposal.promptPackageJson.context
    : undefined;

  if (record.structure && typeof record.structure === "object") {
    const structure = record.structure as Record<string, unknown>;
    await context.saveStructure({
      id: context.plan.structure?.id,
      bookId: context.bookId,
      structureType: textValue(structure.structureType) || "custom",
      description: textValue(structure.description),
      notes: textValue(structure.notes),
      status: "draft"
    });
  }

  if (Array.isArray(record.acts)) {
    for (const [index, item] of record.acts.entries()) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const act = item as Record<string, unknown>;
      await context.saveAct({
        bookId: context.bookId,
        name: textValue(act.name) || `Akt ${index + 1}`,
        purpose: textValue(act.purpose),
        summary: textValue(act.summary),
        startPercent: numberValue(act.startPercent, index * 25),
        endPercent: numberValue(act.endPercent, (index + 1) * 25),
        color: textValue(act.color) || actColors[index % actColors.length],
        orderIndex: context.plan.acts.length + index
      });
    }
  }

  if (Array.isArray(record.threads)) {
    for (const [index, item] of record.threads.entries()) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const thread = item as Record<string, unknown>;
      await context.saveThread({
        bookId: context.bookId,
        name: textValue(thread.name) || `Wątek ${index + 1}`,
        description: textValue(thread.description),
        color: textValue(thread.color) || actColors[index % actColors.length],
        status: textValue(thread.status) || "planned",
        orderIndex: context.plan.threads.length + index
      });
    }
  }

  if (Array.isArray(record.beats)) {
    for (const [index, item] of record.beats.entries()) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const beat = item as Record<string, unknown>;
      const actId = findByNameOrId(context.plan.acts, textValue(beat.actNameOrId))?.id ?? null;
      await context.saveBeat({
        bookId: context.bookId,
        actId,
        name: textValue(beat.name) || `Beat ${index + 1}`,
        description: textValue(beat.description),
        role: textValue(beat.role),
        threadIds: namesToIds(context.plan.threads, beat.threadNamesOrIds),
        orderIndex: context.plan.beats.length + index
      });
    }
  }

  if (Array.isArray(record.chapters)) {
    for (const [index, item] of record.chapters.entries()) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const chapter = item as Record<string, unknown>;
      const actId = findByNameOrId(context.plan.acts, textValue(chapter.actNameOrId))?.id ?? null;
      await context.saveChapter({
        bookId: context.bookId,
        actId,
        number: numberValue(chapter.number, context.plan.chapters.length + index + 1),
        workingTitle: textValue(chapter.workingTitle) || `Rozdział ${index + 1}`,
        summary: textValue(chapter.summary),
        purpose: textValue(chapter.purpose),
        conflict: textValue(chapter.conflict),
        turningPoint: textValue(chapter.turningPoint),
        targetWordCount: numberValue(chapter.targetWordCount, 0) || null,
        threadIds: namesToIds(context.plan.threads, chapter.threadNamesOrIds),
        beatIds: namesToIds(context.plan.beats, chapter.beatNamesOrIds),
        orderIndex: context.plan.chapters.length + index
      });
    }
  }

  if (typeof record.value === "string" && packageContext && typeof packageContext === "object") {
    await applySingleField(record.value, packageContext as Record<string, unknown>, context);
  }
}

async function applySingleField(
  value: string,
  packageContext: Record<string, unknown>,
  context: ApplyPlanContext
) {
  const targetField = textValue(packageContext.targetField) as PlanFieldKey;
  const targetEntityId = textValue(packageContext.targetEntityId);
  if (!targetEntityId) {
    return;
  }

  const act = context.plan.acts.find((item) => item.id === targetEntityId);
  if (act && (targetField === "actPurpose" || targetField === "actSummary")) {
    await context.saveAct({
      ...act,
      purpose: targetField === "actPurpose" ? value : act.purpose,
      summary: targetField === "actSummary" ? value : act.summary
    });
  }

  const chapter = context.plan.chapters.find((item) => item.id === targetEntityId);
  if (
    chapter &&
    ["chapterSummary", "chapterPurpose", "chapterConflict", "chapterTurningPoint"].includes(
      targetField
    )
  ) {
    await context.saveChapter({
      ...chapter,
      summary: targetField === "chapterSummary" ? value : chapter.summary,
      purpose: targetField === "chapterPurpose" ? value : chapter.purpose,
      conflict: targetField === "chapterConflict" ? value : chapter.conflict,
      turningPoint:
        targetField === "chapterTurningPoint" ? value : chapter.turningPoint,
      threadIds: context.plan.chapterThreads
        .filter((item) => item.chapterId === chapter.id)
        .map((item) => item.threadId),
      beatIds: context.plan.chapterBeats
        .filter((item) => item.chapterId === chapter.id)
        .map((item) => item.beatId)
    });
  }
}

function selectedItemDetails(item: SelectedPlanItem | null, plan: BookPlan) {
  if (!item) {
    return null;
  }

  if (item.type === "act") {
    const act = plan.acts.find((candidate) => candidate.id === item.id);
    return act
      ? {
          title: act.name,
          description: act.summary || act.purpose,
          meta: [
            { label: "Zakres", value: `${act.startPercent} - ${act.endPercent}%` },
            { label: "Rozdziały", value: String(chaptersForAct(plan, act.id).length) }
          ]
        }
      : null;
  }

  if (item.type === "beat") {
    const beat = plan.beats.find((candidate) => candidate.id === item.id);
    return beat
      ? {
          title: beat.name,
          description: beat.description,
          meta: [
            { label: "Rola", value: beat.role || "Brak" },
            { label: "Akt", value: plan.acts.find((act) => act.id === beat.actId)?.name ?? "Brak" }
          ]
        }
      : null;
  }

  if (item.type === "thread") {
    const thread = plan.threads.find((candidate) => candidate.id === item.id);
    return thread
      ? {
          title: thread.name,
          description: thread.description,
          meta: [
            { label: "Status", value: thread.status },
            {
              label: "Rozdziały",
              value: String(
                plan.chapterThreads.filter((relation) => relation.threadId === thread.id)
                  .length
              )
            }
          ]
        }
      : null;
  }

  if (item.type === "chapter") {
    const chapter = plan.chapters.find((candidate) => candidate.id === item.id);
    return chapter
      ? {
          title: `Rozdział ${chapter.number}: ${chapter.workingTitle}`,
          description: chapter.summary || chapter.purpose,
          meta: [
            { label: "Akt", value: plan.acts.find((act) => act.id === chapter.actId)?.name ?? "Brak" },
            { label: "Konflikt", value: chapter.conflict || "Brak" },
            { label: "Punkt zwrotny", value: chapter.turningPoint || "Brak" }
          ]
        }
      : null;
  }

  return null;
}

function chaptersForAct(plan: BookPlan, actId: string): Chapter[] {
  return plan.chapters.filter((chapter) => chapter.actId === actId);
}

function emptyPlan(): BookPlan {
  return {
    structure: null,
    acts: [],
    beats: [],
    threads: [],
    chapters: [],
    chapterThreads: [],
    beatThreads: [],
    chapterBeats: []
  };
}

function isPlanReady(plan: BookPlan): boolean {
  return plan.acts.length > 0 && plan.chapters.length > 0;
}

function normalizePlanStep(value: string | undefined): PlanStep {
  return planSteps.some((step) => step.key === value)
    ? (value as PlanStep)
    : "structure";
}

function isEntityField(field: PlanFieldKey): boolean {
  return [
    "actPurpose",
    "actSummary",
    "chapterSummary",
    "chapterPurpose",
    "chapterConflict",
    "chapterTurningPoint"
  ].includes(field);
}

function parseOptionalPositiveInt(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed.replace(/\s+/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function textValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function namesToIds<T extends { id: string; name?: string; workingTitle?: string }>(
  items: T[],
  value: unknown
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => findByNameOrId(items, textValue(item))?.id)
    .filter((id): id is string => Boolean(id));
}

function findByNameOrId<T extends { id: string; name?: string; workingTitle?: string }>(
  items: T[],
  value: string
): T | undefined {
  const normalized = value.toLowerCase();
  return items.find((item) => {
    const label = (item.name ?? item.workingTitle ?? "").toLowerCase();
    return item.id === value || label === normalized;
  });
}
