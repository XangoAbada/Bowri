import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Globe2,
  History,
  Inbox,
  Lightbulb,
  ListTree,
  PackageOpen,
  PanelRightClose,
  PanelRightOpen,
  PenLine,
  Search,
  SearchCheck,
  Settings,
  Sparkles,
  Users
} from "lucide-react";
import {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  getAiSettings,
  getProject,
  listAiRunUsageTotals,
  listCodexModels,
  saveAiSettings,
  searchProject
} from "../shared/api/commands";
import type { SearchResult } from "../shared/api/types";
import { REASONING_LEVELS } from "../shared/api/types";
import {
  describeTextProvider,
  normalizeClaudeModel,
  textModelChoices
} from "../features/ai/textProviderInfo";
import { formatPln, formatUsd, totalCostOf } from "../features/ai/pricing";
import { AiProposalPanel } from "../features/ai/AiProposalPanel";
import { AiPromptContextPanel } from "../features/ai/AiPromptContextPanel";
import { useCodexSettingsStore } from "../features/ai/codexSettingsStore";
import { useProposalStore } from "../features/ai/proposalStore";
import { coverImageSource } from "../shared/api/assets";
import { ThemeToggle } from "../shared/ui";
import {
  projectLogReturnHref,
  useProjectNavigationStore
} from "./projectNavigationStore";

type ProjectShellProps = {
  projectId: string;
  activeSection: "brainstorm" | "concept" | "plan" | "characters" | "world" | "editor" | "editing" | "export" | "ai" | "aiLog";
  children: ReactNode;
};

const reasoningLevels = REASONING_LEVELS;

export function ProjectShell({
  projectId,
  activeSection,
  children
}: ProjectShellProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const location = useLocation({
    select: (currentLocation) => ({
      href: currentLocation.href
    })
  });
  const projectQuery = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProject(projectId),
    retry: 0
  });
  const codexPath = useCodexSettingsStore((state) => state.codexPath);
  const model = useCodexSettingsStore((state) => state.model);
  const setModel = useCodexSettingsStore((state) => state.setModel);
  const reasoningEffort = useCodexSettingsStore(
    (state) => state.reasoningEffort
  );
  const setReasoningEffort = useCodexSettingsStore(
    (state) => state.setReasoningEffort
  );
  const modelQuery = useQuery({
    queryKey: ["codex-models", codexPath],
    queryFn: () => listCodexModels(codexPath),
    retry: 0
  });
  const aiSettingsQuery = useQuery({
    queryKey: ["ai-settings"],
    queryFn: getAiSettings,
    retry: 0
  });
  const providerInfo = describeTextProvider(aiSettingsQuery.data);
  const modelChoice = aiSettingsQuery.data
    ? textModelChoices(aiSettingsQuery.data)
    : null;
  const saveAiSettingsMutation = useMutation({
    mutationFn: saveAiSettings,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ai-settings"] });
    }
  });
  const plnPerUsd = aiSettingsQuery.data?.plnPerUsd ?? 4;
  const usageTotalsQuery = useQuery({
    queryKey: ["ai-run-usage-totals", projectId],
    queryFn: () => listAiRunUsageTotals(projectId),
    retry: 0,
    refetchInterval: 5000
  });
  const totalCost = totalCostOf(usageTotalsQuery.data ?? []);
  const contextPanelWidth = useCodexSettingsStore(
    (state) => state.contextPanelWidth
  );
  const setContextPanelWidth = useCodexSettingsStore(
    (state) => state.setContextPanelWidth
  );
  const contextPanelOpen = useCodexSettingsStore(
    (state) => state.contextPanelOpen
  );
  const setContextPanelOpen = useCodexSettingsStore(
    (state) => state.setContextPanelOpen
  );
  const proposalCount = useProposalStore(
    (state) =>
      state.proposals.filter((proposal) => proposal.projectId === projectId).length
  );
  const rememberLogReturnLocation = useProjectNavigationStore(
    (state) => state.rememberLogReturnLocation
  );
  const storedLogReturnLocation = useProjectNavigationStore(
    (state) => state.logReturnLocations[projectId]
  );

  const title =
    projectQuery.data?.book.workingTitle ||
    projectQuery.data?.project.name ||
    t("shell.defaultProjectTitle");
  const subtitle =
    activeSection === "brainstorm"
      ? t("shell.phase.brainstorm")
      : activeSection === "concept"
      ? t("shell.phase.concept")
      : activeSection === "plan"
        ? t("shell.phase.plan")
        : activeSection === "characters"
          ? t("shell.phase.characters")
          : activeSection === "world"
            ? t("shell.phase.world")
            : activeSection === "editor"
              ? t("shell.phase.editor")
              : activeSection === "editing"
                ? t("shell.phase.editing")
              : activeSection === "export"
                ? t("shell.phase.export")
          : activeSection === "aiLog"
          ? t("shell.phase.aiLog")
          : t("shell.phase.aiSettings");

  const modelOptions = useMemo(() => {
    const catalogModels = modelQuery.data?.models ?? [];
    const options = [
      ...catalogModels.map((item) => {
        const rawItem = item as typeof item & { display_name?: string };
        return {
          value: item.slug,
          label: item.displayName || rawItem.display_name || item.slug,
          title: item.description || item.slug
        };
      }),
      {
        value: model,
        label: model,
        title: t("shell.model.currentlySelected")
      },
      {
        value: "gpt-5.5",
        label: "GPT-5.5",
        title: t("shell.model.catalogFallback")
      }
    ];
    const seen = new Set<string>();
    return options.filter((option) => {
      if (seen.has(option.value)) {
        return false;
      }
      seen.add(option.value);
      return true;
    });
  }, [model, modelQuery.data?.models, t]);
  const reasoningIndex = Math.max(
    0,
    reasoningLevels.findIndex((level) => level.value === reasoningEffort)
  );

  useEffect(() => {
    if (activeSection !== "aiLog") {
      rememberLogReturnLocation(projectId, location.href);
    }
  }, [activeSection, location.href, projectId, rememberLogReturnLocation]);

  function handleResizeStart(event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = contextPanelWidth;

    function handlePointerMove(moveEvent: PointerEvent) {
      const nextWidth = clamp(startWidth + startX - moveEvent.clientX, 300, 560);
      setContextPanelWidth(nextWidth);
    }

    function handlePointerUp() {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }

  function toggleAiLog() {
    if (activeSection === "aiLog") {
      void navigate({
        href: projectLogReturnHref(projectId, storedLogReturnLocation)
      });
      return;
    }

    rememberLogReturnLocation(projectId, location.href);
    void navigate({
      to: "/projects/$projectId/ai-log",
      params: { projectId }
    });
  }

  function updateReasoning(index: number) {
    setReasoningEffort(reasoningLevels[index]?.value ?? "medium");
  }

  const coverSrc = coverImageSource(projectQuery.data?.book.coverImagePath);

  return (
    <div
      className="project-shell"
      data-rail={contextPanelOpen ? "open" : "closed"}
      style={
        {
          "--context-panel-width": contextPanelOpen ? `${contextPanelWidth}px` : "52px"
        } as CSSProperties
      }
    >
      <aside className="sidebar">
        <Link className="brand-link" to="/">
          <span className="brand-word">
            Bow<em>ri</em>
          </span>
        </Link>

        <Link className="sidebar-project-card" to="/">
          {coverSrc ? (
            <img className="sidebar-project-cover" src={coverSrc} alt="" />
          ) : (
            <span className="sidebar-project-cover sidebar-project-cover-fallback" aria-hidden>
              {title.slice(0, 1)}
            </span>
          )}
          <span className="sidebar-project-meta">
            <strong>{title}</strong>
            <span className="sidebar-project-back">
              <ArrowLeft size={11} aria-hidden />
              {t("shell.back")}
            </span>
          </span>
        </Link>

        <nav className="sidebar-nav" aria-label={t("shell.nav.stagesLabel")}>
          {(
            [
              ["brainstorm", "01", t("shell.nav.brainstorm"), Lightbulb],
              ["concept", "02", t("shell.nav.concept"), Sparkles],
              ["plan", "03", t("shell.nav.plan"), ListTree],
              ["characters", "04", t("shell.nav.characters"), Users],
              ["world", "05", t("shell.nav.world"), Globe2],
              ["editor", "06", t("shell.nav.editor"), PenLine],
              ["editing", "07", t("shell.nav.editing"), SearchCheck],
              ["export", "08", t("shell.nav.export"), PackageOpen]
            ] as const
          ).map(([section, num, label, Icon]) => (
            <Link
              key={section}
              to={`/projects/$projectId/${section}`}
              params={{ projectId }}
              className={activeSection === section ? "nav-item active" : "nav-item"}
            >
              {activeSection === section ? (
                <motion.span
                  className="nav-pill"
                  layoutId="nav-pill"
                  transition={{ type: "spring", stiffness: 480, damping: 42 }}
                  aria-hidden
                />
              ) : null}
              <Icon size={15} className="nav-icon" aria-hidden />
              <span className="nav-label">{label}</span>
              <span className="nav-num" aria-hidden>
                {num}
              </span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-bottom-nav">
          <div className="sidebar-bottom-row">
            <Link
              to="/settings"
              className={activeSection === "ai" ? "nav-item active" : "nav-item"}
            >
              <Settings size={15} className="nav-icon" aria-hidden />
              <span className="nav-label">{t("shell.nav.settings")}</span>
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      <div className="workspace">
        <header className="workspace-header">
          <div>
            <p>{subtitle}</p>
            <h1>{title}</h1>
          </div>
          <ProjectSearch projectId={projectId} />
          <button
            type="button"
            className="rail-toggle"
            aria-expanded={contextPanelOpen}
            title={contextPanelOpen ? t("shell.rail.collapse") : t("shell.rail.expand")}
            aria-label={contextPanelOpen ? t("shell.rail.collapse") : t("shell.rail.expand")}
            onClick={() => setContextPanelOpen(!contextPanelOpen)}
          >
            {contextPanelOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
            {!contextPanelOpen && proposalCount > 0 ? (
              <span className="rail-badge">{proposalCount}</span>
            ) : null}
          </button>
        </header>

        <main className="workspace-main">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            {children}
          </motion.div>
        </main>
      </div>

      {contextPanelOpen ? (
      <aside className="context-panel global-context-panel" aria-label={t("shell.panel.projectLabel")}>
        <button
          type="button"
          className="context-resize-handle"
          onPointerDown={handleResizeStart}
          title={t("shell.panel.resizeTitle")}
          aria-label={t("shell.panel.resizeAriaLabel")}
        />
        <div className="workspace-header-actions context-status-bar" aria-label={t("shell.panel.statusLabel")}>
          <span className="autosave-status">
            <CheckCircle2 size={16} />
            {t("shell.panel.autosaved")}
          </span>
          <span
            className="ai-cost-chip"
            title={t("shell.panel.costChipTitle")}
          >
            {totalCost.hasPricing ? (
              <>
                ≈ {totalCost.estimated ? "~" : ""}
                {formatUsd(totalCost.usd)} ({formatPln(totalCost.usd, plnPerUsd)})
              </>
            ) : (
              t("shell.panel.noPricing")
            )}
          </span>
          <details className="model-menu-panel">
            <summary
              className={projectQuery.isError ? "topbar-select muted" : "topbar-select ready"}
            >
              {projectQuery.isError ? <CircleDot size={16} /> : <CheckCircle2 size={16} />}
              <span>
                {providerInfo.isCodex
                  ? `Codex CLI · ${model}`
                  : `${providerInfo.providerLabel} · ${providerInfo.modelLabel}`}
              </span>
              <ChevronDown size={15} />
            </summary>
            <div className="model-menu-body">
              {providerInfo.isCodex ? (
                <label className="field-label">
                  {t("shell.modelMenu.modelLabel")}
                  <select
                    value={model}
                    onChange={(event) => setModel(event.target.value)}
                    title={t("shell.modelMenu.codexModelTitle")}
                  >
                    {modelOptions.map((option) => (
                      <option value={option.value} key={option.value} title={option.title}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : modelChoice ? (
                <label className="field-label">
                  {t("shell.modelMenu.modelLabel")}
                  <select
                    value={normalizeClaudeModel(
                      String(aiSettingsQuery.data?.[modelChoice.field] ?? "")
                    )}
                    disabled={saveAiSettingsMutation.isPending}
                    onChange={(event) => {
                      if (!aiSettingsQuery.data) {
                        return;
                      }
                      saveAiSettingsMutation.mutate({
                        ...aiSettingsQuery.data,
                        [modelChoice.field]: event.target.value
                      });
                    }}
                    title={t("shell.modelMenu.providerModelTitle", {
                      provider: providerInfo.providerLabel
                    })}
                  >
                    {modelChoice.options.map((option) => (
                      <option value={option.value} key={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <label className="field-label">
                {t("shell.modelMenu.reasoningLevel")}
                <div className="reasoning-control">
                  <input
                    type="range"
                    min={0}
                    max={reasoningLevels.length - 1}
                    step={1}
                    value={reasoningIndex}
                    onChange={(event) => updateReasoning(Number(event.target.value))}
                    title={reasoningLevels[reasoningIndex]?.hint}
                  />
                  <div className="reasoning-labels" aria-hidden="true">
                    {reasoningLevels.map((level) => (
                      <span
                        key={level.value}
                        className={level.value === reasoningEffort ? "active" : ""}
                        title={level.hint}
                      >
                        {level.label}
                      </span>
                    ))}
                  </div>
                </div>
              </label>

              {providerInfo.isCodex ? (
                modelQuery.data?.fallback ? (
                  <p className="muted-text">{modelQuery.data.errorMessage}</p>
                ) : null
              ) : (
                <Link
                  className="model-menu-settings-link"
                  to="/projects/$projectId/ai"
                  params={{ projectId }}
                >
                  {t("shell.modelMenu.openAiSettings")}
                </Link>
              )}
            </div>
          </details>
        </div>
        <AiPromptContextPanel />
        <div className="context-inbox-header">
          <Inbox size={15} aria-hidden />
          <span>{t("shell.rail.inbox")}</span>
          {proposalCount > 0 ? (
            <span className="context-inbox-count">{proposalCount}</span>
          ) : null}
        </div>
        <AiProposalPanel projectId={projectId} />
        <div className="context-panel-footer">
          <button
            type="button"
            className={
              activeSection === "aiLog"
                ? "context-footer-action active"
                : "context-footer-action"
            }
            title={activeSection === "aiLog" ? t("shell.aiLog.close") : t("shell.aiLog.open")}
            onClick={toggleAiLog}
          >
            <History size={18} />
            {t("shell.aiLog.label")}
          </button>
        </div>
      </aside>
      ) : (
      <aside className="context-panel global-context-panel context-panel-collapsed" aria-label={t("shell.panel.projectLabel")}>
        <button
          type="button"
          className="collapsed-rail-action ui-tip"
          data-tip={t("shell.rail.expand")}
          aria-label={t("shell.rail.expand")}
          onClick={() => setContextPanelOpen(true)}
        >
          <PanelRightOpen size={17} />
        </button>
        <button
          type="button"
          className="collapsed-rail-action ui-tip"
          data-tip={t("shell.rail.inbox")}
          aria-label={t("shell.rail.inbox")}
          onClick={() => setContextPanelOpen(true)}
        >
          <Inbox size={17} />
          {proposalCount > 0 ? <span className="rail-badge">{proposalCount}</span> : null}
        </button>
        <button
          type="button"
          className={
            activeSection === "aiLog"
              ? "collapsed-rail-action ui-tip active"
              : "collapsed-rail-action ui-tip"
          }
          data-tip={t("shell.aiLog.label")}
          aria-label={t("shell.aiLog.label")}
          onClick={toggleAiLog}
        >
          <History size={17} />
        </button>
      </aside>
      )}
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const searchSectionByEntityType: Record<string, { route: string; viewStateKey: string }> = {
  scene: { route: "editor", viewStateKey: "searchSceneId" },
  character: { route: "characters", viewStateKey: "searchCharacterId" },
  world_element: { route: "world", viewStateKey: "searchElementId" }
};

function ProjectSearch({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setProjectViewState = useProjectNavigationStore(
    (state) => state.setProjectViewState
  );
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      searchProject(projectId, trimmed)
        .then((items) => {
          setResults(items);
          setOpen(true);
        })
        .catch(() => setResults([]));
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [projectId, query]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function openResult(result: SearchResult) {
    const section = searchSectionByEntityType[result.entityType];
    if (!section) {
      return;
    }
    setProjectViewState(projectId, section.viewStateKey, result.entityId);
    setOpen(false);
    setQuery("");
    void navigate({
      to: `/projects/$projectId/${section.route}`,
      params: { projectId }
    });
  }

  return (
    <div className="project-search" ref={containerRef}>
      <label className="project-search-input">
        <Search size={15} aria-hidden="true" />
        <input
          type="search"
          value={query}
          placeholder={t("shell.search.placeholder")}
          aria-label={t("shell.search.ariaLabel")}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => results.length && setOpen(true)}
        />
      </label>
      {open && query.trim().length >= 2 ? (
        <div className="project-search-results" role="listbox" aria-label={t("shell.search.resultsLabel")}>
          {results.length === 0 ? (
            <p className="muted-text">{t("shell.search.noResults")}</p>
          ) : (
            results.map((result) => (
              <button
                type="button"
                key={`${result.entityType}:${result.entityId}`}
                className="project-search-result"
                onClick={() => openResult(result)}
              >
                <span className="project-search-kind">
                  {searchSectionByEntityType[result.entityType]
                    ? t(`shell.search.kind.${result.entityType}`)
                    : result.entityType}
                </span>
                <strong>{result.title || t("shell.search.untitled")}</strong>
                <span className="project-search-snippet">{result.snippet}</span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
