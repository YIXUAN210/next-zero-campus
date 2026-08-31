/**
 * NEXT ZERO 管理審核後台 - 前端邏輯
 */

// 請替換為您部署的 Google Apps Script Web App URL
const GAS_API_URL = ""; 

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
    btnRefresh.addEventListener('click', fetchSubmissions);
  }
}

/**
 * 向後端取得所有任務上傳列表
 */
async function fetchSubmissions() {
  const grid = document.getElementById('submissions-grid');
  grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #6b7280; padding: 40px;">載入審核名單中...</p>';

  // 若未填寫 GAS URL，載入模擬測試資料
  if (!GAS_API_URL || GAS_API_URL === "YOUR_GAS_WEB_APP_URL") {
    console.info("💡 管理後台處於展示模式 (Demo Mode)。");
    allSubmissions = [
      {
        rowId: 2,
        timestamp: "2026/08/29 11:15:20",
        nickname: "電機三甲 黃同學",
        taskType: "任務 1. 教室空調設置成 26 度並隨手關閉電源",
        photoUrl: "puzzle.svg",
        status: "待審核"
      },
      {
        rowId: 3,
        timestamp: "2026/08/29 11:30:45",
        nickname: "資工二乙 林同學",
        taskType: "任務 2. 短程爬梯代替搭電梯",
        photoUrl: "puzzle.svg",
        status: "通過"
      },
      {
        rowId: 4,
        timestamp: "2026/08/29 11:42:10",
        nickname: "電子四甲 趙同學",
        taskType: "任務 3. 出門時拔除待機的電力",
        photoUrl: "puzzle.svg",
        status: "待審核"
      },
      {
        rowId: 5,
        timestamp: "2026/08/29 12:05:33",
        nickname: "企管一丙 王同學",
        taskType: "任務 4. 自備環保容器與環保杯",
        photoUrl: "puzzle.svg",
        status: "通過"
      },
      {
        rowId: 6,
        timestamp: "2026/08/29 12:20:18",
        nickname: "資訊傳播三 陳同學",
        taskType: "任務 5. 數位節能與設備休眠",
        photoUrl: "puzzle.svg",
        status: "待審核"
      }
    ];
    updateCounts();
    renderSubmissions();
    return;
  }

  try {
    const url = `${GAS_API_URL}?action=get_admin_list&token=${encodeURIComponent(currentToken)}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.status === "success") {
      allSubmissions = data.submissions || [];
      updateCounts();
      renderSubmissions();
    } else {
      alert("❌ " + (data.message || "驗證失敗或讀取錯誤"));
    }
  } catch (err) {
    console.error("載入失敗:", err);
    grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #dc2626; padding: 40px;">連線失敗，請檢查 API 網址或網路！</p>';
  }
}

/**
 * 更新統計數字
 */
function updateCounts() {
  const pending = allSubmissions.filter(s => s.status === "待審核").length;
  const approved = allSubmissions.filter(s => s.status === "通過").length;
  const rejected = allSubmissions.filter(s => s.status === "退回").length;

  document.getElementById('count-pending').innerText = pending;
  document.getElementById('count-approved').innerText = approved;
  document.getElementById('count-rejected').innerText = rejected;

  document.getElementById('filter-all-count').innerText = allSubmissions.length;
  document.getElementById('filter-pending-count').innerText = pending;
  document.getElementById('filter-approved-count').innerText = approved;
  document.getElementById('filter-rejected-count').innerText = rejected;
}

/**
 * 渲染卡片清單
 */
/**
 * 解析媒體網址：將 Google Drive 網址轉換為直接可嵌入 <img> 的縮圖網址
 */
function getMediaEmbedUrl(url) {
  if (!url || url === "無照片佐證") return "puzzle.svg";

  // 解析 Google Drive 檔案 ID
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    const fileId = match[1];
    // Google Drive 高畫質縮圖端點
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
  }
  return url;
}

/**
 * 渲染卡片清單
 */
function renderSubmissions() {
  const grid = document.getElementById('submissions-grid');
  grid.innerHTML = '';

  const filtered = allSubmissions.filter(s => {
    if (currentFilter === "all") return true;
    return s.status === currentFilter;
  });

  if (filtered.length === 0) {
    grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #6b7280; padding: 40px;">目前無符合條件的任務紀錄</p>';
    return;
  }

  filtered.forEach(item => {
    const card = document.createElement('div');
    card.className = 'sub-card';
    const embedImgUrl = getMediaEmbedUrl(item.photoUrl);
    const hasValidDriveLink = item.photoUrl && item.photoUrl.indexOf("http") !== -1;

    card.innerHTML = `
      <div class="sub-img-box" onclick="showPhoto('${embedImgUrl}', '${item.photoUrl}')">
        <img src="${embedImgUrl}" alt="佐證照片" loading="lazy" onerror="this.onerror=null; this.src='puzzle.svg';">
        <span class="sub-badge badge-${item.status}">${item.status}</span>
        <div class="img-hint-overlay">🔍 點擊查看大圖 / 影片</div>
      </div>
      <div class="sub-body">
        <div class="sub-title">${escapeHtml(item.nickname)}</div>
        <div class="sub-task">📋 ${escapeHtml(item.taskType)}</div>
        <div class="sub-time">🕒 ${escapeHtml(String(item.timestamp))}</div>
        ${hasValidDriveLink ? `
          <a href="${item.photoUrl}" target="_blank" rel="noopener noreferrer" class="link-drive-file" onclick="event.stopPropagation()">
            🔗 在雲端開啟原檔 / 影片
          </a>
        ` : ''}
      </div>
      <div class="sub-actions">
        <button type="button" class="btn-approve" onclick="auditTask(${item.rowId}, '通過')">✅ 通過</button>
        <button type="button" class="btn-reject" onclick="auditTask(${item.rowId}, '退回')">❌ 退回</button>
      </div>
    `;
    grid.appendChild(card);
  });
}

/**
 * 執行審核動作 (通過 / 退回)
 */
async function auditTask(rowId, status) {
  if (!confirm(`確定要將此筆任務設定為「${status}」嗎？`)) return;

  // 展示模式本地更新
  if (!GAS_API_URL || GAS_API_URL === "YOUR_GAS_WEB_APP_URL") {
    const target = allSubmissions.find(s => s.rowId === rowId);
    if (target) {
      target.status = status;
      updateCounts();
      renderSubmissions();
    }
    return;
  }

  try {
    const res = await fetch(GAS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "audit_task",
        token: currentToken,
        rowId: rowId,
        status: status
      })
    });
    const result = await res.json();
    if (result.status === "success") {
      // 更新本地資料狀態
      const target = allSubmissions.find(s => s.rowId === rowId);
      if (target) target.status = status;
      updateCounts();
      renderSubmissions();
    } else {
      alert("❌ 審核失敗：" + (result.message || "未知錯誤"));
    }
  } catch (err) {
    console.error("審核操作異常:", err);
    alert("❌ 網路請求失敗，請稍候重試！");
  }
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
      driveLink.href = originalUrl || embedUrl;
      driveLink.style.display = (originalUrl && originalUrl.indexOf("http") !== -1) ? 'inline-block' : 'none';
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
