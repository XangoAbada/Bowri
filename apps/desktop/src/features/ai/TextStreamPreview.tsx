import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useProposalStore } from "./proposalStore";

// Podgląd generacji tekstu na żywo. Pokazuje ogon odpowiedzi spływającej z
// modelu (backend przysyła ostatnie ~2000 znaków, nie całość) i licznik
// odebranych znaków. Stan jest ulotny — nie ma go w bazie i po restarcie
// aplikacji nie wraca.
//
// Sens: przebieg analizy spójności ma podłogę timeoutu 30 minut i do tej pory
// autor widział tylko spinner. Tutaj widzi, że model faktycznie pisze.

type TextStreamPreviewProps = {
  text: string;
  chars: number;
};

export function TextStreamPreview({ text, chars }: TextStreamPreviewProps) {
  const { t } = useTranslation();
  const bodyRef = useRef<HTMLPreElement>(null);

  // Autoscroll do dołu: bez tego widać początek ogona, a nie to, co dopiero
  // przyszło. Ref, nie scrollIntoView — inaczej przewijałaby się cała strona.
  useEffect(() => {
    const node = bodyRef.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [text]);

  return (
    <div className="ai-stream-preview" role="status" aria-live="polite">
      <div className="ai-stream-preview-head">
        <span className="ai-stream-preview-dot" aria-hidden="true" />
        <span>{t("ai.streamPreview.label")}</span>
        <span className="ai-stream-preview-count">
          {t("ai.streamPreview.chars", { count: chars })}
        </span>
      </div>
      <pre className="ai-stream-preview-body" ref={bodyRef}>
        {text}
      </pre>
    </div>
  );
}

/**
 * Podgląd generacji konkretnej propozycji z kolejki. Używają go i strona
 * Analiza (per przebieg), i karta audytu w panelu AI (przebieg aktualnie
 * biegnący) — obie znają tylko `proposalId`, resztę bierzemy ze store'u.
 *
 * Dwa osobne selektory zwracające wartości proste, a nie jeden zwracający
 * obiekt: zustand porównuje wynik selektora referencyjnie, więc obiekt
 * przerysowywałby komponent przy każdej zmianie w store.
 */
export function ProposalStreamPreview({ proposalId }: { proposalId?: string }) {
  const text = useProposalStore((state) =>
    proposalId ? state.proposals.find((item) => item.id === proposalId)?.partialText : undefined
  );
  const chars = useProposalStore((state) =>
    proposalId
      ? state.proposals.find((item) => item.id === proposalId)?.partialTextChars
      : undefined
  );

  if (!text) {
    return null;
  }

  return <TextStreamPreview text={text} chars={chars ?? text.length} />;
}
