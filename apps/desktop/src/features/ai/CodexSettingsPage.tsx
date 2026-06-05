import { SlidersHorizontal } from "lucide-react";
import { CodexStatusPanel } from "./CodexStatusPanel";
import { useCodexSettingsStore } from "./codexSettingsStore";

export function CodexSettingsPage() {
  const timeoutSeconds = useCodexSettingsStore((state) => state.timeoutSeconds);
  const setTimeoutSeconds = useCodexSettingsStore(
    (state) => state.setTimeoutSeconds
  );

  return (
    <section className="content-panel settings-content">
      <div className="section-title-row">
        <div>
          <p className="eyebrow">Ustawienia</p>
          <h2>Codex CLI Bridge</h2>
        </div>
        <SlidersHorizontal size={20} aria-hidden="true" />
      </div>

      <CodexStatusPanel />

      <label className="field-label narrow">
        Timeout generowania
        <input
          type="number"
          min={30}
          max={600}
          step={30}
          value={timeoutSeconds}
          onChange={(event) => setTimeoutSeconds(Number(event.target.value))}
        />
      </label>
    </section>
  );
}
