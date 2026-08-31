/**
 * NEXT ZERO 管理審核後台 - 真實審核與動態計算邏輯 (v8 旗艦穩定版)
 * 整合 IndexedDB + LocalStorage 雙核心引擎 + 雲端同步管理
 * 零假資料：所有案件均來自真實上傳或管理員手動測試！
 */

// 預設 Google Apps Script Web App URL
const DEFAULT_GAS_API_URL = ""; 
const LOCAL_STORAGE_KEY = "NEXT_ZERO_SUBMISSIONS_STORAGE";
const GAS_URL_KEY = "NEXT_ZERO_GAS_URL";
const DB_NAME = "NextZeroCampusDB";
const STORE_NAME = "submissions";

let currentToken = "";
let allSubmissions = [];
let currentFilter = "all";

/**
 * 取得當前生效的 GAS API URL
 */
function getActiveGasUrl() {
  return localStorage.getItem(GAS_URL_KEY) || DEFAULT_GAS_API_URL || "";
}

/**
 * ==========================================================================
 * EcoDB: 瀏覽器 IndexedDB + LocalStorage 雙層儲存引擎
 * ==========================================================================
 */
const EcoDB = {
  open() {
    return new Promise((resolve) => {
      if (!window.indexedDB) {
        resolve(null);
        return;
      }
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "rowId" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    });
  },

  async getAll() {
    try {
      const db = await this.open();
      if (db) {
        return new Promise((resolve) => {
          const tx = db.transaction(STORE_NAME, "readonly");
          const store = tx.objectStore(STORE_NAME);
          const req = store.getAll();
          req.onsuccess = () => {
            const list = req.result || [];
            if (list.length > 0) {
              resolve(list.sort((a, b) => b.rowId - a.rowId));
              return;
            }
            resolve(this.getFromLocalStorage());
          };
          req.onerror = () => resolve(this.getFromLocalStorage());
        });
      }
    } catch (e) {
      console.warn("IndexedDB 讀取異常:", e);
    }
    return this.getFromLocalStorage();
  },

  getFromLocalStorage() {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  },

  async updateStatus(rowId, status) {
    // 更新 IndexedDB
    try {
      const db = await this.open();
      if (db) {
        await new Promise((resolve) => {
          const tx = db.transaction(STORE_NAME, "readwrite");
          const store = tx.objectStore(STORE_NAME);
          const req = store.get(rowId);
          req.onsuccess = () => {
            const item = req.result;
            if (item) {
              item.status = status;
              store.put(item);
            }
            resolve();
          };
          req.onerror = () => resolve();
        });
      }
    } catch (e) {
      console.warn("IndexedDB 更新異常:", e);
    }

    // 更新 LocalStorage
    const list = this.getFromLocalStorage();
    const target = list.find(s => s.rowId === rowId);
    if (target) {
      target.status = status;
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
      } catch (e) {}
    }

    // 觸發自訂事件廣播
    window.dispatchEvent(new CustomEvent("eco-data-changed"));
  },

  async clearAll() {
    try {
      const db = await this.open();
      if (db) {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).clear();
      }
    } catch (e) {}
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent("eco-data-changed"));
  },

  async add(item) {
    try {
      const db = await this.open();
      if (db) {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).put(item);
      }
    } catch (e) {}

    let list = this.getFromLocalStorage();
    list.unshift(item);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
    } catch (e) {}

    window.dispatchEvent(new CustomEvent("eco-data-changed"));
  }
};

/**
 * 頁面初始化
 */
document.addEventListener('DOMContentLoaded', () => {
  setupAuth();
  setupToolbar();
  setupPhotoModal();
  setupCloudSettingsModal();

  // 若 sessionStorage 存有 Token，自動嘗試登入
  const savedToken = sessionStorage.getItem("NEXT_ZERO_ADMIN_TOKEN");
  if (savedToken) {
    currentToken = savedToken;
    loginSuccess();
  }

  // 跨分頁與同分頁實時監聽
  window.addEventListener('storage', (e) => {
    if (e.key === LOCAL_STORAGE_KEY && currentToken) {
      fetchSubmissions();
    }
  });
  window.addEventListener('eco-data-changed', () => {
    if (currentToken) fetchSubmissions();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && currentToken) fetchSubmissions();
  });
});

/**
 * 登入驗證處理
 */
function setupAuth() {
  const authForm = document.getElementById('auth-form');
  const tokenInput = document.getElementById('admin-token');
  const btnLogout = document.getElementById('btn-logout');

  if (authForm) {
    authForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const token = tokenInput.value.trim();
      if (!token) return;

      currentToken = token;
      sessionStorage.setItem("NEXT_ZERO_ADMIN_TOKEN", token);
      loginSuccess();
    });
  }

  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      sessionStorage.removeItem("NEXT_ZERO_ADMIN_TOKEN");
      currentToken = "";
      document.getElementById('auth-section').style.display = 'block';
      document.getElementById('dashboard-section').style.display = 'none';
      btnLogout.style.display = 'none';
    });
  }
}

function loginSuccess() {
  document.getElementById('auth-section').style.display = 'none';
  document.getElementById('dashboard-section').style.display = 'block';
  document.getElementById('btn-logout').style.display = 'inline-block';
  fetchSubmissions();
}

/**
 * 工具列與按鈕事件設定
 */
function setupToolbar() {
  const filterBtns = document.querySelectorAll('.btn-filter');
  const btnRefresh = document.getElementById('btn-refresh');
  const btnTestSample = document.getElementById('btn-test-sample');
  const btnClearAll = document.getElementById('btn-clear-all');
  const btnConfigGas = document.getElementById('btn-config-gas');

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.getAttribute('data-filter');
      renderSubmissions();
    });
  });

  if (btnRefresh) {
    btnRefresh.addEventListener('click', fetchSubmissions);
  }

  // 快速建立一筆真實測試案件 (方便使用者一鍵驗證審核流程)
  if (btnTestSample) {
    btnTestSample.addEventListener('click', async () => {
      const now = new Date();
      const timeStr = `${now.getFullYear()}/${String(now.getMonth()+1).padStart(2,'0')}/${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
      
      const sampleItem = {
        rowId: Date.now(),
        timestamp: timeStr,
        nickname: "測試同學 (即時模擬)",
        taskType: "任務 1. 教室空調設置成 26 度並隨手關閉電源",
        photoUrl: "puzzle.svg",
        imageName: "test_demo.jpg",
        status: "待審核"
      };

      await EcoDB.add(sampleItem);
      await fetchSubmissions();
      alert("✨ 已成功建立 1 筆測試待審核案件！您可以點選「✅ 通過審核」進行即時驗證。");
    });
  }

  // 清空所有案件
  if (btnClearAll) {
    btnClearAll.addEventListener('click', async () => {
      if (!confirm("⚠️ 確定要清空所有上傳與審核案件紀錄嗎？\n（此操作將重設所有拼圖與減碳統計數據）")) return;
      await EcoDB.clearAll();
      await fetchSubmissions();
      alert("🗑️ 所有案件已清空，數據已重設為 0！");
    });
  }

  // 雲端 API 設定
  if (btnConfigGas) {
    btnConfigGas.addEventListener('click', () => {
      const currentUrl = getActiveGasUrl();
      const newUrl = prompt("🌐 請輸入 Google Apps Script Web App URL（若無請留空以使用本地模式）：", currentUrl);
      if (newUrl !== null) {
        localStorage.setItem(GAS_URL_KEY, newUrl.trim());
        alert("✅ 雲端 API 網址已更新！系統將在可用時自動同步雲端試算表。");
        fetchSubmissions();
      }
    });
  }
}

/**
 * 載入所有真實任務上傳案件（完全排除假資料）
 */
async function fetchSubmissions() {
  const grid = document.getElementById('submissions-grid');
  if (!grid) return;

  const gasUrl = getActiveGasUrl();

  // 情況 1：若有設定 GAS 雲端 API，向 Google 試算表拉取資料
  if (gasUrl && gasUrl !== "YOUR_GAS_WEB_APP_URL") {
    try {
      grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #537562; padding: 40px; font-weight: 600;">🔄 正在從雲端 Google 試算表載入審核名單中...</p>';
      const url = `${gasUrl}?action=get_admin_list&token=${encodeURIComponent(currentToken)}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.status === "success") {
        allSubmissions = data.submissions || [];
        updateCounts();
        renderSubmissions();
        return;
      }
    } catch (err) {
      console.warn("GAS 雲端拉取失敗，自動由本地雙核心儲存庫讀取:", err);
    }
  }

  // 情況 2：從 EcoDB (IndexedDB + LocalStorage) 讀取真實上傳案件
  allSubmissions = await EcoDB.getAll();
  updateCounts();
  renderSubmissions();
}

/**
 * 更新統計數字看板
 */
function updateCounts() {
  const pending = allSubmissions.filter(s => s.status === "待審核").length;
  const approved = allSubmissions.filter(s => s.status === "通過").length;
  const rejected = allSubmissions.filter(s => s.status === "退回").length;

  const countPendingEl = document.getElementById('count-pending');
  const countApprovedEl = document.getElementById('count-approved');
  const countRejectedEl = document.getElementById('count-rejected');

  if (countPendingEl) countPendingEl.innerText = pending;
  if (countApprovedEl) countApprovedEl.innerText = approved;
  if (countRejectedEl) countRejectedEl.innerText = rejected;

  const fAll = document.getElementById('filter-all-count');
  const fPending = document.getElementById('filter-pending-count');
  const fApproved = document.getElementById('filter-approved-count');
  const fRejected = document.getElementById('filter-rejected-count');

  if (fAll) fAll.innerText = allSubmissions.length;
  if (fPending) fPending.innerText = pending;
  if (fApproved) fApproved.innerText = approved;
  if (fRejected) fRejected.innerText = rejected;
}

/**
 * 解析媒體網址
 */
function getMediaEmbedUrl(url) {
  if (!url || url === "無照片佐證") return "puzzle.svg";
  if (url.startsWith("data:image")) return url;

  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w800`;
  }
  return url;
}

/**
 * 渲染卡片清單（真實上傳紀錄）
 */
function renderSubmissions() {
  const grid = document.getElementById('submissions-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const filtered = allSubmissions.filter(s => {
    if (currentFilter === "all") return true;
    return s.status === currentFilter;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 45px 20px; background: #FFFFFF; border-radius: 20px; border: 1.5px dashed #C8E6C9;">
        <span style="font-size: 42px; display: block; margin-bottom: 12px;">📭</span>
        <h3 style="font-size: 18px; color: #193828; margin-bottom: 6px; font-weight: 800;">目前尚無任何案件紀錄</h3>
        <p style="font-size: 13px; color: #537562; max-width: 440px; margin: 0 auto 18px auto; line-height: 1.6;">
          系統目前處於【零假資料模式】。您可以前往首頁進行任務上傳，或點擊下方按鈕進行審核功能測試！
        </p>
        <div style="display: flex; justify-content: center; gap: 10px; flex-wrap: wrap;">
          <a href="index.html" style="background: #2E7D32; color: #FFFFFF; text-decoration: none; padding: 9px 22px; border-radius: 25px; font-size: 13px; font-weight: 700;">
            📸 前往首頁拍照上傳
          </a>
          <button type="button" onclick="document.getElementById('btn-test-sample').click()" style="background: #E8F5E9; color: #2E7D32; border: 1.5px solid #A5D6A7; padding: 9px 20px; border-radius: 25px; font-size: 13px; font-weight: 700; cursor: pointer;">
            🧪 產生一筆測試案件
          </button>
        </div>
      </div>
    `;
    return;
  }

  filtered.forEach(item => {
    const card = document.createElement('div');
    card.className = 'sub-card';
    const embedImgUrl = getMediaEmbedUrl(item.photoUrl);
    const isDriveLink = item.photoUrl && item.photoUrl.startsWith("http");

    card.innerHTML = `
      <div class="sub-img-box" onclick="showPhoto('${embedImgUrl}', '${item.photoUrl}')">
        <img src="${embedImgUrl}" alt="佐證照片" loading="lazy" onerror="this.onerror=null; this.src='puzzle.svg';">
        <span class="sub-badge badge-${item.status}">${item.status}</span>
        <div class="img-hint-overlay">🔍 點擊檢視佐證大圖</div>
      </div>
      <div class="sub-body">
        <div class="sub-title">👤 ${escapeHtml(item.nickname || '熱心同學')}</div>
        <div class="sub-task">📋 ${escapeHtml(item.taskType || '')}</div>
        <div class="sub-time">🕒 提交時間：${escapeHtml(String(item.timestamp || ''))}</div>
        ${isDriveLink ? `
          <a href="${item.photoUrl}" target="_blank" rel="noopener noreferrer" class="link-drive-file" onclick="event.stopPropagation()">
            🔗 在 Google 雲端開啟原檔
          </a>
        ` : ''}
      </div>
      <div class="sub-actions">
        <button type="button" class="btn-approve" onclick="auditTask(${item.rowId}, '通過')">✅ 通過審核</button>
        <button type="button" class="btn-reject" onclick="auditTask(${item.rowId}, '退回')">❌ 退回案件</button>
      </div>
    `;
    grid.appendChild(card);
  });
}

/**
 * 執行審核動作 (通過 / 退回) - 實時連動更新
 */
async function auditTask(rowId, status) {
  if (!confirm(`確定要將此筆任務設定為「${status}」嗎？`)) return;

  // 1. 本地雙核心儲存庫更新
  await EcoDB.updateStatus(rowId, status);

  // 2. 若有設定 GAS 雲端 API，同步更新雲端試算表
  const gasUrl = getActiveGasUrl();
  if (gasUrl && gasUrl !== "YOUR_GAS_WEB_APP_URL") {
    try {
      await fetch(gasUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "audit_task",
          token: currentToken,
          rowId: rowId,
          status: status
        })
      });
    } catch (err) {
      console.warn("GAS 雲端審核同步異常:", err);
    }
  }

  await fetchSubmissions();
  alert(`✅ 審核完成！已將此任務標記為「${status}」。\n\n${status === '通過' ? '前台首頁將即時點亮拼圖並累計減碳數據！' : '該案件已被標記為退回。'}`);
}

/**
 * 照片大圖彈窗
 */
function setupPhotoModal() {
  const modal = document.getElementById('photo-modal');
  const btnClose = document.getElementById('btn-close-photo');
  if (btnClose && modal) {
    btnClose.addEventListener('click', () => modal.classList.remove('active'));
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('active');
    });
  }
}

function showPhoto(embedUrl, originalUrl) {
  const modal = document.getElementById('photo-modal');
  const modalImg = document.getElementById('photo-modal-img');
  const driveLink = document.getElementById('photo-modal-drive-link');

  if (modal && modalImg) {
    modalImg.src = embedUrl;
    if (driveLink) {
      const isDriveLink = originalUrl && originalUrl.startsWith("http");
      driveLink.href = isDriveLink ? originalUrl : embedUrl;
      driveLink.style.display = isDriveLink ? 'inline-block' : 'none';
    }
    modal.classList.add('active');
  }
}

function setupCloudSettingsModal() {
  // Reserved for additional modal setup if needed
}

function escapeHtml(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}
