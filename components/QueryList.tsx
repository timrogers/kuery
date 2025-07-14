import React from 'react';
import styles from '../popup.module.css';
import CopyButton from './CopyButton';

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

interface QueryListProps {
  queries: QueryData[];
  searchTerm: string;
  loadingMore: boolean;
  hasMore: boolean;
  onQueryClick: (query: QueryData) => void;
  onLoadMore: () => void;
}

const QueryList: React.FC<QueryListProps> = ({
  queries,
  searchTerm,
  loadingMore,
  hasMore,
  onQueryClick,
  onLoadMore,
}) => {
  if (queries.length === 0) {
    return (
      <div
        style={{
          textAlign: 'center',
          color: '#6b7280',
          fontSize: '14px',
          padding: '20px 0',
        }}
      >
        {searchTerm
          ? 'No queries found matching your search.'
          : 'No queries captured yet.'}
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#374151' }}>
        {searchTerm ? 'Search Results' : 'Recent Queries'}
      </h4>
      <div
        style={{ maxHeight: 300, overflowY: 'auto' }}
        onScroll={e => {
          const target = e.target as HTMLDivElement;
          if (
            target.scrollTop + target.clientHeight >=
            target.scrollHeight - 10
          ) {
            onLoadMore();
          }
        }}
      >
        {queries.map(query => (
          <div
            key={query.id}
            onClick={() => onQueryClick(query)}
            className={styles.queryItem}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 4,
              }}
            >
              <div
                style={{
                  fontWeight: 'bold',
                  color: '#1f2937',
                  flex: 1,
                  marginRight: 8,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {query.description}
              </div>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <CopyButton
                  textToCopy={query.query}
                  style={{
                    background: '#e0e7ff',
                    border: 'none',
                    padding: '4px 8px',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontSize: '10px',
                    color: '#2563eb',
                  }}
                  title="Copy Query"
                >
                  Copy
                </CopyButton>
                <div
                  style={{
                    background: query.runs_count > 1 ? '#3b82f6' : '#6b7280',
                    color: 'white',
                    padding: '2px 6px',
                    borderRadius: 10,
                    fontSize: '10px',
                    fontWeight: 'bold',
                    minWidth: '20px',
                    textAlign: 'center',
                  }}
                >
                  {query.runs_count}
                </div>
              </div>
            </div>
            <div
              style={{
                color: '#6b7280',
                fontFamily: 'monospace',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {query.query.substring(0, 60)}...
            </div>
            <div style={{ color: '#9ca3af', fontSize: '11px', marginTop: 4 }}>
              Last used: {new Date(query.last_used_at).toLocaleString()}
            </div>
          </div>
        ))}

        {/* Loading more indicator */}
        {loadingMore && (
          <div
            style={{
              textAlign: 'center',
              padding: '16px',
              color: '#6b7280',
              fontSize: '14px',
            }}
          >
            Loading more queries...
          </div>
        )}

        {/* End of results indicator */}
        {!hasMore && queries.length > 0 && !searchTerm && (
          <div
            style={{
              textAlign: 'center',
              padding: '16px',
              color: '#9ca3af',
              fontSize: '12px',
            }}
          >
            No more queries to load
          </div>
        )}
      </div>
    </div>
  );
};

export default QueryList;
