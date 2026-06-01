// [Avalon Harvester] Background script loaded - Enterprise Edition
console.log("[Avalon Harvester] Enterprise Background script loaded");

// =========================================================================
// KONFIGURASI SUPABASE
// =========================================================================
const SUPABASE_URL = "https://fzomsxxbqdhgeafhygkp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6b21zeHhicWRoZ2VhZmh5Z2twIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzNjc4MTAsImV4cCI6MjA5NDk0MzgxMH0.1jgnNpGYavTM2zUbWZkKbhnXqTMUovcjUEtKEaP4zvk";
const SUPABASE_API_ENDPOINT = `${SUPABASE_URL}/rest/v1/shopee_search_products`;

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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "START_SWEEP") {
    const keyword = message.keyword || "";
    const projectId = message.project_id || "PRJ-UNASSIGNED";
    const categoryGroup = message.category_group || "General";
    const newBatchId = "batch_" + Date.now();

    chrome.storage.local.set({
      keyword,
      project_id: projectId,
      category_group: categoryGroup,
      isAutoSweep: true,
      currentTask: keyword,
      batch_id: newBatchId,
    }, () => {
      const url = "https://shopee.co.id/search?keyword=" + encodeURIComponent(keyword);
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) chrome.tabs.update(tabs[0].id, { url });
        else chrome.tabs.create({ url });
      });
      sendResponse({ status: "started", keyword, project_id: projectId });
    });

    return true;
  } else if (message.action === "STOP_SWEEP") {
    chrome.storage.local.set({
      isAutoSweep: false,
      currentTask: null,
    }, () => {
      sendResponse({ status: "stopped" });
    });

    return true;
  } else if (message.action === "GET_CIRCUIT_BREAKER_STATUS") {
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
      const uniqueId = `p_${product.shopid}_${product.itemid}`;
      return {
        unique_id: uniqueId,
        item_id: String(product.itemid),
        shop_id: String(product.shopid),
        product_name: product.name || "Unknown Product",
        price: product.price || 0,
        price_min: product.price_min || 0,
        price_max: product.price_max || 0,
        original_price: product.original_price || null,
        discount: product.discount || null,
        stock: product.stock || 0,
        product_url: product.product_url || null,
        historical_sold: product.historical_sold || 0,
        sold: product.sold || product.historical_sold || 0,
        rating_star: product.rating_star || 0,
        rating_count: product.rating_count || 0,
        shop_name: product.shop_name || null,
        is_official_shop: product.is_official_shop === true,
        shop_location: product.location || null,
        image_url: product.image || null,
        search_query: searchQuery,
        project_id: projectId,
        category_group: categoryGroup,
        source_platform: "shopee",
        created_at: batchTimestamp,
        updated_at: batchTimestamp,
        scraped_at: product.scraped_at || batchTimestamp,
      };
    };

    const sendBatch = async (batch) => {
      try {
        const res = await fetch(SUPABASE_API_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            Prefer: "resolution=merge-duplicates",
          },
          body: JSON.stringify(batch),
        });

        if (!res.ok) {
          const text = await res.text();
          console.error(`[Avalon Harvester] Supabase batch error ${res.status}: ${text}`);
          errorCount += batch.length;
        } else {
          savedCount += batch.length;
        }
      } catch (e) {
        console.error("[Avalon Harvester] Supabase batch fetch failed:", e.message);
        errorCount += batch.length;
      }
    };

    const processBatches = async () => {
      for (let i = 0; i < products.length; i += batchSize) {
        const batch = products.slice(i, i + batchSize).map(mapPayload);
        await sendBatch(batch);
        if (i + batchSize < products.length) {
          await new Promise((r) => setTimeout(r, 400 + Math.random() * 600));
        }
      }

      console.log(
        `[Avalon Harvester] Batch done: ${savedCount} saved, ${errorCount} errors of ${products.length} products`,
      );
      sendResponse({ status: "success", total_saved: savedCount, total_errors: errorCount });
    };

    processBatches();
    return true;
  }
});
