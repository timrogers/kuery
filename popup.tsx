import { useEffect, useState, useCallback } from "react"
import kueryLogo from "./assets/kuery_logo.svg";
import CopyButton from "./components/CopyButton";
import styles from "./popup.module.css";

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

interface QueryData {
  id: number;
  query: string;
  database: string;
  cluster: string;
  runs_count: number;
  last_used_at: string;
  created_at: string;
  description: string;
}

function IndexPopup() {
  console.log('Popup: IndexPopup component rendering');
  const [queries, setQueries] = useState<QueryData[]>([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [sqliteStatus, setSqliteStatus] = useState<{
    available: boolean, 
    error?: string,
    migrationStatus?: {
      hasUnappliedMigrations: boolean;
      failedMigration?: { version: number; error: string };
      lastBackupDate?: string;
    }
  } | null>(null)
  const [selectedQuery, setSelectedQuery] = useState<QueryData | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [editingDescription, setEditingDescription] = useState(false)
  const [editedDescription, setEditedDescription] = useState('')
  
  const debouncedSearchTerm = useDebounce(searchTerm, 300)

  useEffect(() => {
    console.log('Popup: Component mounted, loading initial data');
    loadInitialData()
  }, [])

  useEffect(() => {
    if (debouncedSearchTerm !== undefined) {
      performSearch(debouncedSearchTerm)
    }
  }, [debouncedSearchTerm])

  const loadInitialData = async () => {
    try {
      // Get SQLite status
      const statusResponse = await chrome.runtime.sendMessage({ type: 'GET_SQLITE_STATUS' })
      if (statusResponse) {
        setSqliteStatus(statusResponse)
      }


      // Get recent queries initially - call directly to bypass loading guard
      const response = await chrome.runtime.sendMessage({ 
        type: 'GET_RECENT_QUERIES', 
        limit: 50,
        offset: 0
      })
      
      if (response?.queries) {
        setQueries(response.queries)
        setOffset(50)
        setHasMore(response.queries.length === 50)
      } else {
        setQueries([])
        setOffset(0)
        setHasMore(false)
      }
    } catch (error) {
      console.error('Error loading data:', error)
      setQueries([])
    } finally {
      setLoading(false)
    }
  }

  const performSearch = async (term: string) => {
    if (loading) return // Don't search during initial load
    
    setSearching(true)
    try {
      let response;
      if (term.trim() === '') {
        // Get recent queries if no search term
        response = await chrome.runtime.sendMessage({ 
          type: 'GET_RECENT_QUERIES', 
          limit: 50,
          offset: 0
        })
      } else {
        // Search queries
        response = await chrome.runtime.sendMessage({ 
          type: 'SEARCH_QUERIES', 
          searchTerm: term,
          limit: 50,
          offset: 0
        })
      }
      
      if (response?.queries) {
        setQueries(response.queries)
        setOffset(term.trim() === '' ? 50 : 0)
        setHasMore(response.queries.length === 50)
      } else {
        setQueries([])
        setOffset(0)
        setHasMore(false)
      }
    } catch (error) {
      console.error('Error searching queries:', error)
      setQueries([])
      setOffset(0)
      setHasMore(false)
    } finally {
      setSearching(false)
    }
  }

  const loadMoreQueries = async () => {
    if (loadingMore || !hasMore) return
    
    setLoadingMore(true)
    try {
      let response;
      if (searchTerm.trim() === '') {
        // Get more recent queries if no search term
        response = await chrome.runtime.sendMessage({ 
          type: 'GET_RECENT_QUERIES', 
          limit: 50,
          offset: offset
        })
      } else {
        // Search more queries (for search we don't implement pagination yet)
        return
      }
      
      if (response?.queries && response.queries.length > 0) {
        setQueries(prev => [...prev, ...response.queries])
        setOffset(prev => prev + response.queries.length)
        setHasMore(response.queries.length === 50)
      } else {
        setHasMore(false)
      }
    } catch (error) {
      console.error('Error loading more queries:', error)
      setHasMore(false)
    } finally {
      setLoadingMore(false)
    }
  }

  

  const deleteQuery = async (queryId: number) => {
    try {
      console.log('Popup: Attempting to delete query with ID:', queryId)
      
      const response = await chrome.runtime.sendMessage({
        type: 'DELETE_QUERY',
        queryId: queryId
      })
      
      console.log('Popup: Delete response:', response)
      
      if (response?.success) {
        console.log('Popup: Delete successful, updating UI')
        // Remove from local state
        setQueries(queries.filter(q => q.id !== queryId))
        setSelectedQuery(null)
      } else {
        console.error('Popup: Failed to delete query, response:', response)
      }
    } catch (error) {
      console.error('Popup: Error deleting query:', error)
    }
  }

  const updateQueryDescription = async (queryId: number, description: string) => {
    try {
      console.log('Popup: Updating description for query ID:', queryId, 'to:', description);
      
      const response = await chrome.runtime.sendMessage({
        type: 'UPDATE_QUERY_DESCRIPTION',
        queryId: queryId,
        description: description
      })
      
      if (response?.success) {
        console.log('Popup: Description updated successfully');
        // Update local state
        setSelectedQuery(prev => prev ? { ...prev, description } : null);
        setQueries(prev => prev.map(q => q.id === queryId ? { ...q, description } : q));
        return true;
      } else {
        console.error('Popup: Failed to update description');
        return false;
      }
    } catch (error) {
      console.error('Popup: Error updating description:', error);
      return false;
    }
  }

  const handleQueryClick = (query: QueryData) => {
    console.log('Popup: Query clicked, setting selectedQuery:', query.id);
    setSelectedQuery(query)
    setEditedDescription(query.description)
  }

  const handleBackClick = () => {
    setSelectedQuery(null)
    setShowDeleteConfirm(false)
    setEditingDescription(false)
    setEditedDescription('')
  }

  if (loading) {
    return (
      <div style={{ padding: 16, width: 300 }}>
        <div>Loading...</div>
      </div>
    )
  }

  // Query detail view
  if (selectedQuery) {
    console.log('Popup: Rendering query detail view for:', selectedQuery.id);
    return (
      <div style={{ padding: 16, width: 300, fontFamily: 'system-ui, sans-serif' }}>
        {/* Back button header */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          marginBottom: 16,
          paddingBottom: 12,
          borderBottom: '1px solid #e2e8f0'
        }}>
          <button
            onClick={handleBackClick}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              color: '#2563eb',
              fontSize: '14px',
              fontWeight: '500'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#f0f9ff'}
            onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
          >
            ← Back
          </button>
          <div style={{ 
            marginLeft: 'auto',
            background: selectedQuery.runs_count > 1 ? '#3b82f6' : '#6b7280',
            color: 'white',
            padding: '4px 8px',
            borderRadius: 12,
            fontSize: '12px',
            fontWeight: 'bold'
          }}>
            Used {selectedQuery.runs_count} time{selectedQuery.runs_count !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Query details */}
        <div style={{ marginBottom: 20 }}>
          {/* Description */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: '12px', fontWeight: '500', color: '#374151', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              Description:
              {!editingDescription && (
                <button
                  onClick={() => setEditingDescription(true)}
                  style={{
                    background: 'none',
                    border: '1px solid #d1d5db',
                    color: '#6b7280',
                    padding: '2px 6px',
                    borderRadius: 3,
                    cursor: 'pointer',
                    fontSize: '10px'
                  }}
                >
                  Edit
                </button>
              )}
            </div>
            
            {editingDescription ? (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  value={editedDescription}
                  onChange={(e) => setEditedDescription(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '6px 8px',
                    borderRadius: 4,
                    border: '1px solid #d1d5db',
                    fontSize: '14px',
                    fontFamily: 'system-ui, sans-serif'
                  }}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      updateQueryDescription(selectedQuery.id, editedDescription);
                      setEditingDescription(false);
                    } else if (e.key === 'Escape') {
                      setEditedDescription(selectedQuery.description);
                      setEditingDescription(false);
                    }
                  }}
                />
                <button
                  onClick={async () => {
                    await updateQueryDescription(selectedQuery.id, editedDescription);
                    setEditingDescription(false);
                  }}
                  style={{
                    background: '#10b981',
                    color: 'white',
                    border: 'none',
                    padding: '4px 8px',
                    borderRadius: 3,
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setEditedDescription(selectedQuery.description);
                    setEditingDescription(false);
                  }}
                  style={{
                    background: '#6b7280',
                    color: 'white',
                    border: 'none',
                    padding: '4px 8px',
                    borderRadius: 3,
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 4,
                padding: 8,
                fontSize: '14px',
                color: '#1f2937'
              }}>
                {selectedQuery.description}
              </div>
            )}
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: '12px', fontWeight: '500', color: '#374151', marginBottom: 4 }}>
              Source:
            </div>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1f2937', marginBottom: 4 }}>
              {selectedQuery.cluster || 'Unknown Cluster'}
              {selectedQuery.database && ` / ${selectedQuery.database}`}
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>
              Last used: {new Date(selectedQuery.last_used_at).toLocaleString()}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: '12px', fontWeight: '500', color: '#374151', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              Query:
              <CopyButton
                textToCopy={selectedQuery.query}
                style={{
                  background: '#e0e7ff',
                  border: 'none',
                  padding: '4px 8px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: '10px',
                  color: '#2563eb'
                }}
                title="Copy Query"
              >
                Copy
              </CopyButton>
            </div>
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 6,
              padding: 12,
              fontFamily: 'Monaco, Menlo, monospace',
              fontSize: '11px',
              lineHeight: '1.5',
              color: '#1f2937',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              maxHeight: '200px',
              overflowY: 'auto'
            }}>
              {selectedQuery.query}
            </div>
          </div>
        </div>

        {/* Delete confirmation or delete button */}
        {showDeleteConfirm ? (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => {
                console.log('Popup: User confirmed delete, calling deleteQuery');
                deleteQuery(selectedQuery.id);
                setShowDeleteConfirm(false);
              }}
              style={{
                background: '#dc2626',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                flex: 1
              }}
            >
              Yes, Delete
            </button>
            <button
              onClick={() => {
                console.log('Popup: User cancelled delete');
                setShowDeleteConfirm(false);
              }}
              style={{
                background: '#6b7280',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                flex: 1
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              console.log('Popup: Delete button clicked for query ID:', selectedQuery.id);
              setShowDeleteConfirm(true);
            }}
            style={{
              background: '#dc2626',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              width: '100%'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#b91c1c'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#dc2626'}
          >
            Delete Query
          </button>
        )}
      </div>
    )
  }

  return (
    <div style={{ padding: 16, width: 300, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img src={kueryLogo} alt="Kuery Logo" style={{ width: '32px', height: '32px', cursor: 'pointer' }} />
          <h3 style={{ margin: 0, color: '#2563eb', fontSize: '24px', cursor: 'pointer' }}>Kuery</h3>
        </div>
        <button
          onClick={() => chrome.runtime.openOptionsPage()}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '8px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title="Settings"
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f9ff'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-settings"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 0 2l-.15.08a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1 0-2l.15-.08a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
      </div>

      {/* SQLite Status - only show if there's a problem */}
      {sqliteStatus && !sqliteStatus.available && (
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
      {sqliteStatus?.migrationStatus?.hasUnappliedMigrations && (
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

      {/* Search Box */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ 
          position: 'relative',
          display: 'flex',
          alignItems: 'center'
        }}>
          <input
            type="text"
            placeholder="Search queries..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 4,
              border: '1px solid #d1d5db',
              fontSize: '14px',
              fontFamily: 'system-ui, sans-serif',
              outline: 'none'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#2563eb';
              e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#d1d5db';
              e.target.style.boxShadow = 'none';
            }}
          />
          {(searching || loading) && (
            <div style={{ 
              position: 'absolute',
              right: 8,
              fontSize: '12px',
              color: '#6b7280'
            }}>
              🔍
            </div>
          )}
        </div>
        {searchTerm && (
          <div style={{ 
            fontSize: '12px', 
            color: '#6b7280', 
            marginTop: 4 
          }}>
            {searching ? 'Searching...' : `Found ${queries.length} result${queries.length !== 1 ? 's' : ''}`}
          </div>
        )}
      </div>

      {/* Query Results */}
      {queries.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#374151' }}>
            {searchTerm ? 'Search Results' : 'Recent Queries'}
          </h4>
          <div 
            style={{ maxHeight: 300, overflowY: 'auto' }}
            onScroll={(e) => {
              const target = e.target as HTMLDivElement;
              if (target.scrollTop + target.clientHeight >= target.scrollHeight - 10) {
                loadMoreQueries();
              }
            }}
          >
            {queries.map((query) => (
              <div 
                key={query.id} 
                onClick={() => handleQueryClick(query)}
                className={styles.queryItem}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <div style={{ fontWeight: 'bold', color: '#1f2937', flex: 1, marginRight: 8, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {query.description}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <CopyButton
                      textToCopy={query.query}
                      style={{
                        background: '#e0e7ff',
                        border: 'none',
                        padding: '4px 8px',
                        borderRadius: 4,
                        cursor: 'pointer',
                        fontSize: '10px',
                        color: '#2563eb'
                      }}
                      title="Copy Query"
                    >
                      Copy
                    </CopyButton>
                    <div style={{ 
                      background: query.runs_count > 1 ? '#3b82f6' : '#6b7280',
                      color: 'white',
                      padding: '2px 6px',
                      borderRadius: 10,
                      fontSize: '10px',
                      fontWeight: 'bold',
                      minWidth: '20px',
                      textAlign: 'center'
                    }}>
                      {query.runs_count}
                    </div>
                  </div>
                </div>
                <div style={{ 
                  color: '#6b7280', 
                  fontFamily: 'monospace',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {query.query.substring(0, 60)}...
                </div>
                <div style={{ color: '#9ca3af', fontSize: '11px', marginTop: 4 }}>
                  Last used: {new Date(query.last_used_at).toLocaleString()}
                </div>
              </div>
            ))}
            
            {/* Loading more indicator */}
            {loadingMore && (
              <div style={{ 
                textAlign: 'center', 
                padding: '16px',
                color: '#6b7280',
                fontSize: '14px'
              }}>
                Loading more queries...
              </div>
            )}
            
            {/* End of results indicator */}
            {!hasMore && queries.length > 0 && !searchTerm && (
              <div style={{ 
                textAlign: 'center', 
                padding: '16px',
                color: '#9ca3af',
                fontSize: '12px'
              }}>
                No more queries to load
              </div>
            )}
          </div>
        </div>
      )}

      {queries.length === 0 && !loading && (
        <div style={{ 
          textAlign: 'center', 
          color: '#6b7280', 
          fontSize: '14px',
          padding: '20px 0'
        }}>
          {searchTerm ? 'No queries found matching your search.' : 'No queries captured yet.'}
        </div>
      )}

      <div style={{ 
        marginTop: 12, 
        fontSize: '11px', 
        color: '#9ca3af',
        textAlign: 'center'
      }}>
        Visit Azure Data Explorer to capture queries automatically
      </div>
    </div>
  )
}

export default IndexPopup
