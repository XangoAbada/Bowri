import { CONSISTENCY_AUDIT_FIELD } from "./consistencyAuditPromptPackage";
import { SCENE_CRITIQUE_FIELD } from "./sceneCritiquePromptPackage";
import { SCENE_STORY_BIBLE_AUDIT_FIELD } from "./sceneStoryBibleAuditPromptPackage";

// Jedno miejsce z wiedzą "wynik tej generacji to raport, nie wartość do zapisania".
// Panel propozycji i log AI muszą odpowiadać tak samo — kiedy log zgadywał sam,
// pokazywał przycisk zapisu dla audytu spójności, a ten kończył się błędem
// updateBookConcept(bookId, undefined).
//
// Moduł zależy wyłącznie od trzech stałych z pakietów promptów, więc nie tworzy
// cyklu importów z AiProposalPanel.

/**
 * Pola, których wynik jest raportem (listą uwag), a nie treścią pojedynczego pola.
 * Poprawki z takiego raportu stosuje się osobno — w panelu analizy albo w logu AI.
 */
export const REPORT_ONLY_FIELDS: readonly string[] = [
  SCENE_STORY_BIBLE_AUDIT_FIELD,
  SCENE_CRITIQUE_FIELD,
  CONSISTENCY_AUDIT_FIELD
];

export function isReportOnlyField(field: string): boolean {
  return REPORT_ONLY_FIELDS.includes(field);
}

/**
 * Przebieg audytu spójności. Takie propozycje nie renderują się jako kafelek
 * kolejki — postęp n/6 pokazuje karta raportu — ale runner kolejki nadal je
 * przetwarza.
 */
export function isConsistencyAuditField(field: string): boolean {
  return field === CONSISTENCY_AUDIT_FIELD;
}
