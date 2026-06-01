document.addEventListener("DOMContentLoaded", () => {
  const keywordInput = document.getElementById("keywordInput");
  const projectIdInput = document.getElementById("projectIdInput");
  const categoryGroupSelect = document.getElementById("categoryGroupSelect");
  const btnStart = document.getElementById("btnStart");
  const btnStop = document.getElementById("btnStop");
  const status = document.getElementById("status");

  // 1. Ambil data terakhir dari storage saat panel popup dibuka oleh user
  chrome.storage.local.get(
    ["isAutoSweep", "keyword", "project_id", "category_group"],
    (result) => {
      const isActive = result.isAutoSweep;

      // Kunci atau buka form input tergantung status aktivitas pemanenan
      keywordInput.disabled = isActive;
      projectIdInput.disabled = isActive;
      categoryGroupSelect.disabled = isActive;

      // Tampilkan kembali text terakhir yang pernah diketik user agar tidak hilang
      if (result.keyword) keywordInput.value = result.keyword;
      if (result.project_id) projectIdInput.value = result.project_id;
      if (result.category_group)
        categoryGroupSelect.value = result.category_group;

      btnStart.disabled = isActive;
      btnStop.disabled = !isActive;
      status.textContent = isActive ? "Status: Sweeping..." : "Status: Idle";
    },
  );

  // 2. Intip perubahan status 'isAutoSweep' secara real-time dari background/content script
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.isAutoSweep) {
      const isActive = changes.isAutoSweep.newValue;
      keywordInput.disabled = isActive;
      projectIdInput.disabled = isActive;
      categoryGroupSelect.disabled = isActive;
      btnStart.disabled = isActive;
      btnStop.disabled = !isActive;
      status.textContent = isActive ? "Status: Sweeping..." : "Status: Idle";
    }
  });

  // 3. Logika Eksekusi Tombol "Start Auto-Sweep"
  btnStart.addEventListener("click", () => {
    const keyword = keywordInput.value.trim();
    const projectId = projectIdInput.value.trim() || "PRJ-UNASSIGNED";
    const categoryGroup = categoryGroupSelect.value;

    if (!keyword) {
      alert("Please enter a keyword.");
      return;
    }

    // Amankan konfigurasi ke storage terlebih dahulu agar dibaca serentak oleh sistem ekstensi
    chrome.storage.local.set(
      {
        keyword: keyword,
        project_id: projectId,
        category_group: categoryGroup,
      },
      () => {
        // Nyalakan misi sweeping dengan payload komplit menuju background.js
        chrome.runtime.sendMessage({
          action: "START_SWEEP",
          keyword,
          project_id: projectId,
          category_group: categoryGroup,
        });
      },
    );
  });

  // 4. Logika Eksekusi Tombol "Stop"
  btnStop.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "STOP_SWEEP" });
  });
});
