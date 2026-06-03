// ==================== INJECT INJECT.JS & CSS ====================
const script = document.createElement("script");
script.src = chrome.runtime.getURL("inject.js");
script.onload = () => script.remove();
(document.head || document.documentElement).appendChild(script);

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
document.body.appendChild(overlay);

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
let isSweeping = false;
let currentPage = 0;
let maxPages = 12;

// Ambil data dari storage
chrome.storage.local.get(
  ["keyword", "project_id", "category_group"],
  (result) => {
    currentKeyword = result.keyword || "";
    currentProjectId = result.project_id || "PRJ-UNASSIGNED";
    currentCategoryGroup = result.category_group || "General";
  },
);

// ==================== ANTI DETECTION DELAY ====================
const randomDelay = (min, max) => {
  const variance = Math.random();
  if (variance < 0.1)
    return Math.floor(Math.random() * (max * 1.8 - max * 1.2 + 1)) + max * 1.2;
  if (variance < 0.2)
    return Math.floor(Math.random() * (min * 0.8 - min * 0.5 + 1)) + min * 0.5;
  return (
    Math.floor(
      Math.random() *
        (Math.min(8000, max * 0.6) - Math.max(3000, min * 0.6) + 1),
    ) + Math.max(3000, min * 0.6)
  );
};

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
  });
});

// ==================== AUTO SWEEP (Improved) ====================
const startSweep = async () => {
  if (isSweeping) return;
  isSweeping = true;
  currentPage = 0;

  chrome.storage.local.get(["maxPages"], (result) => {
    maxPages = result.maxPages || 12;
  });

  while (isSweeping && currentPage < maxPages) {
    currentPage++;
    updateStatus(`Processing page ${currentPage}/${maxPages}...`);

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
      updateStatus(`Keyword selesai. Total ${currentPage} halaman.`);
      chrome.storage.local.set({ isAutoSweep: false });
      chrome.runtime.sendMessage({ action: "KEYWORD_FINISHED" });
      isSweeping = false;
      break;
    }

    nextBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await new Promise((r) => setTimeout(r, randomDelay(4000, 6000)));
  }

  if (currentPage >= maxPages) {
    chrome.runtime.sendMessage({ action: "KEYWORD_FINISHED" });
  }

  isSweeping = false;
};

const stopSweep = () => {
  isSweeping = false;
  chrome.storage.local.set({ isAutoSweep: false });
  updateStatus("Harvester dihentikan.");
};

// ==================== STORAGE LISTENER ====================
chrome.storage.onChanged.addListener((changes) => {
  if (changes.isAutoSweep) {
    if (changes.isAutoSweep.newValue === true) {
      startSweep();
    } else {
      stopSweep();
    }
  }
  if (changes.keyword) {
    currentKeyword = changes.keyword.newValue || "";
  }
});

// Check initial state
chrome.storage.local.get("isAutoSweep", (result) => {
  if (result.isAutoSweep) {
    startSweep();
  }
});
