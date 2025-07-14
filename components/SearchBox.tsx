import React from 'react';

interface SearchBoxProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  searching: boolean;
  loading: boolean;
  queries: any[];
}

const SearchBox: React.FC<SearchBoxProps> = ({ 
  searchTerm, 
  setSearchTerm, 
  searching, 
  loading, 
  queries 
}) => {
  return (
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
  );
};

export default SearchBox;