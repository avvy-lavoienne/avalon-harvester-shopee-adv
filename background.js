// [Avalon Harvester] Background script loaded - Enterprise Edition
console.log("[Avalon Harvester] Background script loaded - Full Auto Mode");

// =========================================================================
// KONFIGURASI SUPABASE
// =========================================================================
const SUPABASE_URL = "https://fzomsxxbqdhgeafhygkp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6b21zeHhicWRoZ2VhZmh5Z2twIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzNjc4MTAsImV4cCI6MjA5NDk0MzgxMH0.1jgnNpGYavTM2zUbWZkKbhnXqTMUovcjUEtKEaP4zvk";
const SUPABASE_API_ENDPOINT = `${SUPABASE_URL}/rest/v1/shopee_products`;
const SUPABASE_KEYWORDS_ENDPOINT = `${SUPABASE_URL}/rest/v1/harvesting_keywords`;

let currentTask = null; // Menyimpan keyword yang sedang aktif

// Inisialisasi Worker ID permanen untuk profil Chrome ini
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(["worker_id"], (result) => {
    if (!result.worker_id) {
      const newWorkerId =
        "avalon-node-" + Math.random().toString(36).substr(2, 6);
      chrome.storage.local.set({ worker_id: newWorkerId });
      console.log("[Avalon Harvester] New Worker ID generated:", newWorkerId);
    }
  });
});

// Bersihkan tab Shopee berlebih saat startup
chrome.runtime.onStartup.addListener(() => {
  chrome.tabs.query({ url: "*://*.shopee.co.id/*" }, (tabs) => {
    if (tabs.length > 1) {
      for (let i = 1; i < tabs.length; i++) {
        chrome.tabs.remove(tabs[i].id);
      }
    }
  });
});

// Test Supabase connection
fetch(SUPABASE_API_ENDPOINT + "?select=*", {
  method: "GET",
  headers: {
    "Content-Type": "application/json",
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
  },
}).then((res) =>
  console.log(
    "[Avalon Harvester] Supabase test connection:",
    res.ok ? "SUCCESS" : "FAILED",
  ),
);

const AntiDetection = {
  _cachedHeaders: null,
  _lastHeaderRefresh: 0,
  _headerRefreshInterval: 25 * 60 * 1000,

  // ==================== CIRCUIT BREAKER ====================
  circuitBreaker: {
    failureCount: 0,
    lastFailureTime: 0,
    isOpen: false,
    threshold: 3,
    cooldownMin: 10 * 60 * 1000,
    cooldownMax: 20 * 60 * 1000,

    recordFailure: function () {
      this.failureCount++;
      this.lastFailureTime = Date.now();
      if (this.failureCount >= this.threshold && !this.isOpen) {
        this.isOpen = true;
        const cooldown = this.cooldownMin + Math.random() * (this.cooldownMax - this.cooldownMin);
        chrome.storage.local.set({
          circuitBreakerOpen: true,
          circuitBreakerUntil: Date.now() + cooldown,
        });
      }
    },

    recordSuccess: function () {
      this.failureCount = 0;
      this.isOpen = false;
      chrome.storage.local.remove(["circuitBreakerOpen", "circuitBreakerUntil"]);
    },

    shouldAllowRequest: async function () {
      if (!this.isOpen) return true;
      const data = await chrome.storage.local.get(["circuitBreakerUntil"]);
      if (Date.now() > (data.circuitBreakerUntil || 0)) {
        this.isOpen = false;
        return true;
      }
      return false;
    },

    getStatus: function () {
      return {
        isOpen: this.isOpen,
        failureCount: this.failureCount,
        threshold: this.threshold,
      };
    },
  },

  getRandomHeaders: () => {
    const now = Date.now();
    if (AntiDetection._cachedHeaders && now - AntiDetection._lastHeaderRefresh < AntiDetection._headerRefreshInterval) {
      return AntiDetection._cachedHeaders;
    }
    const userAgents = [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    ];
    AntiDetection._cachedHeaders = {
      "User-Agent": userAgents[Math.floor(Math.random() * userAgents.length)],
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": ["en-US,en;q=0.9", "id-ID,id;q=0.9"][Math.floor(Math.random() * 2)],
      "Accept-Encoding": "gzip, deflate, br",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
    };
    AntiDetection._lastHeaderRefresh = now;
    return AntiDetection._cachedHeaders;
  },
  applyStickyHeadersRule: async function () {
    const headers = AntiDetection.getRandomHeaders();
    const requestHeaders = Object.entries(headers).map(([key, val]) => ({
      header: key,
      operation: "set",
      value: val,
    }));

    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [999],
      addRules: [
        {
          id: 999,
          priority: 1,
          action: { type: "modifyHeaders", requestHeaders: requestHeaders },
          condition: {
            urlFilter: "*://*.shopee.*/*",
            resourceTypes: ["main_frame", "xmlhttprequest"],
          },
        },
      ],
    });
  },
};

AntiDetection.applyStickyHeadersRule();

// ====================== SUPABASE HELPER ======================
async function getNextKeyword() {
  try {
    const now = new Date().toISOString();

    const query = `${SUPABASE_KEYWORDS_ENDPOINT}?select=*` +
      `&or=(and(status.eq.pending),and(status.eq.done,next_scrape_at.lt.${now}))` +
      `&order=priority.asc,last_scraped_at.asc` +
      `&limit=1`;

    const res = await fetch(query, {
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      console.error(`[Avalon] Supabase keywords fetch failed: ${res.status}`);
      return null;
    }

    const data = await res.json();
    console.log(`[Avalon] Found next keyword: ${data.length > 0 ? data[0].keyword : 'NONE'}`);

    return data.length > 0 ? data[0] : null;
  } catch (error) {
    console.error("Error fetching keyword from Supabase:", error);
    return null;
  }
}

async function updateKeywordStatus(id, status) {
  try {
    const payload = { status, last_scraped_at: new Date().toISOString() };

    if (status === "done") {
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + 14);
      payload.next_scrape_at = nextDate.toISOString();
    }

    await fetch(`${SUPABASE_KEYWORDS_ENDPOINT}?id=eq.${id}`, {
      method: "PATCH",
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error("Error updating keyword status:", error);
  }
}

// ====================== START HARVESTING ======================
async function startHarvestingFromSupabase() {
  if (currentTask) {
    console.log("Already harvesting a keyword");
    return;
  }

  const keywordData = await getNextKeyword();
  
  if (!keywordData) {
    console.log("[Avalon] No pending keywords found");
    chrome.storage.local.set({ isAutoSweep: false });
    return;
  }

  currentTask = keywordData;

  const searchUrl = `https://shopee.co.id/search?keyword=${encodeURIComponent(keywordData.keyword)}`;

  const tabs = await chrome.tabs.query({ url: "*://*.shopee.co.id/*" });

  if (tabs.length > 0) {
    await chrome.tabs.update(tabs[0].id, { url: searchUrl });
    console.log(`[Avalon] Updated existing tab with new keyword: ${keywordData.keyword}`);
  } else {
    await chrome.tabs.create({ url: searchUrl });
    console.log(`[Avalon] Created new tab for keyword: ${keywordData.keyword}`);
  }

  chrome.storage.local.set({
    keyword: keywordData.keyword,
    project_id: keywordData.project_id,
    category_group: keywordData.category_group,
    currentKeywordId: keywordData.id,
    currentPage: 0,
    maxPages: keywordData.max_pages || 12,
    isAutoSweep: true
  });

  console.log(`🔄 Starting harvest: "${keywordData.keyword}"`);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  
  if (message.action === "START_SWEEP") {
    if (message.keyword) {
      chrome.storage.local.set({
        keyword: message.keyword,
        project_id: message.project_id || "PRJ-UNASSIGNED",
        category_group: message.category_group || "General",
        isAutoSweep: true,
        currentPage: 0,
        maxPages: 12,
      });
    } else {
      startHarvestingFromSupabase();
    }
    sendResponse({ status: "started" });
    return true;
  }

  if (message.action === "STOP_SWEEP") {
    currentTask = null;
    chrome.storage.local.set({ 
      isAutoSweep: false, 
      currentTask: null,
      currentKeywordId: null 
    });
    sendResponse({ status: "stopped" });
    return true;
  }

  if (message.action === "KEYWORD_FINISHED") {
    if (currentTask) {
      updateKeywordStatus(currentTask.id, "done");
      currentTask = null;
    }
    setTimeout(startHarvestingFromSupabase, 3000);
  }

  if (message.action === "GET_CIRCUIT_BREAKER_STATUS") {
    const cb = AntiDetection.circuitBreaker;
    chrome.storage.local.get(["circuitBreakerUntil"], (data) => {
      const until = data.circuitBreakerUntil || 0;
      const remainingMs = until > Date.now() ? until - Date.now() : 0;
      sendResponse({
        isOpen: cb.isOpen,
        failureCount: cb.failureCount,
        threshold: cb.threshold,
        remainingMinutes: Math.ceil(remainingMs / 1000 / 60),
      });
    });
    return true;
  } else if (message.action === "STORE_HARVESTED_DATA") {
    const products = message.products || [];
    const searchQuery = message.search_query || "unknown";
    const projectId = message.project_id || "PRJ-UNASSIGNED";
    const categoryGroup = message.category_group || "General";

    const batchTimestamp = new Date().toISOString();
    const batchSize = 40;
    let savedCount = 0;
    let errorCount = 0;

    const mapPayload = (product) => {
      const itemId = String(product.itemid);
      const shopId = String(product.shopid);

      let discountPercentage = null;
      if (product.discount) {
        const cleaned = String(product.discount).replace('%', '').trim();
        const num = parseFloat(cleaned);
        if (!isNaN(num)) {
          discountPercentage = num;
        }
      }

      return {
        item_id: itemId,
        product_name: product.name || "Unknown Product",
        brand: product.brand || null,
        model: product.model || null,
        price: product.price || 0,
        original_price: product.original_price || null,
        discount_percentage: discountPercentage,
        historical_sold: product.historical_sold || 0,
        sold: product.sold || product.historical_sold || 0,
        rating_star: product.rating_star || 0,
        rating_count: product.rating_count || 0,
        review_count: product.rating_count || 0,
        stock: product.stock || 0,
        shop_id: shopId,
        shop_name: product.shop_name || null,
        is_official_shop: product.is_official_shop === true,
        shop_location: product.location || null,
        shop_rating: null,
        response_rate: null,
        search_query: searchQuery,
        project_id: projectId,
        category_group: categoryGroup,
        product_url: product.product_url || `https://shopee.co.id/product/${shopId}/${itemId}`,
        image_url: product.image || null,
        source_platform: "shopee",
        scraped_at: product.scraped_at || batchTimestamp,
        created_at: batchTimestamp,
        updated_at: batchTimestamp,
      };
    };

    const sendBatch = async (batch) => {
      try {
        const res = await fetch(
          `${SUPABASE_API_ENDPOINT}?on_conflict=item_id`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
              Prefer: "resolution=merge-duplicates",
            },
            body: JSON.stringify(batch),
          },
        );

        if (!res.ok) {
          const text = await res.text();
          console.error(
            `[Avalon Harvester] Supabase batch error ${res.status}: ${text}`,
          );
          errorCount += batch.length;
        } else {
          savedCount += batch.length;
        }

        await new Promise((r) => setTimeout(r, 300 + Math.random() * 400));
      } catch (e) {
        console.error("[Avalon Harvester] Supabase batch fetch failed:", e.message);
        errorCount += batch.length;
      }
    };

    const processBatches = async () => {
      const validBatches = [];
      let skipped = 0;
      for (let i = 0; i < products.length; i += batchSize) {
        const batch = products.slice(i, i + batchSize).map(mapPayload).filter((p) => {
          if (!p.item_id || p.price == null) {
            skipped++;
            return false;
          }
          return true;
        });
        if (batch.length === 0) continue;
        validBatches.push(batch);
      }

      for (const batch of validBatches) {
        await sendBatch(batch);
        await new Promise((r) => setTimeout(r, 400 + Math.random() * 600));
      }

      console.log(
        `[Avalon Harvester] Batch done: ${savedCount} saved, ${errorCount} errors, ${skipped} skipped (no item_id/price) of ${products.length} total`,
      );
      sendResponse({ status: "success", total_saved: savedCount, total_errors: errorCount });
    };

    processBatches();
    return true;
  } else if (message.action === "STORE_SHOP_DATA") {
    const shops = message.shops || [];
    const batchTimestamp = new Date().toISOString();

    const sendShops = async () => {
      for (const shop of shops) {
        try {
          const payload = {
            shop_id: String(shop.shopid),
            shop_name: shop.shop_name || null,
            shop_rating: shop.shop_rating || 0,
            shop_rating_count: shop.shop_rating_count || 0,
            response_rate: shop.response_rate || null,
            follower_count: shop.follower_count || 0,
            is_official_shop: shop.is_official_shop === true,
            shop_location: shop.shop_location || null,
            scraped_at: shop.scraped_at || batchTimestamp,
            updated_at: batchTimestamp,
          };

          const res = await fetch(`${SUPABASE_URL}/rest/v1/shopee_shop_info`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
              Prefer: "resolution=merge-duplicates",
            },
            body: JSON.stringify(payload),
          });

          if (!res.ok) {
            const text = await res.text();
            console.error(`[Avalon Harvester] Supabase shop error ${res.status}: ${text}`);
          }

          await new Promise((r) => setTimeout(r, 80 + Math.random() * 120));
        } catch (e) {
          console.error("[Avalon Harvester] Failed to store shop:", shop.shopid, e.message);
        }
      }
    };

    sendShops().then(() => sendResponse({ status: "success", count: shops.length }));
    return true;
  }
});
