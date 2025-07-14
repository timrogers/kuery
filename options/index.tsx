import React, { useEffect, useState } from 'react';
import kueryLogo from '../assets/icon.png';

interface Backup {
  key: string;
  date: string;
}

const Options = () => {
  const [githubToken, setGithubToken] = useState<string>('');
  const [availableBackups, setAvailableBackups] = useState<Backup[]>([]);
  const [isLoadingBackups, setIsLoadingBackups] = useState(false);
  const [exportStatus, setExportStatus] = useState<string>('');
  const [importStatus, setImportStatus] = useState<string>('');
  const [isImporting, setIsImporting] = useState(false);
  const [tokenTestStatus, setTokenTestStatus] = useState<string>('');
  const [isTestingToken, setIsTestingToken] = useState(false);
  const [isTokenValid, setIsTokenValid] = useState(false);
  const [originalToken, setOriginalToken] = useState<string>('');

  useEffect(() => {
    // Load the token from storage when the component mounts
    chrome.storage.sync.get('githubToken', data => {
      if (data.githubToken) {
        setGithubToken(data.githubToken);
        setOriginalToken(data.githubToken);
        setIsTokenValid(true); // Assume stored token is valid
      }
    });

    // Load available backups
    loadAvailableBackups();
  }, []);

  const handleSave = () => {
    // Save the token to storage
    chrome.storage.sync.set({ githubToken }, () => {
      setOriginalToken(githubToken);
      setIsTokenValid(true); // Reset validation state after save
      alert('Settings saved!');
    });
  };

  const handleTestToken = async () => {
    if (!githubToken.trim()) {
      setTokenTestStatus('Please enter a GitHub token first');
      setTimeout(() => setTokenTestStatus(''), 3000);
      return;
    }

    setIsTestingToken(true);
    setTokenTestStatus('Testing token...');

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'TEST_GITHUB_TOKEN',
        token: githubToken,
      });

      if (response.success) {
        setTokenTestStatus('✅ Token is valid! GitHub Models API accessible.');
        setIsTokenValid(true);
      } else {
        setTokenTestStatus(`❌ Token test failed: ${response.error}`);
        setIsTokenValid(false);
      }
    } catch (error) {
      console.error('Token test error:', error);
      setTokenTestStatus(
        '❌ Token test failed: Unable to communicate with background script'
      );
      setIsTokenValid(false);
    } finally {
      setIsTestingToken(false);
      setTimeout(() => setTokenTestStatus(''), 5000);
    }
  };

  const handleTokenChange = (value: string) => {
    setGithubToken(value);
    // Invalidate token validation if it has changed from the original
    if (value !== originalToken) {
      setIsTokenValid(false);
    } else {
      setIsTokenValid(true); // Token is back to original, so it's valid
    }
  };

  // Determine if the save button should be enabled
  const canSave = () => {
    // If token is empty, allow save (user is deleting the token)
    if (!githubToken.trim()) {
      return true;
    }
    // If token is the same as original, allow save
    if (githubToken === originalToken) {
      return true;
    }
    // Otherwise, only allow save if token has been tested and is valid
    return isTokenValid;
  };

  const loadAvailableBackups = async () => {
    setIsLoadingBackups(true);
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_AVAILABLE_BACKUPS',
      });
      if (response.success && response.backups) {
        setAvailableBackups(response.backups);
      } else {
        console.error('Failed to load backups:', response.error);
        setAvailableBackups([]);
      }
    } catch (error) {
      console.error('Error loading backups:', error);
      setAvailableBackups([]);
    } finally {
      setIsLoadingBackups(false);
    }
  };

  const downloadFile = (data: Uint8Array, filename: string) => {
    const blob = new Blob([data], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportDatabase = async () => {
    setExportStatus('Exporting database...');
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'EXPORT_DATABASE',
      });

      if (response.success && response.data) {
        const data = new Uint8Array(response.data);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `kuery-database-${timestamp}.sqlite`;

        downloadFile(data, filename);
        setExportStatus(`Database exported as ${filename}`);

        setTimeout(() => setExportStatus(''), 3000);
      } else {
        setExportStatus(`Export failed: ${response.error}`);
        setTimeout(() => setExportStatus(''), 5000);
      }
    } catch (error) {
      console.error('Export error:', error);
      setExportStatus('Export failed: Unknown error');
      setTimeout(() => setExportStatus(''), 5000);
    }
  };

  const handleExportBackup = async (backupKey: string, backupDate: string) => {
    setExportStatus(`Exporting backup from ${backupDate}...`);
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'EXPORT_BACKUP',
        backupKey: backupKey,
      });

      if (response.success && response.data) {
        const data = new Uint8Array(response.data);
        const cleanDate = backupDate.replace(/[:.]/g, '-');
        const filename = `kuery-backup-${cleanDate}.sqlite`;

        downloadFile(data, filename);
        setExportStatus(`Backup exported as ${filename}`);

        setTimeout(() => setExportStatus(''), 3000);
      } else {
        setExportStatus(`Backup export failed: ${response.error}`);
        setTimeout(() => setExportStatus(''), 5000);
      }
    } catch (error) {
      console.error('Backup export error:', error);
      setExportStatus('Backup export failed: Unknown error');
      setTimeout(() => setExportStatus(''), 5000);
    }
  };

  const handleImportDatabase = async (file: File) => {
    if (!file) return;

    setIsImporting(true);
    setImportStatus('Reading file...');

    try {
      // Validate file type
      if (
        !file.name.toLowerCase().endsWith('.sqlite') &&
        !file.name.toLowerCase().endsWith('.db')
      ) {
        setImportStatus(
          'Please select a valid SQLite database file (.sqlite or .db)'
        );
        setTimeout(() => setImportStatus(''), 5000);
        return;
      }

      // Read file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);

      setImportStatus('Importing database...');

      const response = await chrome.runtime.sendMessage({
        type: 'IMPORT_DATABASE',
        data: Array.from(data),
      });

      if (response.success) {
        setImportStatus(
          'Database imported successfully! Refreshing backups...'
        );

        // Refresh backup list after successful import
        await loadAvailableBackups();

        setImportStatus('Import completed successfully!');
        setTimeout(() => setImportStatus(''), 5000);
      } else {
        setImportStatus(`Import failed: ${response.error}`);
        setTimeout(() => setImportStatus(''), 8000);
      }
    } catch (error) {
      console.error('Import error:', error);
      setImportStatus('Import failed: Unable to read file');
      setTimeout(() => setImportStatus(''), 5000);
    } finally {
      setIsImporting(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleImportDatabase(file);
    }
    // Reset input value to allow selecting the same file again
    event.target.value = '';
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#f9fafb',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: '800px',
          margin: '0 auto',
          padding: '24px',
          backgroundColor: 'white',
          minHeight: '100vh',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: 32,
            paddingBottom: 16,
            borderBottom: '1px solid #e2e8f0',
          }}
        >
          <img
            src={kueryLogo}
            alt="Kuery Logo"
            style={{ width: '40px', height: '40px' }}
          />
          <h1
            style={{
              margin: 0,
              color: 'rgb(25,112,196)',
              fontSize: '28px',
              fontWeight: '600',
            }}
          >
            Kuery Settings
          </h1>
        </div>

        {/* GitHub Token Section */}
        <section style={{ marginBottom: 40 }}>
          <h2
            style={{
              fontSize: '20px',
              fontWeight: '600',
              color: '#1f2937',
              marginBottom: 8,
              margin: '0 0 8px 0',
            }}
          >
            GitHub Models Integration
          </h2>
          <p
            style={{
              color: '#6b7280',
              fontSize: '14px',
              marginBottom: 16,
              margin: '0 0 16px 0',
            }}
          >
            Configure your GitHub token for AI-powered query descriptions.
          </p>

          {/* Instructions for creating a token */}
          <div
            style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 6,
              padding: '12px 16px',
              marginBottom: 16,
              fontSize: '14px',
            }}
          >
            <h4
              style={{
                margin: '0 0 8px 0',
                fontSize: '14px',
                fontWeight: '600',
                color: '#374151',
              }}
            >
              📋 How to create a GitHub token:
            </h4>
            <ol
              style={{
                margin: '0 0 0 16px',
                padding: 0,
                color: '#4b5563',
                lineHeight: '1.5',
              }}
            >
              <li style={{ marginBottom: 4 }}>
                Go to{' '}
                <a
                  href="https://github.com/settings/personal-access-tokens/new"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#2563eb', textDecoration: 'none' }}
                  onMouseEnter={e =>
                    ((e.target as HTMLElement).style.textDecoration = 'underline')
                  }
                  onMouseLeave={e => ((e.target as HTMLElement).style.textDecoration = 'none')}
                >
                  GitHub Settings → Personal Access Tokens
                </a>
              </li>
              <li style={{ marginBottom: 4 }}>
                Choose "Fine-grained personal access token"
              </li>
              <li style={{ marginBottom: 4 }}>
                Set expiration and description (e.g., "Kuery Extension")
              </li>
              <li style={{ marginBottom: 4 }}>
                In <strong>"Account permissions"</strong> section, enable{' '}
                <strong>"Models - Read-only"</strong>
              </li>
              <li>Click "Generate token" and copy the token here</li>
            </ol>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label
              htmlFor="githubToken"
              style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: 6,
              }}
            >
              GitHub Token:
            </label>
            <input
              type="text"
              id="githubToken"
              value={githubToken}
              onChange={e => handleTokenChange(e.target.value)}
              style={{
                width: '100%',
                maxWidth: '400px',
                padding: '8px 12px',
                borderRadius: 4,
                border: '1px solid #d1d5db',
                fontSize: '14px',
                fontFamily: 'system-ui, sans-serif',
                outline: 'none',
              }}
              placeholder="Enter your GitHub token..."
              onFocus={e => {
                e.target.style.borderColor = '#2563eb';
                e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)';
              }}
              onBlur={e => {
                e.target.style.borderColor = '#d1d5db';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button
              onClick={handleTestToken}
              disabled={isTestingToken || !githubToken.trim()}
              style={{
                padding: '8px 16px',
                backgroundColor:
                  isTestingToken || !githubToken.trim() ? '#9ca3af' : '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                cursor:
                  isTestingToken || !githubToken.trim()
                    ? 'not-allowed'
                    : 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                flex: 1,
              }}
              onMouseEnter={e => {
                if (!isTestingToken && githubToken.trim())
                  (e.target as HTMLElement).style.backgroundColor = '#059669';
              }}
              onMouseLeave={e => {
                if (!isTestingToken && githubToken.trim())
                  (e.target as HTMLElement).style.backgroundColor = '#10b981';
              }}
            >
              {isTestingToken ? 'Testing...' : 'Test Token'}
            </button>

            <button
              onClick={handleSave}
              disabled={!canSave()}
              style={{
                padding: '8px 16px',
                backgroundColor: !canSave() ? '#9ca3af' : '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                cursor: !canSave() ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                flex: 1,
              }}
              onMouseEnter={e => {
                if (canSave()) e.target.style.backgroundColor = '#1d4ed8';
              }}
              onMouseLeave={e => {
                if (canSave()) e.target.style.backgroundColor = '#2563eb';
              }}
            >
              Save Token
            </button>
          </div>

          {/* Save validation message */}
          {!canSave() && githubToken.trim() && (
            <div
              style={{
                marginTop: 8,
                padding: '6px 8px',
                backgroundColor: '#fef3cd',
                color: '#92400e',
                borderRadius: 4,
                fontSize: '12px',
                border: '1px solid #fde68a',
              }}
            >
              Please test your token before saving
            </div>
          )}

          {/* Token Test Status */}
          {tokenTestStatus && (
            <div
              style={{
                marginTop: 16,
                padding: '8px 12px',
                backgroundColor: tokenTestStatus.includes('✅')
                  ? '#f0fdf4'
                  : tokenTestStatus.includes('❌')
                    ? '#fef2f2'
                    : '#f0f9ff',
                color: tokenTestStatus.includes('✅')
                  ? '#16a34a'
                  : tokenTestStatus.includes('❌')
                    ? '#dc2626'
                    : '#2563eb',
                borderRadius: 6,
                fontSize: '14px',
                border: `1px solid ${tokenTestStatus.includes('✅') ? '#bbf7d0' : tokenTestStatus.includes('❌') ? '#fecaca' : '#dbeafe'}`,
              }}
            >
              {tokenTestStatus}
            </div>
          )}
        </section>

        {/* Database Import/Export Section */}
        <section style={{ marginBottom: 40 }}>
          <h2
            style={{
              fontSize: '20px',
              fontWeight: '600',
              color: '#1f2937',
              marginBottom: 8,
              margin: '0 0 8px 0',
            }}
          >
            Database Import/Export
          </h2>
          <p
            style={{
              color: '#6b7280',
              fontSize: '14px',
              marginBottom: 16,
              margin: '0 0 16px 0',
            }}
          >
            Import databases from other devices or export your current database
            and backups as SQLite files.
          </p>

          {/* Status Messages */}
          {(exportStatus || importStatus) && (
            <div style={{ marginBottom: 16 }}>
              {exportStatus && (
                <div
                  style={{
                    padding: '8px 12px',
                    backgroundColor: exportStatus.includes('failed')
                      ? '#fef2f2'
                      : '#f0f9ff',
                    color: exportStatus.includes('failed')
                      ? '#dc2626'
                      : '#2563eb',
                    borderRadius: 6,
                    marginBottom: importStatus ? 8 : 0,
                    fontSize: '14px',
                    border: `1px solid ${exportStatus.includes('failed') ? '#fecaca' : '#dbeafe'}`,
                  }}
                >
                  📤 {exportStatus}
                </div>
              )}
              {importStatus && (
                <div
                  style={{
                    padding: '8px 12px',
                    backgroundColor: importStatus.includes('failed')
                      ? '#fef2f2'
                      : '#f0fdf4',
                    color: importStatus.includes('failed')
                      ? '#dc2626'
                      : '#16a34a',
                    borderRadius: 6,
                    fontSize: '14px',
                    border: `1px solid ${importStatus.includes('failed') ? '#fecaca' : '#bbf7d0'}`,
                  }}
                >
                  📥 {importStatus}
                </div>
              )}
            </div>
          )}

          {/* Import Database */}
          <div style={{ marginBottom: 24 }}>
            <h3
              style={{
                fontSize: '16px',
                fontWeight: '600',
                color: '#1f2937',
                marginBottom: 8,
                margin: '0 0 8px 0',
              }}
            >
              Import Database
            </h3>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                marginBottom: 8,
              }}
            >
              <label
                htmlFor="databaseImport"
                style={{
                  padding: '8px 16px',
                  backgroundColor: isImporting ? '#9ca3af' : '#f59e0b',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: isImporting ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  display: 'inline-block',
                }}
                onMouseEnter={e => {
                  if (!isImporting) e.target.style.backgroundColor = '#d97706';
                }}
                onMouseLeave={e => {
                  if (!isImporting) e.target.style.backgroundColor = '#f59e0b';
                }}
              >
                {isImporting ? 'Importing...' : 'Choose Database File'}
              </label>
              <input
                id="databaseImport"
                type="file"
                accept=".sqlite,.db"
                onChange={handleFileSelect}
                disabled={isImporting}
                style={{ display: 'none' }}
              />
            </div>
            <div
              style={{ fontSize: '12px', color: '#6b7280', marginBottom: 8 }}
            >
              Select a .sqlite or .db file to import. <strong>Warning:</strong>{' '}
              This will replace your current database!
            </div>
            <div
              style={{
                fontSize: '11px',
                color: '#dc2626',
                backgroundColor: '#fef2f2',
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid #fecaca',
              }}
            >
              ⚠️ A backup of your current database will be created automatically
              before import.
            </div>
          </div>

          {/* Current Database Export */}
          <div style={{ marginBottom: 24 }}>
            <h3
              style={{
                fontSize: '16px',
                fontWeight: '600',
                color: '#1f2937',
                marginBottom: 8,
                margin: '0 0 8px 0',
              }}
            >
              Export Current Database
            </h3>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                marginBottom: 8,
              }}
            >
              <button
                onClick={handleExportDatabase}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                }}
                onMouseEnter={e => (e.target.style.backgroundColor = '#059669')}
                onMouseLeave={e => (e.target.style.backgroundColor = '#10b981')}
              >
                Export Current Database
              </button>
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>
              Downloads your current database as a .sqlite file
            </div>
          </div>

          {/* Backup Exports */}
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                marginBottom: 12,
              }}
            >
              <h3
                style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#1f2937',
                  margin: 0,
                }}
              >
                Database Backups
              </h3>
              <button
                onClick={loadAvailableBackups}
                disabled={isLoadingBackups}
                style={{
                  padding: '4px 8px',
                  backgroundColor: isLoadingBackups ? '#9ca3af' : '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: isLoadingBackups ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                  fontWeight: '500',
                }}
                onMouseEnter={e => {
                  if (!isLoadingBackups)
                    e.target.style.backgroundColor = '#4b5563';
                }}
                onMouseLeave={e => {
                  if (!isLoadingBackups)
                    e.target.style.backgroundColor = '#6b7280';
                }}
              >
                {isLoadingBackups ? 'Loading...' : 'Refresh'}
              </button>
            </div>

            {availableBackups.length > 0 ? (
              <div
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: 6,
                  overflow: 'hidden',
                }}
              >
                {availableBackups.map((backup, index) => (
                  <div
                    key={backup.key}
                    style={{
                      padding: '12px 16px',
                      borderBottom:
                        index < availableBackups.length - 1
                          ? '1px solid #e2e8f0'
                          : 'none',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      backgroundColor: index % 2 === 0 ? '#f8fafc' : 'white',
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: '14px',
                          fontWeight: '500',
                          color: '#1f2937',
                        }}
                      >
                        Backup #{availableBackups.length - index}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>
                        Created: {new Date(backup.date).toLocaleString()}
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        handleExportBackup(backup.key, backup.date)
                      }
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: 4,
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: '500',
                      }}
                      onMouseEnter={e =>
                        (e.target.style.backgroundColor = '#2563eb')
                      }
                      onMouseLeave={e =>
                        (e.target.style.backgroundColor = '#3b82f6')
                      }
                    >
                      Export
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  padding: 20,
                  textAlign: 'center',
                  color: '#6b7280',
                  backgroundColor: '#f8fafc',
                  borderRadius: 6,
                  border: '1px solid #e2e8f0',
                }}
              >
                {isLoadingBackups
                  ? 'Loading backups...'
                  : 'No database backups found'}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Options;
