document.addEventListener("DOMContentLoaded", () => {
  const keywordInput = document.getElementById("keywordInput");
  const projectIdInput = document.getElementById("projectIdInput");
  const categoryGroupSelect = document.getElementById("categoryGroupSelect");
  const btnStart = document.getElementById("btnStart");
  const btnStop = document.getElementById("btnStop");
  const status = document.getElementById("status");

  function setFormEnabled(enabled) {
    keywordInput.disabled = !enabled;
    projectIdInput.disabled = !enabled;
    categoryGroupSelect.disabled = !enabled;
    btnStart.disabled = !enabled;
    btnStop.disabled = enabled;
  }

  chrome.storage.local.get(
    ["isAutoSweep", "keyword", "project_id", "category_group"],
    (result) => {
      const isActive = result.isAutoSweep;
      setFormEnabled(!isActive);
      if (result.keyword) keywordInput.value = result.keyword;
      if (result.project_id) projectIdInput.value = result.project_id;
      if (result.category_group)
        categoryGroupSelect.value = result.category_group;
      status.textContent = isActive ? "Status: Sweeping..." : "Status: Idle";
    },
  );

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.isAutoSweep) {
      const isActive = changes.isAutoSweep.newValue;
      setFormEnabled(!isActive);
      status.textContent = isActive ? "Status: Sweeping..." : "Status: Idle";
    }
  });

  btnStart.addEventListener("click", () => {
    const keyword = keywordInput.value.trim();
    const projectId = projectIdInput.value.trim() || "PRJ-UNASSIGNED";
    const categoryGroup = categoryGroupSelect.value;

    if (!keyword) {
      alert("Please enter a keyword.");
      return;
    }

    btnStart.disabled = true;
    btnStart.textContent = "Starting...";
    status.textContent = "Status: Starting...";

    chrome.storage.local.set(
      { keyword, project_id: projectId, category_group: categoryGroup },
      () => {
        chrome.runtime.sendMessage(
          { action: "START_SWEEP", keyword, project_id: projectId, category_group: categoryGroup },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error("[Avalon Harvester] Start error:", chrome.runtime.lastError);
              status.textContent = "Status: Error starting";
              btnStart.disabled = false;
              btnStart.textContent = "Start Auto-Sweep";
            } else {
              console.log("[Avalon Harvester] Started:", response);
            }
          },
        );
      },
    );
  });

  btnStop.addEventListener("click", () => {
    btnStop.disabled = true;
    btnStop.textContent = "Stopping...";
    status.textContent = "Status: Stopping...";

    chrome.runtime.sendMessage({ action: "STOP_SWEEP" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("[Avalon Harvester] Stop error:", chrome.runtime.lastError);
      }
    });
  });
});
