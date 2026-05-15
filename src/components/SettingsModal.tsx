import { useEffect, useState } from "react";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";
import {
  debugInfo,
  exportDatabase,
  importDatabase,
  type DebugInfo,
} from "../api";

interface Props {
  onClose: () => void;
  onChanged: () => void;
}

export function SettingsModal({ onClose, onChanged }: Props) {
  const [autostart, setAutostart] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [debug, setDebug] = useState<DebugInfo | null>(null);

  useEffect(() => {
    isEnabled()
      .then((v) => setAutostart(v))
      .catch(() => {});
    debugInfo().then(setDebug).catch(() => {});
  }, []);

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setStatus(`Copied ${label} to clipboard.`);
    } catch (e) {
      setStatus(`Couldn't copy ${label}: ${e}`);
    }
  }

  async function openLog() {
    if (!debug) return;
    try {
      await openPath(debug.log_file);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus(`Couldn't open log file: ${msg}. Try 'Show in folder' instead.`);
    }
  }

  async function revealLog() {
    if (!debug) return;
    try {
      await revealItemInDir(debug.log_file);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus(`Couldn't reveal log file: ${msg}`);
    }
  }

  async function toggleAutostart(next: boolean) {
    try {
      if (next) {
        await enable();
      } else {
        await disable();
      }
      setAutostart(next);
      setStatus(next ? "Will start at login." : "Won't start at login.");
    } catch (e) {
      setStatus(`Couldn't update startup setting: ${e}`);
    }
  }

  async function exportDb() {
    const dest = await saveDialog({
      defaultPath: "kuery.sqlite",
      filters: [{ name: "SQLite", extensions: ["sqlite"] }],
    });
    if (!dest) return;
    await exportDatabase(dest);
    setStatus(`Exported to ${dest}`);
  }

  async function importDb() {
    const src = await openDialog({
      multiple: false,
      filters: [{ name: "SQLite", extensions: ["sqlite"] }],
    });
    if (!src || typeof src !== "string") return;
    const summary = await importDatabase(src);
    setStatus(
      `Imported ${summary.imported} new, merged ${summary.merged}` +
        (summary.skipped ? `, skipped ${summary.skipped}` : ""),
    );
    onChanged();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>Settings</h2>
          <button onClick={onClose}>×</button>
        </header>

        <section>
          <h3>Startup</h3>
          <p className="hint">
            Kuery only captures queries while it's running. Launching at login
            keeps capture continuous across reboots.
          </p>
          <label className="filter-toggle">
            <input
              type="checkbox"
              checked={autostart}
              onChange={(e) => toggleAutostart(e.target.checked)}
            />
            Start Kuery when I log in
          </label>
        </section>

        <section>
          <h3>Database</h3>
          <p className="hint">
            Export your full query history or import from another device or the
            legacy Chrome extension.
          </p>
          <div className="row">
            <button onClick={exportDb}>Export</button>
            <button onClick={importDb}>Import</button>
          </div>
        </section>

        <section>
          <h3>Copilot CLI plugin</h3>
          <p className="hint">
            Capture KQL run by AI agents and let them search your saved queries
            via MCP. Install with:
          </p>
          <div className="row">
            <code className="cli-snippet">
              {debug?.install_command ?? "copilot plugin install timrogers/kuery:plugin"}
            </code>
            <button
              onClick={() =>
                copy(
                  debug?.install_command ??
                    "copilot plugin install timrogers/kuery:plugin",
                  "install command",
                )
              }
            >
              Copy
            </button>
          </div>
          <p className="hint">
            Requires{" "}
            <a href="https://docs.github.com/en/copilot/concepts/agents/copilot-cli" target="_blank">
              GitHub Copilot CLI
            </a>
            . Run the command in your terminal — restart any active{" "}
            <code>copilot</code> sessions afterwards.
          </p>
        </section>

        <section>
          <h3>Logs</h3>
          <p className="hint">
            Persistent logs for the HTTP API and MCP server. Useful when the
            extension or CLI plugin isn't reaching Kuery.
          </p>
          {debug && (
            <>
              <div className="row">
                <code className="cli-snippet">{debug.log_file}</code>
              </div>
              <div className="row">
                <button onClick={openLog}>Open log file</button>
                <button onClick={revealLog}>Show in folder</button>
                <button onClick={() => copy(debug.log_file, "log path")}>
                  Copy path
                </button>
              </div>
            </>
          )}
        </section>

        <section>
          <h3>Help</h3>
          <p className="hint">
            Need to walk through setup again? Delete all your queries (or
            install Kuery on a fresh machine) and the welcome guide reappears
            here as the empty state.
          </p>
        </section>

        {status && <div className="status">{status}</div>}
      </div>
    </div>
  );
}
