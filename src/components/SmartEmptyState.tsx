export function SmartEmptyState() {
  return (
    <div className="empty-state">
      <div className="empty-state-card">
        <h1>✨ Smart search</h1>
        <p className="hint">
          Describe what you're looking for in plain English and Copilot will
          find matching queries for you. It can search across query text and
          descriptions, combine multiple searches, and reason about intent
          rather than matching exact keywords.
        </p>

        <section>
          <h3>Try asking for things like</h3>
          <ul className="hint setup-steps">
            <li>queries that join the users and orgs tables</li>
            <li>recent aggregations over Copilot usage</li>
            <li>anything I starred about latency</li>
            <li>queries similar to the one I ran yesterday about retention</li>
          </ul>
        </section>

        <section>
          <h3>How it works</h3>
          <p className="hint">
            Smart search uses the GitHub Copilot SDK via the Copilot CLI on
            your machine. It runs one or more full-text searches under the
            hood and picks the best matches — you'll see live progress as it
            works.
          </p>
          <p className="hint">
            Type a prompt above and press <code>Enter</code> to get started.
          </p>
        </section>
      </div>
    </div>
  );
}
