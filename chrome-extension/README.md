# Kuery — Chrome capture shim

Tiny Manifest V3 extension that intercepts Kusto queries you run in
[Azure Data Explorer](https://dataexplorer.azure.com/) and POSTs them to the
locally running Kuery desktop app at `http://127.0.0.1:47821/v1/queries`.

This used to be the whole product. All the storage, UI and AI now live in the
desktop app — the extension just observes the network and forwards.

## Install (developer mode)

1. Make sure the Kuery desktop app is running.
2. Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**
   and select this directory.
3. Visit Azure Data Explorer and run a query. It should appear in the desktop
   app within a couple of seconds.

## Behaviour

- Only fires on `https://dataexplorer.azure.com/*` and `*.kusto.windows.net/*`.
- Uses the legacy `inject.js` interceptor (fetch + XHR overrides) to capture
  requests to `/v[12]/rest/query`.
- If the desktop app isn't running, queries are queued in `chrome.storage.local`
  and retried every minute until the app comes back.
- Dashboard queries are filtered out (matches the legacy behaviour).
