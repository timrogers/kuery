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
          them later — across the browser and your AI agents. Hook up one or
          both sources below and queries will start showing up here
          automatically.
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
              disabled={!autostartLoaded}
              onChange={(e) => applyAutostart(e.target.checked)}
            />
            Start Kuery when I log in
          </label>
          {autostartError && <div className="error">{autostartError}</div>}
        </section>

        <section>
          <h3>Capture from Azure Data Explorer (Chrome)</h3>
          <p className="hint">
            Install the bundled Chrome extension to auto-capture queries you
            run at{" "}
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
        </section>

        <section>
          <h3>Capture from Copilot CLI agents</h3>
          <p className="hint">
            Install the Kuery plugin so the agent's Kusto MCP queries get
            captured here, and so it can search your saved queries:
          </p>
          <div className="row">
            <code className="cli-snippet">{installCommand}</code>
            <button onClick={copyInstall}>{copyStatus ?? "Copy"}</button>
          </div>
          <p className="hint">
            Restart any active <code>copilot</code> sessions afterwards so
            they pick up the new hook and MCP server.
          </p>
        </section>
      </div>
    </div>
  );
}
