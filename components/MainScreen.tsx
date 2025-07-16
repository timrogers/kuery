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
  showStarredOnly: boolean;
  scrollPosition: number;
  onSearchTermChange: (term: string) => void;
  onQueryClick: (query: QueryData, scrollTop: number) => void;
  onLoadMore: () => void;
  onStarClick: (queryId: number) => void;
  onToggleStarredFilter: () => void;
}

const MainScreen: React.FC<MainScreenProps> = ({
  queries,
  loading,
  searching,
  searchTerm,
  sqliteStatus,
  loadingMore,
  hasMore,
  showStarredOnly,
  scrollPosition,
  onSearchTermChange,
  onQueryClick,
  onLoadMore,
  onStarClick,
  onToggleStarredFilter,
}) => {
  return (
    <div
      style={{ padding: 16, width: 300, fontFamily: 'system-ui, sans-serif' }}
    >
      <PopupHeader />

      <SQLiteStatus sqliteStatus={sqliteStatus} />

      <SearchBox
        searchTerm={searchTerm}
        setSearchTerm={onSearchTermChange}
        searching={searching}
        loading={loading}
        queries={queries}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <button
          onClick={onToggleStarredFilter}
          style={{
            background: showStarredOnly ? '#3b82f6' : '#f3f4f6',
            color: showStarredOnly ? 'white' : '#374151',
            border: 'none',
            padding: '6px 12px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <span style={{ fontSize: '14px' }}>★</span>
          {showStarredOnly ? 'Show All' : 'Starred Only'}
        </button>
      </div>

      <QueryList
        queries={queries}
        searchTerm={searchTerm}
        loadingMore={loadingMore}
        hasMore={hasMore}
        scrollPosition={scrollPosition}
        onQueryClick={onQueryClick}
        onLoadMore={onLoadMore}
        onStarClick={onStarClick}
      />

      <div
        style={{
          marginTop: 12,
          fontSize: '11px',
          color: '#9ca3af',
          textAlign: 'center',
        }}
      >
        Visit Azure Data Explorer to capture queries automatically
      </div>
    </div>
  );
};

export default MainScreen;
