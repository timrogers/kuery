import type { Query } from "../types";

interface Props {
  queries: Query[];
  selectedId: number | null;
  onSelect: (q: Query) => void;
  onToggleStar: (q: Query) => void;
  searchTerm: string;
  starredOnly: boolean;
}

export function QueryList({
  queries,
  selectedId,
  onSelect,
  onToggleStar,
  searchTerm,
  starredOnly,
}: Props) {
  if (queries.length === 0) {
    return (
      <div className="empty">
        {searchTerm
          ? "No queries match your search."
          : starredOnly
            ? "No starred queries yet."
            : "No queries captured yet. Run one in Azure Data Explorer or via an AI agent."}
      </div>
    );
  }

  return (
    <ul className="query-list">
      {queries.map((q) => (
        <li
          key={q.id}
          className={"query-item" + (q.id === selectedId ? " selected" : "")}
          onClick={() => onSelect(q)}
        >
          <div className="query-item-header">
            <button
              className={"star-button" + (q.starred ? " starred" : "")}
              onClick={(e) => {
                e.stopPropagation();
                onToggleStar(q);
              }}
              title={q.starred ? "Unstar" : "Star"}
            >
              ★
            </button>
            <div className="query-item-title">
              {q.description ?? truncate(q.query_text, 80)}
            </div>
            <span className="run-count" title={`Run ${q.run_count} times`}>
              {q.run_count}
            </span>
          </div>
          <div className="query-item-snippet">{truncate(q.query_text, 120)}</div>
          <div className="query-item-meta">
            <span>{q.cluster ?? "no cluster"}</span>
            <span>·</span>
            <span>{q.database ?? "no db"}</span>
            <span>·</span>
            <span>{relativeTime(q.last_seen_at)}</span>
            <span>·</span>
            <span className={"source source-" + q.source}>{q.source}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function truncate(s: string, n: number): string {
  const flat = s.replace(/\s+/g, " ").trim();
  return flat.length > n ? flat.slice(0, n - 1) + "…" : flat;
}

function relativeTime(iso: string): string {
  const d = new Date(iso);
  const seconds = Math.round((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}
