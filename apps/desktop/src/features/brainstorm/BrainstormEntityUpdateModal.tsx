import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Field, Modal } from "../../shared/ui";
import type { BrainstormSuggestion } from "../../shared/api/types";
import {
  BRAINSTORM_ENTITY_FIELDS,
  entityFieldTarget,
  type BrainstormEntityKind
} from "../ai/brainstormEntityTargets";
import {
  applyEntityFieldUpdate,
  EntityNotFoundError,
  mergeFieldValue,
  UnknownEntityFieldError
} from "../ai/entityFieldUpdate";

export type EntityUpdateCandidate = {
  id: string;
  name: string;
  /** Bieżąca treść pól z whitelisty — źródło sekcji „Obecna treść". */
  fields: Record<string, string>;
};

/**
 * Potwierdzenie aktualizacji pola istniejącej encji. Zapis idzie prosto do
 * bazy (bez kolejki propozycji i bez kolejnego wywołania modelu), więc autor
 * musi zobaczyć trzy rzeczy: co jest teraz, co proponuje AI i co zostanie
 * zapisane. Cel wskazany przez AI można zmienić — model bywa nieprecyzyjny,
 * a przy nieznanym id picker jest jedyną drogą dalej.
 */
export function BrainstormEntityUpdateModal({
  projectId,
  bookId,
  kind,
  suggestion,
  candidates,
  onClose,
  onDismiss,
  onApplied
}: {
  projectId: string;
  bookId: string;
  kind: BrainstormEntityKind;
  suggestion: BrainstormSuggestion;
  candidates: EntityUpdateCandidate[];
  onClose: () => void;
  onDismiss: () => void;
  onApplied: () => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const fields = BRAINSTORM_ENTITY_FIELDS[kind];

  const suggestedEntity = candidates.find((item) => item.id === suggestion.targetEntityId);
  const [entityId, setEntityId] = useState(suggestedEntity?.id ?? "");
  const [field, setField] = useState(
    suggestion.targetField && entityFieldTarget(kind, suggestion.targetField)
      ? suggestion.targetField
      : fields[0].key
  );
  // Cel nierozpoznany (np. halucynowane id) → od razu pokazujemy wybór encji,
  // zamiast zostawiać autora z pustym nagłówkiem.
  const [pickerOpen, setPickerOpen] = useState(!suggestedEntity);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const entity = candidates.find((item) => item.id === entityId) ?? null;
  const currentValue = (entity?.fields[field] ?? "").trim();
  const target = entityFieldTarget(kind, field);
  const canAppend = Boolean(currentValue) && (target?.multiline ?? true);

  const sortedCandidates = useMemo(
    () => [...candidates].sort((a, b) => a.name.localeCompare(b.name, "pl")),
    [candidates]
  );

  async function apply(mode: "append" | "replace") {
    if (!entity || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await applyEntityFieldUpdate({
        projectId,
        bookId,
        kind,
        entityId: entity.id,
        field,
        value: suggestion.value,
        mode
      });
      await onApplied();
    } catch (caught) {
      setError(
        caught instanceof EntityNotFoundError
          ? t("brainstorm.entityNotFound")
          : caught instanceof UnknownEntityFieldError
            ? t("brainstorm.entityFieldNotAllowed", { field })
            : t("brainstorm.entityUpdateError", {
                error: caught instanceof Error ? caught.message : String(caught)
              })
      );
      setBusy(false);
    }
  }

  return (
    <Modal
      title={t("brainstorm.updateModalTitle", { title: suggestion.title })}
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("brainstorm.cancel")}
          </Button>
          <Button variant="ghost" onClick={onDismiss}>
            {t("brainstorm.dismiss")}
          </Button>
          {canAppend ? (
            <Button
              variant="secondary"
              busy={busy}
              disabled={!entity}
              onClick={() => void apply("append")}
            >
              {t("brainstorm.append")}
            </Button>
          ) : null}
          <Button
            variant="primary"
            busy={busy}
            disabled={!entity}
            onClick={() => void apply("replace")}
          >
            {currentValue ? t("brainstorm.replace") : t("brainstorm.insert")}
          </Button>
        </>
      }
    >
      <div className="brainstorm-entity-update">
        <div className="brainstorm-entity-target">
          <div>
            <p className="eyebrow">{t("brainstorm.updateTargetLabel")}</p>
            <p className="brainstorm-entity-target-name">
              {entity ? entity.name : t("brainstorm.targetMissing")}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPickerOpen((open) => !open)}
            title={t("brainstorm.pickTargetTitle")}
          >
            {t("brainstorm.changeTarget")}
          </Button>
        </div>

        {pickerOpen ? (
          <div className="brainstorm-entity-picker" role="listbox" aria-label={t("brainstorm.pickTargetTitle")}>
            {sortedCandidates.map((candidate) => (
              <button
                type="button"
                key={candidate.id}
                role="option"
                aria-selected={candidate.id === entityId}
                className={candidate.id === entityId ? "is-selected" : undefined}
                onClick={() => {
                  setEntityId(candidate.id);
                  setPickerOpen(false);
                }}
              >
                {candidate.name}
              </button>
            ))}
            {sortedCandidates.length === 0 ? (
              <p className="muted-text">{t("brainstorm.noTargets")}</p>
            ) : null}
          </div>
        ) : null}

        <Field label={t("brainstorm.updateFieldLabel")}>
          <select value={field} onChange={(event) => setField(event.target.value)}>
            {fields.map((option) => (
              <option value={option.key} key={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>

        <div className="brainstorm-concept-preview">
          <section>
            <p className="eyebrow">{t("brainstorm.currentContent")}</p>
            <p className="brainstorm-concept-value">
              {currentValue || t("brainstorm.emptyFieldPlaceholder")}
            </p>
          </section>
          <section>
            <p className="eyebrow">{t("brainstorm.proposalFromBrainstorm")}</p>
            <p className="brainstorm-concept-value">{suggestion.value}</p>
            <small className="muted-text">{suggestion.reason}</small>
          </section>
          {/* „Zastąp" daje dokładnie treść propozycji z sekcji obok, więc osobny
              podgląd potrzebny jest tylko dla dopisania. */}
          {canAppend ? (
            <section>
              <p className="eyebrow">{t("brainstorm.afterAppend")}</p>
              <p className="brainstorm-concept-value">
                {mergeFieldValue(currentValue, suggestion.value, "append")}
              </p>
              <small className="muted-text">{t("brainstorm.afterAppendHint")}</small>
            </section>
          ) : null}
        </div>

        {error ? <p className="warning-text">{error}</p> : null}
      </div>
    </Modal>
  );
}
