(function () {
  "use strict";

  function getSearchQuery(url) {
    try {
      const match = url.match(/[?&]keyword=([^&]+)/);
      return match ? decodeURIComponent(match[1]) : '';
    } catch (e) {
      return '';
    }
  }

  function extractProductsData(data) {
    try {
      const products = [];
      const seen = new Set();
      let invalidCount = 0;

      function traverse(obj) {
        if (obj && typeof obj === 'object') {
          // Validasi wajib: harus punya itemid, shopid, dan name
          if (
            obj.itemid &&
            obj.shopid &&
            obj.name &&
            typeof obj.name === 'string' &&
            obj.name.trim() !== '' &&
            !seen.has(obj.itemid)
          ) {
            seen.add(obj.itemid);

            // Hitung total rating_count jika berbentuk array
            const ratingCount = obj.item_rating && Array.isArray(obj.item_rating.rating_count)
              ? obj.item_rating.rating_count.reduce((a, b) => a + b, 0)
              : (obj.rating_count || 0);

            products.push({
              itemid: obj.itemid,
              shopid: obj.shopid,
              name: obj.name.trim(),
              price: obj.price || 0,
              price_min: obj.price_min || 0,
              price_max: obj.price_max || 0,
              original_price: obj.price_before_discount || null,
              stock: obj.stock || 0,
              product_url: 'https://shopee.co.id/product/' + obj.shopid + '/' + obj.itemid,
              historical_sold: obj.historical_sold || 0,
              sold: obj.sold || obj.historical_sold || 0,
              rating_star: obj.item_rating ? (obj.item_rating.rating_star || 0) : 0,
              rating_count: ratingCount,
              shop_name: obj.shop_name || null,
              is_official_shop: obj.is_official_shop === true,
              location: obj.shop_location || obj.location || null,
              discount: obj.discount || null,
              image: obj.image || null,
              scraped_at: new Date().toISOString(),
            });
          } else if (obj.itemid && obj.shopid && !obj.name) {
            invalidCount++; // Hitung produk yang tidak valid
          }

          for (const key in obj) {
            traverse(obj[key]);
          }
        }
      }

      traverse(data);

      console.log(`[Avalon Harvester] Extracted ${products.length} valid products. Invalid skipped: ${invalidCount}`);
      return products;

    } catch (e) {
      console.error('[Avalon Harvester] Error extracting product data:', e);
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
                        console.log('[Avalon Harvester] Extracting product data from:', fetchUrl);
                        const products = extractProductsData(data);
                        console.log('[Avalon Harvester] Extracted ' + products.length + ' products from API:', fetchUrl);
                        if (products.length > 0) {
                          const searchQuery = getSearchQuery(fetchUrl);
                          console.log('[Avalon Harvester] Dispatching harvest event with', products.length, 'products, query:', searchQuery);
                          document.dispatchEvent(
                            new CustomEvent("Avalon_Harvest_Data", {
                              detail: {
                                type: "harvest",
                                products: products,
                                search_query: searchQuery,
                              },
                            }),
                          );
                        } else {
                          console.log('[Avalon Harvester] No products extracted from:', fetchUrl);
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
                console.log('[Avalon Harvester] Extracting product data from XHR:', this._intercepted_url);
                const products = extractProductsData(parsedData);
                console.log('[Avalon Harvester] Extracted ' + products.length + ' products from XHR API:', this._intercepted_url);
                if (products.length > 0) {
                  const searchQuery = getSearchQuery(this._intercepted_url);
                  console.log('[Avalon Harvester] Dispatching harvest event from XHR with', products.length, 'products, query:', searchQuery);
                  document.dispatchEvent(
                    new CustomEvent("Avalon_Harvest_Data", {
                      detail: {
                        type: "harvest",
                        products: products,
                        search_query: searchQuery,
                      },
                    }),
                  );
                } else {
                  console.log('[Avalon Harvester] No products extracted from XHR:', this._intercepted_url);
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
