import { useEffect, useState } from "react";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";
import { setSetting } from "../api";

interface WelcomeModalProps {
  onClose: () => void;
}

export function WelcomeModal({ onClose }: WelcomeModalProps) {
  const [autostart, setAutostart] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    isEnabled()
      .then((enabled) => setAutostart(enabled))
      .catch(() => {});
  }, []);

  async function applyAutostart(next: boolean) {
    try {
      if (next) {
        await enable();
      } else {
        await disable();
      }
      setAutostart(next);
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }

  async function finish() {
    setBusy(true);
    try {
      await setSetting("welcome_completed", "1");
      onClose();
    } catch (e) {
      setError(String(e));
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>Welcome to Kuery</h2>
        </header>

        <p className="hint">
          Kuery captures the Kusto queries you run so you can find and reuse
          them later — across the browser and your AI agents.
        </p>

        <section>
          <h3>Runs in the menu bar</h3>
          <p className="hint">
            Kuery is designed to run quietly in the background. On macOS it
            lives in your menu bar instead of the Dock — click the tray icon
            to open this window any time, or to quit the app. Closing this
            window just hides it; the capture API and MCP server keep
            running.
          </p>
        </section>

        <section>
          <h3>Launch at login</h3>
          <p className="hint">
            For Kuery to capture queries it needs to be running. We recommend
            letting it start automatically when you log in. You can change
            this later from Settings.
          </p>
          <label className="filter-toggle">
            <input
              type="checkbox"
              checked={autostart}
              onChange={(e) => applyAutostart(e.target.checked)}
            />
            Start Kuery when I log in
          </label>
        </section>

        <section>
          <h3>Where queries come from</h3>
          <ul className="hint">
            <li>
              <strong>Browser:</strong> install the bundled Chrome extension
              and Kuery will auto-capture queries you run in Azure Data
              Explorer.
            </li>
            <li>
              <strong>AI agents:</strong> install the Copilot CLI hook and
              Kuery will auto-capture queries your agents run via the Kusto
              MCP server.
            </li>
          </ul>
          <p className="hint">
            Setup instructions for both are in the project README.
          </p>
        </section>

        {error && <div className="error">{error}</div>}

        <div className="row">
          <button onClick={finish} disabled={busy}>
            Get started
          </button>
        </div>
      </div>
    </div>
  );
}
