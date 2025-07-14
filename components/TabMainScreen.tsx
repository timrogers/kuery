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
  onSearchTermChange: (term: string) => void;
  onQueryClick: (query: QueryData) => void;
  onLoadMore: () => void;
}

const TabMainScreen: React.FC<TabMainScreenProps> = ({
  queries,
  loading,
  searching,
  searchTerm,
  sqliteStatus,
  loadingMore,
  hasMore,
  onSearchTermChange,
  onQueryClick,
  onLoadMore,
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