document.addEventListener("DOMContentLoaded", () => {
  const btnStart = document.getElementById("btnStart");
  const btnStop = document.getElementById("btnStop");
  const status = document.getElementById("status");
  const errorMsg = document.getElementById("errorMsg");
  const usernameInput = document.getElementById("harvesterUsername");
  const btnLock = document.getElementById("btnLock");

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

  function loadUsername() {
    chrome.storage.local.get(["harvester_username", "harvester_username_locked"], (result) => {
      const name = result.harvester_username || "";
      const locked = result.harvester_username_locked || false;
      usernameInput.value = name;
      usernameInput.disabled = locked;
      btnLock.textContent = locked ? "\u{1F512}" : "\u{1F513}";
    });
  }

  // Load initial state
  chrome.storage.local.get("isAutoSweep", (result) => {
    updateUI(result.isAutoSweep || false);
    loadUsername();
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.isAutoSweep) {
      updateUI(changes.isAutoSweep.newValue);
    }
  });

  // Lock/Unlock toggle
  btnLock.addEventListener("click", () => {
    const isLocked = usernameInput.disabled;
    if (isLocked) {
      // Unlock — user ingin ganti username
      usernameInput.disabled = false;
      btnLock.textContent = "\u{1F513}";
      chrome.storage.local.set({ harvester_username_locked: false });
    } else {
      // Lock — validasi dulu
      const name = usernameInput.value.trim();
      if (!name) {
        showError("Harvester username harus diisi sebelum dikunci.");
        usernameInput.focus();
        return;
      }
      usernameInput.disabled = true;
      btnLock.textContent = "\u{1F512}";
      chrome.storage.local.set({
        harvester_username: name,
        harvester_username_locked: true
      });
    }
  });

  btnStart.addEventListener("click", () => {
    // Validasi username sudah dikunci
    const name = usernameInput.value.trim();
    const isLocked = usernameInput.disabled;

    if (!name || !isLocked) {
      showError("Isi dan kunci Harvester username terlebih dahulu.");
      return;
    }

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