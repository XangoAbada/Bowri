import { Image as ImageIcon, Loader2, Plus, Save, Sparkles, X } from "lucide-react";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import {
  checkCodexCli,
  generateBookCover,
  getProject,
  runCodexPrompt,
  updateBookConcept
} from "../../shared/api/commands";
import { isTauriRuntime } from "../../shared/api/browserDevCommands";
import type {
  BookConceptInput,
  CoverGenerationProgressEvent
} from "../../shared/api/types";
import { coverImageSource } from "../../shared/api/assets";
import {
  editableFieldsFromParsed,
  parseProposalResult,
  selectedFieldsFromParsed
} from "../ai/AiProposalPanel";
import {
  buildBookCoverPromptPackage,
  renderBookCoverPromptPackage
} from "../ai/coverPromptPackage";
import {
  buildConceptFieldPromptPackage,
  conceptFieldConfigs,
  ConceptFieldKey,
  renderPromptPackage
} from "../ai/promptPackage";
import { useCodexSettingsStore } from "../ai/codexSettingsStore";
import { useProposalStore } from "../ai/proposalStore";

type BookConceptPageProps = {
  projectId: string;
};

type ConceptForm = {
  title: string;
  workingTitle: string;
  premise: string;
  expandedPremise: string;
  logline: string;
  centralConflict: string;
  stakes: string;
  genre: string;
  subgenre: string;
  targetAudience: string;
  tone: string;
  pointOfView: string;
  targetWordCount: string;
  themesJson: string;
  unwantedThemes: string;
  alternativeTitlesJson: string;
  titleChoiceNote: string;
  styleGuide: string;
};

type ChoiceOption = {
  value: string;
  hint: string;
};

const emptyForm: ConceptForm = {
  title: "",
  workingTitle: "",
  premise: "",
  expandedPremise: "",
  logline: "",
  centralConflict: "",
  stakes: "",
  genre: "",
  subgenre: "",
  targetAudience: "",
  tone: "",
  pointOfView: "",
  targetWordCount: "",
  themesJson: "",
  unwantedThemes: "",
  alternativeTitlesJson: "",
  titleChoiceNote: "",
  styleGuide: ""
};

const fieldHints: Record<ConceptFieldKey, string> = {
  title: "Tytul finalny jest kandydatem do okladki i eksportu.",
  workingTitle: "Tytul roboczy pomaga szybko rozpoznac projekt.",
  premise: "Premise to 1-2 zdania o bohaterze, konflikcie i stawce.",
  expandedPremise: "Rozszerzona premisa trzyma rdzen historii w jednym akapicie.",
  logline: "Logline pokazuje bohatera, cel, przeszkode i stawke w jednym zdaniu.",
  centralConflict: "Konflikt centralny opisuje glowne tarcie napedzajace fabule.",
  stakes: "Stawki mowia, co zostanie utracone, jesli bohater przegra.",
  genre: "Gatunek ustawia konwencje i oczekiwania czytelnika.",
  subgenre: "Podgatunek doprecyzowuje obietnice bez blokowania hybryd.",
  targetAudience: "Odbiorcy steruja jezykiem, tempem i poziomem mroku.",
  tone: "Ton pilnuje nastroju scen i propozycji.",
  pointOfView: "Punkt widzenia pomaga utrzymac spojna narracje scen.",
  targetWordCount: "Docelowa liczba slow pomaga planowac rozdzialy i tempo.",
  themesJson: "Tematy zapisuj jako krotkie etykiety oddzielone przecinkami.",
  unwantedThemes: "Granice i tematy niechciane ograniczaja pozniejsze prompty.",
  alternativeTitlesJson: "Alternatywne tytuly zapisuj jako liste oddzielona przecinkami.",
  titleChoiceNote: "Notatka wyboru tytulu przechowuje powod decyzji autora.",
  styleGuide: "Style guide zbiera preferencje jezyka, rytmu i zakazy."
};

const genreOptions: ChoiceOption[] = [
  { value: "fantasy", hint: "Magia, reguly swiata, obietnica niezwyklosci." },
  { value: "kryminal", hint: "Zagadka, tropy, sledztwo i ujawnianie prawdy." },
  { value: "obyczajowa", hint: "Relacje, codziennosc i emocjonalna przemiana." },
  { value: "thriller", hint: "Presja czasu, zagrozenie i wysokie napiecie." },
  { value: "horror", hint: "Lek, niepewnosc i narastajace poczucie grozy." },
  { value: "science fiction", hint: "Technologia, spekulacja i konsekwencje idei." },
  { value: "romans", hint: "Relacja uczuciowa jako glowna os napiecia." },
  { value: "realizm magiczny", hint: "Niezwyklosc traktowana jak codziennosc." }
];

const subgenreOptions: ChoiceOption[] = [
  { value: "dark academia", hint: "Sekrety, instytucje i intelektualny mrok." },
  { value: "cozy mystery", hint: "Zagadka bez brutalnosci na pierwszym planie." },
  { value: "urban fantasy", hint: "Niezwyklosc wpisana we wspolczesne miasto." },
  { value: "space opera", hint: "Szeroka skala, przygoda i konflikt systemow." },
  { value: "slow burn romance", hint: "Relacja budowana przez dluzsze napiecie." }
];

const audienceOptions: ChoiceOption[] = [
  { value: "adult", hint: "Dorosly czytelnik, wieksza zlozonosc i tematy." },
  { value: "YA", hint: "Mlodzi dorosli, szybkie tempo i silna identyfikacja." },
  { value: "new adult", hint: "Wejscie w doroslosc, relacje i niezaleznosc." },
  { value: "middle grade", hint: "Mlodsi czytelnicy, przygoda i klarowny konflikt." },
  { value: "dzieci", hint: "Prostszy jezyk, bezpieczniejsze tematy i wyrazny rytm." },
  { value: "fani kryminalu", hint: "Czytelnicy oczekujacy tropow, zwrotow i fair play." },
  { value: "fani fantasy", hint: "Czytelnicy lubiacy swiat, mitologie i konsekwencje magii." }
];

const toneOptions: ChoiceOption[] = [
  { value: "mroczny", hint: "Ciezszy nastroj, tajemnica i moralne koszty." },
  { value: "cieply", hint: "Bliskosc, nadzieja i empatia wobec postaci." },
  { value: "ironiczny", hint: "Dystans, blyskotliwosc i podwazajacy narrator." },
  { value: "liryczny", hint: "Obrazowy jezyk, rytm i emocjonalna gestosc." },
  { value: "napiety", hint: "Presja i ciagle pytanie co dalej." },
  { value: "kameralny", hint: "Mniejsza skala, intymne sceny i relacje." },
  { value: "epicki", hint: "Szeroka skala, wysokie stawki i rozmach." },
  { value: "humorystyczny", hint: "Lekki rytm, komizm sytuacyjny lub dialogowy." }
];

const pointOfViewOptions: ChoiceOption[] = [
  { value: "pierwsza osoba", hint: "Blisko emocji i subiektywnej narracji." },
  { value: "trzecia osoba ograniczona", hint: "Blisko POV, ale z wieksza kontrola dystansu." },
  { value: "trzecia osoba wszechwiedzaca", hint: "Szersza skala i swobodny przeglad swiata." },
  { value: "wielu POV", hint: "Kilka perspektyw w jednej strukturze." },
  { value: "czas terazniejszy", hint: "Natychmiastowosc i mocniejszy puls scen." },
  { value: "czas przeszly", hint: "Klasyczny rytm narracyjny." }
];

const themeOptions: ChoiceOption[] = [
  { value: "tozsamosc", hint: "Kim jest bohater, kiedy odpadaja role." },
  { value: "pamiec", hint: "Co zostaje z prawdy po czasie i manipulacji." },
  { value: "wladza", hint: "Koszt kontroli nad innymi." },
  { value: "rodzina", hint: "Wiezy, lojalnosc i dziedziczone rany." },
  { value: "wolnosc", hint: "Cena samostanowienia." },
  { value: "zdrada", hint: "Pekniecie zaufania i jego konsekwencje." }
];

export function BookConceptPage({ projectId }: BookConceptPageProps) {
  const queryClient = useQueryClient();
  const codexPath = useCodexSettingsStore((state) => state.codexPath);
  const timeoutSeconds = useCodexSettingsStore((state) => state.timeoutSeconds);
  const model = useCodexSettingsStore((state) => state.model);
  const reasoningEffort = useCodexSettingsStore(
    (state) => state.reasoningEffort
  );
  const startProposal = useProposalStore((state) => state.startProposal);
  const finishProposal = useProposalStore((state) => state.finishProposal);
  const failProposal = useProposalStore((state) => state.failProposal);
  const activeProposal = useProposalStore((state) => state.activeProposal);
  const [form, setForm] = useState<ConceptForm>(emptyForm);
  const [saveMessage, setSaveMessage] = useState("");
  const [validationMessage, setValidationMessage] = useState("");
  const [coverMessage, setCoverMessage] = useState("");
  const [coverProgressText, setCoverProgressText] = useState("");
  const [coverStartedAt, setCoverStartedAt] = useState<number | null>(null);
  const [streamedCoverPreview, setStreamedCoverPreview] = useState("");
  const [aiError, setAiError] = useState("");

  const projectQuery = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProject(projectId),
    retry: 0
  });

  const codexStatusQuery = useQuery({
    queryKey: ["codex-cli", codexPath],
    queryFn: () => checkCodexCli(codexPath),
    retry: 0
  });

  useEffect(() => {
    if (!projectQuery.data) {
      return;
    }

    const { book } = projectQuery.data;
    setForm({
      title: book.title,
      workingTitle: book.workingTitle,
      premise: book.premise,
      expandedPremise: book.expandedPremise ?? "",
      logline: book.logline,
      centralConflict: book.centralConflict ?? "",
      stakes: book.stakes ?? "",
      genre: book.genre,
      subgenre: book.subgenre,
      targetAudience: book.targetAudience,
      tone: book.tone,
      pointOfView: book.pointOfView,
      targetWordCount: book.targetWordCount?.toString() ?? "",
      themesJson: listTextFromJson(book.themesJson ?? "[]"),
      unwantedThemes: book.unwantedThemes ?? "",
      alternativeTitlesJson: listTextFromJson(book.alternativeTitlesJson ?? "[]"),
      titleChoiceNote: book.titleChoiceNote ?? "",
      styleGuide: book.styleGuide
    });
  }, [projectQuery.data?.book.id, projectQuery.data?.book.updatedAt]);

  const bookForPrompt = useMemo(() => {
    if (!projectQuery.data) {
      return null;
    }

    return {
      ...projectQuery.data.book,
      title: form.title,
      workingTitle: form.workingTitle,
      premise: form.premise,
      expandedPremise: form.expandedPremise,
      logline: form.logline,
      centralConflict: form.centralConflict,
      stakes: form.stakes,
      genre: form.genre,
      subgenre: form.subgenre,
      targetAudience: form.targetAudience,
      tone: form.tone,
      pointOfView: form.pointOfView,
      targetWordCount: parseOptionalPositiveInt(form.targetWordCount),
      themesJson: serializeListValue(form.themesJson),
      unwantedThemes: form.unwantedThemes,
      alternativeTitlesJson: serializeListValue(form.alternativeTitlesJson),
      titleChoiceNote: form.titleChoiceNote,
      styleGuide: form.styleGuide
    };
  }, [form, projectQuery.data]);

  useEffect(() => {
    const activeBookId = projectQuery.data?.book.id;
    if (!activeBookId || !isTauriRuntime()) {
      return;
    }

    let cancelled = false;
    const unlistenPromise = listen<CoverGenerationProgressEvent>(
      "cover-generation-progress",
      (event) => {
        const payload = event.payload;
        if (payload.projectId !== projectId || payload.bookId !== activeBookId) {
          return;
        }

        setCoverProgressText(payload.message);
        if (payload.partialImageDataUrl) {
          setStreamedCoverPreview(payload.partialImageDataUrl);
        }
      }
    );

    return () => {
      cancelled = true;
      unlistenPromise
        .then((unlisten) => {
          if (cancelled) {
            unlisten();
          }
        })
        .catch(() => undefined);
    };
  }, [projectId, projectQuery.data?.book.id]);

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!projectQuery.data) {
        throw new Error("Brak projektu do zapisu.");
      }

      const validation = validateConceptForm(form);
      if (validation) {
        throw new ValidationError(validation);
      }

      return updateBookConcept(projectQuery.data.book.id, conceptInputFromForm(form));
    },
    onSuccess: async () => {
      setSaveMessage("Zapisano koncepcje.");
      setValidationMessage("");
      await queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (error) => {
      if (error instanceof ValidationError) {
        setValidationMessage(error.message);
      }
    }
  });

  const generateFieldMutation = useMutation({
    mutationFn: async (field: ConceptFieldKey) => {
      if (!projectQuery.data || !bookForPrompt) {
        throw new GenerationError("Brak danych projektu.");
      }

      const promptPackage = buildConceptFieldPromptPackage(
        projectQuery.data.project,
        bookForPrompt,
        field
      );
      const prompt = renderPromptPackage(promptPackage);
      const snapshot = {
        projectId,
        bookId: projectQuery.data.book.id,
        field,
        action: promptPackage.action,
        promptPackageId: promptPackage.id,
        promptPackageJson: promptPackage,
        prompt
      };

      startProposal(snapshot);

      const result = await runCodexPrompt({
        projectId,
        action: promptPackage.action,
        promptPackageId: promptPackage.id,
        promptPackageJson: promptPackage,
        prompt,
        codexPath,
        timeoutSeconds,
        model,
        reasoningEffort
      });

      if (result.status !== "success" || !result.rawOutput) {
        throw new GenerationError(
          result.errorMessage || "Codex CLI nie zwrocil wyniku.",
          result.rawOutput ?? ""
        );
      }

      const parsed = parseProposalResult(
        result.rawOutput,
        field,
        promptPackage.action
      );
      return { parsed, result };
    },
    onSuccess: ({ parsed, result }) => {
      setAiError("");
      finishProposal({
        aiRunId: result.id,
        rawOutput: result.rawOutput ?? "",
        parsed,
        editableValue: parsed.textValue,
        editableFields: editableFieldsFromParsed(parsed),
        selectedFields: selectedFieldsFromParsed(parsed),
        durationMs: result.durationMs
      });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : String(error);
      const rawOutput = error instanceof GenerationError ? error.rawOutput : "";
      setAiError(message);
      failProposal(message, rawOutput);
    }
  });

  const generateCoverMutation = useMutation({
    mutationFn: async () => {
      if (!projectQuery.data || !bookForPrompt) {
        throw new GenerationError("Brak danych projektu.");
      }

      const promptPackage = buildBookCoverPromptPackage(
        projectQuery.data.project,
        bookForPrompt
      );
      const prompt = renderBookCoverPromptPackage(promptPackage);

      return generateBookCover({
        projectId,
        bookId: projectQuery.data.book.id,
        promptPackageId: promptPackage.id,
        promptPackageJson: promptPackage,
        prompt,
        coverPrompt: promptPackage.coverPrompt,
        coverNegativePrompt: promptPackage.negativePrompt,
        codexPath,
        timeoutSeconds,
        model,
        reasoningEffort
      });
    },
    onSuccess: async (result) => {
      setAiError("");
      setCoverMessage("Utworzono okladke.");
      setCoverProgressText("Okladka zapisana.");
      setCoverStartedAt(null);
      setStreamedCoverPreview(coverImageSource(result.book.coverImagePath));
      await queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : String(error);
      setCoverProgressText("Generowanie okladki zatrzymane.");
      setCoverStartedAt(null);
      setAiError(message);
    }
  });

  useEffect(() => {
    if (!generateCoverMutation.isPending || coverStartedAt === null) {
      return;
    }

    const startedAt = coverStartedAt;

    function updateProgressText() {
      const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
      if (elapsedSeconds < 2) {
        setCoverProgressText("Przygotowuje prompt okladki...");
        return;
      }
      if (elapsedSeconds < 8) {
        setCoverProgressText("Uruchamiam Codex CLI...");
        return;
      }
      if (elapsedSeconds < 45) {
        setCoverProgressText(`Codex CLI generuje okladke (${elapsedSeconds}s)...`);
        return;
      }
      setCoverProgressText(`Dopracowuje finalny obraz (${elapsedSeconds}s)...`);
    }

    updateProgressText();
    const intervalId = window.setInterval(updateProgressText, 1000);
    return () => window.clearInterval(intervalId);
  }, [coverStartedAt, generateCoverMutation.isPending]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaveMessage("");
    setValidationMessage("");
    saveMutation.mutate();
  }

  function updateField<Key extends keyof ConceptForm>(
    key: Key,
    value: ConceptForm[Key]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function generateField(field: ConceptFieldKey) {
    setAiError("");
    generateFieldMutation.mutate(field);
  }

  function generateCover() {
    setAiError("");
    setCoverMessage("");
    setStreamedCoverPreview("");
    setCoverProgressText("Przygotowuje prompt okladki...");
    setCoverStartedAt(Date.now());
    generateCoverMutation.mutate();
  }

  const codexUnavailable = codexStatusQuery.data?.available === false;
  const aiDisabled =
    generateFieldMutation.isPending || !projectQuery.data || codexUnavailable;
  const activeField =
    activeProposal?.projectId === projectId && activeProposal.status === "running"
      ? activeProposal.field
      : null;
  const coverSrc =
    streamedCoverPreview || coverImageSource(projectQuery.data?.book.coverImagePath);

  return (
    <div className="concept-page-grid">
      <section className="content-panel concept-panel">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">Faza 2</p>
            <h2>Koncepcja ksiazki</h2>
          </div>
        </div>

        {projectQuery.isError ? (
          <div className="empty-state">
            <h3>Nie mozna wczytac projektu</h3>
            <p>Sprawdz, czy aplikacja dziala w Tauri i baza jest dostepna.</p>
          </div>
        ) : null}

        <form className="concept-form" onSubmit={handleSubmit}>
          <FormSection title="Tytuly">
            <div className="form-grid">
              <TextField
                label="Tytul finalny"
                field="title"
                value={form.title}
                placeholder="Tytul, ktory trafi na okladke"
                disabled={aiDisabled}
                loading={activeField === "title"}
                onGenerate={generateField}
                onChange={(value) => updateField("title", value)}
              />
              <TextField
                label="Tytul roboczy"
                field="workingTitle"
                value={form.workingTitle}
                placeholder="Tytul roboczy"
                disabled={aiDisabled}
                loading={activeField === "workingTitle"}
                onGenerate={generateField}
                onChange={(value) => updateField("workingTitle", value)}
              />
            </div>
            <TextField
              label="Alternatywne tytuly"
              field="alternativeTitlesJson"
              value={form.alternativeTitlesJson}
              placeholder="Jeden tytul na linie albo po przecinku"
              rows={3}
              disabled={aiDisabled}
              loading={activeField === "alternativeTitlesJson"}
              onGenerate={generateField}
              onChange={(value) => updateField("alternativeTitlesJson", value)}
            />
            <TextField
              label="Notatka wyboru tytulu"
              field="titleChoiceNote"
              value={form.titleChoiceNote}
              placeholder="Dlaczego ten tytul wygrywa"
              rows={3}
              disabled={aiDisabled}
              loading={activeField === "titleChoiceNote"}
              onGenerate={generateField}
              onChange={(value) => updateField("titleChoiceNote", value)}
            />
          </FormSection>

          <FormSection title="Rdzen historii">
            <TextField
              label="Premise"
              field="premise"
              value={form.premise}
              placeholder="Jedno lub dwa zdania o obietnicy historii"
              rows={4}
              disabled={aiDisabled}
              loading={activeField === "premise"}
              onGenerate={generateField}
              onChange={(value) => updateField("premise", value)}
            />
            <div className="form-grid">
              <TextField
                label="Logline"
                field="logline"
                value={form.logline}
                placeholder="Bohater, cel, przeszkoda, stawka"
                rows={3}
                disabled={aiDisabled}
                loading={activeField === "logline"}
                onGenerate={generateField}
                onChange={(value) => updateField("logline", value)}
              />
              <TextField
                label="Konflikt centralny"
                field="centralConflict"
                value={form.centralConflict}
                placeholder="Glowne tarcie fabularne"
                rows={3}
                disabled={aiDisabled}
                loading={activeField === "centralConflict"}
                onGenerate={generateField}
                onChange={(value) => updateField("centralConflict", value)}
              />
            </div>
            <TextField
              label="Rozszerzona premisa"
              field="expandedPremise"
              value={form.expandedPremise}
              placeholder="Akapit rozwijajacy zalozenie ksiazki"
              rows={5}
              disabled={aiDisabled}
              loading={activeField === "expandedPremise"}
              onGenerate={generateField}
              onChange={(value) => updateField("expandedPremise", value)}
            />
            <TextField
              label="Stawki"
              field="stakes"
              value={form.stakes}
              placeholder="Co bohater traci, jesli przegra"
              rows={4}
              disabled={aiDisabled}
              loading={activeField === "stakes"}
              onGenerate={generateField}
              onChange={(value) => updateField("stakes", value)}
            />
          </FormSection>

          <FormSection title="Obietnica czytelnicza">
            <div className="form-grid concept-choice-grid">
              <MultiChoiceField
                label="Gatunek"
                field="genre"
                value={form.genre}
                options={genreOptions}
                onChange={(value) => updateField("genre", value)}
                onGenerate={generateField}
                disabled={aiDisabled}
                loading={activeField === "genre"}
              />
              <MultiChoiceField
                label="Podgatunek"
                field="subgenre"
                value={form.subgenre}
                options={subgenreOptions}
                onChange={(value) => updateField("subgenre", value)}
                onGenerate={generateField}
                disabled={aiDisabled}
                loading={activeField === "subgenre"}
              />
              <MultiChoiceField
                label="Odbiorcy"
                field="targetAudience"
                value={form.targetAudience}
                options={audienceOptions}
                onChange={(value) => updateField("targetAudience", value)}
                onGenerate={generateField}
                disabled={aiDisabled}
                loading={activeField === "targetAudience"}
              />
              <MultiChoiceField
                label="Ton"
                field="tone"
                value={form.tone}
                options={toneOptions}
                onChange={(value) => updateField("tone", value)}
                onGenerate={generateField}
                disabled={aiDisabled}
                loading={activeField === "tone"}
              />
              <MultiChoiceField
                label="Punkt widzenia"
                field="pointOfView"
                value={form.pointOfView}
                options={pointOfViewOptions}
                onChange={(value) => updateField("pointOfView", value)}
                onGenerate={generateField}
                disabled={aiDisabled}
                loading={activeField === "pointOfView"}
              />
              <TextField
                label="Docelowa liczba slow"
                field="targetWordCount"
                value={form.targetWordCount}
                placeholder="np. 85000"
                disabled={aiDisabled}
                loading={activeField === "targetWordCount"}
                onGenerate={generateField}
                onChange={(value) => updateField("targetWordCount", value)}
              />
            </div>
          </FormSection>

          <FormSection title="Styl i granice">
            <MultiChoiceField
              label="Tematy"
              field="themesJson"
              value={form.themesJson}
              options={themeOptions}
              onChange={(value) => updateField("themesJson", value)}
              onGenerate={generateField}
              disabled={aiDisabled}
              loading={activeField === "themesJson"}
            />
            <TextField
              label="Granice i tematy niechciane"
              field="unwantedThemes"
              value={form.unwantedThemes}
              placeholder="Czego unikac w pozniejszych promptach"
              rows={4}
              disabled={aiDisabled}
              loading={activeField === "unwantedThemes"}
              onGenerate={generateField}
              onChange={(value) => updateField("unwantedThemes", value)}
            />
            <TextField
              label="Style guide"
              field="styleGuide"
              value={form.styleGuide}
              placeholder="Notatki o jezyku, rytmie, zakazach i preferencjach"
              rows={5}
              disabled={aiDisabled}
              loading={activeField === "styleGuide"}
              onGenerate={generateField}
              onChange={(value) => updateField("styleGuide", value)}
            />
          </FormSection>

          <div className="button-row">
            <button
              type="submit"
              className="primary-button"
              disabled={saveMutation.isPending || !projectQuery.data}
            >
              <Save size={16} />
              {saveMutation.isPending ? "Zapisuje" : "Zapisz"}
            </button>
            {saveMessage ? <span className="success-text">{saveMessage}</span> : null}
            {validationMessage ? (
              <span className="warning-text">{validationMessage}</span>
            ) : null}
            {saveMutation.isError && !validationMessage ? (
              <span className="warning-text">Nie udalo sie zapisac koncepcji.</span>
            ) : null}
          </div>
        </form>

        {codexUnavailable ? (
          <p className="warning-text">
            Codex CLI nie jest gotowy. Skonfiguruj go w prawym panelu albo
            ekranie AI.
          </p>
        ) : null}

        {aiError && !generateCoverMutation.isError ? (
          <p className="warning-text">{aiError}</p>
        ) : null}
      </section>

      <aside className="content-panel cover-panel">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">Okladka</p>
            <h2>Robocza okladka</h2>
          </div>
          <ImageIcon size={20} aria-hidden="true" />
        </div>

        <div className={coverSrc ? "cover-preview has-image" : "cover-preview"}>
          {coverSrc ? (
            <img src={coverSrc} alt="Okladka robocza" />
          ) : (
            <div className="cover-placeholder">
              <ImageIcon size={30} aria-hidden="true" />
              <span>Brak okladki</span>
            </div>
          )}
        </div>

        {projectQuery.data?.book.coverGeneratedAt ? (
          <p className="muted-text">
            Wygenerowano: {projectQuery.data.book.coverGeneratedAt}
          </p>
        ) : null}

        <button
          type="button"
          className="secondary-button"
          onClick={generateCover}
          disabled={
            generateCoverMutation.isPending ||
            !projectQuery.data ||
            codexUnavailable
          }
          title="Utworz okladke na podstawie danych z widoku koncepcji"
        >
          {generateCoverMutation.isPending ? (
            <Loader2 size={16} className="spin-icon" />
          ) : (
            <Sparkles size={16} />
          )}
          {generateCoverMutation.isPending ? "Tworze" : "Utworz okladke"}
        </button>

        {coverProgressText ? (
          <div
            className={
              generateCoverMutation.isPending
                ? "cover-progress active"
                : "cover-progress"
            }
            role={generateCoverMutation.isPending ? "status" : undefined}
            aria-live="polite"
          >
            <span>{coverProgressText}</span>
            {generateCoverMutation.isPending ? (
              <div className="cover-progress-track" aria-hidden="true">
                <span />
              </div>
            ) : null}
          </div>
        ) : null}

        {coverMessage ? <p className="success-text">{coverMessage}</p> : null}
        {generateCoverMutation.isError ? (
          <p className="warning-text">Nie udalo sie utworzyc okladki.</p>
        ) : null}
        {generateCoverMutation.isError && aiError ? (
          <p className="warning-text">{aiError}</p>
        ) : null}
      </aside>
    </div>
  );
}

type FormSectionProps = {
  title: string;
  children: ReactNode;
};

function FormSection({ title, children }: FormSectionProps) {
  return (
    <section className="concept-form-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

type TextFieldProps = {
  label: string;
  field: ConceptFieldKey;
  value: string;
  placeholder: string;
  disabled: boolean;
  loading: boolean;
  rows?: number;
  onChange: (value: string) => void;
  onGenerate: (field: ConceptFieldKey) => void;
};

function TextField({
  label,
  field,
  value,
  placeholder,
  disabled,
  loading,
  rows,
  onChange,
  onGenerate
}: TextFieldProps) {
  return (
    <FieldFrame
      label={label}
      field={field}
      disabled={disabled}
      loading={loading}
      onGenerate={onGenerate}
    >
      {rows ? (
        <textarea
          className={field === "styleGuide" ? "style-guide-textarea" : undefined}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          title={fieldHints[field]}
          aria-label={label}
          rows={rows}
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          title={fieldHints[field]}
          aria-label={label}
        />
      )}
    </FieldFrame>
  );
}

type FieldFrameProps = {
  label: string;
  field: ConceptFieldKey;
  children: ReactNode;
  disabled: boolean;
  loading: boolean;
  onGenerate: (field: ConceptFieldKey) => void;
};

function FieldFrame({
  label,
  field,
  children,
  disabled,
  loading,
  onGenerate
}: FieldFrameProps) {
  return (
    <div className="field-shell" title={fieldHints[field]}>
      <div className="field-heading">
        <span className="field-label-text">{label}</span>
        <AiFieldButton
          field={field}
          disabled={disabled}
          loading={loading}
          onGenerate={onGenerate}
        />
      </div>
      {children}
    </div>
  );
}

type AiFieldButtonProps = {
  field: ConceptFieldKey;
  disabled: boolean;
  loading: boolean;
  onGenerate: (field: ConceptFieldKey) => void;
};

function AiFieldButton({
  field,
  disabled,
  loading,
  onGenerate
}: AiFieldButtonProps) {
  const config = conceptFieldConfigs[field];

  return (
    <button
      type="button"
      className="icon-button ai-field-button"
      onClick={() => onGenerate(field)}
      disabled={disabled}
      title={`Generuj pole "${config.label}" z AI. Prompt uwzgledni pozostale pola koncepcji.`}
      aria-label={`Generuj ${config.label} z AI`}
    >
      {loading ? <Loader2 size={15} className="spin-icon" /> : <Sparkles size={15} />}
      <span>{loading ? "Generuje" : "AI"}</span>
    </button>
  );
}

type MultiChoiceFieldProps = {
  label: string;
  field: ConceptFieldKey;
  value: string;
  options: ChoiceOption[];
  disabled: boolean;
  loading: boolean;
  onChange: (value: string) => void;
  onGenerate: (field: ConceptFieldKey) => void;
};

function MultiChoiceField({
  label,
  field,
  value,
  options,
  disabled,
  loading,
  onChange,
  onGenerate
}: MultiChoiceFieldProps) {
  const [customValue, setCustomValue] = useState("");
  const selectedValues = parseChoiceString(value);
  const knownValues = new Set(options.map((option) => option.value));
  const customSelectedValues = selectedValues.filter(
    (selected) => !knownValues.has(selected)
  );

  function setSelected(nextValues: string[]) {
    onChange(nextValues.join(", "));
  }

  function toggleChoice(choice: string) {
    if (selectedValues.includes(choice)) {
      setSelected(selectedValues.filter((selected) => selected !== choice));
      return;
    }

    setSelected([...selectedValues, choice]);
  }

  function addCustomValue() {
    const nextValue = customValue.trim();
    if (!nextValue || selectedValues.includes(nextValue)) {
      setCustomValue("");
      return;
    }

    setSelected([...selectedValues, nextValue]);
    setCustomValue("");
  }

  return (
    <FieldFrame
      label={label}
      field={field}
      disabled={disabled}
      loading={loading}
      onGenerate={onGenerate}
    >
      <div className="choice-field" aria-label={label}>
        <div className="choice-chip-list">
          {options.map((option) => {
            const selected = selectedValues.includes(option.value);
            return (
              <button
                type="button"
                key={option.value}
                className={selected ? "choice-chip selected" : "choice-chip"}
                onClick={() => toggleChoice(option.value)}
                title={`${option.value}: ${option.hint}`}
                aria-pressed={selected}
              >
                {option.value}
              </button>
            );
          })}
          {customSelectedValues.map((selected) => (
            <button
              type="button"
              key={selected}
              className="choice-chip selected custom"
              onClick={() => toggleChoice(selected)}
              title={`Wlasna opcja: ${selected}. Kliknij, aby usunac.`}
              aria-pressed
            >
              {selected}
              <X size={12} />
            </button>
          ))}
        </div>
        <div className="choice-custom-row">
          <input
            value={customValue}
            onChange={(event) => setCustomValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addCustomValue();
              }
            }}
            placeholder="Wlasna opcja"
            title={`Dopisz wlasna wartosc dla pola ${label}.`}
            aria-label={`Wlasna opcja ${label}`}
          />
          <button
            type="button"
            className="icon-button"
            onClick={addCustomValue}
            title={`Dodaj wlasna opcje do pola ${label}`}
            aria-label={`Dodaj wlasna opcje ${label}`}
          >
            <Plus size={15} />
          </button>
        </div>
      </div>
    </FieldFrame>
  );
}

function parseChoiceString(value: string | undefined | null): string[] {
  return (value ?? "")
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function conceptInputFromForm(form: ConceptForm): BookConceptInput {
  return {
    title: form.title,
    workingTitle: form.workingTitle,
    premise: form.premise,
    expandedPremise: form.expandedPremise,
    logline: form.logline,
    centralConflict: form.centralConflict,
    stakes: form.stakes,
    genre: form.genre,
    subgenre: form.subgenre,
    targetAudience: form.targetAudience,
    tone: form.tone,
    pointOfView: form.pointOfView,
    targetWordCount: parseOptionalPositiveInt(form.targetWordCount),
    themesJson: serializeListValue(form.themesJson),
    unwantedThemes: form.unwantedThemes,
    alternativeTitlesJson: serializeListValue(form.alternativeTitlesJson),
    titleChoiceNote: form.titleChoiceNote,
    styleGuide: form.styleGuide
  };
}

function validateConceptForm(form: ConceptForm): string {
  if (form.targetWordCount.trim() && parseOptionalPositiveInt(form.targetWordCount) === null) {
    return "Docelowa liczba slow musi byc dodatnia liczba albo pozostac pusta.";
  }

  if (form.premise.length > 1200) {
    return "Premise jest zbyt dluga; przenies szczegoly do rozszerzonej premisy.";
  }

  if (form.logline.length > 700) {
    return "Logline jest zbyt dlugi; powinien zmiescic sie w jednym zwartym zdaniu.";
  }

  return "";
}

function parseOptionalPositiveInt(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.replace(/\s+/g, "");
  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function serializeListValue(value: string): string {
  return JSON.stringify([...new Set(parseChoiceString(value))]);
}

function listTextFromJson(value: string): string {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item): item is string => typeof item === "string")
        .join(", ");
    }
  } catch {
    return value;
  }

  return value;
}

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

class GenerationError extends Error {
  rawOutput: string;

  constructor(message: string, rawOutput = "") {
    super(message);
    this.name = "GenerationError";
    this.rawOutput = rawOutput;
  }
}
