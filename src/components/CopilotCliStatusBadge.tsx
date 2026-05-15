import { useEffect, useState } from "react";
import { copilotCliStatus, type CopilotCliStatus } from "../api";

interface Props {
  /// Render a compact one-line variant (used in Settings) vs a fuller card
  /// with install instructions (used in the welcome flow).
  variant?: "compact" | "full";
}

const INSTALL_COMMAND = "npm install -g @github/copilot";
const DOCS_URL = "https://docs.github.com/en/copilot/concepts/agents/about-copilot-cli";

export function CopilotCliStatusBadge({ variant = "compact" }: Props) {
  const [status, setStatus] = useState<CopilotCliStatus | null>(null);
  const [checking, setChecking] = useState(true);

  async function refresh() {
    setChecking(true);
    try {
      setStatus(await copilotCliStatus());
    } catch (e) {
      setStatus({
        installed: false,
        path: null,
        version: null,
        error: String(e),
      });
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  if (checking && !status) {
    return (
      <div className="cli-status cli-status-checking">
        Checking for Copilot CLI…
      </div>
    );
  }

  if (!status) return null;

  if (status.installed) {
    return (
      <div className="cli-status cli-status-ok">
        <span className="cli-status-dot" aria-hidden>✓</span>
        <span>
          GitHub Copilot CLI detected
          {status.version ? ` (${status.version})` : ""}
        </span>
        <button
          type="button"
          className="cli-status-recheck"
          onClick={refresh}
          disabled={checking}
        >
          {checking ? "Checking…" : "Re-check"}
        </button>
      </div>
    );
  }

  return (
    <div className="cli-status cli-status-missing">
      <div className="cli-status-headline">
        <span className="cli-status-dot" aria-hidden>!</span>
        <span>
          <strong>GitHub Copilot CLI not detected.</strong>{" "}
          AI descriptions, smart search, and the capture plugin won't work
          without it.
        </span>
      </div>
      {variant === "full" && (
        <>
          <p className="hint cli-status-hint">
            Install it with npm, then sign in by running{" "}
            <code>copilot</code> once in your terminal:
          </p>
          <div className="row">
            <code className="cli-snippet">{INSTALL_COMMAND}</code>
            <button
              onClick={() => navigator.clipboard.writeText(INSTALL_COMMAND)}
            >
              Copy
            </button>
          </div>
          <p className="hint cli-status-hint">
            See{" "}
            <a href={DOCS_URL} target="_blank" rel="noreferrer">
              the Copilot CLI docs
            </a>{" "}
            for full setup instructions.
          </p>
        </>
      )}
      {status.error && (
        <p className="hint cli-status-error">{status.error}</p>
      )}
      <button
        type="button"
        className="cli-status-recheck"
        onClick={refresh}
        disabled={checking}
      >
        {checking ? "Checking…" : "Re-check"}
      </button>
    </div>
  );
}
