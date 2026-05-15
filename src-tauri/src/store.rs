use std::path::Path;
use std::sync::Arc;

use anyhow::{Context, Result};
use chrono::Utc;
use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;
use rusqlite::{params, OptionalExtension, Row};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

pub type SqlitePool = Pool<SqliteConnectionManager>;

#[derive(Clone)]
pub struct Store {
    pool: Arc<SqlitePool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Query {
    pub id: i64,
    pub query_text: String,
    pub cluster: Option<String>,
    pub database: Option<String>,
    pub description: Option<String>,
    pub starred: bool,
    pub run_count: i64,
    pub source: String,
    pub first_seen_at: String,
    pub last_seen_at: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct NewQuery {
    pub query_text: String,
    pub cluster: Option<String>,
    pub database: Option<String>,
    pub source: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct IngestResult {
    pub id: i64,
    pub created: bool,
    pub run_count: i64,
}

#[derive(Debug, Default, Deserialize)]
pub struct UpdateQuery {
    pub starred: Option<bool>,
    pub description: Option<Option<String>>,
}

const SCHEMA_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS queries (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    query_text    TEXT NOT NULL,
    cluster       TEXT,
    "database"    TEXT,
    description   TEXT,
    starred       INTEGER NOT NULL DEFAULT 0,
    run_count     INTEGER NOT NULL DEFAULT 1,
    source        TEXT NOT NULL,
    first_seen_at TEXT NOT NULL,
    last_seen_at  TEXT NOT NULL,
    query_hash    TEXT NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_queries_last_seen ON queries(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_queries_starred   ON queries(starred, last_seen_at DESC);

CREATE VIRTUAL TABLE IF NOT EXISTS queries_fts USING fts5(
    query_text, description, content='queries', content_rowid='id'
);

CREATE TRIGGER IF NOT EXISTS queries_ai AFTER INSERT ON queries BEGIN
    INSERT INTO queries_fts(rowid, query_text, description)
    VALUES (new.id, new.query_text, COALESCE(new.description, ''));
END;

CREATE TRIGGER IF NOT EXISTS queries_ad AFTER DELETE ON queries BEGIN
    INSERT INTO queries_fts(queries_fts, rowid, query_text, description)
    VALUES ('delete', old.id, old.query_text, COALESCE(old.description, ''));
END;

CREATE TRIGGER IF NOT EXISTS queries_au AFTER UPDATE ON queries BEGIN
    INSERT INTO queries_fts(queries_fts, rowid, query_text, description)
    VALUES ('delete', old.id, old.query_text, COALESCE(old.description, ''));
    INSERT INTO queries_fts(rowid, query_text, description)
    VALUES (new.id, new.query_text, COALESCE(new.description, ''));
END;

CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT
);
"#;

impl Store {
    pub fn open(path: &Path) -> Result<Self> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).with_context(|| {
                format!("creating data directory {}", parent.display())
            })?;
        }

        let manager = SqliteConnectionManager::file(path).with_init(|c| {
            c.pragma_update(None, "journal_mode", "WAL")?;
            c.pragma_update(None, "synchronous", "NORMAL")?;
            c.pragma_update(None, "foreign_keys", "ON")?;
            Ok(())
        });
        let pool = Pool::builder()
            .max_size(8)
            .build(manager)
            .context("building sqlite pool")?;

        let conn = pool.get()?;
        conn.execute_batch(SCHEMA_SQL).context("running schema")?;

        Ok(Self { pool: Arc::new(pool) })
    }

    pub fn ingest(&self, q: &NewQuery) -> Result<IngestResult> {
        let normalized = normalize_query(&q.query_text);
        if normalized.is_empty() {
            anyhow::bail!("query_text is empty");
        }
        let hash = compute_hash(
            &normalized,
            q.cluster.as_deref().unwrap_or(""),
            q.database.as_deref().unwrap_or(""),
        );
        let now = Utc::now().to_rfc3339();
        let conn = self.pool.get()?;

        let existing: Option<(i64, i64)> = conn
            .query_row(
                "SELECT id, run_count FROM queries WHERE query_hash = ?1",
                params![hash],
                |r| Ok((r.get::<_, i64>(0)?, r.get::<_, i64>(1)?)),
            )
            .optional()?;

        if let Some((id, run_count)) = existing {
            conn.execute(
                "UPDATE queries SET run_count = run_count + 1, last_seen_at = ?2 WHERE id = ?1",
                params![id, now],
            )?;
            Ok(IngestResult { id, created: false, run_count: run_count + 1 })
        } else {
            conn.execute(
                "INSERT INTO queries
                 (query_text, cluster, \"database\", source, first_seen_at, last_seen_at, query_hash)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?5, ?6)",
                params![q.query_text, q.cluster, q.database, q.source, now, hash],
            )?;
            let id = conn.last_insert_rowid();
            Ok(IngestResult { id, created: true, run_count: 1 })
        }
    }

    pub fn get(&self, id: i64) -> Result<Option<Query>> {
        let conn = self.pool.get()?;
        let row = conn
            .query_row("SELECT id, query_text, cluster, \"database\", description, starred, run_count, source, first_seen_at, last_seen_at FROM queries WHERE id = ?1", params![id], row_to_query)
            .optional()?;
        Ok(row)
    }

    pub fn list_recent(&self, limit: i64) -> Result<Vec<Query>> {
        let conn = self.pool.get()?;
        let mut stmt = conn.prepare(
            "SELECT id, query_text, cluster, \"database\", description, starred, run_count, source, first_seen_at, last_seen_at FROM queries ORDER BY last_seen_at DESC LIMIT ?1",
        )?;
        let rows = stmt.query_map(params![limit], row_to_query)?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }

    pub fn list_starred(&self, limit: i64) -> Result<Vec<Query>> {
        let conn = self.pool.get()?;
        let mut stmt = conn.prepare(
            "SELECT id, query_text, cluster, \"database\", description, starred, run_count, source, first_seen_at, last_seen_at FROM queries WHERE starred = 1 ORDER BY last_seen_at DESC LIMIT ?1",
        )?;
        let rows = stmt.query_map(params![limit], row_to_query)?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }

    pub fn search(&self, query: &str, limit: i64, starred_only: bool) -> Result<Vec<Query>> {
        let conn = self.pool.get()?;
        let trimmed = query.trim();
        if trimmed.is_empty() {
            return if starred_only {
                self.list_starred(limit)
            } else {
                self.list_recent(limit)
            };
        }
        let fts = sanitize_fts(trimmed);
        let sql = if starred_only {
            "SELECT q.id, q.query_text, q.cluster, q.\"database\", q.description, q.starred, q.run_count, q.source, q.first_seen_at, q.last_seen_at \
             FROM queries q JOIN queries_fts f ON f.rowid = q.id \
             WHERE queries_fts MATCH ?1 AND q.starred = 1 \
             ORDER BY q.last_seen_at DESC LIMIT ?2"
        } else {
            "SELECT q.id, q.query_text, q.cluster, q.\"database\", q.description, q.starred, q.run_count, q.source, q.first_seen_at, q.last_seen_at \
             FROM queries q JOIN queries_fts f ON f.rowid = q.id \
             WHERE queries_fts MATCH ?1 \
             ORDER BY q.last_seen_at DESC LIMIT ?2"
        };
        let mut stmt = conn.prepare(sql)?;
        let rows = stmt.query_map(params![fts, limit], row_to_query)?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }

    pub fn update(&self, id: i64, patch: &UpdateQuery) -> Result<Option<Query>> {
        let conn = self.pool.get()?;
        if let Some(starred) = patch.starred {
            conn.execute(
                "UPDATE queries SET starred = ?2 WHERE id = ?1",
                params![id, starred as i64],
            )?;
        }
        if let Some(description) = &patch.description {
            conn.execute(
                "UPDATE queries SET description = ?2 WHERE id = ?1",
                params![id, description],
            )?;
        }
        drop(conn);
        self.get(id)
    }

    pub fn delete(&self, id: i64) -> Result<bool> {
        let conn = self.pool.get()?;
        let rows = conn.execute("DELETE FROM queries WHERE id = ?1", params![id])?;
        Ok(rows > 0)
    }

    pub fn set_setting(&self, key: &str, value: Option<&str>) -> Result<()> {
        let conn = self.pool.get()?;
        match value {
            Some(v) => {
                conn.execute(
                    "INSERT INTO settings(key, value) VALUES(?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                    params![key, v],
                )?;
            }
            None => {
                conn.execute("DELETE FROM settings WHERE key = ?1", params![key])?;
            }
        }
        Ok(())
    }

    pub fn get_setting(&self, key: &str) -> Result<Option<String>> {
        let conn = self.pool.get()?;
        let v = conn
            .query_row(
                "SELECT value FROM settings WHERE key = ?1",
                params![key],
                |r| r.get::<_, Option<String>>(0),
            )
            .optional()?
            .flatten();
        Ok(v)
    }
}

fn row_to_query(r: &Row<'_>) -> rusqlite::Result<Query> {
    Ok(Query {
        id: r.get(0)?,
        query_text: r.get(1)?,
        cluster: r.get(2)?,
        database: r.get(3)?,
        description: r.get(4)?,
        starred: r.get::<_, i64>(5)? != 0,
        run_count: r.get(6)?,
        source: r.get(7)?,
        first_seen_at: r.get(8)?,
        last_seen_at: r.get(9)?,
    })
}

fn normalize_query(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut prev_ws = true;
    for ch in s.trim().chars() {
        if ch.is_whitespace() {
            if !prev_ws {
                out.push(' ');
                prev_ws = true;
            }
        } else {
            out.push(ch);
            prev_ws = false;
        }
    }
    out
}

fn compute_hash(query: &str, cluster: &str, database: &str) -> String {
    let mut h = Sha256::new();
    h.update(query.as_bytes());
    h.update(b"|");
    h.update(cluster.as_bytes());
    h.update(b"|");
    h.update(database.as_bytes());
    format!("{:x}", h.finalize())
}

fn sanitize_fts(input: &str) -> String {
    // Wrap each whitespace-separated token in quotes so user input cannot
    // accidentally form FTS5 operators. Keeps search behaviour predictable.
    input
        .split_whitespace()
        .map(|tok| {
            let escaped = tok.replace('"', "\"\"");
            format!("\"{}\"", escaped)
        })
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn open_temp() -> (Store, tempfile::TempDir) {
        let dir = tempdir().unwrap();
        let store = Store::open(&dir.path().join("kuery.sqlite")).unwrap();
        (store, dir)
    }

    #[test]
    fn ingest_then_bump() {
        let (s, _d) = open_temp();
        let q = NewQuery {
            query_text: "StormEvents | take 10".into(),
            cluster: Some("c".into()),
            database: Some("Samples".into()),
            source: "extension".into(),
        };
        let r1 = s.ingest(&q).unwrap();
        assert!(r1.created);
        assert_eq!(r1.run_count, 1);

        let r2 = s.ingest(&q).unwrap();
        assert!(!r2.created);
        assert_eq!(r2.id, r1.id);
        assert_eq!(r2.run_count, 2);
    }

    #[test]
    fn search_finds_by_text() {
        let (s, _d) = open_temp();
        s.ingest(&NewQuery {
            query_text: "StormEvents | where State == 'TEXAS' | take 5".into(),
            cluster: None, database: None, source: "manual".into(),
        }).unwrap();
        s.ingest(&NewQuery {
            query_text: "PageViews | summarize count() by bin(timestamp, 1d)".into(),
            cluster: None, database: None, source: "manual".into(),
        }).unwrap();

        let hits = s.search("StormEvents", 10, false).unwrap();
        assert_eq!(hits.len(), 1);
        assert!(hits[0].query_text.contains("StormEvents"));
    }

    #[test]
    fn star_and_update() {
        let (s, _d) = open_temp();
        let r = s.ingest(&NewQuery {
            query_text: "T | count".into(),
            cluster: None, database: None, source: "manual".into(),
        }).unwrap();
        s.update(r.id, &UpdateQuery { starred: Some(true), description: Some(Some("counts T".into())) }).unwrap();
        let q = s.get(r.id).unwrap().unwrap();
        assert!(q.starred);
        assert_eq!(q.description.as_deref(), Some("counts T"));
    }
}
