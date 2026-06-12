(function () {

  function isCategoryApi(url) {
    return url && url.includes("/api/v4/pages/get_category_tree");
  }

  function handleCategoryData(parsedData, url) {
    try {
      const rawList = parsedData?.data?.category_tree || parsedData?.data?.category_list || parsedData?.category_tree || parsedData?.data?.categories || parsedData?.categories || parsedData?.data || [];
      if (!Array.isArray(rawList) || rawList.length === 0) return;
      const categories = rawList.filter(c => (c.level || 0) >= 1).map(c => ({
        catid: c.catid,
        name: c.display_name || c.cat_name || c.brief_name || c.simple_name || c.name || "",
        parent_catid: c.parent_catid || 0,
        level: c.level || 1,
        no_sub: c.no_sub === true,
        url: c.url || null,
      }));
      if (categories.length > 0) {
        window.__avalon_categories__ = categories;
        console.log("[Avalon] Category tree cached:", categories.length, "categories");
      }
    } catch (e) { /* swallow */ }
  }

  // =========================================================================

  function getSearchQuery(url) {
    try {
      const match = url.match(/[?&]keyword=([^&]+)/);
      if (match) return decodeURIComponent(match[1]);
      const facetMatch = url.match(/[?&]facet=(\d+)/);
      if (facetMatch) return `facet:${facetMatch[1]}`;
      return "";
    } catch (e) {
      return "";
    }
  }

  function isShopApi(url) {
    return (
      url &&
      (url.includes("/api/v2/shop/get_shop_info") ||
        url.includes("/api/v2/shop/get"))
    );
  }

  // =========================================================================
  // 1. PRICE PARSER — Shopee selalu kirim harga dalam MICRO-UNIT (× 100000)
  //    Tidak ada threshold heuristic, formula deterministik.
  // =========================================================================
  function parsePrice(raw) {
    if (
      raw == null ||
      raw === "" ||
      raw === 0 ||
      raw === -1 ||
      raw === "0" ||
      raw === "-1"
    ) {
      return null;
    }

    const num =
      typeof raw === "number"
        ? raw
        : parseFloat(String(raw).replace(/[^\d.-]/g, ""));

    if (!isFinite(num) || num <= 0) return null;

    // Shopee API standard: price stored as IDR × 100000
    // Examples:
    //   15000000000  -> Rp 150.000
    //   350000000    -> Rp 3.500
    //   1234500000   -> Rp 12.345
    return Math.round(num / 100000);
  }

  // =========================================================================
  // 2. PRICE EXTRACTION — handle varian, diskon, price_min/max
  // =========================================================================
  function extractPrices(obj) {
    const priceRaw = parsePrice(obj.price);
    const priceMin = parsePrice(obj.price_min);
    const priceMax = parsePrice(obj.price_max);

    // Untuk produk varian, obj.price kadang 0 → fallback ke price_min
    let price = priceRaw || priceMin;

    // Original price: coba 3 field secara berurutan
    let originalPrice =
      parsePrice(obj.price_before_discount) ||
      parsePrice(obj.price_min_before_discount) ||
      parsePrice(obj.price_max_before_discount);

    // Sanity check: kalau original <= price, berarti tidak ada diskon nyata
    if (originalPrice && price && originalPrice <= price) {
      originalPrice = null;
    }

    // Hitung discount percentage
    let discountPercentage = null;
    if (originalPrice && price && originalPrice > price) {
      discountPercentage = Math.round(
        ((originalPrice - price) / originalPrice) * 100,
      );
    } else if (obj.raw_discount) {
      const m = String(obj.raw_discount).match(/(\d+(?:\.\d+)?)/);
      if (m) discountPercentage = parseFloat(m[1]);
    } else if (obj.discount) {
      const m = String(obj.discount).match(/(\d+(?:\.\d+)?)/);
      if (m) discountPercentage = parseFloat(m[1]);
    }

    return {
      price: price || 0,
      original_price: originalPrice,
      price_min: priceMin,
      price_max: priceMax,
      discount_percentage: discountPercentage,
    };
  }

  // =========================================================================
  // 3. NAME CLEANING — buang emoji, tag promo, karakter dekoratif, spam ALL CAPS
  // =========================================================================
  const SPAM_PREFIX_RE =
    /^(PROMO|DISKON|MURAH|READY\s*STOCK|READY|FLASH\s*SALE|BIG\s*SALE|TERMURAH|BEST\s*SELLER|TERLARIS|COD|FREE\s*ONGKIR|BARANG\s*BARU|NEW\s*LAUNCH|NEW|BARU|ORIGINAL|ORI|GARANSI\s*RESMI|GARANSI|GROSIR|HOT|VIRAL|TERBARU|LARIS|SALE|OBRAL|MEGA\s*SALE|SUPER\s*SALE|BONUS|GRATIS|FREE|STOCK\s*TERBATAS|TERBATAS|LAUNCHING|UNIT\s*BARU|JUAL\s*MURAH|HARGA\s*MURAH|JAMINAN|BERKUALITAS|RECOMMENDED)\b[\s\-:,.!]*/i;

  // Karakter dekoratif yang sering jadi spam (★✦▪●◆ dll)
  const DECORATIVE_RE =
    /[★✦✧✩✪✫✬✭✮✯✰⭐☆▪▫●○◆◇◈♥♡♦♢✨✿❀❁❂❃❄❅❆❇❈❉❊❋➤➥➦➧➨➩➪➫➬➭➮➯➰※‼❗❓❕❔➕➖]/g;

  // Pattern diskon "DISKON 50%", "50%", "-30%" yang sering jadi prefix
  const DISCOUNT_PREFIX_RE = /^\s*[-]?\d{1,3}\s*%\s*[-:]*\s*/;
  // Trailing spam: "GARANSI RESMI", "READY STOCK", "BNIB", "BPOM" dll
  const TRAILING_SPAM_RE =
    /\s+(GARANSI\s*(RESMI|TOKO|DISTRIBUTOR|PABRIK)?(\s*\d+\s*(TAHUN|BULAN|HARI))?|READY(\s*STOCK)?|READYSTOCK|BNIB|NEW|ORI|ORIGINAL|BPOM|FREE\s*ONGKIR|FREE\s*ONGKIR|HALAL|MURAH|TERMURAH|BERGARANSI|RESMI|COD|FAST\s*RESPON?)\.?\s*$/i;

  function cleanProductName(raw) {
    if (!raw || typeof raw !== "string") return "";
    let name = raw;

    // 3a. Remove emoji (semua block emoji unicode)
    name = name.replace(
      /[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{27BF}]|[\u{1F000}-\u{1F02F}]|[\u{1F0A0}-\u{1F0FF}]|[\u{1F100}-\u{1F1FF}]|[\u{2300}-\u{23FF}]|[\u{2B00}-\u{2BFF}]/gu,
      " ",
    );

    // 3b. Remove karakter dekoratif
    name = name.replace(DECORATIVE_RE, " ");

    // 3c. Remove tag promo dalam kurung siku/kurawal [COD] 【BISA COD】 〖PROMO〗
    name = name.replace(/[\[【〖［][^\]】〗］]{0,60}[\]】〗］]/g, " ");

    // 3d. Remove kurung biasa yang isinya promo (TAPI keep kalau spec produk)
    name = name.replace(/[(（]([^)）]{1,60})[)）]/g, (match, inner) => {
      const t = inner.trim();
      // Keep spec teknis: "16GB", "i7", "1TB", "RTX 3060", "144Hz", "15.6 inch"
      if (
        /\d+\s*(GB|TB|MB|KB|GHz|MHz|inch|in|"|cm|mm|Hz|W|V|mAh|fps|px|p|K)\b/i.test(
          t,
        )
      )
        return match;
      if (/\b(i[3579]|ryzen|core|amd|intel|nvidia|rtx|gtx|m[1-4])\b/i.test(t))
        return match;
      if (/^\d+(\.\d+)?\s*(inch|in|gb|tb)$/i.test(t)) return match;
      // Promo wording → drop
      if (
        /^(cod|promo|garansi|gratis|free|ready|new|original|ori|bonus|diskon|murah|terlaris|laris|sale|obral)/i.test(
          t,
        )
      )
        return " ";
      // Default: kalau pendek (<= 3 kata) & no spec keyword, drop
      const wordCount = t.split(/\s+/).length;
      if (wordCount <= 3) return " ";
      return match;
    });

    // 3d'. Normalize tilde/underscore/pipe SEBELUM prefix-trailing strip
    name = name.replace(/[~_]+/g, " ");
    name = name.replace(/\|{2,}/g, " | ");

    // 3d''. Strip leading/trailing dash, pipe, slash, dot
    name = name.replace(/^[\s\-|/–—.,;:]+/, "").replace(/[\s\-|/–—.,;:]+$/, "");

    // 3e. Remove spam ALL CAPS prefix berulang
    let prev;
    do {
      prev = name;
      name = name.replace(SPAM_PREFIX_RE, "").trimStart();
      // Strip "50%", "-30%", "DISKON 50%" residual setelah spam prefix dibuang
      name = name.replace(DISCOUNT_PREFIX_RE, "").trimStart();
    } while (name !== prev && name.length > 0);

    // 3e'. Remove trailing spam berulang ("GARANSI RESMI 1 TAHUN", "READY STOCK", "BNIB", dll)
    do {
      prev = name;
      name = name.replace(TRAILING_SPAM_RE, "").trimEnd();
    } while (name !== prev && name.length > 0);

    // 3f. Normalize tanda baca berlebih
    name = name.replace(/[!?]{2,}/g, "");
    name = name.replace(/-{2,}/g, "-");
    name = name.replace(/[\.,;:]{2,}/g, " ");

    // 3g. Normalize whitespace
    name = name.replace(/\s+/g, " ").trim();

    // 3g'. Final strip leading/trailing dash residual setelah cleanup
    name = name.replace(/^[\s\-|/–—.,;:]+/, "").replace(/[\s\-|/–—.,;:]+$/, "").trim();

    // 3h. Smart Title Case: hanya kalau seluruh nama ALL CAPS,
    //     dan PRESERVE token alphanumeric (model code, SKU, chip code)
    //     seperti FA506NCG, RTX3050, 7445HS, 14ARP10E, R735B1T
    const isAllCaps =
      name.length > 3 && name === name.toUpperCase() && /[A-Z]/.test(name);

    if (isAllCaps) {
      // Token alphanumeric (mengandung digit) → KEEP UPPERCASE
      // Token alfabet murni → Title Case
      // Token yang termasuk abbreviation list → ALL UPPERCASE
      const ABBREV = new Set([
        "SSD","HDD","RAM","ROM","CPU","GPU","USB","HDMI","LCD","LED","OLED",
        "TV","PC","GB","TB","MB","KB","GHZ","MHZ","HZ","MP","HD","UHD","FHD",
        "QHD","WUXGA","WQHD","WQXGA","SRGB","NTSC","IPS","VA","TN","RGB",
        "NVME","SATA","PCIE","DDR","DDR4","DDR5","DDR3","LPDDR4","LPDDR5",
        "WIFI","BT","NFC","LTE","5G","4G","3G","AI","VR","AR","IOT","NFC",
        "RTX","GTX","DLSS","FSR","HDR","BL","BLIT","OHS","WIN","WIN11","WIN10",
        "AMD","INTEL","NVIDIA","ASUS","MSI","HP","LG","JBL","DJI","KB",
        "FHD+","FPS","API","SDK","SOC","NA","NPU","DPI","KBPS","MBPS","GBPS",
      ]);

      name = name
        .split(/(\s+)/) // keep whitespace as separator
        .map((tok) => {
          if (/^\s+$/.test(tok)) return tok;
          // Split out trailing/leading punctuation, process core
          const m = tok.match(/^([^A-Za-z0-9]*)([A-Za-z0-9]+(?:[-/+][A-Za-z0-9]+)*)?(.*)$/);
          if (!m || !m[2]) return tok;
          const [, pre, core, post] = m;
          const upperCore = core.toUpperCase();

          // 1. Abbreviation? Keep all caps
          if (ABBREV.has(upperCore)) return pre + upperCore + post;
          // 2. Mengandung digit (model code / SKU)? Keep all caps
          if (/\d/.test(core)) return pre + upperCore + post;
          // 3. Alfabet murni → Title Case (huruf pertama capital)
          const tc = core.charAt(0).toUpperCase() + core.slice(1).toLowerCase();
          return pre + tc + post;
        })
        .join("");
    }

    return name;
  }

  // =========================================================================
  // 4. BRAND & MODEL EXTRACTION
  // =========================================================================
  const BRAND_LIST = [
    // Laptop & Computing
    "ASUS", "Acer", "Lenovo", "HP", "Dell", "MSI", "Apple", "Microsoft",
    "Toshiba", "Fujitsu", "LG", "Razer", "Alienware", "Gigabyte", "Huawei",
    "Honor", "Advan", "Axioo", "Zyrex", "Hyrican", "NEC", "VAIO", "Panasonic",
    "Tecno", "AMOLI",
    // Smartphone
    "Samsung", "Xiaomi", "Realme", "Infinix", "Poco", "Oppo", "Vivo",
    "OnePlus", "Tecno", "Itel", "Nokia", "Asus ROG", "iQOO",
    // Audio
    "JBL", "Bose", "Sennheiser", "Sonos", "Audio-Technica", "Marshall",
    "Beats", "Anker", "Edifier", "Aukey", "Soundcore", "Skullcandy", "AKG",
    // Camera
    "Canon", "Nikon", "Fujifilm", "Panasonic", "GoPro", "DJI", "Sony",
    "Olympus", "Leica", "Pentax", "Insta360",
    // Home Appliance
    "Philips", "Sharp", "Rinnai", "Polytron", "Miyako", "Cosmos", "Maspion",
    "Modena", "Yong Ma", "Cuckoo", "Mitsubishi", "Daikin", "Electrolux",
    "Aqua", "Sanken", "Denpoo",
    // Fashion
    "Nike", "Adidas", "Puma", "Reebok", "New Balance", "Converse", "Vans",
    "Uniqlo", "Zara", "H&M", "Skechers", "Under Armour", "Fila", "Eiger",
    "Consina", "Bodypack",
    // PC Accessories
    "Logitech", "Steelseries", "Corsair", "HyperX", "Kingston", "SanDisk",
    "Seagate", "WD", "Western Digital", "Crucial", "Transcend", "Adata",
    "TP-Link", "Tenda", "Mikrotik", "Cisco", "Ubiquiti", "D-Link", "Asus ROG",
    "Rexus", "Fantech", "Robot", "Imperion",
    // Watches & Wearable
    "Rolex", "Casio", "Seiko", "Citizen", "Garmin", "Fitbit", "Mi Band",
    "Amazfit",
    // Beauty
    "Wardah", "Maybelline", "L'Oreal", "Loreal", "Revlon", "MAC", "NYX",
    "Make Over", "Emina", "Pixy", "Pond's", "Nivea", "Vaseline",
  ];

  // Pre-sort DESC supaya brand panjang (Western Digital) match dulu sebelum WD
  const BRAND_LIST_SORTED = [...new Set(BRAND_LIST)].sort(
    (a, b) => b.length - a.length,
  );

  // Blacklist untuk fallback brand: kata generik yang BUKAN brand
  const BRAND_BLACKLIST = new Set([
    "LAPTOP","GAMING","HEADPHONE","KEYBOARD","MOUSE","MOBILE","PHONE","SMARTPHONE",
    "TABLET","CAMERA","KAMERA","SEPATU","SHOES","TAS","BAG","JAM","WATCH","BAJU",
    "KAOS","CELANA","PANTS","DRESS","JAKET","JACKET","HOODIE","SANDAL","SLIPPER",
    "PROMO","DISKON","MURAH","BARU","NEW","READY","STOCK","ORIGINAL","ORI",
    "GARANSI","BONUS","GRATIS","FREE","BEST","HOT","TOP","SUPER","MEGA","FLASH",
    "PROMOSI","SALE","OBRAL","BAGUS","TERBAIK","TERLARIS","TERMURAH","COD",
    "PAKET","BUNDLE","SET","KIT","UNIT","FAST","INSTANT","ASLI","PREMIUM",
    "NOTEBOOK","COMPUTER","PC","KOMPUTER","ELEKTRONIK","GADGET","ALAT","BARANG",
    "PERLENGKAPAN","AKSESORIS","ACCESSORIES","FASHION","SPORT","OUTDOOR",
    "KESEHATAN","KECANTIKAN","BEAUTY","SKINCARE","MAKEUP","PRODUK",
    "STAND","COOLING","HEADSET","KABEL","WEBCAM","MEJA","KANTOR","PORTABLE",
    "HOLDER","DUDUKAN","DESK","LED","COOLINGPAD","SPEAKER","CHARGER","CABLE",
    "ADAPTER","STAND",
  ]);

  function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function detectBrand(name) {
    if (!name) return null;
    for (const brand of BRAND_LIST_SORTED) {
      const re = new RegExp(`\\b${escapeRegex(brand)}\\b`, "i");
      if (re.test(name)) {
        // Return brand dengan casing canonical dari list
        return brand;
      }
    }
    // Fallback: kata pertama yang ALL CAPS (>= 3 chars, alfanumerik)
    // tapi SKIP kalau kata itu di blacklist (kata generik bukan brand)
    const allCapsMatch = name.match(/^[\W_]*([A-Z][A-Z0-9]{2,})\b/);
    if (allCapsMatch && !BRAND_BLACKLIST.has(allCapsMatch[1].toUpperCase())) {
      return allCapsMatch[1];
    }
    // Fallback: kata pertama yang Title-case (mulai huruf kapital)
    const titleMatch = name.match(/^[\W_]*([A-Z][a-zA-Z]{2,})\b/);
    if (titleMatch && !BRAND_BLACKLIST.has(titleMatch[1].toUpperCase())) {
      return titleMatch[1];
    }
    return null;
  }

  function extractModel(name, brand) {
    if (!name) return null;
    let remaining = name;
    if (brand) {
      remaining = remaining
        .replace(new RegExp(`\\b${escapeRegex(brand)}\\b`, "i"), "")
        .trim();
    }

    // Strip prefix generik yang bukan model: "Laptop", "Gaming", "Mobile" dll
    const MODEL_PREFIX_NOISE =
      /^(laptop|notebook|gaming|smartphone|mobile|phone|tablet|kamera|camera|headphone|earphone|earbuds|mouse|keyboard|monitor|tv|sepatu|shoes|tas|bag|baju|kaos|celana|jaket|jam|watch|charger|kabel|cable|adapter|stand|holder|case|cover|paket|bundle|set|kit|jual|murah|asli|original|new|baru|free|gratis|bonus|garansi|resmi|cod|ready|stock|untuk|for|with|dan|and|original|ori|baru|new)\s+/i;
    let prev;
    do {
      prev = remaining;
      remaining = remaining.replace(MODEL_PREFIX_NOISE, "").trim();
    } while (remaining !== prev && remaining.length > 0);

    // Stop di pertama kali ketemu spec keyword (Ram, SSD, Intel, AMD, Ryzen, Core, Gen, RTX, GTX, MX, dll)
    const STOP_AT = /\b(ram|ssd|hdd|gpu|cpu|intel|amd|ryzen|core|gen|rtx|gtx|mx|nvidia|geforce|radeon|iris|vega|m1|m2|m3|m4|snapdragon|mediatek|exynos|kirin|dimensity|helio|apple|bionic|tensor|\d+gb|\d+tb|\d+mb|\d+inch|\d+\"|\d+hz|\d+mp|\d+mah|\d+w|\d+v|tahun|bulan|hari|second|bekas|mulus|berkualitas|win\s*\d+|windows|android|ios|chromeos|bnib|sein|tam|ibox|garansi|generasi|series|seri)\b/i;
    const stopMatch = remaining.search(STOP_AT);
    if (stopMatch > 0) remaining = remaining.substring(0, stopMatch);

    // Stop di separator " - ", " | ", " / "
    const sepAt = remaining.search(/\s[-|/–—]\s/);
    if (sepAt > 0) remaining = remaining.substring(0, sepAt);

    const words = remaining.split(/\s+/).filter(Boolean).slice(0, 5);
    let model = words.join(" ").trim().replace(/["""'']/g, "");
    // Buang trailing dash/punct
    model = model.replace(/[\s\-|/–—.,;:]+$/, "");
    if (model.length > 80) model = model.substring(0, 80);
    return model || null;
  }

  // =========================================================================
  // 5. SHOP DATA EXTRACTION (unchanged logic, just cleaned)
  // =========================================================================
  function extractShopData(data) {
    try {
      const seenShops = new Set();
      const shops = [];
      function traverse(obj) {
        if (obj && typeof obj === "object") {
          if (obj.shopid && !seenShops.has(obj.shopid)) {
            const hasRating = obj.rating_star != null;
            if (hasRating) {
              seenShops.add(obj.shopid);
              const ratingCount =
                obj.rating_count && Array.isArray(obj.rating_count)
                  ? obj.rating_count.reduce((a, b) => a + b, 0)
                  : obj.rating_count || 0;
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
          for (const key in obj) traverse(obj[key]);
        }
      }
      traverse(data);
      return shops;
    } catch (e) {
      console.error("[Avalon Harvester] Error extracting shop data:", e);
      return [];
    }
  }

  // =========================================================================
  // 6. PRODUCT EXTRACTION — NO MORE laptop/notebook filter
  // =========================================================================
  function extractProductsData(data) {
    try {
      const products = [];
      const seen = new Set();
      let invalidCount = 0;

      function traverse(obj) {
        if (obj && typeof obj === "object") {
          if (
            obj.itemid &&
            obj.shopid &&
            obj.name &&
            typeof obj.name === "string" &&
            obj.name.trim() !== "" &&
            !seen.has(obj.itemid)
          ) {
            seen.add(obj.itemid);

            const rawName = obj.name.trim();
            const cleanName = cleanProductName(rawName);

            // Skip kalau nama jadi kosong setelah cleaning
            if (!cleanName || cleanName.length < 3) {
              invalidCount++;
              return;
            }

            const ratingCount =
              obj.item_rating && Array.isArray(obj.item_rating.rating_count)
                ? obj.item_rating.rating_count.reduce((a, b) => a + b, 0)
                : obj.rating_count || 0;

            const brand = detectBrand(cleanName);
            const model = extractModel(cleanName, brand);
            const prices = extractPrices(obj);

            // Skip kalau price tidak valid (0)
            if (!prices.price || prices.price <= 0) {
              invalidCount++;
              return;
            }

            products.push({
              itemid: obj.itemid,
              shopid: obj.shopid,
              name: cleanName,
              name_raw: rawName,
              brand: brand,
              model: model,
              price: prices.price,
              original_price: prices.original_price,
              price_min: prices.price_min,
              price_max: prices.price_max,
              discount_percentage: prices.discount_percentage,
              stock: obj.stock || 0,
              product_url:
                "https://shopee.co.id/product/" +
                obj.shopid +
                "/" +
                obj.itemid,
              historical_sold: obj.historical_sold || 0,
              sold: obj.sold || obj.historical_sold || 0,
              rating_star: obj.item_rating
                ? obj.item_rating.rating_star || 0
                : 0,
              rating_count: ratingCount,
              shop_name: obj.shop_name || null,
              is_official_shop: obj.is_official_shop === true,
              location: obj.shop_location || obj.location || null,
              image: obj.image || null,
              scraped_at: new Date().toISOString(),
            });
          } else if (obj.itemid && obj.shopid && !obj.name) {
            invalidCount++;
          }
          for (const key in obj) traverse(obj[key]);
        }
      }

      traverse(data);
      console.log(
        `[Avalon Harvester] Extracted ${products.length} valid products. Skipped: ${invalidCount}`,
      );
      return products;
    } catch (e) {
      console.error("[Avalon Harvester] Error extracting product data:", e);
      return [];
    }
  }

  // =========================================================================
  // 7. FETCH & XHR INTERCEPTION (unchanged routing)
  // =========================================================================
  function isHarvestApi(url) {
    return (
      url &&
      (url.includes("/api/v4/shop/get_shop_items") ||
        url.includes("/api/v4/search/search_items"))
    );
  }

  function handleProductData(parsedData, url) {
    const products = extractProductsData(parsedData);
    if (products.length > 0) {
      const searchQuery = getSearchQuery(url);
      document.dispatchEvent(
        new CustomEvent("Avalon_Harvest_Data", {
          detail: {
            type: "harvest",
            products: products,
            search_query: searchQuery,
          },
        }),
      );
    }
  }

  function handleShopData(parsedData) {
    const shops = extractShopData(parsedData);
    if (shops.length > 0) {
      document.dispatchEvent(
        new CustomEvent("Avalon_Shop_Data", {
          detail: { shops: shops },
        }),
      );
    }
  }

  // ----- Fetch interception -----
  const OriginalFetch = window.fetch;
  window.fetch = new Proxy(OriginalFetch, {
    apply: function (target, thisArg, args) {
      const fetchUrl =
        args[0] && typeof args[0] === "object" && args[0].url
          ? args[0].url
          : args[0];
      const fetchPromise = Reflect.apply(target, thisArg, args);
      fetchPromise
        .then((response) => {
          try {
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("json")) {
              response
                .clone()
                .json()
                .then((data) => {
                  try {
                    if (isHarvestApi(fetchUrl)) {
                      handleProductData(data, fetchUrl);
                    } else if (isShopApi(fetchUrl)) {
                      handleShopData(data);
                    } else if (isCategoryApi(fetchUrl)) {
                      handleCategoryData(data, fetchUrl);
                    }
                  } catch (e) {
                    /* swallow parser errors */
                  }
                })
                .catch(() => {});
            }
          } catch (e) {
            /* swallow header errors */
          }
        })
        .catch(() => {});
      return fetchPromise;
    },
  });

  // ----- XHR interception -----
  const OriginalXHR = window.XMLHttpRequest;
  const OriginalOpen = OriginalXHR.prototype.open;
  OriginalXHR.prototype.open = new Proxy(OriginalOpen, {
    apply: function (target, thisArg, args) {
      try {
        thisArg._intercepted_url = args[1];
      } catch (e) {
        /* swallow assignment errors */
      }
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
            if (contentType && contentType.includes("json")) {
              const parsedData = JSON.parse(this.responseText);
              if (isHarvestApi(this._intercepted_url)) {
                handleProductData(parsedData, this._intercepted_url);
              } else if (isShopApi(this._intercepted_url)) {
                handleShopData(parsedData);
              } else if (isCategoryApi(this._intercepted_url)) {
                handleCategoryData(parsedData, this._intercepted_url);
              }
            }
          } catch (e) {
            /* swallow xhr parse errors */
          }
        });
      } catch (e) {
        /* swallow xhr listener errors */
      }
      return Reflect.apply(target, thisArg, args);
    },
  });

  console.log("[Avalon Harvester] inject.js v2 loaded - enhanced cleaning");

  // Self-fetch category tree setelah SDK siap (tunggu 3 detik)
  setTimeout(() => {
    if (window.__avalon_categories__) return; // sudah ada dari intercept
    fetch('https://shopee.co.id/api/v4/pages/get_category_tree', {
      headers: { 'Accept': 'application/json', 'x-requested-with': 'XMLHttpRequest', 'x-api-source': 'pc', 'x-shopee-language': 'id' },
    })
      .then(r => r.json())
      .then(data => handleCategoryData(data, ""))
      .catch((err) => console.error("[Avalon] Self-fetch category tree failed:", err));
  }, 3000);
})();
