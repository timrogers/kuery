// Background service worker: forwards captured queries to the Kuery desktop
// app's HTTP API. If the app is not running, the query is queued in
// chrome.storage.local and retried periodically.

const API_URL = 'http://127.0.0.1:47821/v1/queries';
const QUEUE_KEY = 'kuery_queue';
const RETRY_ALARM = 'kuery_retry';
const RETRY_PERIOD_MINUTES = 1;

async function postQuery(payload) {
  const body = {
    query_text: payload.query,
    cluster: normaliseCluster(payload.cluster, payload.url),
    database: payload.database || null,
    source: 'extension',
  };
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

function normaliseCluster(cluster, url) {
  if (cluster && cluster.startsWith('http')) return cluster;
  if (cluster) return `https://${cluster}.kusto.windows.net`;
  if (url) {
    const m = url.match(/https:\/\/([^/]+)/);
    if (m) return `https://${m[1]}`;
  }
  return null;
}

async function enqueue(payload) {
  const { [QUEUE_KEY]: queue = [] } = await chrome.storage.local.get(QUEUE_KEY);
  queue.push({ payload, attemptedAt: Date.now() });
  // Cap to avoid unbounded growth.
  while (queue.length > 500) queue.shift();
  await chrome.storage.local.set({ [QUEUE_KEY]: queue });
  await chrome.alarms.create(RETRY_ALARM, { periodInMinutes: RETRY_PERIOD_MINUTES });
}

async function flushQueue() {
  const { [QUEUE_KEY]: queue = [] } = await chrome.storage.local.get(QUEUE_KEY);
  if (queue.length === 0) {
    await chrome.alarms.clear(RETRY_ALARM);
    return;
  }
  const remaining = [];
  for (const item of queue) {
    try {
      await postQuery(item.payload);
    } catch (_e) {
      remaining.push(item);
    }
  }
  await chrome.storage.local.set({ [QUEUE_KEY]: remaining });
  if (remaining.length === 0) await chrome.alarms.clear(RETRY_ALARM);
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== 'KUERY_INGEST') return false;
  (async () => {
    try {
      await postQuery(msg.payload);
      sendResponse({ ok: true });
    } catch (e) {
      await enqueue(msg.payload);
      sendResponse({ ok: false, queued: true, error: String(e) });
    }
  })();
  return true; // async
});

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === RETRY_ALARM) flushQueue();
});

// Try draining the queue when the worker starts up.
flushQueue();
