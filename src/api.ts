import { invoke, Channel } from "@tauri-apps/api/core";
import type { Query, UpdateQueryPatch } from "./types";

export async function searchQueries(
  query: string,
  starredOnly = false,
  limit = 200,
): Promise<Query[]> {
  return invoke<Query[]>("search_queries", {
    args: { query, starredOnly, limit },
  });
}

export async function listRecent(limit = 200): Promise<Query[]> {
  return invoke<Query[]>("list_recent_queries", { limit });
}

export async function listStarred(limit = 200): Promise<Query[]> {
  return invoke<Query[]>("list_starred_queries", { limit });
}

export async function getQuery(id: number): Promise<Query | null> {
  return invoke<Query | null>("get_query", { id });
}

export async function updateQuery(
  id: number,
  patch: UpdateQueryPatch,
): Promise<Query | null> {
  // The Rust UpdateQuery uses Option<Option<String>> for description, so we
  // pass a tuple-shape: omit to leave alone, set to null/string to update.
  const rustPatch: Record<string, unknown> = {};
  if (patch.starred !== undefined) rustPatch.starred = patch.starred;
  if (patch.description !== undefined) rustPatch.description = patch.description;
  return invoke<Query | null>("update_query", { id, patch: rustPatch });
}

export async function deleteQuery(id: number): Promise<boolean> {
  return invoke<boolean>("delete_query", { id });
}

export async function getSetting(key: string): Promise<string | null> {
  return invoke<string | null>("get_setting", { key });
}

export async function setSetting(key: string, value: string | null): Promise<void> {
  return invoke<void>("set_setting", { key, value });
}

export async function exportDatabase(destPath: string): Promise<void> {
  return invoke<void>("export_database", { destPath });
}

export interface ImportSummary {
  imported: number;
  merged: number;
  skipped: number;
}

export async function importDatabase(sourcePath: string): Promise<ImportSummary> {
  return invoke<ImportSummary>("import_database", { sourcePath });
}

export interface AgentSearchResult {
  queries: Query[];
  assistant_message: string;
}

export type AgentProgress =
  | { kind: "starting" }
  | { kind: "searching"; text: string }
  | { kind: "searched_found"; text: string; count: number }
  | { kind: "thinking" };

export async function agentSearch(
  prompt: string,
  onProgress?: (event: AgentProgress) => void,
): Promise<AgentSearchResult> {
  const channel = new Channel<AgentProgress>();
  if (onProgress) channel.onmessage = onProgress;
  return invoke<AgentSearchResult>("agent_search", {
    prompt,
    onProgress: channel,
  });
}

export interface DebugInfo {
  log_file: string;
  log_dir: string;
  install_command: string;
  chrome_extension_path: string | null;
}

export async function debugInfo(): Promise<DebugInfo> {
  return invoke<DebugInfo>("debug_info");
}
