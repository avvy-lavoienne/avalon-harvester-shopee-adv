document.addEventListener("DOMContentLoaded", () => {
  const btnStart = document.getElementById("btnStart");
  const btnStop = document.getElementById("btnStop");
  const status = document.getElementById("status");
  const errorMsg = document.getElementById("errorMsg");
  const toast = document.getElementById("toast");
  const usernameInput = document.getElementById("harvesterUsername");
  const btnLock = document.getElementById("btnLock");
  const btnDiscover = document.getElementById("btnDiscover");
  const catLoading = document.getElementById("catLoading");
  const catContainer = document.getElementById("categoryContainer");
  const taskInfo = document.getElementById("taskInfo");
  const taskMode = document.getElementById("taskMode");
  const taskName = document.getElementById("taskName");
  const taskProgress = document.getElementById("taskProgress");
  const taskProducts = document.getElementById("taskProducts");
  const cbStatus = document.getElementById("cbStatus");
  const cbText = document.getElementById("cbText");

  let statusTimer = null;

  function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.style.display = "block";
    setTimeout(() => (errorMsg.style.display = "none"), 5000);
  }

  function showToast(msg, isError) {
    toast.textContent = msg;
    toast.className = "toast" + (isError ? " toast-error" : "");
    toast.style.display = "block";
    setTimeout(() => { toast.style.display = "none"; }, 2500);
  }

  function updateUI(isRunning) {
    btnStart.disabled = isRunning;
    btnStop.disabled = !isRunning;
    taskInfo.style.display = isRunning ? "block" : "none";
    if (!isRunning) {
      status.textContent = "Status: Idle";
      if (statusTimer) {
        clearInterval(statusTimer);
        statusTimer = null;
      }
    } else {
      status.textContent = "Status: Harvesting aktif dari Supabase...";
      refreshStatus();
      if (statusTimer) clearInterval(statusTimer);
      statusTimer = setInterval(refreshStatus, 3000);
    }
  }

  function refreshStatus() {
    chrome.runtime.sendMessage({ action: "GET_STATUS" }, (resp) => {
      if (!resp) return;
      if (resp.keyword) {
        const isFacet = !!resp.facet_id;
        taskMode.textContent = isFacet ? "Facet" : "Keyword";
        taskMode.className = "task-value " + (isFacet ? "task-mode-facet" : "task-mode-keyword");
        taskName.textContent = isFacet
          ? `facet#${resp.facet_id} "${resp.keyword}"`
          : `"${resp.keyword}"`;
        taskProgress.textContent = resp.currentPage != null
          ? `Page ${resp.currentPage}/${resp.maxPages || "?"}`
          : "Page 0/?";
        taskProducts.textContent = resp.productCount ?? 0;
        status.textContent = `Status: ${isFacet ? "Facet" : "Keyword"} — ${resp.keyword}`;
      }
      if (resp.circuitBreaker) {
        const cb = resp.circuitBreaker;
        if (cb.isOpen) {
          cbText.textContent = `OPEN (${cb.remainingMinutes}m left)`;
          cbText.className = "task-value cb-open";
        } else {
          cbText.textContent = "OK";
          cbText.className = "task-value cb-ok";
        }
      }
    });
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

  chrome.storage.local.get("isAutoSweep", (result) => {
    updateUI(result.isAutoSweep || false);
    loadUsername();
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.isAutoSweep) {
      updateUI(changes.isAutoSweep.newValue);
    }
  });

  btnLock.addEventListener("click", () => {
    const isLocked = usernameInput.disabled;
    if (isLocked) {
      usernameInput.disabled = false;
      btnLock.textContent = "\u{1F513}";
      chrome.storage.local.set({ harvester_username_locked: false });
    } else {
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
        showError("Gagal terhubung ke background: " + chrome.runtime.lastError.message);
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

  // ====================== CATEGORY DISCOVERY ======================

  let allCategories = [];
  let groupedByParent = {};
  let expandedIds = new Set();

  btnDiscover.addEventListener("click", () => {
    if (catContainer.style.display === "block") {
      catContainer.style.display = "none";
      catContainer.innerHTML = "";
      btnDiscover.textContent = "📂 Discover Categories";
      return;
    }

    btnDiscover.disabled = true;
    catLoading.style.display = "block";
    catContainer.style.display = "none";
    catContainer.innerHTML = "";

    chrome.runtime.sendMessage({ action: "FETCH_CATEGORIES" }, (response) => {
      catLoading.style.display = "none";
      btnDiscover.disabled = false;

      if (!response || !response.success) {
        catContainer.style.display = "block";
        catContainer.innerHTML = `<div class="cat-error">❌ ${response?.error || "Gagal fetch kategori"}</div>`;
        return;
      }

      allCategories = response.categories;
      groupedByParent = {};
      expandedIds = new Set();
      buildCategoryTree();
    });
  });

  function buildCategoryTree() {
    const scrollTop = catContainer.scrollTop;

    for (const c of allCategories) {
      const pid = c.parent_catid;
      if (!groupedByParent[pid]) groupedByParent[pid] = [];
      groupedByParent[pid].push(c);
    }
    for (const pid in groupedByParent) {
      groupedByParent[pid].sort((a, b) => a.name.localeCompare(b.name));
    }

    const level1 = groupedByParent[0] || [];
    if (level1.length === 0) {
      catContainer.innerHTML = `<div class="cat-empty">Tidak ada kategori ditemukan</div>`;
      catContainer.style.display = "block";
      return;
    }

    let html = `<div class="cat-count">${allCategories.length} kategori (level 1+), ${level1.length} root</div>`;
    html += renderNodeList(level1, 1);
    catContainer.innerHTML = html;
    catContainer.style.display = "block";
    btnDiscover.textContent = "📂 Sembunyikan Categories";
    requestAnimationFrame(() => {
      catContainer.scrollTop = scrollTop;
    });

    catContainer.querySelectorAll(".cat-node").forEach(el => {
      el.addEventListener("click", (e) => {
        if (e.target.classList.contains("cat-add-btn")) return;
        if (el.dataset.leaf === "true") return;
        const catId = parseInt(el.dataset.catid, 10);
        if (expandedIds.has(catId)) {
          expandedIds.delete(catId);
        } else {
          expandedIds.add(catId);
        }
        buildCategoryTree();
      });
    });

    catContainer.querySelectorAll(".cat-add-btn").forEach(el => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const catId = parseInt(el.dataset.catid, 10);
        const catName = el.dataset.catname || "Category";
        createFacetTask(catId, catName);
      });
    });
  }

  function renderNodeList(cats, level) {
    let html = "";
    for (const c of cats) {
      const children = groupedByParent[c.catid] || [];
      const isLeaf = c.no_sub || children.length === 0;
      const isExpanded = expandedIds.has(c.catid);
      const arrow = isLeaf ? "⚬" : (isExpanded ? "▼" : "▶");
      html += `<div class="cat-node cat-level-${Math.min(level, 4)}" data-catid="${c.catid}" data-level="${level}" data-leaf="${isLeaf}">
        <span class="cat-arrow">${arrow}</span>
        <span class="cat-name">${escapeHtml(c.name)}</span>
        <span class="cat-badge">#${c.catid}</span>
        <span class="cat-add-btn" data-catid="${c.catid}" data-catname="${escapeHtml(c.name)}" title="Buat facet task">＋</span>
      </div>`;
      if (isExpanded && !isLeaf) {
        html += renderNodeList(children, level + 1);
      }
    }
    return html;
  }


  // ====================== DISCOVER SUB CATEGORIES ======================
  const btnDiscoverSub = document.getElementById('btnDiscoverSub');
  const subProgress = document.getElementById('subDiscoverProgress');
  let subTimer = null;

  btnDiscoverSub.addEventListener('click', () => {
    btnDiscoverSub.disabled = true;
    subProgress.style.display = 'block';
    subProgress.textContent = 'Memulai discovery...';
    catContainer.style.display = 'none';
    catContainer.innerHTML = '';

    // Pantau progress via storage
    if (subTimer) clearInterval(subTimer);
    subTimer = setInterval(() => {
      chrome.storage.local.get('discoverProgress', (r) => {
        if (r.discoverProgress) {
          subProgress.textContent = `${r.discoverProgress.name}: ${r.discoverProgress.current}/${r.discoverProgress.total}`;
        }
      });
    }, 1000);

    chrome.runtime.sendMessage({ action: 'DISCOVER_SUB_CATEGORIES' }, (response) => {
      clearInterval(subTimer);
      subTimer = null;
      btnDiscoverSub.disabled = false;

      if (!response || !response.success) {
        subProgress.textContent = '❌ ' + (response?.error || 'Gagal');
        return;
      }

      subProgress.textContent = '✅ ' + response.count + ' kategori (termasuk subkategori) tersimpan!';
      // Refresh category cache di popup
      allCategories = [];
      groupedByParent = {};
      expandedIds = new Set();
      btnDiscover.textContent = '📂 Discover Categories';
    });
  });
  function createFacetTask(catId, catName) {
    if (!confirm(`Buat facet task untuk "${catName}" (facet_id=${catId})?`)) return;

    chrome.runtime.sendMessage({
      action: "CREATE_FACET_TASK",
      facet_id: catId,
      keyword: catName,
    }, (response) => {
      if (!response) {
        showError("Tidak ada response dari background");
        return;
      }
      if (response.success) {
        showToast(`Task facet "${catName}" berhasil dibuat!`);
      } else {
        showError(response.error || "Gagal membuat facet task");
      }
    });
  }

  function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML.replace(/'/g, "&#39;");
  }
});
