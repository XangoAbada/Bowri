import { AlertCircle, CheckCircle2, RefreshCw, Terminal } from "lucide-react";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { checkCodexCli } from "../../shared/api/commands";
import { useCodexSettingsStore } from "./codexSettingsStore";

type CodexStatusPanelProps = {
  compact?: boolean;
};

export function CodexStatusPanel({ compact = false }: CodexStatusPanelProps) {
  const queryClient = useQueryClient();
  const codexPath = useCodexSettingsStore((state) => state.codexPath);
  const setCodexPath = useCodexSettingsStore((state) => state.setCodexPath);
  const [draftPath, setDraftPath] = useState(codexPath);

  const statusQuery = useQuery({
    queryKey: ["codex-cli", codexPath],
    queryFn: () => checkCodexCli(codexPath),
    retry: 0
  });

  const status = statusQuery.data;
  const unavailable = statusQuery.isError || status?.available === false;
  const ready = status?.available === true;

  function handleCheck() {
    const nextPath = draftPath.trim() || "codex";
    setCodexPath(nextPath);
    void queryClient.invalidateQueries({ queryKey: ["codex-cli", nextPath] });
  }

  return (
    <section className={compact ? "context-section compact" : "settings-panel"}>
      <div className="section-title-row">
        <div>
          <p className="eyebrow">AI provider</p>
          <h2>{compact ? "Codex CLI" : "Status Codex CLI"}</h2>
        </div>
        <span
          className={
            ready ? "status-pill ready" : unavailable ? "status-pill muted" : "status-pill"
          }
        >
          {ready ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          {ready ? "Gotowy" : statusQuery.isLoading ? "Sprawdzam" : "Konfiguracja"}
        </span>
      </div>

      <label className="field-label">
        Sciezka do binarki
        <div className="inline-control">
          <Terminal size={16} aria-hidden="true" />
          <input
            value={draftPath}
            onChange={(event) => setDraftPath(event.target.value)}
            placeholder="codex"
          />
          <button
            type="button"
            className="icon-button"
            onClick={handleCheck}
            title="Sprawdz Codex CLI"
            aria-label="Sprawdz Codex CLI"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </label>

      {status?.version ? (
        <p className="muted-text">Wersja: {status.version}</p>
      ) : null}

      {statusQuery.isError ? (
        <p className="warning-text">
          Backend Tauri nie jest dostepny w tym widoku albo komenda nie mogla
          zostac wykonana.
        </p>
      ) : null}

      {status?.message ? <p className="muted-text">{status.message}</p> : null}

      {!compact && unavailable ? (
        <p className="help-text">
          Uruchom `codex` w terminalu i zaloguj sie oficjalna metoda Codex CLI.
          StoryForge2 nie zapisuje tokenow ani danych logowania.
        </p>
      ) : null}
    </section>
  );
}
