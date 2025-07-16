import React from 'react';
import PopupHeader from './PopupHeader';
import QueryList from './QueryList';
import SearchBox from './SearchBox';
import SQLiteStatus from './SQLiteStatus';

interface QueryData {
  id: number;
  query: string;
  database: string;
  cluster: string;
  runs_count: number;
  last_used_at: string;
  created_at: string;
  description: string;
  starred_at?: string;
}

interface TabMainScreenProps {
  queries: QueryData[];
  loading: boolean;
  searching: boolean;
  searchTerm: string;
  sqliteStatus: {
    available: boolean;
    error?: string;
    migrationStatus?: {
      hasUnappliedMigrations: boolean;
      failedMigration?: { version: number; error: string };
      lastBackupDate?: string;
    };
  } | null;
  loadingMore: boolean;
  hasMore: boolean;
  showStarredOnly: boolean;
  onSearchTermChange: (term: string) => void;
  onQueryClick: (query: QueryData) => void;
  onLoadMore: () => void;
  onStarClick: (queryId: number) => void;
  onToggleStarredFilter: () => void;
}

const TabMainScreen: React.FC<TabMainScreenProps> = ({
  queries,
  loading,
  searching,
  searchTerm,
  sqliteStatus,
  loadingMore,
  hasMore,
  showStarredOnly,
  onSearchTermChange,
  onQueryClick,
  onLoadMore,
  onStarClick,
  onToggleStarredFilter,
}) => {
  return (
    <div style={{ 
      width: '100vw', 
      height: '100vh',
      fontFamily: 'system-ui, sans-serif',
      backgroundColor: '#ffffff',
      overflow: 'auto',
      boxSizing: 'border-box'
    }}>
      <div style={{ 
        padding: '24px 32px',
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ marginBottom: '24px' }}>
          <PopupHeader showFullScreenButton={false} isTabVersion={true} />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <SQLiteStatus sqliteStatus={sqliteStatus} />
        </div>

        <div style={{ 
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'center'
        }}>
          <div style={{ width: '100%', maxWidth: '600px' }}>
            <SearchBox
              searchTerm={searchTerm}
              setSearchTerm={onSearchTermChange}
              searching={searching}
              loading={loading}
              queries={queries}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
              <button
                onClick={onToggleStarredFilter}
                style={{
                  background: showStarredOnly ? '#3b82f6' : '#f3f4f6',
                  color: showStarredOnly ? 'white' : '#374151',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span style={{ fontSize: '16px' }}>★</span>
                {showStarredOnly ? 'Show All' : 'Starred Only'}
              </button>
            </div>
          </div>
        </div>

        <div style={{ 
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0
        }}>
          <QueryList
            queries={queries}
            searchTerm={searchTerm}
            loadingMore={loadingMore}
            hasMore={hasMore}
            onQueryClick={onQueryClick}
            onLoadMore={onLoadMore}
            onStarClick={onStarClick}
            isFullHeight={true}
          />
        </div>

        <div style={{
          marginTop: '24px',
          fontSize: '16px',
          color: '#9ca3af',
          textAlign: 'center',
          padding: '16px'
        }}>
          Visit Azure Data Explorer to capture queries automatically
        </div>
      </div>
    </div>
  );
};

export default TabMainScreen;