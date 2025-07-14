import React, { useEffect, useState } from 'react';
import CopyButton from './CopyButton';
import DeleteConfirmation from './DeleteConfirmation';

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

interface QueryDetailProps {
  query: QueryData;
  onBack: () => void;
  onDelete: (queryId: number) => void;
  onUpdateDescription: (
    queryId: number,
    description: string
  ) => Promise<boolean>;
}

const QueryDetail: React.FC<QueryDetailProps> = ({
  query,
  onBack,
  onDelete,
  onUpdateDescription,
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [editedDescription, setEditedDescription] = useState(query.description);

  // Update editedDescription when query changes
  useEffect(() => {
    setEditedDescription(query.description);
  }, [query.description]);

  const handleUpdateDescription = async () => {
    const success = await onUpdateDescription(query.id, editedDescription);
    if (success) {
      setEditingDescription(false);
    }
  };

  const handleCancelEdit = () => {
    setEditedDescription(query.description);
    setEditingDescription(false);
  };

  const handleDeleteConfirm = () => {
    onDelete(query.id);
    setShowDeleteConfirm(false);
  };

  return (
    <div
      style={{ padding: 16, width: 300, fontFamily: 'system-ui, sans-serif' }}
    >
      {/* Back button header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: 16,
          paddingBottom: 12,
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        <button
          onClick={onBack}
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
            fontWeight: '500',
          }}
          onMouseEnter={e => (e.target.style.backgroundColor = '#f0f9ff')}
          onMouseLeave={e => (e.target.style.backgroundColor = 'transparent')}
        >
          ← Back
        </button>
        <div
          style={{
            marginLeft: 'auto',
            background: query.runs_count > 1 ? '#3b82f6' : '#6b7280',
            color: 'white',
            padding: '4px 8px',
            borderRadius: 12,
            fontSize: '12px',
            fontWeight: 'bold',
          }}
        >
          Used {query.runs_count} time{query.runs_count !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Query details */}
      <div style={{ marginBottom: 20 }}>
        {/* Description */}
        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              fontSize: '12px',
              fontWeight: '500',
              color: '#374151',
              marginBottom: 8,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
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
                  fontSize: '10px',
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
                onChange={e => setEditedDescription(e.target.value)}
                style={{
                  flex: 1,
                  padding: '6px 8px',
                  borderRadius: 4,
                  border: '1px solid #d1d5db',
                  fontSize: '14px',
                  fontFamily: 'system-ui, sans-serif',
                }}
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    handleUpdateDescription();
                  } else if (e.key === 'Escape') {
                    handleCancelEdit();
                  }
                }}
              />
              <button
                onClick={handleUpdateDescription}
                style={{
                  background: '#10b981',
                  color: 'white',
                  border: 'none',
                  padding: '4px 8px',
                  borderRadius: 3,
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                Save
              </button>
              <button
                onClick={handleCancelEdit}
                style={{
                  background: '#6b7280',
                  color: 'white',
                  border: 'none',
                  padding: '4px 8px',
                  borderRadius: 3,
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 4,
                padding: 8,
                fontSize: '14px',
                color: '#1f2937',
              }}
            >
              {query.description}
            </div>
          )}
        </div>

        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              fontSize: '12px',
              fontWeight: '500',
              color: '#374151',
              marginBottom: 4,
            }}
          >
            Source:
          </div>
          <div
            style={{
              fontSize: '14px',
              fontWeight: 'bold',
              color: '#1f2937',
              marginBottom: 4,
            }}
          >
            {query.cluster || 'Unknown Cluster'}
            {query.database && ` / ${query.database}`}
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>
            Last used: {new Date(query.last_used_at).toLocaleString()}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: '12px',
              fontWeight: '500',
              color: '#374151',
              marginBottom: 8,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            Query:
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
          </div>
          <div
            style={{
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
              overflowY: 'auto',
            }}
          >
            {query.query}
          </div>
        </div>
      </div>

      {/* Delete confirmation or delete button */}
      {showDeleteConfirm ? (
        <DeleteConfirmation
          onConfirm={handleDeleteConfirm}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      ) : (
        <button
          onClick={() => setShowDeleteConfirm(true)}
          style={{
            background: '#dc2626',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            width: '100%',
          }}
          onMouseEnter={e => (e.target.style.backgroundColor = '#b91c1c')}
          onMouseLeave={e => (e.target.style.backgroundColor = '#dc2626')}
        >
          Delete Query
        </button>
      )}
    </div>
  );
};

export default QueryDetail;
