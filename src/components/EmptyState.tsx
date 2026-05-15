import { useEffect, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";
import { debugInfo, type DebugInfo } from "../api";

export function EmptyState() {
  const [debug, setDebug] = useState<DebugInfo | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [autostart, setAutostart] = useState(false);
  const [autostartLoaded, setAutostartLoaded] = useState(false);
  const [autostartError, setAutostartError] = useState<string | null>(null);

  useEffect(() => {
    debugInfo().then(setDebug).catch(() => {});
    isEnabled()
      .then((v) => {
        setAutostart(v);
        setAutostartLoaded(true);
      })
      .catch(() => setAutostartLoaded(true));
  }, []);

  const installCommand =
    debug?.install_command ?? "copilot plugin install timrogers/kuery:plugin";

  async function copyInstall() {
    try {
      await navigator.clipboard.writeText(installCommand);
      setCopyStatus("Copied!");
      setTimeout(() => setCopyStatus(null), 2000);
    } catch (e) {
      setCopyStatus(`Couldn't copy: ${e}`);
    }
  }

  async function applyAutostart(next: boolean) {
    try {
      if (next) {
        await enable();
      } else {
        await disable();
      }
      setAutostart(next);
      setAutostartError(null);
    } catch (e) {
      setAutostartError(String(e));
    }
  }

  return (
    <div className="empty-state">
      <div className="empty-state-card">
        <h1>Get started with Kuery</h1>
        <p className="hint">
          Kuery captures the Kusto queries you run so you can find and reuse
          them later — across the browser and your AI agents.
        </p>
        <p className="hint">
          On macOS it lives in your menu bar; closing this window just hides
          it while the capture API and MCP server keep running.
        </p>

        <ol className="setup-list">
          <li className="setup-step">
            <div className="setup-step-number">1</div>
            <div className="setup-step-body">
              <h3>Launch Kuery automatically</h3>
              <p className="hint">
                Kuery can only capture queries while it's running. Letting
                it start at login means it's always there in the background
                ready to log queries from Chrome and the Copilot CLI —
                without you having to remember to open it.
              </p>
              <label className="filter-toggle">
                <input
                  type="checkbox"
                  checked={autostart}
                  disabled={!autostartLoaded}
                  onChange={(e) => applyAutostart(e.target.checked)}
                />
                Start Kuery when I log in
              </label>
              {autostartError && <div className="error">{autostartError}</div>}
            </div>
          </li>

          <li className="setup-step">
            <div className="setup-step-number">2</div>
            <div className="setup-step-body">
              <h3>Add Kuery to Chrome</h3>
              <p className="hint">
                Install the bundled Chrome extension to auto-capture queries
                you run at{" "}
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    openUrl("https://dataexplorer.azure.com/");
                  }}
                >
                  dataexplorer.azure.com
                </a>
                :
              </p>
              <ol className="hint setup-steps">
                <li>
                  Open <code>chrome://extensions</code> and enable{" "}
                  <strong>Developer mode</strong> (top-right).
                </li>
                <li>
                  Click <strong>Load unpacked</strong> and select the{" "}
                  <code>chrome-extension/</code> folder from the Kuery repo
                  checkout.
                </li>
                <li>Refresh any open Azure Data Explorer tabs.</li>
              </ol>
            </div>
          </li>

          <li className="setup-step">
            <div className="setup-step-number">3</div>
            <div className="setup-step-body">
              <h3>Add Kuery to Copilot CLI</h3>
              <p className="hint">
                Install the Kuery plugin so the agent's Kusto MCP queries
                get captured here, and so it can search your saved queries:
              </p>
              <div className="row">
                <code className="cli-snippet">{installCommand}</code>
                <button onClick={copyInstall}>{copyStatus ?? "Copy"}</button>
              </div>
              <p className="hint">
                Restart any active <code>copilot</code> sessions afterwards
                so they pick up the new hook and MCP server.
              </p>
            </div>
          </li>
        </ol>
      </div>
    </div>
  );
}
