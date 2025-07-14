(function () {
  'use strict';

  let isReady = false;

  // Listen for page ready signal
  window.addEventListener('message', event => {
    if (event.data.type === 'ADE_PAGE_READY') {
      isReady = true;
      console.log('Kuery: Azure Data Explorer page ready');
    }
  });

  // Override fetch to intercept API calls
  const originalFetch = window.fetch;
  window.fetch = function (...args) {
    const [resource, config] = args;
    let resourceStr = typeof resource === 'string' ? resource : resource.url;

    console.log('Kuery: Fetch intercepted:', resourceStr);

    return originalFetch.apply(this, args).then(response => {
      console.log(
        'Kuery: Fetch response received for:',
        resourceStr,
        'Status:',
        response.status
      );

      if (isReady && shouldInterceptRequest(resourceStr, config)) {
        console.log('Kuery: This request should be intercepted');
        interceptKustoRequest(resourceStr, config || {}, response.clone());
      } else {
        console.log(
          'Kuery: This request will not be intercepted. isReady:',
          isReady,
          'shouldIntercept:',
          shouldInterceptRequest(resourceStr, config)
        );
      }
      return response;
    });
  };

  // Override XMLHttpRequest as well
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (
    method,
    url,
    async,
    username,
    password
  ) {
    console.log('Kuery: XHR open intercepted:', url);
    this._method = method;
    this._url = url.toString();
    return originalXHROpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function (data) {
    const self = this;
    console.log(
      'Kuery: XHR send intercepted:',
      self._url,
      'Method:',
      self._method
    );

    if (
      isReady &&
      shouldInterceptRequest(self._url, { method: self._method, body: data })
    ) {
      console.log('Kuery: This XHR request should be intercepted');
      this.addEventListener('load', () => {
        console.log('Kuery: XHR load event, status:', this.status);
        if (this.status >= 200 && this.status < 300) {
          const mockResponse = {
            text: () => Promise.resolve(this.responseText),
            json: () => Promise.resolve(JSON.parse(this.responseText)),
            status: this.status,
            headers: new Headers(),
          };
          interceptKustoRequest(
            self._url,
            { method: self._method, body: data },
            mockResponse
          );
        }
      });
    } else {
      console.log(
        'Kuery: This XHR request will not be intercepted. isReady:',
        isReady,
        'shouldIntercept:',
        shouldInterceptRequest(self._url, { method: self._method, body: data })
      );
    }
    return originalXHRSend.apply(this, arguments);
  };

  function shouldInterceptRequest(url, config) {
    const kustoPatterns = [
      /\/v1\/rest\/query/,
      /\/v2\/rest\/query/,
      /\/v1\/rest\/mgmt/,
      /query\/v1\/rest\/query/,
      /kusto\.windows\.net.*\/v1\/rest\/query/,
      /api\/v1\/query/,
      /KustoService.*query/i,
    ];

    return (
      kustoPatterns.some(pattern => pattern.test(url)) &&
      config?.method?.toUpperCase() === 'POST'
    );
  }

  async function interceptKustoRequest(url, config, response) {
    console.log('Kuery: Starting to intercept Kusto request to:', url);
    console.log('Kuery: Response status:', response.status);
    console.log('Kuery: Response headers:', response.headers);

    try {
      let requestBody = config?.body;

      if (typeof requestBody === 'string') {
        try {
          requestBody = JSON.parse(requestBody);
        } catch (e) {
          // Keep as string if not JSON
        }
      }

      let queryText = '';
      let database = '';
      let cluster = '';

      if (requestBody) {
        queryText =
          requestBody.csl ||
          requestBody.query ||
          requestBody.Query ||
          (typeof requestBody === 'string' ? requestBody : '');
        database = requestBody.db || requestBody.database || '';
      }

      const urlMatch = url.match(/https:\/\/(.+)\.kusto\.windows\.net/);
      if (urlMatch && urlMatch[1]) {
        cluster = urlMatch[1];
      }

      let responseData = null;
      try {
        const responseText = await response.text();
        console.log('Kuery: Raw response text length:', responseText.length);
        console.log(
          'Kuery: Raw response preview:',
          responseText.substring(0, 500)
        );
        responseData = JSON.parse(responseText);
        console.log('Kuery: Successfully parsed JSON response');
      } catch (e) {
        console.log('Kuery: Failed to parse response as JSON:', e);
        console.log('Kuery: Response was not valid JSON');
      }

      // Enhanced result detection
      let hasResults = false;
      let resultCount = 0;

      if (responseData) {
        console.log(
          'Kuery: Full response data structure:',
          JSON.stringify(responseData, null, 2)
        );

        // Check if response is an array (v2 API format)
        if (Array.isArray(responseData)) {
          console.log(
            'Kuery: Response is array with',
            responseData.length,
            'elements'
          );

          // Look for PrimaryResult table in the array
          const primaryResultTable = responseData.find(
            item => item && item.TableKind === 'PrimaryResult' && item.Rows
          );

          if (primaryResultTable) {
            console.log(
              'Kuery: Found PrimaryResult table with',
              primaryResultTable.Rows.length,
              'rows'
            );
            hasResults = primaryResultTable.Rows.length > 0;
            resultCount = primaryResultTable.Rows.length;
          } else {
            // Look for any DataTable with rows
            const dataTables = responseData.filter(
              item => item && item.FrameType === 'DataTable' && item.Rows
            );

            if (dataTables.length > 0) {
              const totalRows = dataTables.reduce(
                (sum, table) => sum + (table.Rows ? table.Rows.length : 0),
                0
              );
              console.log(
                'Kuery: Found',
                dataTables.length,
                'data tables with total',
                totalRows,
                'rows'
              );
              hasResults = totalRows > 0;
              resultCount = totalRows;
            }
          }
        }
        // Handle object-based responses (v1 API format)
        else if (typeof responseData === 'object') {
          console.log('Kuery: Response data keys:', Object.keys(responseData));

          // Check various possible response structures
          if (responseData.Tables) {
            hasResults = responseData.Tables.length > 0;
            resultCount = responseData.Tables.length;
            console.log(
              'Kuery: Found Tables array, length:',
              responseData.Tables.length
            );

            // Check if tables have rows
            if (responseData.Tables.length > 0 && responseData.Tables[0].Rows) {
              console.log(
                'Kuery: First table has',
                responseData.Tables[0].Rows.length,
                'rows'
              );
              hasResults = responseData.Tables[0].Rows.length > 0;
              resultCount = responseData.Tables[0].Rows.length;
            }
          } else if (responseData.tables) {
            hasResults = responseData.tables.length > 0;
            resultCount = responseData.tables.length;
            console.log(
              'Kuery: Found tables array, length:',
              responseData.tables.length
            );

            // Check if tables have rows
            if (responseData.tables.length > 0 && responseData.tables[0].rows) {
              console.log(
                'Kuery: First table has',
                responseData.tables[0].rows.length,
                'rows'
              );
              hasResults = responseData.tables[0].rows.length > 0;
              resultCount = responseData.tables[0].rows.length;
            }
          } else if (responseData.PrimaryResult) {
            // Some Kusto APIs use PrimaryResult
            const primaryResult = responseData.PrimaryResult;
            console.log(
              'Kuery: PrimaryResult keys:',
              Object.keys(primaryResult)
            );
            if (primaryResult.Tables) {
              hasResults = primaryResult.Tables.length > 0;
              resultCount = primaryResult.Tables.length;
              console.log(
                'Kuery: Found PrimaryResult.Tables, length:',
                primaryResult.Tables.length
              );
            }
          } else if (responseData.Rows || responseData.rows) {
            // Direct rows structure
            const rows = responseData.Rows || responseData.rows;
            hasResults = Array.isArray(rows) && rows.length > 0;
            resultCount = Array.isArray(rows) ? rows.length : 0;
            console.log('Kuery: Found rows array, length:', resultCount);
          } else {
            console.log(
              'Kuery: No recognized result structure found in response'
            );
            console.log('Kuery: Available keys:', Object.keys(responseData));

            // Try to detect any array that might contain results
            for (const [key, value] of Object.entries(responseData)) {
              if (Array.isArray(value)) {
                console.log(
                  'Kuery: Found array property',
                  key,
                  'with length',
                  value.length
                );
                if (value.length > 0) {
                  console.log('Kuery: First item in', key, ':', value[0]);
                }
              }
            }
          }
        }
      } else {
        console.log('Kuery: No response data available');
      }

      const queryData = {
        query: queryText,
        database: database,
        cluster: cluster,
        url: url,
        timestamp: new Date().toISOString(),
        requestBody: requestBody,
        responsePreview: responseData
          ? {
              hasResults: hasResults,
              resultCount: resultCount,
            }
          : null,
      };

      if (queryText && queryText.trim()) {
        console.log(
          'Kuery: Intercepted query with hasResults:',
          hasResults,
          'resultCount:',
          resultCount
        );
        window.postMessage(
          {
            type: 'KUSTO_QUERY_INTERCEPTED',
            payload: queryData,
          },
          '*'
        );
      }
    } catch (error) {
      console.error('Kuery: Error intercepting request:', error);
    }
  }

  console.log('Kuery: Injection script loaded');

  // Test injection by setting a flag
  window.kueryInjected = true;
})();
