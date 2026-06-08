document.addEventListener("DOMContentLoaded", () => {
  const btnStart = document.getElementById("btnStart");
  const btnStop = document.getElementById("btnStop");
  const status = document.getElementById("status");
  const errorMsg = document.getElementById("errorMsg");

  function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.style.display = "block";
    setTimeout(() => (errorMsg.style.display = "none"), 5000);
  }

  function updateUI(isRunning) {
    btnStart.disabled = isRunning;
    btnStop.disabled = !isRunning;
    status.textContent = isRunning
      ? "Status: Harvesting aktif dari Supabase..."
      : "Status: Idle";
  }

  // Load initial state
  chrome.storage.local.get("isAutoSweep", (result) => {
    updateUI(result.isAutoSweep || false);
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.isAutoSweep) {
      updateUI(changes.isAutoSweep.newValue);
    }
  });

  btnStart.addEventListener("click", () => {
    btnStart.disabled = true;
    status.textContent = "Status: Memulai Auto Harvest...";

    chrome.runtime.sendMessage({ action: "START_SWEEP" }, (response) => {
      if (chrome.runtime.lastError) {
        showError(
          "Gagal terhubung ke background: " + chrome.runtime.lastError.message,
        );
        updateUI(false);
      }
    });
  });

  btnStop.addEventListener("click", () => {
    btnStop.disabled = true;
    status.textContent = "Status: Menghentikan...";

    chrome.runtime.sendMessage({ action: "STOP_SWEEP" }, () => {
      updateUI(false);
    });
  });
});
