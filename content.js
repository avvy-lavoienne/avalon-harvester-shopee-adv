// Inject inject.js
const script = document.createElement('script');
script.src = chrome.runtime.getURL('inject.js');
script.onload = () => script.remove();
(document.head || document.documentElement).appendChild(script);

// Inject content.css
const link = document.createElement('link');
link.rel = 'stylesheet';
link.href = chrome.runtime.getURL('content.css');
document.head.appendChild(link);

// Create status overlay
const overlay = document.createElement('div');
overlay.className = 'avalon-overlay';
overlay.innerHTML = `
  <div class="avalon-modal">
    <h3>Avalon Harvester</h3>
    <p id="statusMessage">Initializing...</p>
    <button class="avalon-btn" id="hideOverlay">Hide</button>
  </div>
`;
document.body.appendChild(overlay);

const statusMessage = overlay.querySelector('#statusMessage');
const hideBtn = overlay.querySelector('#hideOverlay');

hideBtn.addEventListener('click', () => {
  overlay.style.display = 'none';
});

const updateStatus = (message) => {
  statusMessage.textContent = message;
  overlay.style.display = 'flex';
  console.log('[Avalon Harvester]', message);
};

// Ambil data keyword, project_id, dan category_group secara bersamaan
let currentKeyword = '';
let currentProjectId = 'DEFAULT_PROJ';
let currentCategoryGroup = 'General';

chrome.storage.local.get(['keyword', 'project_id', 'category_group'], (result) => {
  currentKeyword = result.keyword || '';
  currentProjectId = result.project_id || 'PRJ-UNASSIGNED';
  currentCategoryGroup = result.category_group || 'General';
  console.log(`[Avalon Harvester] Active Project: ${currentProjectId} | Category: ${currentCategoryGroup}`);
});

// Listen for keyword changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.keyword) {
    currentKeyword = changes.keyword.newValue || '';
  }
});

// Anti-detection random delay
const randomDelay = (min, max) => {
  const variance = Math.random();
  if (variance < 0.1) return Math.floor(Math.random() * (max * 1.8 - max * 1.2 + 1)) + max * 1.2;
  if (variance < 0.2) return Math.floor(Math.random() * (min * 0.8 - min * 0.5 + 1)) + min * 0.5;
  return Math.floor(Math.random() * (Math.min(8000, max * 0.6) - Math.max(3000, min * 0.6) + 1)) + Math.max(3000, min * 0.6);
};

document.addEventListener('Avalon_Harvest_Data', (event) => {
  console.log('[Avalon Harvester] Content.js received harvest event:', event.detail);
  const products = event.detail.products || [];
  updateStatus(`Harvested ${products.length} products with full data`);
  console.log('[Avalon Harvester] Sending harvested products to background:', products.length, 'with query:', currentKeyword);
  chrome.runtime.sendMessage({
    action: 'STORE_HARVESTED_DATA',
    products: products,
    search_query: currentKeyword,
    project_id: currentProjectId,
    category_group: currentCategoryGroup,
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('[Avalon Harvester] Error sending message to background:', chrome.runtime.lastError);
    } else {
      console.log('[Avalon Harvester] Background response:', response);
    }
  });
});

document.addEventListener('Avalon_Shop_Data', (event) => {
  const shops = event.detail.shops || [];
  console.log('[Avalon Harvester] Content.js received shop data:', shops.length);
  chrome.runtime.sendMessage({
    action: 'STORE_SHOP_DATA',
    shops: shops,
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('[Avalon Harvester] Error sending shop data to background:', chrome.runtime.lastError);
    }
  });
});

// Sweeper loop
let isSweeping = false;
let pageCount = 0;

const startSweep = async () => {
  if (isSweeping) return;
  isSweeping = true;
  pageCount = 0;
  updateStatus("Starting auto-sweep...");

  while (isSweeping) {
    pageCount++;
    updateStatus(`Processing page ${pageCount} - Scrolling to load content...`);

    // 1. Acak jumlah total guliran per halaman (antara 4 sampai 7 kali gulir)
    const totalScrolls = Math.floor(Math.random() * 4) + 4;
    console.log(
      `[Avalon Harvester] Memulai pengguliran dinamis sebanyak: ${totalScrolls} kali`,
    );

    for (let i = 0; i < totalScrolls; i++) {
      // 2. Acak jarak gulir (700px - 1000px)
      let scrollAmount = 700 + Math.random() * 300;

      // 3. Taktik Siluman: Sekali-kali (probabilitas 15%), paksa manusia virtual
      // untuk gulir balik ke ATAS sedikit (micro-backscroll 150px-250px) seolah sedang membaca ulang
      if (Math.random() < 0.15 && i > 0) {
        window.scrollBy({
          top: -150 - Math.random() * 100,
          behavior: "smooth",
        });
        console.log(
          "[Avalon Harvester] Anti-Detection: Memicu micro-backscroll (membaca ulang)",
        );
        await new Promise((resolve) =>
          setTimeout(resolve, randomDelay(1000, 2000)),
        );
      }

      const scrollBehavior = Math.random() > 0.4 ? "smooth" : "auto";
      window.scrollBy({ top: scrollAmount, behavior: scrollBehavior });

      updateStatus(
        `Processing page ${pageCount} - Scroll ${i + 1}/${totalScrolls}`,
      );

      // 4. Berikan jeda antar-gulir yang bervariasi sesuai fungsi randomDelay-mu
      await new Promise((resolve) =>
        setTimeout(resolve, randomDelay(1500, 2500)),
      );
    }

    updateStatus(
      `Processing page ${pageCount} - Waiting for data interception...`,
    );
    // Wait for inject.js
    await new Promise((resolve) =>
      setTimeout(resolve, randomDelay(3000, 5000)),
    );

    updateStatus(`Processing page ${pageCount} - Mencari tombol Next...`);

    // Fungsi cerdas untuk menemukan tombol Next apa pun class-nya
    const findNextButton = () => {
      // Prioritas 1: Paginasi mini di atas
      let btn = document.querySelector(
        ".shopee-mini-page-controller__next-btn",
      );
      if (btn && !btn.disabled && !btn.className.includes("disabled")) {
        console.log("[Avalon Harvester] Found next button via mini controller");
        return btn;
      }

      // Prioritas 2: Paginasi utama di bawah
      btn = document.querySelector(
        ".shopee-page-controller .shopee-icon-button--right",
      );
      if (btn && !btn.disabled) {
        console.log("[Avalon Harvester] Found next button via main controller");
        return btn;
      }

      // Prioritas 3: Cari tombol apa saja yang punya SVG panah ke kanan
      const svgs = document.querySelectorAll(
        "svg.icon-arrow-right-bold, svg.icon-arrow-right",
      );
      for (let svg of svgs) {
        const b = svg.closest("button");
        if (b && !b.disabled && !b.className.includes("disabled")) {
          console.log("[Avalon Harvester] Found next button via SVG arrow");
          return b;
        }
      }
      console.log("[Avalon Harvester] No next button found");
      return null;
    };

    const nextBtn = findNextButton();

    if (!nextBtn) {
      updateStatus(
        `Auto-sweep completed - Tidak ada halaman lagi (${pageCount} halaman diproses)`,
      );
      chrome.storage.local.set({ isAutoSweep: false });
      break;
    }

    updateStatus(
      `Processing page ${pageCount} - Meluncur ke halaman berikutnya...`,
    );

    // Simulasi klik yang lebih realistis dengan dispatchEvent
    try {
      const clickEvent = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        view: window,
      });

      // Ambil data total link sebelum klik untuk pembanding
      const totalUrlsBeforeClick = document.querySelectorAll(
        'a[href*="/product/"]',
      ).length;

      nextBtn.dispatchEvent(clickEvent);

      // Berikan waktu render konten halaman baru
      await new Promise((resolve) =>
        setTimeout(resolve, randomDelay(4000, 6000)),
      );

      console.log(
        "[Avalon Harvester] Successfully triggered next page navigation",
      );
    } catch (error) {
      console.error("[Avalon Harvester] Gagal navigasi:", error);
      updateStatus("Error: Tidak dapat meluncur ke halaman berikutnya");
      chrome.storage.local.set({ isAutoSweep: false });
      break;
    }
  }

  isSweeping = false;
};

const stopSweep = () => {
  isSweeping = false;
  // Jangan timpa pesan jika berhentinya karena selesai natural
  if (
    !statusMessage.textContent.includes("completed") &&
    !statusMessage.textContent.includes("selesai")
  ) {
    updateStatus("Auto-sweep dihentikan oleh user");
  }
};

// Listen to storage changes
chrome.storage.onChanged.addListener((changes) => {
  if (changes.isAutoSweep) {
    if (changes.isAutoSweep.newValue) {
      startSweep();
    } else {
      stopSweep();
    }
  }
});

// Check initial state
chrome.storage.local.get('isAutoSweep', (result) => {
  if (result.isAutoSweep) {
    startSweep();
  }
});