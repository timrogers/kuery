export interface Query {
  id: number;
  query_text: string;
  cluster: string | null;
  database: string | null;
  description: string | null;
  starred: boolean;
  run_count: number;
  source: string;
  first_seen_at: string;
  last_seen_at: string;
}

export interface UpdateQueryPatch {
  starred?: boolean;
  description?: string | null;
}
