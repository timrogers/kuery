import React from 'react';
import PopupHeader from './PopupHeader';
import SQLiteStatus from './SQLiteStatus';
import SearchBox from './SearchBox';
import QueryList from './QueryList';

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

interface MainScreenProps {
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

const MainScreen: React.FC<MainScreenProps> = ({
  queries,
  loading,
  searching,
  searchTerm,
  sqliteStatus,
  loadingMore,
  hasMore,
  onSearchTermChange,
  onQueryClick,
  onLoadMore
}) => {
  return (
    <div style={{ padding: 16, width: 300, fontFamily: 'system-ui, sans-serif' }}>
      <PopupHeader />
      
      <SQLiteStatus sqliteStatus={sqliteStatus} />

      <SearchBox
        searchTerm={searchTerm}
        setSearchTerm={onSearchTermChange}
        searching={searching}
        loading={loading}
        queries={queries}
      />

      <QueryList
        queries={queries}
        searchTerm={searchTerm}
        loadingMore={loadingMore}
        hasMore={hasMore}
        onQueryClick={onQueryClick}
        onLoadMore={onLoadMore}
      />

      <div style={{ 
        marginTop: 12, 
        fontSize: '11px', 
        color: '#9ca3af',
        textAlign: 'center'
      }}>
        Visit Azure Data Explorer to capture queries automatically
      </div>
    </div>
  );
};

export default MainScreen;