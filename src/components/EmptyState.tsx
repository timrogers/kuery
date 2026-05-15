import { useEffect, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { debugInfo, type DebugInfo } from "../api";

interface EmptyStateProps {
  onShowWelcome: () => void;
}

export function EmptyState({ onShowWelcome }: EmptyStateProps) {
  const [debug, setDebug] = useState<DebugInfo | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  useEffect(() => {
    debugInfo().then(setDebug).catch(() => {});
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

  return (
    <div className="empty-state">
      <div className="empty-state-card">
        <h1>No queries yet</h1>
        <p className="hint">
          Kuery captures the Kusto queries you run so you can find and reuse
          them later. Hook up one or both sources below and queries will start
          showing up here automatically.
        </p>

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

        <p className="hint">
          Need the full walkthrough?{" "}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              onShowWelcome();
            }}
          >
            Open the welcome guide
          </a>
          .
        </p>
      </div>
    </div>
  );
}
