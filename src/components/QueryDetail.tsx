import { useEffect, useState } from "react";
import type { Query } from "../types";

interface Props {
  query: Query;
  onUpdate: (patch: { description?: string | null; starred?: boolean }) => void;
  onDelete: () => void;
}

/// Build the same kind of share URL the ADX UI's "Share" button produces:
/// gzip the query, base64 it, URL-encode, append as ?query=.
async function buildAdxUrl(
  cluster: string,
  database: string,
  query: string
): Promise<string> {
  const stream = new Blob([query]).stream().pipeThrough(
    new CompressionStream("gzip")
  );
  const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
  let binary = "";
  for (let i = 0; i < compressed.length; i++) {
    binary += String.fromCharCode(compressed[i]);
  }
  const encoded = encodeURIComponent(btoa(binary));
  // ADX accepts either the short cluster name or the FQDN; strip the
  // .kusto.windows.net suffix so the URL matches the share-button output.
  const clean = cluster.replace(/^https?:\/\//, "").replace(
    /\.kusto\.windows\.net\/?$/,
    ""
  );
  return `https://dataexplorer.azure.com/clusters/${clean}/databases/${encodeURIComponent(
    database
  )}?query=${encoded}`;
}

export function QueryDetail({ query, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(query.description ?? "");
  const [copyState, setCopyState] = useState<string | null>(null);
  const [adxUrl, setAdxUrl] = useState<string | null>(null);

  useEffect(() => {
    setEditing(false);
    setDraft(query.description ?? "");
    setCopyState(null);
  }, [query.id]);

  // Precompute the ADX URL whenever the query changes. We can't build it
  // inside the click handler because gzip compression is async — WebKit
  // drops the user-gesture token across the `await` and then rejects
  // `clipboard.writeText` with NotAllowedError.
  useEffect(() => {
    let cancelled = false;
    if (!query.cluster || !query.database) {
      setAdxUrl(null);
      return;
    }
    buildAdxUrl(query.cluster, query.database, query.query_text)
      .then((u) => {
        if (!cancelled) setAdxUrl(u);
      })
      .catch(() => {
        if (!cancelled) setAdxUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [query.id, query.cluster, query.database, query.query_text]);

  function save() {
    const next = draft.trim();
    onUpdate({ description: next === "" ? null : next });
    setEditing(false);
  }

  function flashCopyState(message: string) {
    setCopyState(message);
    setTimeout(() => setCopyState(null), 2000);
  }

  function copyText() {
    navigator.clipboard
      .writeText(query.query_text)
      .then(() => flashCopyState("Copied query"))
      .catch((e) => flashCopyState(`Couldn't copy: ${e}`));
  }

  function copyUrl() {
    if (!adxUrl) return;
    navigator.clipboard
      .writeText(adxUrl)
      .then(() => flashCopyState("Copied URL"))
      .catch((e) => flashCopyState(`Couldn't copy URL: ${e}`));
  }

  const canCopyUrl = !!adxUrl;

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
        <div className="detail-query-actions">
          {copyState && <span className="hint">{copyState}</span>}
          <button onClick={copyText}>Copy</button>
          <button
            onClick={copyUrl}
            disabled={!canCopyUrl}
            title={
              canCopyUrl
                ? "Copy an Azure Data Explorer share URL that opens this query"
                : "Cluster and database are required to build an ADX URL"
            }
          >
            Copy URL
          </button>
        </div>
      </div>
      <pre className="detail-query">{query.query_text}</pre>
    </div>
  );
}
