import { useEffect, useState, useCallback } from "react"
import LoadingScreen from "./components/LoadingScreen";
import MainScreen from "./components/MainScreen";
import QueryDetail from "./components/QueryDetail";
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
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  
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
  }

  const handleBackClick = () => {
    setSelectedQuery(null)
  }

  if (loading) {
    return <LoadingScreen />;
  }

  // Query detail view
  if (selectedQuery) {
    console.log('Popup: Rendering query detail view for:', selectedQuery.id);
    return (
      <QueryDetail
        query={selectedQuery}
        onBack={handleBackClick}
        onDelete={deleteQuery}
        onUpdateDescription={updateQueryDescription}
      />
    );
  }

  return (
    <MainScreen
      queries={queries}
      loading={loading}
      searching={searching}
      searchTerm={searchTerm}
      sqliteStatus={sqliteStatus}
      loadingMore={loadingMore}
      hasMore={hasMore}
      onSearchTermChange={setSearchTerm}
      onQueryClick={handleQueryClick}
      onLoadMore={loadMoreQueries}
    />
  )
}

export default IndexPopup
