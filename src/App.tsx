import { useCallback, useEffect, useState } from "react";
import { QueryList } from "./components/QueryList";
import { QueryDetail } from "./components/QueryDetail";
import { SettingsModal } from "./components/SettingsModal";
import { WelcomeModal } from "./components/WelcomeModal";
import { useDebounced } from "./hooks";
import {
  agentSearch,
  type AgentProgress,
  deleteQuery,
  getSetting,
  searchQueries,
  updateQuery,
} from "./api";
import type { Query } from "./types";
import "./App.css";

function App() {
  const [search, setSearch] = useState("");
  const [starredOnly, setStarredOnly] = useState(false);
  const [smartMode, setSmartMode] = useState(false);
  const [smartLoading, setSmartLoading] = useState(false);
  const [smartProgress, setSmartProgress] = useState<string | null>(null);
  const [smartMessage, setSmartMessage] = useState<string | null>(null);
  const [queries, setQueries] = useState<Query[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedSearch = useDebounced(search, 200);

  useEffect(() => {
    getSetting("welcome_completed")
      .then((v) => setShowWelcome(v !== "1"))
      .catch(() => {});
  }, []);

  const reload = useCallback(async () => {
    // Smart-mode results are agent-selected and shouldn't be clobbered by
    // the periodic FTS refresh below; let the smart-search submit handler
    // own that result set until the user switches back to literal search.
    if (smartMode) return;
    try {
      const rows = await searchQueries(debouncedSearch, starredOnly, 200);
      setQueries(rows);
      setError(null);
      if (rows.length > 0 && !rows.some((q) => q.id === selectedId)) {
        setSelectedId(rows[0].id);
      } else if (rows.length === 0) {
        setSelectedId(null);
      }
    } catch (e) {
      setError(String(e));
    }
  }, [debouncedSearch, starredOnly, selectedId, smartMode]);

  useEffect(() => {
    reload();
  }, [debouncedSearch, starredOnly, smartMode]);

  // Periodically refresh so newly captured queries appear without manual
  // reload. Smart mode pauses this — see `reload`.
  useEffect(() => {
    const id = setInterval(reload, 5000);
    return () => clearInterval(id);
  }, [reload]);

  const selected = queries.find((q) => q.id === selectedId) ?? null;

  async function toggleStar(q: Query) {
    await updateQuery(q.id, { starred: !q.starred });
    reload();
  }

  async function patchSelected(patch: { description?: string | null; starred?: boolean }) {
    if (!selected) return;
    await updateQuery(selected.id, patch);
    reload();
  }

  async function deleteSelected() {
    if (!selected) return;
    if (!confirm("Delete this query?")) return;
    await deleteQuery(selected.id);
    setSelectedId(null);
    reload();
  }

  function toggleSmartMode() {
    setSmartMode((on) => {
      const next = !on;
      // Reset transient smart-mode state so the user gets a clean slate
      // both when entering smart mode and when bailing back to FTS. The
      // results list is cleared in both directions: entering smart mode
      // would otherwise keep the previous FTS-filtered list visible
      // (because the FTS refresh effect is paused while smart mode is
      // on), and leaving smart mode would briefly show the agent's
      // picks until the next FTS refresh lands.
      setSmartMessage(null);
      setSearch("");
      setQueries([]);
      setSelectedId(null);
      return next;
    });
  }

  function describeProgress(event: AgentProgress): string {
    switch (event.kind) {
      case "starting":
        return "Starting Copilot…";
      case "thinking":
        return "Copilot is thinking…";
      case "searching":
        return event.text
          ? `Searching for "${event.text}"…`
          : "Listing recent queries…";
      case "searched_found":
        return event.text
          ? `Found ${event.count} match${event.count === 1 ? "" : "es"} for "${event.text}"`
          : `Listed ${event.count} recent quer${event.count === 1 ? "y" : "ies"}`;
    }
  }

  async function runSmartSearch() {
    const prompt = search.trim();
    if (!prompt || smartLoading) return;
    setSmartLoading(true);
    setSmartMessage(null);
    setSmartProgress("Starting Copilot…");
    setError(null);
    try {
      const result = await agentSearch(prompt, (event) => {
        setSmartProgress(describeProgress(event));
      });
      setQueries(result.queries);
      setSelectedId(result.queries[0]?.id ?? null);
      setSmartMessage(
        result.queries.length === 0
          ? "No matches — try rephrasing or switch off smart search."
          : null,
      );
    } catch (e) {
      setError(String(e));
      setQueries([]);
      setSelectedId(null);
    } finally {
      setSmartLoading(false);
      setSmartProgress(null);
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">Kuery</div>
        <input
          className="search-input"
          placeholder={
            smartMode
              ? "Describe queries you're looking for, then press Enter…"
              : "Search queries…"
          }
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (smartMode && e.key === "Enter") {
              e.preventDefault();
              runSmartSearch();
            }
          }}
          disabled={smartLoading}
        />
        <button
          type="button"
          className={`smart-toggle${smartMode ? " smart-toggle-on" : ""}`}
          onClick={toggleSmartMode}
          title={
            smartMode ? "Switch off smart search" : "Search with Copilot CLI"
          }
          aria-pressed={smartMode}
        >
          ✨ Smart
        </button>
        <label className="filter-toggle">
          <input
            type="checkbox"
            checked={starredOnly}
            onChange={(e) => setStarredOnly(e.target.checked)}
            disabled={smartMode}
          />
          Starred only
        </label>
        <button onClick={() => setShowSettings(true)}>Settings</button>
      </header>

      {error && <div className="error">{error}</div>}
      {smartLoading && (
        <div className="smart-status">{smartProgress ?? "Asking Copilot…"}</div>
      )}
      {smartMessage && !smartLoading && (
        <div className="smart-status">{smartMessage}</div>
      )}

      <div className="app-body">
        <aside className="sidebar">
          <QueryList
            queries={queries}
            selectedId={selectedId}
            onSelect={(q) => setSelectedId(q.id)}
            onToggleStar={toggleStar}
            searchTerm={debouncedSearch}
            starredOnly={starredOnly}
          />
        </aside>
        <main className="main">
          {selected ? (
            <QueryDetail
              query={selected}
              onUpdate={patchSelected}
              onDelete={deleteSelected}
            />
          ) : (
            <div className="empty">
              {smartMode
                ? "Describe the queries you want and press Enter."
                : "Select a query to see details."}
            </div>
          )}
        </main>
      </div>

      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          onChanged={reload}
        />
      )}

      {showWelcome && <WelcomeModal onClose={() => setShowWelcome(false)} />}
    </div>
  );
}

export default App;
