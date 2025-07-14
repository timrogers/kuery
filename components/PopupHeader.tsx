import React from 'react';
import kueryLogo from '../assets/icon.png';

interface PopupHeaderProps {
  showFullScreenButton?: boolean;
  isTabVersion?: boolean;
}

const PopupHeader: React.FC<PopupHeaderProps> = ({ showFullScreenButton = true, isTabVersion = false }) => {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: isTabVersion ? 32 : 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: isTabVersion ? '12px' : '8px' }}>
        <img
          src={kueryLogo}
          alt="Kuery Logo"
          style={{ 
            width: isTabVersion ? '48px' : '32px', 
            height: isTabVersion ? '48px' : '32px', 
            cursor: 'pointer' 
          }}
        />
        <h3
          style={{
            margin: 0,
            color: 'rgb(25,112,196)',
            fontSize: isTabVersion ? '36px' : '24px',
            cursor: 'pointer',
          }}
        >
          Kuery
        </h3>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        {showFullScreenButton && (
          <button
            onClick={() => chrome.tabs.create({ url: './tabs/main.html' })}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Open Full-Screen"
            onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f0f9ff')}
            onMouseLeave={e =>
              ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent')
            }
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
          </button>
        )}
        <button
          onClick={() => chrome.runtime.openOptionsPage()}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '8px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="Settings"
          onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f0f9ff')}
          onMouseLeave={e =>
            ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent')
          }
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 0 2l-.15.08a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1 0-2l.15-.08a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default PopupHeader;
