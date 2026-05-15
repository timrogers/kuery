import { useCallback, useEffect, useState } from "react";
import { QueryList } from "./components/QueryList";
import { QueryDetail } from "./components/QueryDetail";
import { SettingsModal } from "./components/SettingsModal";
import { useDebounced } from "./hooks";
import {
  deleteQuery,
  searchQueries,
  updateQuery,
} from "./api";
import type { Query } from "./types";
import "./App.css";

function App() {
  const [search, setSearch] = useState("");
  const [starredOnly, setStarredOnly] = useState(false);
  const [queries, setQueries] = useState<Query[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedSearch = useDebounced(search, 200);

  const reload = useCallback(async () => {
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
  }, [debouncedSearch, starredOnly, selectedId]);

  useEffect(() => {
    reload();
  }, [debouncedSearch, starredOnly]);

  // Periodically refresh so newly captured queries appear without manual reload.
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

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">Kuery</div>
        <input
          className="search-input"
          placeholder="Search queries…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label className="filter-toggle">
          <input
            type="checkbox"
            checked={starredOnly}
            onChange={(e) => setStarredOnly(e.target.checked)}
          />
          Starred only
        </label>
        <button onClick={() => setShowSettings(true)}>Settings</button>
      </header>

      {error && <div className="error">{error}</div>}

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
            <div className="empty">Select a query to see details.</div>
          )}
        </main>
      </div>

      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          onChanged={reload}
        />
      )}
    </div>
  );
}

export default App;
