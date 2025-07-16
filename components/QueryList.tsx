import React, { useEffect, useRef } from 'react';
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
  starred_at?: string;
}

interface QueryListProps {
  queries: QueryData[];
  searchTerm: string;
  loadingMore: boolean;
  hasMore: boolean;
  scrollPosition?: number;
  onQueryClick: (query: QueryData, scrollTop: number) => void;
  onLoadMore: () => void;
  onStarClick: (queryId: number) => void;
  isFullHeight?: boolean;
}

const QueryList: React.FC<QueryListProps> = ({
  queries,
  searchTerm,
  loadingMore,
  hasMore,
  scrollPosition = 0,
  onQueryClick,
  onLoadMore,
  onStarClick,
  isFullHeight = false,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Restore scroll position when component mounts or scrollPosition changes
  useEffect(() => {
    if (scrollContainerRef.current && scrollPosition > 0) {
      scrollContainerRef.current.scrollTop = scrollPosition;
    }
  }, [scrollPosition]);

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
    <div style={{ 
      marginBottom: isFullHeight ? 0 : 16,
      flex: isFullHeight ? 1 : 'none',
      display: isFullHeight ? 'flex' : 'block',
      flexDirection: isFullHeight ? 'column' : 'row',
      minHeight: isFullHeight ? 0 : 'auto'
    }}>
      <h4 style={{ 
        margin: '0 0 8px 0', 
        fontSize: isFullHeight ? '18px' : '14px', 
        color: '#374151',
        flexShrink: 0
      }}>
        {searchTerm ? 'Search Results' : 'Recent Queries'}
      </h4>
      <div
        ref={scrollContainerRef}
        style={{ 
          maxHeight: isFullHeight ? 'none' : 300, 
          height: isFullHeight ? '100%' : 'auto',
          flex: isFullHeight ? 1 : 'none',
          overflowY: 'auto',
          minHeight: isFullHeight ? 0 : 'auto'
        }}
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
            onClick={() => onQueryClick(query, scrollContainerRef.current?.scrollTop || 0)}
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
                  fontSize: isFullHeight ? '16px' : '14px',
                }}
              >
                {query.description}
              </div>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onStarClick(query.id);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '14px',
                    padding: '2px 4px',
                    color: query.starred_at ? '#fbbf24' : '#d1d5db',
                  }}
                  title={query.starred_at ? 'Remove from favorites' : 'Add to favorites'}
                >
                  ★
                </button>
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
                fontSize: isFullHeight ? '14px' : '12px',
              }}
            >
              {query.query.substring(0, isFullHeight ? 100 : 60)}...
            </div>
            <div style={{ 
              color: '#9ca3af', 
              fontSize: isFullHeight ? '13px' : '11px', 
              marginTop: 4 
            }}>
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
