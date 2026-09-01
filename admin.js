/**
 * NEXT ZERO 管理審核後台 - 完整全功能即時雲端審核 (v14 旗艦穩定版)
 * 100% 串接 Google Apps Script 雲端試算表與雲端硬碟
 */

const DEFAULT_GAS_API_URL = "https://script.google.com/macros/s/AKfycbxyCYnR-geEtHPLadoAgXqGZB_H66MVsEr8PojrriLkQmOjSPtYyxR9Cm-dMe2o3pkO/exec"; 
const LOCAL_STORAGE_KEY = "NEXT_ZERO_SUBMISSIONS_STORAGE";
const GAS_URL_KEY = "NEXT_ZERO_GAS_URL";
const DEFAULT_TOKEN = "NEXTZERO2026";

let currentToken = DEFAULT_TOKEN;
let allSubmissions = [];
let currentFilter = "all";

/**
 * 取得生效的 GAS API URL
 */
function getActiveGasUrl() {
  try {
    return localStorage.getItem(GAS_URL_KEY) || DEFAULT_GAS_API_URL;
  } catch (e) {
    return DEFAULT_GAS_API_URL;
  }
}

/**
 * 頁面初始化
 */
document.addEventListener('DOMContentLoaded', () => {
  setupAuth();
  setupToolbar();
  setupPhotoModal();

  // 若 sessionStorage 存有 Token，自動登入
  const savedToken = sessionStorage.getItem("NEXT_ZERO_ADMIN_TOKEN");
  if (savedToken) {
    currentToken = savedToken.trim();
    loginSuccess();
  }

  // 跨分頁監聽
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
      let token = tokenInput.value.trim();
      if (!token) token = DEFAULT_TOKEN;

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
  const btnApproveAll = document.getElementById('btn-approve-all');
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

  // 一鍵全部通過 (統一審核)
  if (btnApproveAll) {
    btnApproveAll.addEventListener('click', async () => {
      const pendingList = allSubmissions.filter(s => s.status === "待審核" || !s.status);
      if (pendingList.length === 0) {
        alert("✨ 目前沒有任何「待審核」的案件需要審核！");
        return;
      }

      if (!confirm(`確定要將目前的 ${pendingList.length} 筆待審核案件【一鍵全部通過】審核嗎？`)) return;

      const gasUrl = getActiveGasUrl();
      if (gasUrl) {
        try {
          btnApproveAll.disabled = true;
          btnApproveAll.innerText = "⏳ 正在統一審核中...";

          const res = await fetch(gasUrl, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({
              action: "batch_audit",
              token: currentToken || DEFAULT_TOKEN,
              status: "通過"
            })
          });
          const result = await res.json();
          alert(result.message || "🎉 統一審核完成！已全數標記為「通過」。");
        } catch (gasErr) {
          console.warn("GAS 雲端批次審核異常:", gasErr);
          alert("⚠️ 雲端連線異常，已將本地案件更新。");
        } finally {
          btnApproveAll.disabled = false;
          btnApproveAll.innerText = "⚡ 一鍵全部通過 (統一審核)";
        }
      }

      await fetchSubmissions();
    });
  }

  if (btnRefresh) {
    btnRefresh.addEventListener('click', fetchSubmissions);
  }

  // 快速建立一筆測試案件
  if (btnTestSample) {
    btnTestSample.addEventListener('click', async () => {
      const gasUrl = getActiveGasUrl();
      if (!gasUrl) return;

      try {
        btnTestSample.disabled = true;
        btnTestSample.innerText = "⏳ 建立中...";

        await fetch(gasUrl, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({
            action: "submit_task",
            nickname: "測試同學 (即時模擬)",
            taskType: "任務 1. 教室空調設置成 26 度並隨手關閉電源",
            imageName: "test_sample.jpg",
            imageBase64: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzJlN2QzMiIvPjwvc3ZnPg=="
          })
        });

        alert("✨ 已成功向雲端試算表發送 1 筆測試案件！正在重新載入清單...");
        await fetchSubmissions();
      } catch (err) {
        alert("⚠️ 建立測試案件失敗：" + err);
      } finally {
        btnTestSample.disabled = false;
        btnTestSample.innerText = "🧪 建立測試案件";
      }
    });
  }

  // 清空所有案件
  if (btnClearAll) {
    btnClearAll.addEventListener('click', () => {
      alert("💡 提示：所有真實上傳紀錄已安全儲存於您的 Google 雲端試算表中。\n如需刪除歷史資料，請直接開啟 Google 試算表刪除資料列即可！");
    });
  }

  // 雲端 API 設定
  if (btnConfigGas) {
    btnConfigGas.addEventListener('click', () => {
      const currentUrl = getActiveGasUrl();
      const newUrl = prompt("🌐 當前 Google Apps Script Web App URL：", currentUrl);
      if (newUrl !== null && newUrl.trim()) {
        localStorage.setItem(GAS_URL_KEY, newUrl.trim());
        alert("✅ 雲端 API 網址已更新！");
        fetchSubmissions();
      }
    });
  }
}

/**
 * 載入所有真實任務上傳案件 (直接從 Google 試算表即時拉取)
 */
async function fetchSubmissions() {
  const grid = document.getElementById('submissions-grid');
  if (!grid) return;

  const gasUrl = getActiveGasUrl();
  if (!gasUrl) {
    grid.innerHTML = '<p style="grid-column:1/-1; text-align:center; padding:30px; color:#DC2626;">⚠️ 尚未設定 Google Apps Script 雲端 API 網址！</p>';
    return;
  }

  // 顯示載入動畫狀態
  grid.innerHTML = `
    <div style="grid-column: 1/-1; text-align: center; padding: 40px 20px; color: #2E7D32;">
      <div class="spinner" style="width: 32px; height: 32px; border-width: 3px; border-color: #2E7D32; border-top-color: transparent; margin: 0 auto 12px auto;"></div>
      <p style="font-weight: 700; font-size: 15px;">🔄 正在從 Google 試算表載入最新案件名單...</p>
    </div>
  `;

  try {
    const token = currentToken || DEFAULT_TOKEN;
    const url = `${gasUrl}?action=get_admin_list&token=${encodeURIComponent(token)}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.status === "success") {
      allSubmissions = data.submissions || [];
      updateCounts();
      renderSubmissions();
    } else {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 30px; background: #FEF2F2; border-radius: 16px; border: 1.5px solid #FECACA;">
          <p style="color: #DC2626; font-weight: 700; font-size: 15px;">❌ 讀取失敗：${data.message || '身分驗證失敗'}</p>
          <p style="color: #666; font-size: 13px; margin-top: 6px;">請確認登入密碼是否為 <code>${DEFAULT_TOKEN}</code></p>
        </div>
      `;
    }
  } catch (err) {
    console.error("GAS 雲端拉取異常:", err);
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 30px; background: #FFFBEB; border-radius: 16px; border: 1.5px solid #FDE68A;">
        <p style="color: #D97706; font-weight: 700; font-size: 15px;">⚠️ 雲端連線逾時，請檢查網路或重新整理！</p>
        <button onclick="fetchSubmissions()" style="margin-top: 10px; background: #2E7D32; color: #FFF; border: none; padding: 8px 18px; border-radius: 20px; font-weight: 700; cursor: pointer;">🔄 再次重試</button>
      </div>
    `;
  }
}

/**
 * 更新統計數字看板
 */
function updateCounts() {
  const pending = allSubmissions.filter(s => s.status === "待審核" || !s.status).length;
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
 * 渲染卡片清單
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
        <h3 style="font-size: 18px; color: #193828; margin-bottom: 6px; font-weight: 800;">目前 Google 試算表中尚無此狀態的案件</h3>
        <p style="font-size: 13px; color: #537562; max-width: 440px; margin: 0 auto 18px auto; line-height: 1.6;">
          您可以前往首頁進行任務上傳，或點擊下方按鈕進行審核功能測試！
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
        <span class="sub-badge badge-${item.status || '待審核'}">${item.status || '待審核'}</span>
        <div class="img-hint-overlay">🔍 點擊檢視佐證大圖</div>
      </div>
      <div class="sub-body">
        <div class="sub-title">👤 ${escapeHtml(item.nickname || '熱心同學')}</div>
        <div class="sub-task">📋 ${escapeHtml(item.taskType || '')}</div>
        <div class="sub-time">🕒 提交時間：${escapeHtml(formatTime(item.timestamp))}</div>
        ${isDriveLink ? `
          <a href="${item.photoUrl}" target="_blank" rel="noopener noreferrer" class="link-drive-file" onclick="event.stopPropagation()">
            🔗 在 Google 雲端硬碟開啟原檔
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
 * 格式化時間
 */
function formatTime(t) {
  if (!t) return "";
  try {
    const d = new Date(t);
    if (isNaN(d.getTime())) return String(t);
    return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  } catch (e) {
    return String(t);
  }
}

/**
 * 執行審核動作 (通過 / 退回)
 */
async function auditTask(rowId, status) {
  if (!confirm(`確定要將第 ${rowId} 筆任務設定為「${status}」嗎？`)) return;

  const gasUrl = getActiveGasUrl();
  if (!gasUrl) return;

  try {
    const res = await fetch(gasUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "audit_task",
        token: currentToken || DEFAULT_TOKEN,
        rowId: rowId,
        status: status
      })
    });
    const result = await res.json();
    if (result.status === "success") {
      alert(`✅ 審核完成！已將此任務標記為「${status}」。\n前台首頁將即時點亮拼圖並累計減碳數據！`);
    } else {
      alert("❌ 審核失敗：" + result.message);
    }
  } catch (err) {
    console.error("審核錯誤:", err);
    alert("⚠️ 網路連線錯誤，請稍後重試！");
  }

  await fetchSubmissions();
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
  if (str === null || str === undefined) return "";
  return String(str).replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}
