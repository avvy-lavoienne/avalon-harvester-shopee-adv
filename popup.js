document.addEventListener("DOMContentLoaded", () => {
  const keywordInput = document.getElementById("keywordInput");
  const projectIdInput = document.getElementById("projectIdInput");
  const categoryGroupSelect = document.getElementById("categoryGroupSelect");
  const btnStart = document.getElementById("btnStart");
  const btnStop = document.getElementById("btnStop");
  const status = document.getElementById("status");
  const errorMsg = document.getElementById("errorMsg");
  const cbContainer = document.getElementById("circuitBreakerStatus");

  function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.style.display = "block";
    setTimeout(() => { errorMsg.style.display = "none"; }, 4000);
  }

  function setFormEnabled(enabled) {
    keywordInput.disabled = !enabled;
    projectIdInput.disabled = !enabled;
    categoryGroupSelect.disabled = !enabled;
    btnStart.disabled = !enabled;
    btnStop.disabled = enabled;
  }

  function updateStatusText(isActive) {
    if (isActive) {
      const kw = keywordInput.value.trim() || "...";
      status.textContent = "Status: Sweeping [" + kw + "]";
    } else if (status.textContent.startsWith("Status: Starting") || status.textContent.startsWith("Status: Stopping")) {
      // leave transitional messages untouched
    } else {
      status.textContent = "Status: Idle";
    }
  }

  function renderCircuitBreaker(s) {
    if (s.isOpen || s.failureCount > 0) {
      cbContainer.style.display = "block";
      cbContainer.style.backgroundColor = s.isOpen ? "#3b1f1f" : "#1f2a1f";
      cbContainer.style.borderColor = s.isOpen ? "#dc2626" : "#ca8a04";
      cbContainer.innerHTML = "";
      if (s.isOpen) {
        var title = document.createElement("div");
        title.style.cssText = "font-weight:600;margin-bottom:4px;color:#fca5a5";
        title.textContent = "Circuit Breaker Active";
        cbContainer.appendChild(title);
        var sub = document.createElement("div");
        sub.style.cssText = "font-size:12px;color:#fca5a5";
        sub.textContent = "Paused ~" + s.remainingMinutes + " mins";
        cbContainer.appendChild(sub);
      } else {
        var title2 = document.createElement("div");
        title2.style.cssText = "font-weight:600;margin-bottom:4px;color:#facc15";
        title2.textContent = "Failures: " + s.failureCount + "/" + s.threshold;
        cbContainer.appendChild(title2);
      }
    } else {
      cbContainer.style.display = "none";
    }
  }

  function fetchCircuitBreaker() {
    chrome.runtime.sendMessage({ action: "GET_CIRCUIT_BREAKER_STATUS" }, (res) => {
      if (!chrome.runtime.lastError && res) renderCircuitBreaker(res);
    });
  }

  chrome.storage.local.get(
    ["isAutoSweep", "keyword", "project_id", "category_group"],
    (result) => {
      const isActive = result.isAutoSweep;
      setFormEnabled(!isActive);
      if (result.keyword) keywordInput.value = result.keyword;
      if (result.project_id) projectIdInput.value = result.project_id;
      if (result.category_group) categoryGroupSelect.value = result.category_group;
      status.textContent = isActive ? "Status: Sweeping..." : "Status: Idle";
    },
  );

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.isAutoSweep) {
      const isActive = changes.isAutoSweep.newValue;
      setFormEnabled(!isActive);
      updateStatusText(isActive);
    }
  });

  btnStart.addEventListener("click", () => {
    const keyword = keywordInput.value.trim();
    const projectId = projectIdInput.value.trim() || "PRJ-UNASSIGNED";
    const categoryGroup = categoryGroupSelect.value;

    if (!keyword) {
      showError("Please enter a keyword.");
      return;
    }
    if (keyword.length < 3) {
      showError("Keyword must be at least 3 characters.");
      return;
    }

    btnStart.disabled = true;
    btnStart.textContent = "Starting...";
    status.textContent = "Status: Starting...";

    chrome.storage.local.set(
      { keyword, project_id: projectId, category_group: categoryGroup, isAutoSweep: true },
      () => {
        chrome.runtime.sendMessage(
          { action: "START_SWEEP", keyword, project_id: projectId, category_group: categoryGroup },
          (response) => {
            if (chrome.runtime.lastError) {
              showError("Failed to start: " + chrome.runtime.lastError.message);
              status.textContent = "Status: Error";
              btnStart.disabled = false;
              btnStart.textContent = "Start Auto-Sweep";
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

    chrome.storage.local.set({ isAutoSweep: false, currentTask: null }, () => {
      chrome.runtime.sendMessage({ action: "STOP_SWEEP" }, (response) => {
        if (chrome.runtime.lastError) {
          showError("Failed to stop: " + chrome.runtime.lastError.message);
        }
        btnStop.textContent = "Stop";
      });
    });
  });

  fetchCircuitBreaker();
  setInterval(fetchCircuitBreaker, 8000);
});
