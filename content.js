// ==================== CSS INJECTION ====================
const link = document.createElement("link");
link.rel = "stylesheet";
link.href = chrome.runtime.getURL("content.css");
document.head.appendChild(link);

// ==================== OVERLAY UI ====================
const overlay = document.createElement("div");
overlay.className = "avalon-overlay";
overlay.innerHTML = `
  <div class="avalon-modal">
    <h3>Avalon Harvester</h3>
    <p id="statusMessage">Initializing...</p>
    <button class="avalon-btn" id="hideOverlay">Hide</button>
  </div>
`;

function appendOverlay() {
  if (document.body) {
    document.body.appendChild(overlay);
  } else {
    document.addEventListener("DOMContentLoaded", () => {
      document.body.appendChild(overlay);
    });
  }
}
appendOverlay();

const statusMessage = overlay.querySelector("#statusMessage");
const hideBtn = overlay.querySelector("#hideOverlay");

hideBtn.addEventListener("click", () => {
  overlay.style.display = "none";
});

const updateStatus = (message) => {
  statusMessage.textContent = message;
  overlay.style.display = "flex";
  console.log("[Avalon Harvester]", message);
};

// ==================== STATE ====================
let currentKeyword = "";
let currentProjectId = "DEFAULT_PROJ";
let currentCategoryGroup = "General";
let currentScenario = "PAGE_OTHERS";
let currentFacetId = null;
let isSweeping = false;
let currentPage = 0;
let maxPages = 12;

function getModeLabel() {
  return currentFacetId ? `Facet#${currentFacetId}` : currentKeyword || "-";
}

// Ambil data dari storage
chrome.storage.local.get(
  ["keyword", "project_id", "category_group", "facet_id", "scenario"],
  (result) => {
    currentKeyword = result.keyword || "";
    currentProjectId = result.project_id || "PRJ-UNASSIGNED";
    currentCategoryGroup = result.category_group || "General";
    currentFacetId = result.facet_id || null;
    currentScenario = result.scenario || "PAGE_OTHERS";
  },
);

// ==================== ANTI DETECTION DELAY ====================
const randomDelay = (min, max) => {
  const variance = Math.random();
  let result;
  if (variance < 0.1)
    result = Math.floor(Math.random() * (max * 1.8 - max * 1.2 + 1)) + max * 1.2;
  else if (variance < 0.2)
    result = Math.floor(Math.random() * (min * 0.8 - min * 0.5 + 1)) + min * 0.5;
  else
    result = Math.floor(
      Math.random() *
        (Math.min(8000, max * 0.6) - Math.max(3000, min * 0.6) + 1),
    ) + Math.max(3000, min * 0.6);
  return Math.max(500, Math.floor(result));
};

// ==================== SHOP DATA LISTENER ====================
document.addEventListener("Avalon_Shop_Data", (event) => {
  const shops = event.detail.shops || [];
  chrome.runtime.sendMessage({
    action: "STORE_SHOP_DATA",
    shops: shops,
  });
});

// ==================== HARVEST DATA LISTENER ====================
document.addEventListener("Avalon_Harvest_Data", (event) => {
  const products = event.detail.products || [];
  updateStatus(`Harvested ${products.length} products`);
  chrome.runtime.sendMessage({
    action: "STORE_HARVESTED_DATA",
    products: products,
    search_query: currentKeyword,
    project_id: currentProjectId,
    category_group: currentCategoryGroup,
    scenario: currentScenario,
    facet_id: currentFacetId,
  });
});

// ==================== AUTO SWEEP (Improved) ====================
const startSweep = async () => {
  if (isSweeping) return;
  isSweeping = true;

  const urlParams = new URLSearchParams(location.search);
  const urlPage = parseInt(urlParams.get("page"), 10);
  currentPage = (urlPage && !isNaN(urlPage)) ? urlPage : 0;

  const storage = await new Promise((resolve) =>
    chrome.storage.local.get(["maxPages"], resolve)
  );
  maxPages = storage.maxPages || 12;

  while (isSweeping && currentPage < maxPages) {
    currentPage++;
    updateStatus(`[${getModeLabel()}] Page ${currentPage}/${maxPages}...`);

    const totalScrolls = Math.floor(Math.random() * 4) + 4;
    for (let i = 0; i < totalScrolls; i++) {
      if (!isSweeping) break;

      if (Math.random() < 0.15 && i > 0) {
        window.scrollBy({
          top: -150 - Math.random() * 100,
          behavior: "smooth",
        });
        await new Promise((r) => setTimeout(r, randomDelay(1000, 2000)));
      }

      const scrollAmount = 700 + Math.random() * 300;
      window.scrollBy({
        top: scrollAmount,
        behavior: Math.random() > 0.4 ? "smooth" : "auto",
      });
      await new Promise((r) => setTimeout(r, randomDelay(1500, 2500)));
    }

    if (!isSweeping) break;

    const findNextButton = () => {
      let btn = document.querySelector(
        ".shopee-mini-page-controller__next-btn",
      );
      if (btn && !btn.disabled) return btn;

      btn = document.querySelector(
        ".shopee-page-controller .shopee-icon-button--right",
      );
      if (btn && !btn.disabled) return btn;

      const svgs = document.querySelectorAll(
        "svg.icon-arrow-right-bold, svg.icon-arrow-right",
      );
      for (let svg of svgs) {
        const b = svg.closest("button");
        if (b && !b.disabled) return b;
      }
      return null;
    };

    const nextBtn = findNextButton();

    if (!nextBtn || currentPage >= maxPages) {
      const completed = currentPage >= maxPages;
      updateStatus(
        completed
          ? `[${getModeLabel()}] Selesai. ${currentPage} halaman tercapai.`
          : `[${getModeLabel()}] Terhenti. Hanya ${currentPage}/${maxPages} halaman (tanpa tombol next).`
      );
      chrome.storage.local.set({ isAutoSweep: false });
      chrome.runtime.sendMessage({ action: "KEYWORD_FINISHED", completed, currentPage, maxPages });
      isSweeping = false;
      return;
    }

    nextBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await new Promise((r) => setTimeout(r, randomDelay(4000, 6000)));
  }

  isSweeping = false;
};

const stopSweep = () => {
  isSweeping = false;
  chrome.storage.local.set({ isAutoSweep: false });
  chrome.runtime.sendMessage({ action: "KEYWORD_FINISHED", completed: false, currentPage, maxPages });
  updateStatus("Harvester dihentikan.");
};

// ==================== STORAGE LISTENER ====================
chrome.storage.onChanged.addListener((changes) => {
  if (changes.keyword) {
    currentKeyword = changes.keyword.newValue || "";
  }
  if (changes.facet_id) {
    currentFacetId = changes.facet_id.newValue || null;
  }
  if (changes.scenario) {
    currentScenario = changes.scenario.newValue || "PAGE_OTHERS";
  }
  if (changes.isAutoSweep) {
    if (changes.isAutoSweep.newValue === true) {
      startSweep();
    } else {
      stopSweep();
    }
  }
});

// Check initial state
chrome.storage.local.get("isAutoSweep", (result) => {
  if (result.isAutoSweep) {
    startSweep();
  }
});

// ==================== CATEGORY FETCH (via page context) ====================
// Ekstrak kategori dari DOM halaman Shopee — fallback kalau API 403
function extractCategoriesFromDom() {
  const cats = [];
  const seen = new Set();

  // Helper: tambah kategori
  function addCat(catid, name, parentCatid, url) {
    if (!catid || seen.has(catid)) return;
    seen.add(catid);
    cats.push({
      catid: parseInt(catid),
      name: (name || 'Category ' + catid).trim().replace(/\s+/g, ' '),
      parent_catid: parseInt(parentCatid || 0),
      level: 1,
      no_sub: false,
      url: url || null,
    });
  }

  // Strategy 1: extract dari URL halaman saat ini
  // Format: /Laptop-cat.11044364.11044440 atau /cat.11044364
  const pageUrl = window.location.href;
  const urlParts = pageUrl.match(/-cat\.(\d+)(?:\.(\d+))?/);
  if (urlParts) {
    const catid = urlParts[2] ? parseInt(urlParts[2], 10) : parseInt(urlParts[1], 10);
    const parentCatid = urlParts[2] ? parseInt(urlParts[1], 10) : 0;
    const nameMatch = pageUrl.match(/\/([^/]+?)-cat\./);
    let name = nameMatch ? decodeURIComponent(nameMatch[1].replace(/-/g, ' ')) : '';
    if (!name) {
      const titleEl = document.querySelector('title');
      if (titleEl) name = titleEl.textContent.split('|')[0].trim();
    }
    addCat(catid, name, parentCatid, pageUrl);
    // Also add parent category from URL pattern (H5)
    if (urlParts[2] && parentCatid) {
      addCat(parentCatid, '', 0, null);
    }
  }

  // Strategy 2: cari semua elemen yang punya data attribute kategori
  document.querySelectorAll('[data-catid], [data-category-id], [data-cateid]').forEach(el => {
    const catid = el.getAttribute('data-catid') || el.getAttribute('data-category-id') || el.getAttribute('data-cateid');
    if (!catid || !catid.match(/^\d+$/)) return;
    addCat(catid, el.textContent || el.getAttribute('title') || '', 0, null);
  });

  // Strategy 3: cari link dengan pattern category di href
  document.querySelectorAll('a[href*="cat."], a[href*="cat/"], a[href*="?cat="]').forEach(a => {
    const href = a.getAttribute('href') || '';
    const m = href.match(/-cat\.(\d+)(?:\.(\d+))?|cat[=/](\d+)/);
    if (!m) return;
    const catid = m[1] || m[3];
    const parentCatid = m[2] || 0;
    addCat(catid, a.textContent, parentCatid, href.startsWith('http') ? href : 'https://shopee.co.id' + href);
  });

  return cats;
}

// Poll window.__avalon_categories__ dengan retry (max 4.5 detik)
// Baca csrf token dari cookie biar Shopee API gak nolak
function getCsrfToken() {
  const m = document.cookie.match(/(?:^|;\\s*)csrftoken=([^;]+)/);
  return m ? m[1] : '';
}

async function pollCategories(attempt) {
  try {
    const cats = window.__avalon_categories__;
    if (Array.isArray(cats) && cats.length > 5) return cats;
  } catch (e) {}
  if (attempt >= 15) return null;
  await new Promise(r => setTimeout(r, 300));
  return pollCategories(attempt + 1);
}
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "FETCH_CATEGORIES_FROM_PAGE") {
    // Strategy 0: Poll window.__avalon_categories__ (di-populate inject.js dalam 1-5 detik)
    pollCategories(0).then(cats => {
      if (cats) {
        sendResponse({ success: true, categories: cats });
        return;
      }

      // Strategy 1: API dengan CSRF token
      const csrf = getCsrfToken();
      return fetch('https://shopee.co.id/api/v4/pages/get_category_tree', {
        headers: {
          'Accept': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
          'x-api-source': 'pc',
          'x-shopee-language': 'id',
          ...(csrf ? { 'x-csrftoken': csrf } : {}),
        },
      })
        .then(r => {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        })
        .then(body => {
          const rawList = body?.data?.category_tree || body?.data?.category_list || body?.category_tree || body?.data?.categories || body?.categories || body?.data || [];
          const categories = Array.isArray(rawList)
            ? rawList.filter(c => (c.level || 0) >= 1).map(c => ({
                catid: c.catid,
                name: c.display_name || c.cat_name || c.brief_name || c.simple_name || c.name || "",
                parent_catid: c.parent_catid || 0,
                level: c.level || 1,
                no_sub: c.no_sub === true,
                url: c.url || null,
              }))
            : [];
          if (categories.length > 0) {
            sendResponse({ success: true, categories });
          } else {
            const domCats = extractCategoriesFromDom();
            sendResponse({ success: true, categories: domCats });
          }
        })
        .catch(() => {
          const domCats = extractCategoriesFromDom();
          sendResponse({ success: true, categories: domCats });
        });
    });
    return true;
  }
});

