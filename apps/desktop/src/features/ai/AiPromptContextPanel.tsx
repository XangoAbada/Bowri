import {
  CheckCircle2,
  RotateCcw,
  Send,
  SlidersHorizontal,
  X
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  isSourceSelected,
  useAiPromptContextStore
} from "./aiPromptContextStore";
import { Button } from "../../shared/ui";

export function AiPromptContextPanel() {
  const { t } = useTranslation();
  const activeTargetId = useAiPromptContextStore((state) => state.activeTargetId);
  const target = useAiPromptContextStore((state) =>
    activeTargetId ? state.targets[activeTargetId] : null
  );
  const draft = useAiPromptContextStore((state) =>
    activeTargetId ? state.drafts[activeTargetId] : undefined
  );
  const setAuthorPriorityComment = useAiPromptContextStore(
    (state) => state.setAuthorPriorityComment
  );
  const toggleContextKey = useAiPromptContextStore(
    (state) => state.toggleContextKey
  );
  const resetDraft = useAiPromptContextStore((state) => state.resetDraft);
  const submitActiveTarget = useAiPromptContextStore(
    (state) => state.submitActiveTarget
  );
  const closeActiveTarget = useAiPromptContextStore(
    (state) => state.closeActiveTarget
  );

  if (!activeTargetId || !target) {
    return null;
  }

  const selectedCount = target.sources.filter((source) =>
    isSourceSelected(source, draft)
  ).length;

  let promptChars: number | null = null;
  if (target.renderPrompt) {
    try {
      promptChars = target.renderPrompt().length;
    } catch {
      promptChars = null;
    }
  }

  return (
    <section
      className="context-section compact prompt-context-panel"
      aria-label={t("ai.promptContext.sectionLabel")}
    >
      <div className="section-title-row">
        <div>
          <p className="eyebrow">{t("ai.promptContext.eyebrow")}</p>
          <h2>{target.title}</h2>
          <p className="muted-text provider-subtitle">{target.subtitle}</p>
        </div>
        <div className="prompt-context-actions">
          <span className="status-pill">
            <SlidersHorizontal size={14} aria-hidden="true" />
            {selectedCount}/{target.sources.length}
          </span>
          {promptChars !== null ? (
            <span
              className="status-pill"
              title={t("ai.promptContext.promptSizeTitle")}
            >
              {"~"}
              {Intl.NumberFormat("pl-PL").format(promptChars)}
              {" "}
              {t("ai.promptContext.chars")}
            </span>
          ) : null}
          <Button
            variant="icon"
            className="prompt-context-reset"
            onClick={() => resetDraft(activeTargetId)}
            title={t("ai.promptContext.reset")}
            aria-label={t("ai.promptContext.reset")}
          >
            <RotateCcw size={15} />
          </Button>
          <Button
            variant="icon"
            className="prompt-context-close"
            onClick={closeActiveTarget}
            title={t("ai.promptContext.close")}
            aria-label={t("ai.promptContext.close")}
          >
            <X size={15} />
          </Button>
        </div>
      </div>

      <div className="prompt-context-list">
        {target.sources.map((source) => {
          const selected = isSourceSelected(source, draft);
          return (
            <div
              className={
                source.required
                  ? "prompt-context-source required"
                  : "prompt-context-source"
              }
              key={source.key}
            >
              <input
                type="checkbox"
                aria-label={t("ai.promptContext.sourceAria", { label: source.label })}
                checked={selected}
                disabled={source.required}
                onChange={() => toggleContextKey(activeTargetId, source.key)}
              />
              <span>{source.label}</span>
              {source.required ? (
                <em>
                  <CheckCircle2 size={13} aria-hidden="true" />
                  {t("ai.promptContext.required")}
                </em>
              ) : null}
            </div>
          );
        })}
      </div>

      <label className="field-label">
        {t("ai.promptContext.authorComment")}
        <textarea
          className="prompt-context-comment"
          value={draft?.authorPriorityComment ?? ""}
          onChange={(event) =>
            setAuthorPriorityComment(activeTargetId, event.target.value)
          }
          placeholder={t("ai.promptContext.authorCommentPlaceholder")}
          rows={3}
        />
      </label>

      <div className="prompt-context-command-row">
        <Button
          variant="primary"
          block
          className="prompt-context-submit"
          onClick={submitActiveTarget}
          disabled={target.submitDisabled || !target.onSubmit}
          title={
            target.submitDisabled
              ? target.submitDisabledReason ?? t("ai.promptContext.submitDisabled")
              : t("ai.promptContext.submitTitle")
          }
        >
          <Send size={15} aria-hidden="true" />
          {target.submitLabel ?? t("ai.promptContext.submit")}
        </Button>
      </div>
    </section>
  );
}
