(function () {
  "use strict";

  // Function to extract product URLs from JSON data
  function extractProductUrls(data) {
    try {
      const urls = [];
      function traverse(obj) {
        if (obj && typeof obj === 'object') {
          if (obj.shopid && obj.itemid) {
            urls.push(`https://shopee.co.id/product/${obj.shopid}/${obj.itemid}`);
          }
          for (const key in obj) {
            traverse(obj[key]);
          }
        }
      }
      traverse(data);
      return urls;
    } catch (e) {
      console.error('[Avalon Harvester] Error extracting product URLs:', e);
      return [];
    }
  }

  const OriginalFetch = window.fetch;
  window.fetch = new Proxy(OriginalFetch, {
    apply: function (target, thisArg, args) {
      const fetchUrl =
        args[0] && typeof args[0] === "object" && args[0].url
          ? args[0].url
          : args[0];
      console.log("[Avalon Harvester] Intercepting fetch:", fetchUrl);
      const fetchPromise = Reflect.apply(target, thisArg, args);
      fetchPromise
        .then((response) => {
          try {
            const contentType = response.headers.get("content-type");
            console.log(
              "[Avalon Harvester] Response content-type:",
              contentType,
              "for URL:",
              fetchUrl,
            );
            if (contentType && contentType.includes("json")) {
              console.log(
                "[Avalon Harvester] Parsing JSON response from:",
                fetchUrl,
              );
              response
                .clone()
                .json()
                .then((data) => {
                  try {
                    const fetchUrl =
                      args[0] && typeof args[0] === "object" && args[0].url
                        ? args[0].url
                        : args[0];
                    console.log(
                      "[Avalon Harvester] Parsed JSON data keys:",
                      Object.keys(data),
                      "from:",
                      fetchUrl,
                    );
                    // New harvest logic
                    if (
                      fetchUrl &&
                      (fetchUrl.includes("/api/v4/shop/get_shop_items") ||
                        fetchUrl.includes("/api/v4/search/search_items") ||
                        fetchUrl.includes("/api/v4/recommend/recommend"))
                    ) {
                      const urls = extractProductUrls(data);
                      console.log('[Avalon Harvester] Extracted URLs:', urls.length, 'from API:', fetchUrl);
                      if (urls.length > 0) {
                        console.log('[Avalon Harvester] Dispatching harvest event with', urls.length, 'URLs');
                        document.dispatchEvent(
                          new CustomEvent("Avalon_Harvest_Links", {
                            detail: {
                              type: "harvest",
                              urls: urls,
                            },
                          }),
                        );
                      } else {
                        console.log('[Avalon Harvester] No URLs extracted from:', fetchUrl);
                      }
                    } else {
                      console.log('[Avalon Harvester] Skipping non-harvest API:', fetchUrl);
                    }
                  } catch (e) {}
                })
                .catch((e) => {});
            }
          } catch (e) {}
        })
        .catch((e) => {});
      return fetchPromise;
    },
  });

  // Intercept XMLHttpRequest for APIs that use XHR instead of fetch
  const OriginalXHR = window.XMLHttpRequest;
  const OriginalOpen = OriginalXHR.prototype.open;
  OriginalXHR.prototype.open = new Proxy(OriginalOpen, {
    apply: function (target, thisArg, args) {
      try {
        thisArg._intercepted_url = args[1];
        thisArg._intercepted_args = Array.from(args);
      } catch (e) {}
      return Reflect.apply(target, thisArg, args);
    },
  });

  const OriginalSend = OriginalXHR.prototype.send;
  OriginalXHR.prototype.send = new Proxy(OriginalSend, {
    apply: function (target, thisArg, args) {
      try {
        thisArg.addEventListener("load", function () {
          try {
            const contentType = this.getResponseHeader("content-type");
            console.log('[Avalon Harvester] XHR response content-type:', contentType, 'for URL:', this._intercepted_url);
            if (contentType && contentType.includes("json")) {
              console.log('[Avalon Harvester] Parsing XHR JSON response from:', this._intercepted_url);
              const parsedData = JSON.parse(this.responseText);
              console.log('[Avalon Harvester] Parsed XHR JSON data keys:', Object.keys(parsedData), 'from:', this._intercepted_url);
              // Check for harvest APIs
              if (
                this._intercepted_url &&
                (this._intercepted_url.includes("/api/v4/shop/get_shop_items") ||
                  this._intercepted_url.includes("/api/v4/search/search_items") ||
                  this._intercepted_url.includes("/api/v4/recommend/recommend"))
              ) {
                const urls = extractProductUrls(parsedData);
                console.log('[Avalon Harvester] Extracted URLs from XHR:', urls.length, 'from API:', this._intercepted_url);
                if (urls.length > 0) {
                  console.log('[Avalon Harvester] Dispatching harvest event from XHR with', urls.length, 'URLs');
                  document.dispatchEvent(
                    new CustomEvent("Avalon_Harvest_Links", {
                      detail: {
                        type: "harvest",
                        urls: urls,
                      },
                    }),
                  );
                } else {
                  console.log('[Avalon Harvester] No URLs extracted from XHR:', this._intercepted_url);
                }
              } else {
                console.log('[Avalon Harvester] Skipping non-harvest XHR API:', this._intercepted_url);
              }
            }
          } catch (e) {
            console.error('[Avalon Harvester] Error in XHR interception:', e);
          }
        });
      } catch (e) {}
      return Reflect.apply(target, thisArg, args);
    },
  });

})();
