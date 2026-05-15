import { useEffect, useState } from "react";
import type { Query } from "../types";

interface Props {
  query: Query;
  onUpdate: (patch: { description?: string | null; starred?: boolean }) => void;
  onDelete: () => void;
}

export function QueryDetail({ query, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(query.description ?? "");

  useEffect(() => {
    setEditing(false);
    setDraft(query.description ?? "");
  }, [query.id]);

  function save() {
    const next = draft.trim();
    onUpdate({ description: next === "" ? null : next });
    setEditing(false);
  }

  return (
    <div className="detail">
      <div className="detail-header">
        <button
          className={"star-button big" + (query.starred ? " starred" : "")}
          onClick={() => onUpdate({ starred: !query.starred })}
          title={query.starred ? "Unstar" : "Star"}
        >
          ★
        </button>
        <div className="detail-title">
          {editing ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={save}
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
                if (e.key === "Escape") {
                  setDraft(query.description ?? "");
                  setEditing(false);
                }
              }}
            />
          ) : (
            <span onClick={() => setEditing(true)}>
              {query.description ?? "Add description…"}
            </span>
          )}
        </div>
        <button className="danger" onClick={onDelete} title="Delete query">
          Delete
        </button>
      </div>
      <dl className="detail-meta">
        <div>
          <dt>Cluster</dt>
          <dd>{query.cluster ?? "—"}</dd>
        </div>
        <div>
          <dt>Database</dt>
          <dd>{query.database ?? "—"}</dd>
        </div>
        <div>
          <dt>Runs</dt>
          <dd>{query.run_count}</dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd>{query.source}</dd>
        </div>
        <div>
          <dt>First seen</dt>
          <dd>{new Date(query.first_seen_at).toLocaleString()}</dd>
        </div>
        <div>
          <dt>Last seen</dt>
          <dd>{new Date(query.last_seen_at).toLocaleString()}</dd>
        </div>
      </dl>
      <div className="detail-query-header">
        <span>Query</span>
        <button onClick={() => navigator.clipboard.writeText(query.query_text)}>
          Copy
        </button>
      </div>
      <pre className="detail-query">{query.query_text}</pre>
    </div>
  );
}
