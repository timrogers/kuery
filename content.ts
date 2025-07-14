// Content script for capturing Azure Data Explorer queries
// This script runs in the context of Azure Data Explorer pages

import type { PlasmoCSConfig } from 'plasmo';

export const config: PlasmoCSConfig = {
  matches: [
    'https://dataexplorer.azure.com/*',
    'https://*.kusto.windows.net/*',
  ],
};

interface KustoQueryData {
  query: string;
  database: string;
  cluster: string;
  url: string;
  timestamp: string;
  requestBody?: unknown;
  responsePreview?: {
    hasResults: boolean;
    resultCount: number;
  } | null;
}

interface WindowMessage {
  type: string;
  payload?: KustoQueryData;
}

// Create and inject the interception script file
function injectScript(): void {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('assets/inject.js');
  (document.head || document.documentElement).appendChild(script);
  script.remove();

  // Verify injection worked
  setTimeout(() => {
    if ((window as unknown as { kueryInjected?: boolean }).kueryInjected) {
      console.log(
        'Kuery: Injection successful - script is running in page context'
      );
    } else {
      console.error(
        'Kuery: Injection failed - script not running in page context'
      );
    }
  }, 100);
}

// Listen for messages from injected script
function setupMessageListener(): void {
  window.addEventListener('message', (event: MessageEvent<WindowMessage>) => {
    if (event.source !== window) return;

    if (event.data.type === 'KUSTO_QUERY_INTERCEPTED') {
      // Send to background script
      chrome.runtime.sendMessage(
        {
          type: 'SAVE_QUERY',
          data: event.data.payload,
        },
        response => {
          if (chrome.runtime.lastError) {
            console.error(
              'Kuery: Error sending message:',
              chrome.runtime.lastError
            );
          } else if (response?.success) {
            console.log('Kuery: Query saved successfully');
          } else {
            console.log('Kuery: Query not saved - SQLite may not be available');
          }
        }
      );
    }
  });

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener(message => {
    if (message.type === 'SQLITE_ERROR') {
      showSQLiteErrorOverlay(message.message, message.error);
    }
  });
}

// Show SQLite error overlay
function showSQLiteErrorOverlay(message: string, error: string) {
  // Remove any existing error overlay
  const existingOverlay = document.getElementById('kuery-sqlite-error');
  if (existingOverlay) {
    existingOverlay.remove();
  }

  const overlay = document.createElement('div');
  overlay.id = 'kuery-sqlite-error';
  overlay.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    max-width: 400px;
    background: linear-gradient(135deg, #dc2626, #b91c1c);
    color: white;
    padding: 16px;
    border-radius: 8px;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 14px;
    z-index: 999999;
    box-shadow: 0 10px 25px rgba(0,0,0,0.3);
    border-left: 4px solid #fca5a5;
  `;

  overlay.innerHTML = `
    <div style="display: flex; align-items: flex-start; gap: 12px;">
      <div style="font-size: 18px;">⚠️</div>
      <div style="flex: 1;">
        <div style="font-weight: bold; margin-bottom: 8px;">Kuery Extension Error</div>
        <div style="margin-bottom: 8px; line-height: 1.4;">${message}</div>
        <details style="margin-top: 8px;">
          <summary style="cursor: pointer; font-size: 12px; opacity: 0.9;">Technical Details</summary>
          <div style="margin-top: 4px; font-size: 11px; opacity: 0.8; font-family: monospace; background: rgba(0,0,0,0.2); padding: 8px; border-radius: 4px; word-break: break-all;">
            ${error}
          </div>
        </details>
        <button id="kuery-dismiss-error" style="
          background: rgba(255,255,255,0.2);
          border: 1px solid rgba(255,255,255,0.3);
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
          margin-top: 8px;
        ">Dismiss</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Auto-dismiss after 30 seconds
  const autoRemove = setTimeout(() => {
    if (overlay.parentNode) {
      overlay.remove();
    }
  }, 30000);

  // Manual dismiss
  const dismissButton = overlay.querySelector('#kuery-dismiss-error');
  if (dismissButton) {
    dismissButton.addEventListener('click', () => {
      clearTimeout(autoRemove);
      overlay.remove();
    });
  }
}

// Observer to detect when Azure Data Explorer is ready
function createPageObserver(): MutationObserver {
  const observer = new MutationObserver(() => {
    const selectors = [
      '[data-test-id="query-editor"]',
      '.monaco-editor',
      '[class*="query"]',
    ];

    console.log('Kuery: Checking for Azure Data Explorer elements...');

    const hasTargetElement = selectors.some(selector => {
      const element = document.querySelector(selector);
      if (element) {
        console.log('Kuery: Found target element:', selector);
        return true;
      }
      return false;
    });

    if (hasTargetElement) {
      console.log('Kuery: Page is ready, posting ADE_PAGE_READY message');
      window.postMessage({ type: 'ADE_PAGE_READY' }, '*');
      observer.disconnect();
    } else {
      console.log('Kuery: Page not ready yet, continuing to observe...');
    }
  });

  return observer;
}

// Initialize content script
function initialize(): void {
  // Only run on Azure Data Explorer domains
  if (
    !window.location.hostname.includes('dataexplorer.azure.com') &&
    !window.location.hostname.includes('kusto.windows.net')
  ) {
    return;
  }

  console.log('Kuery: Initializing on Azure Data Explorer page');

  // Inject script immediately to catch early network requests
  console.log('Kuery: Injecting script to intercept network requests');
  injectScript();

  // Set up message listener
  console.log('Kuery: Setting up message listener');
  setupMessageListener();

  // Set up page observer
  console.log('Kuery: Setting up page observer');
  const observer = createPageObserver();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      console.log('Kuery: DOM content loaded, starting observer');
      if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
      }
    });
  } else {
    console.log(
      'Kuery: Document already loaded, starting observer immediately'
    );
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  // Also trigger an immediate check
  console.log('Kuery: Doing immediate check for page elements');
  setTimeout(() => {
    const selectors = [
      '[data-test-id="query-editor"]',
      '.monaco-editor',
      '[class*="query"]',
    ];

    const hasTargetElement = selectors.some(selector => {
      const element = document.querySelector(selector);
      if (element) {
        console.log(
          'Kuery: Found target element in immediate check:',
          selector
        );
        return true;
      }
      return false;
    });

    if (hasTargetElement) {
      console.log('Kuery: Page ready via immediate check, posting message');
      window.postMessage({ type: 'ADE_PAGE_READY' }, '*');
    }
  }, 1000);
}

initialize();
