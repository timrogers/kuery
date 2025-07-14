import React from 'react';

interface DeleteConfirmationProps {
  onConfirm: () => void;
  onCancel: () => void;
}

const DeleteConfirmation: React.FC<DeleteConfirmationProps> = ({
  onConfirm,
  onCancel,
}) => {
  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      <button
        onClick={onConfirm}
        style={{
          background: '#dc2626',
          color: 'white',
          border: 'none',
          padding: '8px 16px',
          borderRadius: 4,
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: '500',
          flex: 1,
        }}
      >
        Yes, Delete
      </button>
      <button
        onClick={onCancel}
        style={{
          background: '#6b7280',
          color: 'white',
          border: 'none',
          padding: '8px 16px',
          borderRadius: 4,
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: '500',
          flex: 1,
        }}
      >
        Cancel
      </button>
    </div>
  );
};

export default DeleteConfirmation;
