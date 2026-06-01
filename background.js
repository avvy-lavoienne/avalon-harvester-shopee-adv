// [Avalon Harvester] Background script loaded - Enterprise Edition
console.log("[Avalon Harvester] Enterprise Background script loaded");

// =========================================================================
// KONFIGURASI SUPABASE
// =========================================================================
const SUPABASE_URL = "https://fzomsxxbqdhgeafhygkp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6b21zeHhicWRoZ2VhZmh5Z2twIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzNjc4MTAsImV4cCI6MjA5NDk0MzgxMH0.1jgnNpGYavTM2zUbWZkKbhnXqTMUovcjUEtKEaP4zvk";
const SUPABASE_API_ENDPOINT = `${SUPABASE_URL}/rest/v1/task_queue`;

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
  getRandomHeaders: () => {
    if (AntiDetection._cachedHeaders) return AntiDetection._cachedHeaders;
    const userAgents = [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    ];
    AntiDetection._cachedHeaders = {
      "User-Agent": userAgents[Math.floor(Math.random() * userAgents.length)],
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
      "Accept-Encoding": "gzip, deflate, br",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
    };
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
    // Generate Batch ID baru setiap kali mulai sweep
    const newBatchId = "batch_" + Date.now();
    chrome.storage.local.set({
      isAutoSweep: true,
      keyword: message.keyword,
      batch_id: newBatchId,
    });

    const url =
      "https://shopee.co.id/search?keyword=" +
      encodeURIComponent(message.keyword);
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) chrome.tabs.update(tabs[0].id, { url });
      else chrome.tabs.create({ url });
    });
  } else if (message.action === "STOP_SWEEP") {
    chrome.storage.local.set({ isAutoSweep: false });
  } else if (message.action === "STORE_HARVESTED_LINKS") {
    const urls = message.urls;
    const batchSize = 10;
    let savedCount = 0;

    // 👇 KITA TAMBAHKAN "keyword" DI DALAM ARRAY STRORAGE GET AGAR DI-PULL LANGSUNG OLEH BACKGROUND
    chrome.storage.local.get(
      ["worker_id", "batch_id", "project_id", "category_group", "keyword"],
      (storageData) => {
        const workerId = storageData.worker_id || "avalon-node-fallback";
        const batchId = storageData.batch_id || "batch_unknown";
        const projectId = storageData.project_id || "PRJ-UNASSIGNED";
        const categoryGroup = storageData.category_group || "General";

        // 👇 JIKA MESSAGE.KEYWORD KOSONG, KITA AMBIL DARI MEMORI STORAGE INTERNAL YANG SUDAH PASTI VALID
        const keyword = storageData.keyword || message.keyword || "unknown";

        const uploadBatch = async (batch) => {
          for (const urlString of batch) {
            const match = urlString.match(/product\/(\d+)\/(\d+)/);
            const productId = match ? `p_${match[1]}_${match[2]}` : null;

            if (!productId) continue;

            // Siapkan payload data yang strukturnya cocok 100% dengan kolom baru PostgreSQL kita
            const requestData = {
              id: productId,
              product_id: productId,
              url: urlString,
              keyword: keyword,
              region: "id",
              status: "pending",
              priority: 0,
              retry_count: 0,
              batch_id: batchId,
              worker_id: workerId,
              project_id: projectId, // 👈 SUNTIKAN BARU UNTUK MULTI-CLIENT
              category_group: categoryGroup, // 👈 SUNTIKAN BARU UNTUK FILTER KATEGORI
            };

            try {
              // Tembak langsung ke REST API Supabase via Fetch
              const res = await fetch(SUPABASE_API_ENDPOINT, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  apikey: SUPABASE_ANON_KEY,
                  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                  // PENTING: Header ini memerintahkan PostgreSQL untuk melakukan UPSERT jika ID duplikat ditemukan
                  Prefer: "resolution=merge-duplicates",
                },
                body: JSON.stringify(requestData),
              });

              if (!res.ok) {
                const text = await res.text();
                console.error(
                  `[Avalon Harvester] Supabase API Error ${res.status}: ${text}`,
                );
              } else {
                savedCount++;
              }

              // JEDA MIKRO (ANTI-DDOS PROTECTION)
              // Berikan nafas bagi server selama 100ms - 300ms sebelum menembak produk selanjutnya
              const microDelay = 100 + Math.random() * 200;
              await new Promise((resolve) => setTimeout(resolve, microDelay));
            } catch (e) {
              console.error(
                "[Avalon Harvester] Gagal mengunggah ke Supabase:",
                urlString,
                e.message,
              );
            }
          }
        };

        const processBatches = async () => {
          for (let i = 0; i < urls.length; i += batchSize) {
            const batch = urls.slice(i, i + batchSize);
            await uploadBatch(batch);
          }
          console.log(
            `[Avalon Harvester] Misi Selesai. Sukses simpan ke Supabase: ${savedCount} item`,
          );
          sendResponse({ status: "success", total_saved: savedCount });
        };

        processBatches();
      },
    );

    return true; // Menandakan bahwa sendResponse akan dipanggil secara asynchronous
  }
});
