/**
 * NEXT ZERO 管理審核後台 - 真實審核與動態計算邏輯
 * 零假資料：所有待審核與已審核案件均來自使用者真實上傳！
 */

// Google Apps Script Web App URL（選填，若未填寫則自動啟用本地 LocalStorage 實時持久化引擎）
const GAS_API_URL = ""; 

const LOCAL_STORAGE_KEY = "NEXT_ZERO_SUBMISSIONS_STORAGE";
let currentToken = "";
let allSubmissions = [];
let currentFilter = "all";

document.addEventListener('DOMContentLoaded', () => {
  setupAuth();
  setupToolbar();
  setupPhotoModal();

  // 若 sessionStorage 存有 Token，自動嘗試登入
  const savedToken = sessionStorage.getItem("NEXT_ZERO_ADMIN_TOKEN");
  if (savedToken) {
    currentToken = savedToken;
    loginSuccess();
  }

  // 跨分頁即時監聽：當前台有新案件送出時，後台自動即時載入呈現
  window.addEventListener('storage', (e) => {
    if (e.key === LOCAL_STORAGE_KEY && currentToken) {
      fetchSubmissions();
    }
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
 * 工具列與篩選器設定
 */
function setupToolbar() {
  const filterBtns = document.querySelectorAll('.btn-filter');
  const btnRefresh = document.getElementById('btn-refresh');

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.getAttribute('data-filter');
      renderSubmissions();
    });
  });

  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      fetchSubmissions();
    });
  }
}

/**
 * 載入所有真實任務上傳案件（完全排除假資料）
 */
async function fetchSubmissions() {
  const grid = document.getElementById('submissions-grid');
  if (!grid) return;

  // 情況 1：若有設定 GAS 雲端 API，向 Google 試算表拉取資料
  if (GAS_API_URL && GAS_API_URL !== "YOUR_GAS_WEB_APP_URL") {
    try {
      grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #537562; padding: 40px; font-weight: 600;">🔄 正在從雲端載入真實審核名單中...</p>';
      const url = `${GAS_API_URL}?action=get_admin_list&token=${encodeURIComponent(currentToken)}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.status === "success") {
        allSubmissions = data.submissions || [];
        updateCounts();
        renderSubmissions();
        return;
      } else {
        alert("❌ " + (data.message || "驗證失敗或讀取錯誤"));
      }
    } catch (err) {
      console.warn("GAS 雲端拉取失敗，自動讀取本地儲存庫:", err);
    }
  }

  // 情況 2：讀取本地儲存庫中的真實上傳案件
  try {
    const rawData = localStorage.getItem(LOCAL_STORAGE_KEY);
    allSubmissions = rawData ? JSON.parse(rawData) : [];
  } catch (e) {
    allSubmissions = [];
  }

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
 * 解析媒體網址：將 Google Drive 網址轉換為直接可嵌入 <img> 的縮圖網址
 */
function getMediaEmbedUrl(url) {
  if (!url || url === "無照片佐證") return "puzzle.svg";

  // 若為 Base64 圖片直接回傳
  if (url.startsWith("data:image")) return url;

  // 解析 Google Drive 檔案 ID
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    const fileId = match[1];
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
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
      <div style="grid-column: 1/-1; text-align: center; padding: 50px 20px; background: #FFFFFF; border-radius: 16px; border: 1.5px dashed #C8E6C9;">
        <span style="font-size: 40px; display: block; margin-bottom: 12px;">📭</span>
        <h3 style="font-size: 17px; color: #193828; margin-bottom: 6px; font-weight: 700;">目前尚無任何案件紀錄</h3>
        <p style="font-size: 13px; color: #537562; max-width: 420px; margin: 0 auto 16px auto;">
          本系統不包含任何預設假資料。請先至前台首頁填寫表單並上傳照片，送出後的真實案件將即時顯示於此處！
        </p>
        <a href="index.html" style="display: inline-block; background: #2E7D32; color: #FFFFFF; text-decoration: none; padding: 8px 20px; border-radius: 20px; font-size: 13px; font-weight: 700;">
          ⬅️ 前往首頁上傳任務
        </a>
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
        <div class="sub-title">👤 ${escapeHtml(item.nickname || '未填寫暱稱')}</div>
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

  // 1. 本地儲存庫實時更新
  const target = allSubmissions.find(s => s.rowId === rowId);
  if (target) {
    target.status = status;
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(allSubmissions));
    } catch (e) {
      console.warn("LocalStorage 寫入異常:", e);
    }
  }

  // 2. 若有設定 GAS 雲端 API，同步更新雲端試算表
  if (GAS_API_URL && GAS_API_URL !== "YOUR_GAS_WEB_APP_URL") {
    try {
      await fetch(GAS_API_URL, {
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

  updateCounts();
  renderSubmissions();
  
  alert(`✅ 審核完成！已將此任務標記為「${status}」。\n${status === '通過' ? '前台首頁將即時點亮拼圖並累計減碳數據！' : '該案件已被退回。'}`);
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
