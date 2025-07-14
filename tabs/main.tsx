import { useCallback, useEffect, useState } from 'react';
import LoadingScreen from '../components/LoadingScreen';
import TabMainScreen from '../components/TabMainScreen';
import Modal from '../components/Modal';
import QueryDetailModal from '../components/QueryDetailModal';

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

function TabApp() {
  console.log('Tab: TabApp component rendering');
  const [queries, setQueries] = useState<QueryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sqliteStatus, setSqliteStatus] = useState<{
    available: boolean;
    error?: string;
    migrationStatus?: {
      hasUnappliedMigrations: boolean;
      failedMigration?: { version: number; error: string };
      lastBackupDate?: string;
    };
  } | null>(null);
  const [selectedQuery, setSelectedQuery] = useState<QueryData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const performSearch = useCallback(
    async (term: string) => {
      if (loading) return;

      setSearching(true);
      try {
        let response;
        if (term.trim() === '') {
          response = await chrome.runtime.sendMessage({
            type: 'GET_RECENT_QUERIES',
            limit: 50,
            offset: 0,
          });
        } else {
          response = await chrome.runtime.sendMessage({
            type: 'SEARCH_QUERIES',
            searchTerm: term,
            limit: 50,
            offset: 0,
          });
        }

        if (response?.queries) {
          setQueries(response.queries);
          setOffset(term.trim() === '' ? 50 : 0);
          setHasMore(response.queries.length === 50);
        } else {
          setQueries([]);
          setOffset(0);
          setHasMore(false);
        }
      } catch (error) {
        console.error('Error searching queries:', error);
        setQueries([]);
        setOffset(0);
        setHasMore(false);
      } finally {
        setSearching(false);
      }
    },
    [loading]
  );

  useEffect(() => {
    console.log('Tab: Component mounted, loading initial data');
    loadInitialData();
  }, []);

  useEffect(() => {
    if (debouncedSearchTerm !== undefined) {
      performSearch(debouncedSearchTerm);
    }
  }, [debouncedSearchTerm, performSearch]);

  const loadInitialData = async () => {
    try {
      const statusResponse = await chrome.runtime.sendMessage({
        type: 'GET_SQLITE_STATUS',
      });
      if (statusResponse) {
        setSqliteStatus(statusResponse);
      }

      const response = await chrome.runtime.sendMessage({
        type: 'GET_RECENT_QUERIES',
        limit: 50,
        offset: 0,
      });

      if (response?.queries) {
        setQueries(response.queries);
        setOffset(50);
        setHasMore(response.queries.length === 50);
      } else {
        setQueries([]);
        setOffset(0);
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      setQueries([]);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreQueries = async () => {
    if (loadingMore || !hasMore) return;

    setLoadingMore(true);
    try {
      let response;
      if (searchTerm.trim() === '') {
        response = await chrome.runtime.sendMessage({
          type: 'GET_RECENT_QUERIES',
          limit: 50,
          offset: offset,
        });
      } else {
        return;
      }

      if (response?.queries && response.queries.length > 0) {
        setQueries(prev => [...prev, ...response.queries]);
        setOffset(prev => prev + response.queries.length);
        setHasMore(response.queries.length === 50);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error loading more queries:', error);
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  };

  const deleteQuery = async (queryId: number) => {
    try {
      console.log('Tab: Attempting to delete query with ID:', queryId);

      const response = await chrome.runtime.sendMessage({
        type: 'DELETE_QUERY',
        queryId: queryId,
      });

      console.log('Tab: Delete response:', response);

      if (response?.success) {
        console.log('Tab: Delete successful, updating UI');
        setQueries(queries.filter(q => q.id !== queryId));
        setSelectedQuery(null);
        setIsModalOpen(false);
      } else {
        console.error('Tab: Failed to delete query, response:', response);
      }
    } catch (error) {
      console.error('Tab: Error deleting query:', error);
    }
  };

  const updateQueryDescription = async (
    queryId: number,
    description: string
  ) => {
    try {
      console.log(
        'Tab: Updating description for query ID:',
        queryId,
        'to:',
        description
      );

      const response = await chrome.runtime.sendMessage({
        type: 'UPDATE_QUERY_DESCRIPTION',
        queryId: queryId,
        description: description,
      });

      if (response?.success) {
        console.log('Tab: Description updated successfully');
        setSelectedQuery(prev => (prev ? { ...prev, description } : null));
        setQueries(prev =>
          prev.map(q => (q.id === queryId ? { ...q, description } : q))
        );
        return true;
      } else {
        console.error('Tab: Failed to update description');
        return false;
      }
    } catch (error) {
      console.error('Tab: Error updating description:', error);
      return false;
    }
  };

  const handleQueryClick = (query: QueryData) => {
    console.log('Tab: Query clicked, opening modal for query:', query.id);
    setSelectedQuery(query);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedQuery(null);
  };

  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <LoadingScreen />
      </div>
    );
  }


  return (
    <div style={{ 
      minHeight: '100vh',
      height: '100vh',
      width: '100vw',
      margin: '0',
      padding: '0'
    }}>
      <TabMainScreen
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
      
      {/* Query Detail Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={selectedQuery?.description || 'Query Details'}
      >
        {selectedQuery && (
          <QueryDetailModal
            query={selectedQuery}
            onDelete={deleteQuery}
            onUpdateDescription={updateQueryDescription}
          />
        )}
      </Modal>
    </div>
  );
}

export default TabApp;