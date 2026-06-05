import { Check, FileJson, RotateCcw, X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateBookConcept } from "../../shared/api/commands";
import { useProposalStore } from "./proposalStore";

type AiProposalPanelProps = {
  projectId: string;
};

export function AiProposalPanel({ projectId }: AiProposalPanelProps) {
  const queryClient = useQueryClient();
  const proposal = useProposalStore((state) => state.titleProposal);
  const selectTitle = useProposalStore((state) => state.selectTitle);
  const clearTitleProposal = useProposalStore((state) => state.clearTitleProposal);

  const visibleProposal =
    proposal && proposal.projectId === projectId ? proposal : null;

  const acceptMutation = useMutation({
    mutationFn: async () => {
      if (!visibleProposal) {
        return null;
      }

      return updateBookConcept(visibleProposal.bookId, {
        workingTitle: visibleProposal.selectedTitle
      });
    },
    onSuccess: async () => {
      clearTitleProposal();
      await queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
    }
  });

  if (!visibleProposal) {
    return (
      <section className="context-section compact">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">Propozycje</p>
            <h2>Panel AI</h2>
          </div>
          <FileJson size={18} aria-hidden="true" />
        </div>
        <p className="muted-text">
          Wyniki AI pojawia sie tutaj i wymagaja decyzji przed zapisem.
        </p>
      </section>
    );
  }

  return (
    <section className="context-section compact proposal-panel">
      <div className="section-title-row">
        <div>
          <p className="eyebrow">Codex CLI</p>
          <h2>Propozycje tytulow</h2>
        </div>
        <span className="status-pill">pending</span>
      </div>

      <p className="muted-text">{visibleProposal.parsed.summary}</p>

      <div className="proposal-list">
        {visibleProposal.parsed.items.map((item) => (
          <label className="proposal-option" key={`${item.title}:${item.subtitle ?? ""}`}>
            <input
              type="radio"
              name="title-proposal"
              checked={visibleProposal.selectedTitle === item.title}
              onChange={() => selectTitle(item.title)}
            />
            <span>
              <strong>{item.title}</strong>
              {item.subtitle ? <small>{item.subtitle}</small> : null}
              {item.rationale ? <em>{item.rationale}</em> : null}
            </span>
          </label>
        ))}
      </div>

      {visibleProposal.parsed.warnings.length > 0 ? (
        <div className="warning-box">
          {visibleProposal.parsed.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}

      <details className="raw-output">
        <summary>Surowy wynik</summary>
        <pre>{visibleProposal.rawOutput}</pre>
      </details>

      <div className="button-row">
        <button
          type="button"
          className="primary-button"
          onClick={() => acceptMutation.mutate()}
          disabled={acceptMutation.isPending || !visibleProposal.selectedTitle}
        >
          <Check size={16} />
          Akceptuj
        </button>
        <button
          type="button"
          className="ghost-button"
          onClick={() => clearTitleProposal()}
          disabled={acceptMutation.isPending}
        >
          <X size={16} />
          Odrzuc
        </button>
        <button type="button" className="ghost-button" disabled>
          <RotateCcw size={16} />
          Ponow
        </button>
      </div>

      {acceptMutation.isError ? (
        <p className="warning-text">Nie udalo sie zapisac wybranego tytulu.</p>
      ) : null}
    </section>
  );
}
