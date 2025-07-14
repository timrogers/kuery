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

interface QueryDetailModalProps {
  query: QueryData;
  onDelete: (queryId: number) => void;
  onUpdateDescription: (
    queryId: number,
    description: string
  ) => Promise<boolean>;
}

const QueryDetailModal: React.FC<QueryDetailModalProps> = ({
  query,
  onDelete,
  onUpdateDescription,
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [editedDescription, setEditedDescription] = useState(query.description);

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
    <div style={{ padding: '24px', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header with run count */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: 20,
          paddingBottom: 16,
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        <div
          style={{
            marginLeft: 'auto',
            background: query.runs_count > 1 ? '#3b82f6' : '#6b7280',
            color: 'white',
            padding: '6px 12px',
            borderRadius: 16,
            fontSize: '14px',
            fontWeight: 'bold',
          }}
        >
          {query.runs_count} {query.runs_count === 1 ? 'run' : 'runs'}
        </div>
      </div>

      {/* Description Section */}
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#374151' }}>
          Description
        </h3>
        {editingDescription ? (
          <div>
            <textarea
              value={editedDescription}
              onChange={e => setEditedDescription(e.target.value)}
              placeholder="Enter a description for this query..."
              style={{
                width: '100%',
                minHeight: '80px',
                padding: '12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                fontFamily: 'system-ui, sans-serif',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
              <button
                onClick={handleUpdateDescription}
                style={{
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
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
                  padding: '8px 16px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p
              style={{
                margin: 0,
                color: '#6b7280',
                fontSize: '14px',
                lineHeight: '1.5',
                minHeight: '20px',
              }}
            >
              {query.description || 'No description provided'}
            </p>
            <button
              onClick={() => setEditingDescription(true)}
              style={{
                background: 'none',
                border: 'none',
                color: '#3b82f6',
                cursor: 'pointer',
                fontSize: '14px',
                marginTop: 8,
                padding: '4px 0',
              }}
            >
              {query.description ? 'Edit description' : 'Add description'}
            </button>
          </div>
        )}
      </div>

      {/* Query Section */}
      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <h3 style={{ margin: 0, fontSize: '16px', color: '#374151' }}>
            Query
          </h3>
          <CopyButton
            textToCopy={query.query}
            style={{
              background: '#e0e7ff',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              color: '#2563eb',
            }}
            title="Copy Query"
          >
            Copy Query
          </CopyButton>
        </div>
        <pre
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            padding: '16px',
            fontSize: '13px',
            fontFamily: 'Monaco, Consolas, monospace',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            margin: 0,
            maxHeight: '300px',
            overflow: 'auto',
          }}
        >
          {query.query}
        </pre>
      </div>

      {/* Metadata Section */}
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#374151' }}>
          Details
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <strong style={{ color: '#374151', fontSize: '14px' }}>Database:</strong>
            <p style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: '14px' }}>
              {query.database}
            </p>
          </div>
          <div>
            <strong style={{ color: '#374151', fontSize: '14px' }}>Cluster:</strong>
            <p style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: '14px' }}>
              {query.cluster}
            </p>
          </div>
          <div>
            <strong style={{ color: '#374151', fontSize: '14px' }}>Last Used:</strong>
            <p style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: '14px' }}>
              {new Date(query.last_used_at).toLocaleString()}
            </p>
          </div>
          <div>
            <strong style={{ color: '#374151', fontSize: '14px' }}>Created:</strong>
            <p style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: '14px' }}>
              {new Date(query.created_at).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Actions Section */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          paddingTop: 16,
          borderTop: '1px solid #e2e8f0',
        }}
      >
        <button
          onClick={() => setShowDeleteConfirm(true)}
          style={{
            background: '#dc2626',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="3,6 5,6 21,6"></polyline>
            <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
            <line x1="10" y1="11" x2="10" y2="17"></line>
            <line x1="14" y1="11" x2="14" y2="17"></line>
          </svg>
          Delete Query
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <DeleteConfirmation
          onConfirm={handleDeleteConfirm}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
};

export default QueryDetailModal;