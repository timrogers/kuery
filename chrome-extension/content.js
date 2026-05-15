// Inject the page-context interceptor and forward captured queries to the
// background service worker.
(function () {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('inject.js');
  (document.head || document.documentElement).appendChild(script);
  script.remove();

  // Once Azure Data Explorer has likely loaded, signal the page that it's safe
  // to start observing. The legacy inject script gates capture on this.
  function signalReady() {
    window.postMessage({ type: 'ADE_PAGE_READY' }, '*');
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(signalReady, 1500));
  } else {
    setTimeout(signalReady, 1500);
  }

  window.addEventListener('message', event => {
    if (event.source !== window) return;
    if (event.data?.type !== 'KUSTO_QUERY_INTERCEPTED') return;
    const payload = event.data.payload;
    if (!payload || !payload.query) return;

    chrome.runtime.sendMessage({ type: 'KUERY_INGEST', payload }, response => {
      if (chrome.runtime.lastError) {
        // Service worker may have been asleep — that's fine, it'll retry.
      } else if (response && !response.ok) {
        console.warn('Kuery: ingest failed:', response.error);
      }
    });
  });
})();
