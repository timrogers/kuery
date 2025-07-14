import React from 'react';

interface SQLiteStatusProps {
  sqliteStatus: {
    available: boolean;
    error?: string;
    migrationStatus?: {
      hasUnappliedMigrations: boolean;
      failedMigration?: { version: number; error: string };
      lastBackupDate?: string;
    };
  } | null;
}

const SQLiteStatus: React.FC<SQLiteStatusProps> = ({ sqliteStatus }) => {
  if (!sqliteStatus) return null;

  return (
    <>
      {/* SQLite Status - only show if there's a problem */}
      {!sqliteStatus.available && (
        <div style={{ 
          background: '#fef2f2', 
          padding: 12, 
          borderRadius: 6, 
          marginBottom: 16,
          border: '1px solid #fecaca'
        }}>
          <div style={{ 
            fontSize: '12px', 
            color: '#dc2626',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}>
            <span>❌</span>
            <span>SQLite Database Error</span>
          </div>
          {sqliteStatus.error && (
            <details style={{ marginTop: 8 }}>
              <summary style={{ 
                cursor: 'pointer', 
                fontSize: '11px', 
                color: '#7f1d1d' 
              }}>
                Error Details
              </summary>
              <div style={{ 
                marginTop: 4, 
                fontSize: '10px', 
                color: '#7f1d1d', 
                fontFamily: 'monospace',
                background: 'rgba(0,0,0,0.1)',
                padding: 4,
                borderRadius: 3,
                wordBreak: 'break-all'
              }}>
                {sqliteStatus.error}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Migration Status - show if there are migration issues */}
      {sqliteStatus.migrationStatus?.hasUnappliedMigrations && (
        <div style={{ 
          background: '#fef3cd', 
          padding: 12, 
          borderRadius: 6, 
          marginBottom: 16,
          border: '1px solid #fde68a'
        }}>
          <div style={{ 
            fontSize: '12px', 
            color: '#92400e',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 8
          }}>
            <span>⚠️</span>
            <span>Database Migration Issue</span>
          </div>
          
          {sqliteStatus.migrationStatus.failedMigration ? (
            <div>
              <div style={{ fontSize: '11px', color: '#78350f', marginBottom: 4 }}>
                Migration {sqliteStatus.migrationStatus.failedMigration.version} failed. 
                Extension may not work properly.
              </div>
              <details style={{ marginTop: 4 }}>
                <summary style={{ 
                  cursor: 'pointer', 
                  fontSize: '10px', 
                  color: '#78350f' 
                }}>
                  Migration Error Details
                </summary>
                <div style={{ 
                  marginTop: 4, 
                  fontSize: '10px', 
                  color: '#78350f', 
                  fontFamily: 'monospace',
                  background: 'rgba(0,0,0,0.1)',
                  padding: 4,
                  borderRadius: 3,
                  wordBreak: 'break-all'
                }}>
                  {sqliteStatus.migrationStatus.failedMigration.error}
                </div>
              </details>
              {sqliteStatus.migrationStatus.lastBackupDate && (
                <div style={{ 
                  fontSize: '10px', 
                  color: '#78350f', 
                  marginTop: 4,
                  fontStyle: 'italic'
                }}>
                  💾 Backup created: {new Date(sqliteStatus.migrationStatus.lastBackupDate).toLocaleString()}
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: '11px', color: '#78350f' }}>
              Some database migrations are pending. Please restart the extension.
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default SQLiteStatus;