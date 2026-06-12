// [Avalon Harvester] Background script loaded - Enterprise Edition

console.log("[Avalon Harvester] Background script loaded - Full Auto Mode");

// =========================================================================
// ARSITEKTUR AVALON HARVESTER
// =========================================================================
//
// Alur kerja:
//   1. Popup mengirim START_SWEEP → background.js claim task dari Supabase
//   2. `claimNextKeyword()` mengambil 1 task (keyword/facet) via Supabase PATCH
//   3. `buildSearchUrl()` membuat URL sesuai mode (keyword atau facet)
//   4. Tab Shopee diarahkan ke URL tersebut → content.js + inject.js aktif
//   5. `inject.js` mencegat response API Shopee (fetch/XHR), ekstrak produk
//   6. `content.js` mengirim `STORE_HARVESTED_DATA` ke background
//   7. Background batch-insert ke Supabase (40 produk/batch)
//   8. `content.js` klik tombol Next → ulang sampai maxPages tercapai
//   9. `KEYWORD_FINISHED` → update status task di Supabase → task berikutnya
//
// Mode:
//   - KEYWORD : URL pakai ?keyword=..., facet_id=NULL
//   - FACET   : URL pakai ?facet=..., filter harga, sortBy, facet_id!=NULL
//
// Anti-detection:
//   - declarativeNetRequest untuk sticky headers (refresh 25 menit)
//   - Random delay & scroll pattern di content.js
//   - Circuit breaker: 3 gagal berturut → cooldown 10-20 menit
//
// Category Discovery (popup):
//   - Fetch dari Shopee API /api/v2/search/categories
//   - Tampilkan tree view (level >= 1) + drill-down subkategori
//   - Tombol ＋ untuk membuat facet task baru
//
// =========================================================================
// KONFIGURASI SUPABASE
// =========================================================================
const SUPABASE_URL = "https://fzomsxxbqdhgeafhygkp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6b21zeHhicWRoZ2VhZmh5Z2twIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzNjc4MTAsImV4cCI6MjA5NDk0MzgxMH0.1jgnNpGYavTM2zUbWZkKbhnXqTMUovcjUEtKEaP4zvk";
const SUPABASE_API_ENDPOINT = `${SUPABASE_URL}/rest/v1/shopee_products`;
const SUPABASE_KEYWORDS_ENDPOINT = `${SUPABASE_URL}/rest/v1/harvesting_keywords`;
const SUPABASE_CATEGORY_CACHE_ENDPOINT = `${SUPABASE_URL}/rest/v1/shopee_category_cache`;

let currentTask = null;
const completedKeywordIds = new Set();
let currentProductCount = 0;

// Restore product count dari storage (survive service worker restart)
chrome.storage.local.get(["productCount"], (r) => {
  if (r.productCount) currentProductCount = r.productCount;
});

function persistProductCount() {
  return new Promise((resolve) => {
    chrome.storage.local.set({ productCount: currentProductCount }, resolve);
  });
}

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
chrome.runtime.onStartup.addListener(async () => {
  const tabs = await chrome.tabs.query({ url: ['*://shopee.co.id/*', '*://*.shopee.co.id/*'] });
  if (tabs.length > 1) {
    for (let i = 1; i < tabs.length; i++) {
      chrome.tabs.remove(tabs[i].id);
    }
  }
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

// =========================================================================
// ANTI-DETECTION SYSTEM
// =========================================================================

const AntiDetection = {
  _cachedHeaders: null,
  _lastHeaderRefresh: 0,
  _headerRefreshInterval: 25 * 60 * 1000,

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
        this.failureCount = 0;
        chrome.storage.local.remove(["circuitBreakerOpen", "circuitBreakerUntil"]);
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

// Aktifkan sticky headers untuk semua request ke Shopee
AntiDetection.applyStickyHeadersRule();

// =========================================================================
// SUPABASE HELPERS — koneksi, claim task, update status
// =========================================================================

function supabaseHeaders() {
  return {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
  };
}

// Claim 1 task dari Supabase dengan atomic PATCH (race-safe).
// Prioritas: status=pending & not assigned → status=done & next_scrape_at sudah lewat & not assigned.
// retryCount: depth guard untuk mencegah infinite recursion pada race condition.
async function claimNextKeyword(username, retryCount = 0) {
  if (retryCount > 5) {
    console.error("[Avalon] ClaimNext: max retry reached, giving up");
    return null;
  }
  try {
    const now = new Date().toISOString();
    const escUser = encodeURIComponent(username);

    // Step 1: SELECT 1 id yang available
    const filter = `or=(and(status.eq.pending,or(assigned_to.is.null,assigned_to.eq.${escUser})),and(status.eq.done,next_scrape_at.lt.${now},assigned_to.is.null))`;
    const selUrl = `${SUPABASE_KEYWORDS_ENDPOINT}?select=id&${filter}&order=priority.asc,last_scraped_at.asc&limit=1`;
    const selRes = await fetch(selUrl, { headers: supabaseHeaders() });
    if (!selRes.ok) {
      console.error(`[Avalon] ClaimNext: SELECT failed with HTTP ${selRes.status}`);
      return null;
    }
    const candidates = await selRes.json();
    if (!candidates || candidates.length === 0) {
      console.log("[Avalon] No available keywords to claim");
      return null;
    }

    const candidateId = candidates[0].id;

    // Step 2: Atomic claim via PATCH by id (hanya jika masih null / milik kita)
    const patchUrl = `${SUPABASE_KEYWORDS_ENDPOINT}?id=eq.${candidateId}&or=(assigned_to.is.null,assigned_to.eq.${escUser})`;
    const patchRes = await fetch(patchUrl, {
      method: "PATCH",
      headers: {
        ...supabaseHeaders(),
        "Prefer": "return=representation",
      },
      body: JSON.stringify({ assigned_to: username, last_scraped_at: now }),
    });

    if (!patchRes.ok) return null;
    const data = await patchRes.json();
    if (!Array.isArray(data) || data.length === 0) {
      console.log("[Avalon] Claim race — retrying...");
      return claimNextKeyword(username, retryCount + 1);
    }

    console.log(`[Avalon] Claimed: "${data[0].keyword}" (${data[0].id})`);
    return data[0];
  } catch (error) {
    console.error("[Avalon] Error claiming keyword:", error);
    return null;
  }
}

// Update status task setelah selesai/gagal.
// Status "done" → set next_scrape_at (14 hari) + total_products + release assigned_to.
async function updateKeywordStatus(id, status) {
  if (id == null) {
    console.warn("[Avalon] updateKeywordStatus skipped — id is null");
    return;
  }
  try {
    const payload = {
      status,
      last_scraped_at: new Date().toISOString(),
    };

    if (status === "done") {
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + 14);
      payload.next_scrape_at = nextDate.toISOString();
      payload.assigned_to = null;
      payload.total_products = currentProductCount;
    }

    const res = await fetch(`${SUPABASE_KEYWORDS_ENDPOINT}?id=eq.${id}`, {
      method: "PATCH",
      headers: {
        ...supabaseHeaders(),
        "Prefer": "return=minimal",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`[Avalon] Keyword status update failed: ${res.status} ${errText}`);
    } else {
      console.log(`[Avalon] Keyword ${id} status updated to ${status}`);
    }
  } catch (error) {
    console.error("[Avalon] Error updating keyword status:", error);
  }
}

// ====================== CATEGORY DISCOVERY ======================

let _categoryCache = null;
let _categoryCacheTime = 0;
const CATEGORY_CACHE_TTL = 30 * 60 * 1000;

// Fetch kategori dari Shopee API, cache 30 menit.
// Prioritas: tab-based → inject → direct (dengan timeout).
async function fetchShopeeCategories() {
  if (_categoryCache && Date.now() - _categoryCacheTime < CATEGORY_CACHE_TTL) {
    return _categoryCache;
  }

  // Prioritas: tab-based (paling reliable, ada cookies) → inject → direct (fallback singkat)
  let categories = await tryFetchViaTab();
  if (!categories) {
    categories = await tryFetchDirect(5000);
  }

  if (!categories) {
    throw new Error("Tidak ada kategori — buka shopee.co.id dulu lalu coba lagi");
  }

  _categoryCache = categories;
  saveCategoriesToSupabase(categories);
  _categoryCacheTime = Date.now();
  return categories;
}

// Direct fetch dari background.js — butuh cookies & anti-fraud tokens, sering gagal.
// timeoutMs: abort setelah N ms biar gak hang.
async function tryFetchDirect(timeoutMs = 5000) {
  const urls = [
    ...await getCategoryUrls(),
  ];
  for (const url of urls) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
          'x-api-source': 'pc',
          'x-shopee-language': 'id',
        },
      });
      clearTimeout(timer);
      if (!res.ok) continue;
      const body = await res.json();
      return normalizeCategories(body?.data || body);
    } catch {
      clearTimeout(timer);
      continue;
    }
  }
  return null;
}

// Fetch via tab Shopee yang sudah terbuka — punya cookies & anti-fraud SDK.
// Priority #1 karena paling reliable.
async function tryFetchViaTab() {
  const tabs = await chrome.tabs.query({ url: ['*://shopee.co.id/*', '*://*.shopee.co.id/*'] });
  if (tabs.length === 0) return null;

  const tabId = tabs[0].id;

  // Coba lewat content.js message handler
  console.log('[Avalon] tryFetchViaTab: sending to tab', tabId);
  try {
    const response = await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, { action: "FETCH_CATEGORIES_FROM_PAGE" }, (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(result);
        }
      });
      setTimeout(() => reject(new Error("timeout")), 8000);
    });

    console.log('[Avalon] tryFetchViaTab: response', response?.success, Array.isArray(response?.categories) ? response.categories.length + ' cats' : 'no array');
    if (response?.success && Array.isArray(response.categories)) {
      return response.categories;
    }
  } catch {
    console.log('[Avalon] tryFetchViaTab: msg failed, fallback to inject');
  }

  // Fallback: inject fetch langsung ke page context (bypass content.js)
  // Fallback: inject ke page context — ekstrak kategori dari DOM & cookie
  try {
    const [execResult] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        // Helper: baca csrf token dari cookie
        const getCsrf = () => {
          const m = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
          return m ? m[1] : '';
        };

        // Try 1: fetch API dengan headers lengkap (csrf + api-source)
        const tryApi = () => {
          const csrf = getCsrf();
          return fetch('https://shopee.co.id/api/v4/pages/get_category_tree', {
            headers: {
              'Accept': 'application/json',
              'x-requested-with': 'XMLHttpRequest',
              'x-api-source': 'pc',
              'x-shopee-language': 'id',
              ...(csrf ? { 'x-csrftoken': csrf } : {}),
            },
          }).then(r => {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.json();
          }).then(body => {
            const rawList = body?.data?.category_tree || body?.data?.category_list || body?.category_tree || body?.data?.categories || body?.categories || body?.data || [];
            if (!Array.isArray(rawList) || rawList.length === 0) throw new Error('no array');
            return rawList.filter(c => (c.level || 0) >= 1).map(c => ({
              catid: c.catid,
              name: c.display_name || c.name,
              parent_catid: c.parent_catid || 0,
              level: c.level || 1,
              no_sub: c.no_sub === true,
              url: c.url || null,
            }));
          });
        };

        // Try 2: ekstrak dari DOM — ambil semua link kategori di halaman
        const tryDom = () => {
          const cats = [];
          const seen = new Set();
          const pgUrl = window.location.href;

          function addCat(catid, name, parentCatid, url) {
            if (!catid || seen.has(catid)) return;
            seen.add(catid);
            cats.push({
              catid: parseInt(catid),
              name: (name || 'Category ' + catid).trim().replace(/\s+/g, ' '),
              parent_catid: parseInt(parentCatid || 0),
              level: 1, no_sub: false,
              url: url || null,
            });
          }

          // 1. Parse dari URL halaman: /Nama-cat.12345 atau /Nama-cat.12345.67890
          const up = pgUrl.match(/-cat\.(\d+)(?:\.(\d+))?/);
          if (up) {
            const catid = up[2] ? parseInt(up[2]) : parseInt(up[1]);
            const parentCatid = up[2] ? parseInt(up[1]) : 0;
            if (!name) { const t = document.querySelector('title'); if (t) name = t.textContent.split('|')[0].trim(); }
            addCat(catid, name, parentCatid, pgUrl);

          }
          // 2. Cari elemen dengan data attribute kategori
          document.querySelectorAll('[data-catid], [data-category-id], [data-cateid]').forEach(el => {
            const c = el.getAttribute('data-catid') || el.getAttribute('data-category-id') || el.getAttribute('data-cateid');
            if (c && c.match(/^\d+$/)) addCat(c, el.textContent || el.title || '', 0, null);
          });

          // 3. Cari link dengan pola category
          document.querySelectorAll('a[href*="cat."], a[href*="cat/"], a[href*="?cat="]').forEach(a => {
            const h = a.getAttribute('href') || '';
            const m = h.match(/-cat\.(\d+)(?:\.(\d+))?|cat[=/](\d+)/);
            if (m) addCat(m[1] || m[3], a.textContent, m[2] || 0, h.startsWith('http') ? h : 'https://shopee.co.id' + h);
          });

          return cats;
        };
        // Try API first, then DOM
        return tryApi().catch(() => tryDom());
      },
    });
    if (execResult?.result?.length > 0) {
      console.log('[Avalon] tryFetchViaTab: inject got', execResult.result.length, 'categories');
      return execResult.result;
    }
  } catch {
    console.log('[Avalon] tryFetchViaTab: inject also failed');
  }
  return null;

}
function normalizeCategories(body) {
  const rawList = body?.data?.category_list || body?.data?.category_tree || body?.category_tree || body?.data?.categories || body?.categories || body?.data || [];
  if (!Array.isArray(rawList)) return null;
  return rawList
    .filter(c => (c.level || 0) >= 1)
    .map(c => ({
      catid: c.catid,
      name: c.display_name || c.name,
      parent_catid: c.parent_catid || 0,
      level: c.level || 1,
      no_sub: c.no_sub === true,
      url: c.url || null,
    }));
}


// Simpan kategori ke Supabase (upsert by catid)
async function saveCategoriesToSupabase(categories) {
  if (!Array.isArray(categories) || categories.length === 0) return;
  const now = new Date().toISOString();
  const batchSize = 200;
  let saved = 0;
  for (let i = 0; i < categories.length; i += batchSize) {
    const batch = categories.slice(i, i + batchSize).map(c => ({
      catid: c.catid,
      name: c.name,
      parent_catid: c.parent_catid || 0,
      level: c.level || 1,
      no_sub: c.no_sub || false,
      url: c.url || null,
      fetched_at: now,
    }));
    try {
      const res = await fetch(SUPABASE_CATEGORY_CACHE_ENDPOINT, {
        method: 'POST',
        headers: {
          ...supabaseHeaders(),
          'Prefer': 'resolution=merge-duplicates',
        },
        body: JSON.stringify(batch),
      });
      if (res.ok) saved += batch.length;
    } catch (e) {
      console.warn('[Avalon] Failed to save categories batch:', e.message);
    }
  }
  console.log('[Avalon] Saved', saved, 'categories to shopee_category_cache');
}

// ====================== DISCOVER SUB CATEGORIES ======================

// Crawl setiap top-level category untuk kumpulin subkategori
// Pakai tab terpisah (hidden) biar gak ganggu tab user
async function discoverSubCategories(callback) {
  const categories = await fetchShopeeCategories();
  const topLevel = categories.filter(c => c.parent_catid === 0);
  if (topLevel.length === 0) throw new Error('Tidak ada top-level category');

  const allCats = new Map();
  categories.forEach(c => allCats.set(c.catid, c));

  // Buat hidden tab untuk crawling
  const existingTabs = await chrome.tabs.query({ url: ['*://shopee.co.id/*', '*://*.shopee.co.id/*', '*://shopee.co.th/*', '*://*.shopee.co.th/*'] });
  const existingDomain = existingTabs.length > 0 ? (() => {
    try { return new URL(existingTabs[0].url).hostname.replace('shopee.', ''); } catch { return 'co.id'; }
  })() : 'co.id';
  const tab = await chrome.tabs.create({ url: `https://shopee.${existingDomain}/`, active: false });

  let processed = 0;
  const total = topLevel.length;

  for (const cat of topLevel) {
    processed++;
    const catUrl = cat.url || `https://shopee.${existingDomain}/search?facet=${cat.catid}`;
    callback({ status: 'processing', current: processed, total, name: cat.name });

    try {
      await navigateTab(tab.id, catUrl);
      await delay(3000);

      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const cats = [];
          const seen = new Set();
          function add(id, name, pid, url) {
            if (!id || seen.has(id)) return;
            seen.add(id);
            cats.push({ catid: parseInt(id), name: (name || '').trim(), parent_catid: parseInt(pid || 0), level: 1, no_sub: false, url: url || null });
          }
          // Dari URL halaman
          const pu = window.location.href;
          const up = pu.match(/-cat\.(\d+)(?:\.(\d+))?/);
          if (up) add(up[2] || up[1], document.title ? document.title.split('|')[0].trim() : '', up[2] ? up[1] : 0, pu);
          // Dari link kategori
          document.querySelectorAll('a[href*="-cat."], a[href*="cat/"], a[href*="?cat="]').forEach(a => {
            const h = a.getAttribute('href') || '';
            const m = h.match(/-cat\.(\d+)(?:\.(\d+))?|cat[=/](\d+)/);
            if (m) add(m[1] || m[3], a.textContent, m[2] || 0, h.startsWith('http') ? h : 'https://shopee.co.id' + h);
          });
          // Dari data attributes
          document.querySelectorAll('[data-catid], [data-category-id], [data-cateid]').forEach(el => {
            const c = el.getAttribute('data-catid') || el.getAttribute('data-category-id') || el.getAttribute('data-cateid');
            if (c && c.match(/^\d+$/)) add(c, el.textContent || el.title || '', 0, null);
          });
          return cats;
        }
      });

      if (result?.result) {
        for (const c of result.result) {
          if (!allCats.has(c.catid)) allCats.set(c.catid, c);
        }
      }
    } catch (e) {
      console.warn('[Avalon] Failed to crawl', cat.name, ':', e.message);
    }
  }

  // Tutup tab crawling
  chrome.tabs.remove(tab.id).catch(() => {});

  const merged = Array.from(allCats.values());
  await saveCategoriesToSupabase(merged);
  return merged;
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getCategoryUrls() {
  const tabs = await chrome.tabs.query({ url: ['*://shopee.*/*'] });
  for (const tab of tabs) {
    try {
      const domain = new URL(tab.url).hostname;
      if (domain.includes('shopee.')) {
        return [`https://${domain}/api/v4/pages/get_category_tree`];
      }
    } catch {}
  }
  return ['https://shopee.co.id/api/v4/pages/get_category_tree'];
}

async function navigateTab(tabId, url) {
  return new Promise((resolve, reject) => {
    const onUpdated = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(onUpdated);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.update(tabId, { url });
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      reject(new Error('timeout'));
    }, 15000);
  });
}
// Bangun URL berdasarkan mode: facet (dengan filter & sort) atau keyword biasa + pagination.
// Bangun URL berdasarkan mode: facet (dengan filter & sort) atau keyword biasa + pagination.
function buildSearchUrl(task, page) {
  if (page === undefined || page < 1) page = 1;
  const shopeePage = page - 1; // 0-indexed untuk URL
  const domain = task.domain || 'co.id';
  const base = 'https://shopee.' + domain;

  if (task.facet_id) {
    let url = base + '/search?facet=' + task.facet_id + '&noCorrection=true';
    if (task.price_min) url += '&price_min=' + task.price_min;
    if (task.price_max) url += '&price_max=' + task.price_max;
    if (task.sort_by) url += '&sortBy=' + task.sort_by;
    if (shopeePage > 0) url += '&page=' + shopeePage;
    return url;
  }

  const keyword = encodeURIComponent(task.keyword || '');
  let url = base + '/search?keyword=' + keyword;
  if (shopeePage > 0) url += '&page=' + shopeePage;
  return url;
}
// ====================== START HARVESTING ======================
async function startHarvestingFromSupabase(retryCount = 0) {
  if (retryCount > 10) {
    console.log("[Avalon] Too many skips, stopping harvester");
    chrome.storage.local.set({ isAutoSweep: false });
    return;
  }

  if (currentTask) {
    console.log("Already harvesting a keyword");
    return;
  }

  const { harvester_username } = await chrome.storage.local.get(["harvester_username"]);
  if (!harvester_username) {
    console.log("[Avalon] Harvester username not set");
    chrome.storage.local.set({ isAutoSweep: false });
    return;
  }

  const keywordData = await claimNextKeyword(harvester_username);
  if (!keywordData) {
    console.log("[Avalon] No pending keywords found");
    chrome.storage.local.set({ isAutoSweep: false });
    return;
  }

  if (!keywordData.keyword && !keywordData.facet_id) {
    console.log(`[Avalon] Skipping keywordData.id=${keywordData.id} — no keyword or facet_id`);
    completedKeywordIds.add(keywordData.id);
    await chrome.storage.local.set({ [`_done_${keywordData.id}`]: true });
    await updateKeywordStatus(keywordData.id, "done");
    return startHarvestingFromSupabase(retryCount + 1);
  }

  if (completedKeywordIds.has(keywordData.id)) {
    console.log(`[Avalon] Skipping "${keywordData.keyword}" — already completed in this session`);
    return startHarvestingFromSupabase(retryCount + 1);
  }

  const storageFlag = await new Promise(resolve =>
    chrome.storage.local.get([`_done_${keywordData.id}`], resolve)
  );
  if (storageFlag[`_done_${keywordData.id}`]) {
    console.log(`[Avalon] Skipping "${keywordData.keyword}" — already completed (storage flag)`);
    completedKeywordIds.add(keywordData.id);
    return startHarvestingFromSupabase(retryCount + 1);
  }

  currentTask = keywordData;
  currentProductCount = 0;
  await persistProductCount();

  const searchUrl = buildSearchUrl(keywordData, 1);

  const tabs = await chrome.tabs.query({ url: ['*://shopee.co.id/*', '*://*.shopee.co.id/*'] });

  if (tabs.length > 0) {
    await chrome.tabs.update(tabs[0].id, { url: searchUrl });
    const modeLabel = keywordData.facet_id ? `facet#${keywordData.facet_id}` : keywordData.keyword;
    console.log(`[Avalon] Updated existing tab with: ${modeLabel}`);
  } else {
    await chrome.tabs.create({ url: searchUrl });
    const modeLabel = keywordData.facet_id ? `facet#${keywordData.facet_id}` : keywordData.keyword;
    console.log(`[Avalon] Created new tab for: ${modeLabel}`);
  }

  chrome.storage.local.set({
    keyword: keywordData.keyword,
    project_id: keywordData.project_id,
    category_group: keywordData.category_group,
    currentKeywordId: keywordData.id,
    currentPage: 1,
    maxPages: keywordData.max_pages || 12,
    isAutoSweep: true,
    harvester_username: harvester_username,
    facet_id: keywordData.facet_id || null,
    price_min: keywordData.price_min || null,
    price_max: keywordData.price_max || null,
    sort_by: keywordData.sort_by || 'ctime',
    scenario: keywordData.scenario || 'PAGE_OTHERS',
  });

  const modeLabel = keywordData.facet_id
    ? `facet#${keywordData.facet_id} "${keywordData.keyword}"`
    : `"${keywordData.keyword}"`;
  console.log(`[Avalon] Starting harvest: ${modeLabel} by ${harvester_username}`);
}

// =========================================================================
// MESSAGE HANDLERS — komunikasi dengan popup.js & content.js
// =========================================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  // -----------------------------------------------------------------------
  // START_SWEEP — mulai auto harvest dari popup
  // -----------------------------------------------------------------------
  if (message.action === "START_SWEEP") {
    if (message.keyword) {
      chrome.storage.local.set({
        keyword: message.keyword,
        project_id: message.project_id || "PRJ-UNASSIGNED",
        category_group: message.category_group || "General",
        isAutoSweep: true,
        currentPage: 1,
        maxPages: 12,
        facet_id: null,
        price_min: null,
        price_max: null,
        sort_by: 'ctime',
        scenario: 'PAGE_OTHERS',
      });
    } else {
      startHarvestingFromSupabase();
    }
    sendResponse({ status: "started" });
    return true;
  }

  // -----------------------------------------------------------------------
  // STOP_SWEEP — hentikan auto harvest
  // -----------------------------------------------------------------------
  if (message.action === "STOP_SWEEP") {
    currentTask = null;
    chrome.storage.local.set({
      isAutoSweep: false,
      currentTask: null,
      currentKeywordId: null,
      facet_id: null,
      price_min: null,
      price_max: null,
      sort_by: null,
      scenario: null,
      harvester_username: null,
      category_group: null,
    });
    sendResponse({ status: "stopped" });
    return true;
  }

  // -----------------------------------------------------------------------
  // KEYWORD_FINISHED — content.js selesai scraping semua halaman
  // -----------------------------------------------------------------------
  if (message.action === "KEYWORD_FINISHED") {
    return (async () => {
      let taskId, taskName, taskFacet;
      if (currentTask) {
        taskId = currentTask.id;
        taskName = currentTask.keyword;
        taskFacet = currentTask.facet_id;
      } else {
        const stored = await chrome.storage.local.get(["currentKeywordId", "keyword", "facet_id"]);
        taskId = stored.currentKeywordId;
        taskName = stored.keyword || "unknown";
        taskFacet = stored.facet_id;
      }
      const label = taskFacet ? `facet#${taskFacet} "${taskName}"` : `"${taskName}"`;
      if (taskId) {
        if (message.completed) {
          completedKeywordIds.add(taskId);
          await chrome.storage.local.set({ [`_done_${taskId}`]: true });
          await updateKeywordStatus(taskId, "done");
          console.log(`[Avalon] ${label} selesai (${message.currentPage}/${message.maxPages}), status -> done`);
          currentTask = null;
          await chrome.storage.local.remove(["currentKeywordId", "currentPage", "facet_id", "price_min", "price_max", "sort_by", "scenario"]);
          setTimeout(startHarvestingFromSupabase, 3000);
        } else {
          console.log(`[Avalon] ${label} tidak selesai (${message.currentPage}/${message.maxPages}), status tetap pending`);
          currentTask = null;
          await chrome.storage.local.remove(["currentKeywordId", "currentPage", "facet_id", "price_min", "price_max", "sort_by", "scenario"]);
        }
      } else {
        setTimeout(startHarvestingFromSupabase, 3000);
      }
    })();
  }

  // -----------------------------------------------------------------------
  // FETCH_CATEGORIES — ambil tree kategori dari Shopee API
  // -----------------------------------------------------------------------
  if (message.action === "FETCH_CATEGORIES") {
    fetchShopeeCategories()
      .then(cats => sendResponse({ success: true, categories: cats }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  // -----------------------------------------------------------------------
  // GET_STATUS — polling status dari popup (setiap 3 detik)
  // -----------------------------------------------------------------------
  if (message.action === "GET_STATUS") {
    chrome.storage.local.get(
      ["keyword", "facet_id", "currentPage", "maxPages", "scenario", "isAutoSweep", "circuitBreakerUntil"],
      (stored) => {
        const cb = AntiDetection.circuitBreaker;
        const until = stored.circuitBreakerUntil || 0;
        const remainingMs = until > Date.now() ? until - Date.now() : 0;
        sendResponse({
          isActive: stored.isAutoSweep || false,
          keyword: stored.keyword || null,

          facet_id: stored.facet_id || null,
          scenario: stored.scenario || "PAGE_OTHERS",
          currentPage: stored.currentPage ?? null,
          maxPages: stored.maxPages ?? null,
          productCount: currentProductCount,
          circuitBreaker: {
            isOpen: cb.isOpen || remainingMs > 0,
            failureCount: cb.failureCount,
            threshold: cb.threshold,
            remainingMinutes: Math.ceil(remainingMs / 1000 / 60),
          },
        });
      },
    );
    return true;
  }


  // -----------------------------------------------------------------------
  // DISCOVER_SUB_CATEGORIES — crawl semua subkategori
  // -----------------------------------------------------------------------
  if (message.action === "DISCOVER_SUB_CATEGORIES") {
    discoverSubCategories((progress) => {
      chrome.storage.local.set({ discoverProgress: progress });
    })
      .then(cats => sendResponse({ success: true, count: cats.length }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
  // -----------------------------------------------------------------------
  // CREATE_FACET_TASK - buat task baru dari kategori (via popup)
  // -----------------------------------------------------------------------
  if (message.action === "CREATE_FACET_TASK") {
    (async () => {
      try {
        const payload = {
          keyword: message.keyword || `Facet ${message.facet_id}`,
          facet_id: message.facet_id || null,
          scenario: message.scenario || "PAGE_CATEGORY",
          sort_by: message.sort_by || "ctime",
          status: "pending",
          priority: 5,
          max_pages: message.max_pages || 12,
          project_id: message.project_id || "PRJ-UNASSIGNED",
          category_group: message.category_group || "CategoryDiscovery",
        };
        const res = await fetch(SUPABASE_KEYWORDS_ENDPOINT, {
          method: "POST",
          headers: {
            ...supabaseHeaders(),
            Prefer: "return=representation",
          },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          sendResponse({ success: false, error: `HTTP ${res.status}: ${errText}` });
          return;
        }
        const created = await res.json();
        console.log(`[Avalon] Facet task created: "${payload.keyword}" (facet_id=${payload.facet_id}, id=${created[0]?.id})`);
        sendResponse({ success: true, task: created[0] || null });
      } catch (err) {
        console.error("[Avalon] Error creating facet task:", err);
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
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
  // -----------------------------------------------------------------------
  // STORE_HARVESTED_DATA — batch insert produk ke Supabase
  // -----------------------------------------------------------------------
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

      let discountPercentage =
        product.discount_percentage != null
          ? product.discount_percentage
          : null;
      if (discountPercentage == null && product.discount) {
        const cleaned = String(product.discount).replace("%", "").trim();
        const num = parseFloat(cleaned);
        if (!isNaN(num)) discountPercentage = num;
      }

      return {
        item_id: itemId,
        product_name: product.name || "Unknown Product",
        name_raw: product.name_raw || null,
        brand: product.brand || null,
        model: product.model || null,
        price: product.price || 0,
        original_price: product.original_price || null,
        price_min: product.price_min || null,
        price_max: product.price_max || null,
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
        product_url:
          product.product_url ||
          `https://shopee.co.id/product/${shopId}/${itemId}`,
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
      currentProductCount += savedCount;
      await persistProductCount();
      sendResponse({ status: "success", total_saved: savedCount, total_errors: errorCount });
    };

    processBatches();
    return true;
  // -----------------------------------------------------------------------
  // STORE_SHOP_DATA — simpan info toko ke Supabase
  // -----------------------------------------------------------------------
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

