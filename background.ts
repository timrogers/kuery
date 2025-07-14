// Background service worker for Kuery extension
import initSqlJs from "sql.js";
import OpenAI from 'openai';

// Function to generate query description using GitHub Models
async function generateQueryDescription(query: string): Promise<string | null> {
  try {
    const { githubToken } = await chrome.storage.sync.get("githubToken");
    if (!githubToken) {
      console.log('Kuery: No GitHub token configured for OpenAI');
      return null; // No token configured
    }
    
    console.log('Kuery: GitHub token found, attempting OpenAI request');

    const client = new OpenAI({
      baseURL: 'https://models.github.ai/inference',
      apiKey: githubToken,
    });

    const cleanQuery = query
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/--.*$/gm, '')
      .trim();

    const response = await client.chat.completions.create({
      model: 'openai/gpt-4.1',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at analyzing Kusto queries. Generate a concise summary of what the query does in 10 words or less. Focus on the main action and data being queried. Be specific and technical.'
        },
        {
          role: 'user',
          content: `Summarize this Kusto query in 10 words or less:\n\n${cleanQuery}`
        }
      ],
      max_tokens: 50,
      temperature: 0.1,
    });

    const summary = response.choices[0]?.message?.content?.trim();
    return summary || null;
  } catch (error) {
    console.error('Kuery: Failed to generate query description:', error);
    return null;
  }
}

// Function to test GitHub token validity
async function testGitHubToken(token: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('https://api.github.com/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });

    if (response.status === 200) {
      console.log('Kuery: GitHub token test successful');
      return { success: true };
    } else {
      const errorText = await response.text();
      console.error('Kuery: GitHub token test failed:', response.status, errorText);
      return { 
        success: false, 
        error: `HTTP ${response.status}: ${response.statusText}` 
      };
    }
  } catch (error) {
    console.error('Kuery: GitHub token test error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Network error' 
    };
  }
}

interface KustoQueryData {
  query: string;
  database: string;
  cluster: string;
  url: string;
  timestamp: string;
  requestBody?: any;
  responsePreview?: {
    hasResults: boolean;
    resultCount: number;
  } | null;
}

let SQL: any = null;
let db: any = null;
let sqliteAvailable = false;
let initializationError: string | null = null;
let migrationStatus: {
  hasUnappliedMigrations: boolean;
  failedMigration?: { version: number; error: string };
  lastBackupDate?: string;
} = { hasUnappliedMigrations: false };

// Initialize SQLite database with special Chrome extension handling
async function initDatabase() {
  try {
    // Load WASM using a different approach for Chrome extensions
    const wasmUrl = chrome.runtime.getURL('assets/sql-wasm.wasm');
    
    // Create SQL.js instance with pre-loaded WASM
    SQL = await initSqlJs({
      locateFile: () => wasmUrl
    });
    
    // Try to load existing database from storage
    const result = await chrome.storage.local.get(['kuery_database']);
    
    if (result.kuery_database) {
      // Load existing database
      const uint8Array = new Uint8Array(result.kuery_database);
      db = new SQL.Database(uint8Array);
      console.log('Kuery: Loaded existing SQLite database');
    } else {
      // Create new database
      db = new SQL.Database();
      console.log('Kuery: Created new SQLite database');
    }
    
    // Create tables if they don't exist
    createTables();
    
    sqliteAvailable = true;
    initializationError = null;
    console.log('Kuery: SQLite database initialized successfully');
    return true;
  } catch (error) {
    console.error('Kuery: Failed to initialize SQLite database:', error);
    sqliteAvailable = false;
    initializationError = error instanceof Error ? error.message : 'Unknown error';
    
    // Notify all Azure Data Explorer tabs about the error
    notifyTabsAboutSQLiteError();
    
    return false;
  }
}

function createTables() {
  if (!db) return;
  
  try {
    // Create base queries table (without optional columns that will be added by migrations)
    db.exec(`
      CREATE TABLE IF NOT EXISTS queries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        query_text TEXT NOT NULL,
        database_name TEXT,
        cluster_name TEXT,
        url TEXT,
        timestamp DATETIME,
        request_body TEXT,
        response_preview TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(query_text, database_name, cluster_name)
      )
    `);
    
    // Run migrations to add any additional columns or tables
    runMigrations();
    
    console.log('Kuery: SQLite tables created/verified');

    // Log table schema
    const tableInfo = db.exec("PRAGMA table_info(queries)");
    if (tableInfo && tableInfo.length > 0) {
      const columns = tableInfo[0].values.map(row => row[1]);
      console.log('Kuery: Queries table columns:', columns);
    }

  } catch (error) {
    console.error('Kuery: Error creating SQLite tables:', error);
  }
}

// Database Migration System
interface Migration {
  version: number;
  description: string;
  up: (db: any) => void;
  down?: (db: any) => void;
}

const migrations: Migration[] = [
  {
    version: 1,
    description: 'Add runs_count, last_used_at, and description columns',
    up: (db: any) => {
      // Check if columns exist before adding them
      const tableInfo = db.exec("PRAGMA table_info(queries)");
      const columns = tableInfo && tableInfo.length > 0 
        ? tableInfo[0].values.map(row => row[1]) 
        : [];
      
      if (!columns.includes('runs_count')) {
        db.exec('ALTER TABLE queries ADD COLUMN runs_count INTEGER DEFAULT 1');
        db.exec('UPDATE queries SET runs_count = 1 WHERE runs_count IS NULL');
      }
      
      if (!columns.includes('last_used_at')) {
        db.exec('ALTER TABLE queries ADD COLUMN last_used_at DATETIME');
        db.exec(`
          UPDATE queries 
          SET last_used_at = COALESCE(created_at, timestamp, datetime('now'))
          WHERE last_used_at IS NULL
        `);
      }
      
      if (!columns.includes('description')) {
        db.exec('ALTER TABLE queries ADD COLUMN description TEXT DEFAULT "Untitled"');
        db.exec('UPDATE queries SET description = "Untitled" WHERE description IS NULL');
      }
    },
    down: (db: any) => {
      // SQLite doesn't support DROP COLUMN, so this would require recreating the table
      console.warn('Kuery: Downgrade from migration 1 not supported (SQLite limitation)');
    }
  }
  // Future migrations can be added here
  // {
  //   version: 2,
  //   description: 'Add new feature table',
  //   up: (db: any) => {
  //     db.exec('CREATE TABLE new_feature (id INTEGER PRIMARY KEY, data TEXT)');
  //   },
  //   down: (db: any) => {
  //     db.exec('DROP TABLE new_feature');
  //   }
  // }
];

function createSchemaVersionTable() {
  if (!db) return;
  
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        description TEXT
      )
    `);
  } catch (error) {
    console.error('Kuery: Error creating schema_version table:', error);
  }
}

function getCurrentSchemaVersion(): number {
  if (!db) return 0;
  
  try {
    const result = db.exec('SELECT MAX(version) as version FROM schema_version');
    if (result && result.length > 0 && result[0].values && result[0].values.length > 0) {
      const version = result[0].values[0][0];
      return version || 0;
    }
    return 0;
  } catch (error) {
    // Table might not exist yet
    return 0;
  }
}

function setSchemaVersion(version: number, description: string) {
  if (!db) return;
  
  try {
    const stmt = db.prepare('INSERT INTO schema_version (version, description) VALUES (?, ?)');
    stmt.run([version, description]);
    stmt.free();
  } catch (error) {
    console.error('Kuery: Error setting schema version:', error);
  }
}

async function createDatabaseBackup(): Promise<boolean> {
  if (!db) return false;
  
  try {
    const data = db.export();
    const backupKey = `kuery_database_backup_${new Date().toISOString()}`;
    await chrome.storage.local.set({ [backupKey]: Array.from(data) });
    
    // Keep only the 3 most recent backups to avoid storage bloat
    const allKeys = await chrome.storage.local.get();
    const backupKeys = Object.keys(allKeys)
      .filter(key => key.startsWith('kuery_database_backup_'))
      .sort()
      .reverse();
    
    if (backupKeys.length > 3) {
      const keysToRemove = backupKeys.slice(3);
      await chrome.storage.local.remove(keysToRemove);
      console.log(`Kuery: Removed ${keysToRemove.length} old backup(s)`);
    }
    
    migrationStatus.lastBackupDate = new Date().toISOString();
    console.log(`Kuery: Database backup created: ${backupKey}`);
    return true;
  } catch (error) {
    console.error('Kuery: Failed to create database backup:', error);
    return false;
  }
}

function runMigrations() {
  if (!db) return;
  
  try {
    createSchemaVersionTable();
    const currentVersion = getCurrentSchemaVersion();
    
    console.log(`Kuery: Current schema version: ${currentVersion}`);
    
    // Find pending migrations
    const pendingMigrations = migrations.filter(m => m.version > currentVersion);
    
    if (pendingMigrations.length === 0) {
      console.log('Kuery: No pending migrations');
      migrationStatus.hasUnappliedMigrations = false;
      migrationStatus.failedMigration = undefined;
      return;
    }
    
    console.log(`Kuery: Running ${pendingMigrations.length} pending migration(s)`);
    
    // Create backup before applying migrations
    createDatabaseBackup().then(backupSuccess => {
      if (!backupSuccess) {
        console.warn('Kuery: Failed to create backup, but proceeding with migrations');
      }
    });
    
    // Sort migrations by version to ensure correct order
    pendingMigrations.sort((a, b) => a.version - b.version);
    
    for (const migration of pendingMigrations) {
      console.log(`Kuery: Applying migration ${migration.version}: ${migration.description}`);
      
      try {
        // Run the migration
        migration.up(db);
        
        // Record the migration as applied
        setSchemaVersion(migration.version, migration.description);
        
        console.log(`Kuery: Migration ${migration.version} completed successfully`);
      } catch (migrationError) {
        console.error(`Kuery: Migration ${migration.version} failed:`, migrationError);
        
        // Track the failed migration
        migrationStatus.hasUnappliedMigrations = true;
        migrationStatus.failedMigration = {
          version: migration.version,
          error: migrationError instanceof Error ? migrationError.message : String(migrationError)
        };
        
        throw migrationError; // Stop migration process on error
      }
    }
    
    // All migrations completed successfully
    migrationStatus.hasUnappliedMigrations = false;
    migrationStatus.failedMigration = undefined;
    console.log('Kuery: All migrations completed successfully');
  } catch (error) {
    console.error('Kuery: Error during migration process:', error);
    migrationStatus.hasUnappliedMigrations = true;
    throw error;
  }
}

async function saveQuery(queryData: KustoQueryData) {
  // Check if SQLite is available
  if (!sqliteAvailable || !db || !SQL) {
    console.error('Kuery: Cannot save query - SQLite database is not available');
    console.error('Kuery: Initialization error:', initializationError);
    return false;
  }

  try {
    // Skip queries starting with '.' (administrative/metadata queries)
    if (queryData.query.startsWith('.')) {
      return false;
    }

    // Only store queries that have successful results
    if (!queryData.responsePreview?.hasResults) {
      console.log('Kuery: Query not stored because it did not have successful results');
      return false;
    }

    // Check if query already exists
    const checkStmt = db.prepare(`
      SELECT id, runs_count FROM queries 
      WHERE query_text = ? AND database_name = ? AND cluster_name = ?
    `);
    
    checkStmt.bind([queryData.query, queryData.database, queryData.cluster]);
    let existingQuery = null;
    if (checkStmt.step()) {
      existingQuery = checkStmt.getAsObject();
    }
    checkStmt.free();

    if (existingQuery && existingQuery.id) {
      // Update existing query: increment runs_count and update last_used_at
      const updateStmt = db.prepare(`
        UPDATE queries 
        SET runs_count = runs_count + 1, 
            last_used_at = ?,
            url = ?,
            request_body = ?,
            response_preview = ?
        WHERE id = ?
      `);
      
      updateStmt.run([
        queryData.timestamp,
        queryData.url,
        JSON.stringify(queryData.requestBody),
        JSON.stringify(queryData.responsePreview),
        existingQuery.id
      ]);
      updateStmt.free();
      
      console.log('Kuery: Query updated - runs_count incremented');
    } else {
      // Insert new query
      const description = await generateQueryDescription(queryData.query);

      const insertStmt = db.prepare(`
        INSERT INTO queries (
          query_text, database_name, cluster_name, url, timestamp, 
          last_used_at, request_body, response_preview, description
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      insertStmt.run([
        queryData.query,
        queryData.database,
        queryData.cluster,
        queryData.url,
        queryData.timestamp,
        queryData.timestamp,
        JSON.stringify(queryData.requestBody),
        JSON.stringify(queryData.responsePreview),
        description || 'Untitled'
      ]);
      insertStmt.free();
      
      console.log('Kuery: New query saved to SQLite database');
    }
    
    // Save database to storage
    await saveDatabaseToStorage();
    
    return true;
  } catch (error) {
    console.error('Kuery: Error saving query to SQLite database:', error);
    return false;
  }
}

async function saveDatabaseToStorage() {
  if (!db) return;
  
  try {
    const data = db.export();
    await chrome.storage.local.set({ kuery_database: Array.from(data) });
  } catch (error) {
    console.error('Kuery: Error saving database to storage:', error);
  }
}

async function getQueriesCount() {
  if (!sqliteAvailable || !db || !SQL) {
    return 0;
  }

  try {
    const result = db.exec("SELECT COUNT(*) as count FROM queries");
    
    if (result && result.length > 0 && result[0].values && result[0].values.length > 0) {
      return result[0].values[0][0];
    }
    
    return 0;
  } catch (error) {
    console.error('Kuery: Error getting queries count:', error);
    return 0;
  }
}

async function getRecentQueries(limit: number = 10, offset: number = 0) {
  if (!sqliteAvailable || !db || !SQL) {
    return [];
  }

  try {
    const result = db.exec(`SELECT * FROM queries ORDER BY last_used_at DESC LIMIT ${limit} OFFSET ${offset}`);
    
    if (!result || result.length === 0 || !result[0].values) {
      return [];
    }
    
    const columns = result[0].columns;
    const rows = result[0].values;
    
    const queries = rows.map(row => {
      const query = {};
      columns.forEach((col, index) => {
        query[col] = row[index];
      });
      
      // Transform to match expected format
      return {
        id: query.id,
        query: query.query_text,
        database: query.database_name,
        cluster: query.cluster_name,
        url: query.url,
        runs_count: query.runs_count || 1,
        last_used_at: query.last_used_at,
        created_at: query.created_at,
        description: query.description || 'Untitled',
        request_body: query.request_body ? JSON.parse(query.request_body) : null,
        response_preview: query.response_preview ? JSON.parse(query.response_preview) : null
      };
    });
    
    return queries;
  } catch (error) {
    console.error('Kuery: Error getting recent queries:', error);
    return [];
  }
}

async function searchQueries(searchTerm: string, limit: number = 50) {
  if (!sqliteAvailable || !db || !SQL) {
    return [];
  }

  if (!searchTerm || searchTerm.trim().length === 0) {
    return await getRecentQueries(limit);
  }

  try {
    // Use LIKE for full-text search across query text, database, and cluster
    const stmt = db.prepare(`
      SELECT * FROM queries 
      WHERE query_text LIKE ? 
         OR database_name LIKE ? 
         OR cluster_name LIKE ?
         OR url LIKE ?
      ORDER BY created_at DESC 
      LIMIT ?
    `);
    
    const searchPattern = `%${searchTerm}%`;
    const results = [];
    stmt.bind([searchPattern, searchPattern, searchPattern, searchPattern, limit]);
    
    while (stmt.step()) {
      const row = stmt.getAsObject();
      results.push({
        ...row,
        query: row.query_text,
        database: row.database_name,
        cluster: row.cluster_name,
        description: row.description || 'Untitled',
        request_body: row.request_body ? JSON.parse(row.request_body) : null,
        response_preview: row.response_preview ? JSON.parse(row.response_preview) : null
      });
    }
    
    stmt.free();
    return results;
  } catch (error) {
    console.error('Kuery: Error searching queries:', error);
    return [];
  }
}

async function deleteQuery(queryId: number) {
  if (!sqliteAvailable || !db || !SQL) {
    console.error('Kuery: Cannot delete query - SQLite database is not available');
    return false;
  }

  try {
    console.log('Kuery: Attempting to delete query with ID:', queryId);
    
    // Check if query exists first
    const checkStmt = db.prepare('SELECT id FROM queries WHERE id = ?');
    checkStmt.bind([queryId]);
    let exists = false;
    if (checkStmt.step()) {
      exists = true;
    }
    checkStmt.free();
    
    if (!exists) {
      console.error('Kuery: Query with ID', queryId, 'does not exist');
      return false;
    }
    
    // Delete the query
    const deleteStmt = db.prepare('DELETE FROM queries WHERE id = ?');
    deleteStmt.run([queryId]);
    deleteStmt.free();
    
    // Verify deletion
    const verifyStmt = db.prepare('SELECT COUNT(*) as count FROM queries WHERE id = ?');
    verifyStmt.bind([queryId]);
    let stillExists = false;
    if (verifyStmt.step()) {
      const result = verifyStmt.getAsObject();
      stillExists = (result['COUNT(*)'] || result.count) > 0;
    }
    verifyStmt.free();
    
    if (stillExists) {
      console.error('Kuery: Query deletion failed - query still exists');
      return false;
    }
    
    // Save database to storage
    await saveDatabaseToStorage();
    
    console.log('Kuery: Query deleted successfully');
    return true;
  } catch (error) {
    console.error('Kuery: Error deleting query:', error);
    console.error('Kuery: Error details:', error.stack);
    return false;
  }
}

async function updateQueryDescription(queryId: number, description: string) {
  if (!sqliteAvailable || !db || !SQL) {
    console.error('Kuery: Cannot update description - SQLite database is not available');
    return false;
  }

  try {
    console.log('Kuery: Updating description for query ID:', queryId, 'to:', description);
    
    const updateStmt = db.prepare('UPDATE queries SET description = ? WHERE id = ?');
    updateStmt.run([description, queryId]);
    updateStmt.free();
    
    // Save database to storage
    await saveDatabaseToStorage();
    
    console.log('Kuery: Description updated successfully');
    return true;
  } catch (error) {
    console.error('Kuery: Error updating description:', error);
    return false;
  }
}

async function exportDatabase(): Promise<{ success: boolean; data?: Uint8Array; error?: string }> {
  if (!sqliteAvailable || !db || !SQL) {
    return { success: false, error: 'SQLite database is not available' };
  }

  try {
    const data = db.export();
    console.log('Kuery: Database exported successfully');
    return { success: true, data };
  } catch (error) {
    console.error('Kuery: Error exporting database:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

async function getAvailableBackups(): Promise<{ success: boolean; backups?: Array<{key: string; date: string}>; error?: string }> {
  try {
    const allKeys = await chrome.storage.local.get();
    const backupKeys = Object.keys(allKeys)
      .filter(key => key.startsWith('kuery_database_backup_'))
      .map(key => {
        const dateMatch = key.match(/kuery_database_backup_(.+)/);
        return {
          key,
          date: dateMatch ? dateMatch[1] : 'Unknown'
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date)); // Most recent first

    console.log(`Kuery: Found ${backupKeys.length} backup(s)`);
    return { success: true, backups: backupKeys };
  } catch (error) {
    console.error('Kuery: Error getting available backups:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

async function exportBackup(backupKey: string): Promise<{ success: boolean; data?: Uint8Array; error?: string }> {
  try {
    const result = await chrome.storage.local.get([backupKey]);
    
    if (!result[backupKey]) {
      return { success: false, error: 'Backup not found' };
    }

    const data = new Uint8Array(result[backupKey]);
    console.log('Kuery: Backup exported successfully');
    return { success: true, data };
  } catch (error) {
    console.error('Kuery: Error exporting backup:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

async function validateSQLiteDatabase(data: Uint8Array): Promise<{ valid: boolean; error?: string }> {
  try {
    // Check if the file starts with SQLite magic bytes
    const magicBytes = new Uint8Array([0x53, 0x51, 0x4C, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6F, 0x72, 0x6D, 0x61, 0x74, 0x20, 0x33, 0x00]);
    
    if (data.length < 16) {
      return { valid: false, error: 'File too small to be a valid SQLite database' };
    }
    
    // Check magic bytes
    for (let i = 0; i < magicBytes.length; i++) {
      if (data[i] !== magicBytes[i]) {
        return { valid: false, error: 'Invalid SQLite file format' };
      }
    }
    
    // Try to create a temporary database to validate structure
    try {
      const tempDb = new SQL.Database(data);
      
      // Check if it has our expected queries table structure
      const result = tempDb.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='queries'");
      if (!result || result.length === 0) {
        tempDb.close();
        return { valid: false, error: 'Database does not contain the expected queries table' };
      }
      
      // Validate basic table structure
      const tableInfo = tempDb.exec("PRAGMA table_info(queries)");
      if (!tableInfo || tableInfo.length === 0) {
        tempDb.close();
        return { valid: false, error: 'Cannot read queries table structure' };
      }
      
      const columns = tableInfo[0].values.map(row => row[1]);
      const requiredColumns = ['id', 'query_text'];
      const hasRequiredColumns = requiredColumns.every(col => columns.includes(col));
      
      if (!hasRequiredColumns) {
        tempDb.close();
        return { valid: false, error: 'Database missing required columns in queries table' };
      }
      
      tempDb.close();
      return { valid: true };
    } catch (dbError) {
      return { valid: false, error: `Database validation failed: ${dbError instanceof Error ? dbError.message : 'Unknown error'}` };
    }
  } catch (error) {
    return { valid: false, error: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

async function importDatabase(data: Uint8Array): Promise<{ success: boolean; error?: string }> {
  if (!SQL) {
    return { success: false, error: 'SQLite not initialized' };
  }

  try {
    console.log('Kuery: Starting database import...');
    
    // Validate the incoming database
    const validation = await validateSQLiteDatabase(data);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }
    
    // Create backup of current database before import
    const backupSuccess = await createDatabaseBackup();
    if (!backupSuccess) {
      console.warn('Kuery: Failed to create backup before import, but proceeding...');
    }
    
    // Replace the current database
    if (db) {
      db.close();
    }
    
    // Create new database from imported data
    db = new SQL.Database(data);
    
    // Run migrations on the imported database to ensure it's up to date
    runMigrations();
    
    // Save the imported database to storage
    await saveDatabaseToStorage();
    
    console.log('Kuery: Database import completed successfully');
    return { success: true };
  } catch (error) {
    console.error('Kuery: Error importing database:', error);
    
    // Try to restore from backup if available
    try {
      console.log('Kuery: Attempting to restore from backup...');
      const result = await chrome.storage.local.get(['kuery_database']);
      if (result.kuery_database) {
        const uint8Array = new Uint8Array(result.kuery_database);
        db = new SQL.Database(uint8Array);
        console.log('Kuery: Database restored from storage');
      }
    } catch (restoreError) {
      console.error('Kuery: Failed to restore database:', restoreError);
    }
    
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error during import' 
    };
  }
}

// Notify Azure Data Explorer tabs about SQLite errors
async function notifyTabsAboutSQLiteError() {
  try {
    const tabs = await chrome.tabs.query({
      url: ["https://dataexplorer.azure.com/*", "https://*.kusto.windows.net/*"]
    });
    
    for (const tab of tabs) {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'SQLITE_ERROR',
          error: initializationError,
          message: 'Kuery extension cannot save queries - SQLite database failed to initialize'
        }).catch(() => {
          // Ignore errors if content script isn't ready
        });
      }
    }
  } catch (error) {
    console.error('Kuery: Error notifying tabs about SQLite error:', error);
  }
}

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Kuery Background: Received message:', message.type, message);
  (async () => {
    try {
      switch (message.type) {
        case 'SAVE_QUERY':
          const success = await saveQuery(message.data);
          sendResponse({ success });
          break;
          
        case 'GET_QUERIES_COUNT':
          const count = await getQueriesCount();
          sendResponse({ count });
          break;
          
        case 'GET_RECENT_QUERIES':
          const queries = await getRecentQueries(message.limit || 10, message.offset || 0);
          sendResponse({ queries });
          break;

        case 'SEARCH_QUERIES':
          const searchResults = await searchQueries(message.searchTerm, message.limit || 50);
          sendResponse({ queries: searchResults });
          break;

        case 'DELETE_QUERY':
          console.log('Kuery Background: Processing DELETE_QUERY for ID:', message.queryId);
          const deleteSuccess = await deleteQuery(message.queryId);
          console.log('Kuery Background: Delete result:', deleteSuccess);
          sendResponse({ success: deleteSuccess });
          break;

        case 'UPDATE_QUERY_DESCRIPTION':
          console.log('Kuery Background: Processing UPDATE_QUERY_DESCRIPTION for ID:', message.queryId);
          const updateSuccess = await updateQueryDescription(message.queryId, message.description);
          console.log('Kuery Background: Update result:', updateSuccess);
          sendResponse({ success: updateSuccess });
          break;
          
        case 'GET_SQLITE_STATUS':
          sendResponse({ 
            available: sqliteAvailable, 
            error: initializationError,
            migrationStatus: migrationStatus
          });
          break;

        case 'EXPORT_DATABASE':
          const exportResult = await exportDatabase();
          if (exportResult.success && exportResult.data) {
            // Convert Uint8Array to Array for message passing
            sendResponse({ 
              success: true, 
              data: Array.from(exportResult.data) 
            });
          } else {
            sendResponse({ 
              success: false, 
              error: exportResult.error 
            });
          }
          break;

        case 'GET_AVAILABLE_BACKUPS':
          const backupsResult = await getAvailableBackups();
          sendResponse(backupsResult);
          break;

        case 'EXPORT_BACKUP':
          const backupResult = await exportBackup(message.backupKey);
          if (backupResult.success && backupResult.data) {
            // Convert Uint8Array to Array for message passing
            sendResponse({ 
              success: true, 
              data: Array.from(backupResult.data) 
            });
          } else {
            sendResponse({ 
              success: false, 
              error: backupResult.error 
            });
          }
          break;

        case 'IMPORT_DATABASE':
          try {
            // Convert Array back to Uint8Array
            const importData = new Uint8Array(message.data);
            const importResult = await importDatabase(importData);
            sendResponse(importResult);
          } catch (error) {
            sendResponse({ 
              success: false, 
              error: error instanceof Error ? error.message : 'Invalid data format' 
            });
          }
          break;

        case 'TEST_GITHUB_TOKEN':
          console.log('Kuery Background: Processing TEST_GITHUB_TOKEN');
          const testResult = await testGitHubToken(message.token);
          console.log('Kuery Background: Token test result:', testResult);
          sendResponse(testResult);
          break;
          
        default:
          console.log('Kuery Background: Unknown message type:', message.type);
          sendResponse({ error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Kuery Background: Error handling message:', error);
      sendResponse({ error: error.message });
    }
  })();
  
  console.log('Kuery Background: Message handler completed, returning true');
  return true; // Keep message channel open for async response
});

// Initialize when extension starts
chrome.runtime.onStartup.addListener(initDatabase);
chrome.runtime.onInstalled.addListener(initDatabase);

// Initialize immediately
initDatabase();