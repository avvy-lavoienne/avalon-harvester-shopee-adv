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

  function isShopApi(url) {
    return url && (
      url.includes('/api/v2/shop/get_shop_info') ||
      url.includes('/api/v2/shop/get')
    );
  }

  function extractShopData(data) {
    try {
      const seenShops = new Set();
      const shops = [];
      function traverse(obj) {
        if (obj && typeof obj === 'object') {
          if (obj.shopid && !seenShops.has(obj.shopid)) {
            const hasRating = obj.rating_star != null;
            if (hasRating) {
              seenShops.add(obj.shopid);
              const ratingCount = obj.rating_count && Array.isArray(obj.rating_count)
                ? obj.rating_count.reduce((a, b) => a + b, 0)
                : (obj.rating_count || 0);
              shops.push({
                shopid: obj.shopid,
                shop_name: obj.name || obj.shop_name || null,
                shop_rating: obj.rating_star || 0,
                shop_rating_count: ratingCount,
                response_rate: obj.response_rate || null,
                follower_count: obj.follower_count || 0,
                is_official_shop: obj.is_official_shop === true,
                shop_location: obj.shop_location || obj.location || null,
                scraped_at: new Date().toISOString(),
              });
            }
          }
          for (const key in obj) {
            traverse(obj[key]);
          }
        }
      }
      traverse(data);
      console.log('[Avalon Harvester] Extracted shop data:', shops.length);
      return shops;
    } catch (e) {
      console.error('[Avalon Harvester] Error extracting shop data:', e);
      return [];
    }
  }

  function parsePrice(raw) {
    if (raw == null || raw === 0) return 0;
    const num = typeof raw === 'string' ? parseFloat(raw) : raw;
    if (isNaN(num) || num <= 0) return 0;
    if (num > 100000000) return Math.round(num / 1000000);
    if (num > 10000000) return Math.round(num / 100000);
    return Math.round(num / 100);
  }

  function extractBrandAndModel(productName) {
    if (!productName || typeof productName !== 'string') {
      return { brand: null, model: null };
    }
    let name = productName.trim();
    let brand = null;
    const brandList = ['ASUS', 'Acer', 'Lenovo', 'HP', 'Dell', 'MSI', 'Apple', 'Samsung', 'Xiaomi', 'Huawei', 'Advans', 'Axioo', 'Microsoft', 'Toshiba', 'Fujitsu', 'LG', 'Realme', 'Infinix', 'Poco'];
    for (const b of brandList) {
      if (name.toUpperCase().includes(b.toUpperCase())) {
        brand = b;
        break;
      }
    }
    let model = null;
    if (brand) {
      let remaining = name.replace(new RegExp(brand, 'i'), '').trim();
      let words = remaining.split(/\s+/);
      let collected = [];
      for (const w of words) {
        if (/^[-–—\-]/.test(w)) break;
        collected.push(w);
        if (collected.length >= 8) break;
      }
      model = collected.join(' ').replace(/["""]/g, '').trim();
    } else {
      model = name.split(/\s+/).slice(0, 5).join(' ');
    }
    if (model && model.length > 80) {
      model = model.substring(0, 80);
    }
    return { brand, model };
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

            const { brand, model } = extractBrandAndModel(obj.name);

            products.push({
              itemid: obj.itemid,
              shopid: obj.shopid,
              name: obj.name.trim(),
              brand: brand,
              model: model,
              price: parsePrice(obj.price),
              price_min: parsePrice(obj.price_min),
              price_max: parsePrice(obj.price_max),
              original_price: obj.price_before_discount ? parsePrice(obj.price_before_discount) : null,
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
                      } else if (isShopApi(fetchUrl)) {
                        console.log('[Avalon Harvester] Extracting shop data from:', fetchUrl);
                        const shops = extractShopData(data);
                        if (shops.length > 0) {
                          document.dispatchEvent(
                            new CustomEvent("Avalon_Shop_Data", {
                              detail: { shops: shops },
                            }),
                          );
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
              } else if (isShopApi(this._intercepted_url)) {
                console.log('[Avalon Harvester] Extracting shop data from XHR:', this._intercepted_url);
                const shops = extractShopData(parsedData);
                if (shops.length > 0) {
                  document.dispatchEvent(
                    new CustomEvent("Avalon_Shop_Data", {
                      detail: { shops: shops },
                    }),
                  );
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
