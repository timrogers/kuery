import { useEffect, useState } from "react";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import {
  exportDatabase,
  getSetting,
  importDatabase,
  setSetting,
} from "../api";

interface Props {
  onClose: () => void;
  onChanged: () => void;
}

const TOKEN_KEY = "github_models_token";

export function SettingsModal({ onClose, onChanged }: Props) {
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    getSetting(TOKEN_KEY).then((v) => setToken(v ?? ""));
  }, []);

  async function saveToken() {
    await setSetting(TOKEN_KEY, token.trim() === "" ? null : token.trim());
    setStatus("Token saved.");
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
    await importDatabase(src);
    setStatus("Import complete. Restart Kuery to see imported queries.");
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
          <h3>GitHub Models token</h3>
          <p className="hint">
            Used to generate AI descriptions of captured queries. Free with a
            GitHub account at{" "}
            <a href="https://github.com/settings/tokens" target="_blank">
              github.com/settings/tokens
            </a>
            .
          </p>
          <div className="row">
            <input
              type="password"
              placeholder="ghp_…"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
            <button onClick={saveToken}>Save</button>
          </div>
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

        {status && <div className="status">{status}</div>}
      </div>
    </div>
  );
}
