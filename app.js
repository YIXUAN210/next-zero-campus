/**
 * NEXT ZERO 校園永續拼圖 - 前端互動與直傳邏輯
 */

// 請將此變數替換為您部署的 Google Apps Script Web App URL
const GAS_API_URL = ""; 

const TOTAL_TILES = 9; // 3x3 網格共 9 塊
let currentBase64Image = null;
let currentImageName = "";

document.addEventListener('DOMContentLoaded', () => {
  initGrid();
  loadProgressData();
  setupUploadModal();
});

/**
 * 初始化 3x3 拼圖網格 DOM
 */
function initGrid() {
  const grid = document.getElementById('grid');
  if (!grid) return;
  grid.innerHTML = '';
  for (let i = 0; i < TOTAL_TILES; i++) {
    const tile = document.createElement('div');
    tile.className = 'tile';
    tile.id = `tile-${i}`;
    tile.innerText = i + 1;
    grid.appendChild(tile);
  }
}

/**
 * 設定彈窗與表單事件
 */
function setupUploadModal() {
  const modal = document.getElementById('upload-modal');
  const btnOpen = document.getElementById('btn-open-modal');
  const btnClose = document.getElementById('btn-close-modal');
  const btnCancel = document.getElementById('btn-cancel');
  const fileInput = document.getElementById('input-file');
  const previewContainer = document.getElementById('image-preview-container');
  const previewImg = document.getElementById('image-preview');
  const uploadForm = document.getElementById('upload-form');

  if (btnOpen && modal) {
    btnOpen.addEventListener('click', () => modal.classList.add('active'));
  }

  const closeModal = () => {
    if (modal) modal.classList.remove('active');
    if (uploadForm) uploadForm.reset();
    if (previewContainer) previewContainer.style.display = 'none';
    currentBase64Image = null;
    currentImageName = "";
  };

  if (btnClose) btnClose.addEventListener('click', closeModal);
  if (btnCancel) btnCancel.addEventListener('click', closeModal);

  // 監聽相片選擇與 Base64 轉換
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      currentImageName = file.name;
      const reader = new FileReader();
      reader.onload = (event) => {
        currentBase64Image = event.target.result;
        if (previewImg && previewContainer) {
          previewImg.src = currentBase64Image;
          previewContainer.style.display = 'block';
        }
      };
      reader.readAsDataURL(file);
    });
  }

  // 表單送出處理
  if (uploadForm) {
    uploadForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nickname = document.getElementById('input-nickname').value.trim();
      const taskType = document.getElementById('select-task').value;
      const btnSubmit = document.getElementById('btn-submit');
      const submitText = document.getElementById('submit-text');
      const submitSpinner = document.getElementById('submit-spinner');

      if (!currentBase64Image) {
        alert("請選取或拍攝佐證照片！");
        return;
      }

      // 進入上傳中狀態
      if (btnSubmit) btnSubmit.disabled = true;
      if (submitText) submitText.innerText = "上傳中...";
      if (submitSpinner) submitSpinner.style.display = "inline-block";

      const payload = {
        action: "submit_task",
        nickname: nickname,
        taskType: taskType,
        imageName: currentImageName,
        imageBase64: currentBase64Image
      };

      // 檢查是否已設定 API URL
      if (!GAS_API_URL || GAS_API_URL === "YOUR_GAS_WEB_APP_URL") {
        setTimeout(() => {
          alert("🎉 [展示模式] 任務上傳成功！\n（若已部署 GAS，請在 app.js 填入真實 API 網址以寫入 Google 試算表）");
          if (btnSubmit) btnSubmit.disabled = false;
          if (submitText) submitText.innerText = "確認送出";
          if (submitSpinner) submitSpinner.style.display = "none";
          closeModal();
        }, 1000);
        return;
      }

      try {
        const res = await fetch(GAS_API_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(payload)
        });
        const result = await res.json();

        if (result.status === "success") {
          alert("🎉 " + result.message);
          closeModal();
          loadProgressData(); // 重新整理數據
        } else {
          alert("❌ 上傳失敗：" + (result.message || "未知錯誤"));
        }
      } catch (err) {
        console.error("上傳發生錯誤:", err);
        alert("❌ 網路連線錯誤，請稍後再試！");
      } finally {
        if (btnSubmit) btnSubmit.disabled = false;
        if (submitText) submitText.innerText = "確認送出";
        if (submitSpinner) submitSpinner.style.display = "none";
      }
    });
  }
}

/**
 * 載入審核進度與數據
 */
async function loadProgressData() {
  const progressText = document.getElementById('progress-text');
  const progressBar = document.getElementById('progress-bar-fill');

  if (!GAS_API_URL || GAS_API_URL === "YOUR_GAS_WEB_APP_URL") {
    console.info("💡 尚未設定 GAS_API_URL，預設全遮罩 (0 塊解鎖)。請在 app.js 設定 GAS_API_URL 以即時連動後端審核。");
    const initialData = {
      totalApproved: 0,
      savedKWh: 0.0,
      savedCarbonKG: 0.00
    };
    renderData(initialData, false);
    return;
  }

  try {
    const response = await fetch(GAS_API_URL);
    if (!response.ok) throw new Error(`HTTP Error! Status: ${response.status}`);
    const data = await response.json();
    if (data.status === "error") throw new Error(data.message || "後端回傳錯誤");
    renderData(data, false);
  } catch (error) {
    console.warn("⚠️ API 串接暫時離線，保持預設遮罩狀態:", error);
    if (progressText) progressText.innerText = "等待後端審核連線中...";
    const fallbackData = {
      totalApproved: 0,
      savedKWh: 0.0,
      savedCarbonKG: 0.00
    };
    renderData(fallbackData, false);
  }
}

/**
 * 渲染數據與解鎖拼圖
 */
function renderData(data, isDemo = false) {
  const progressText = document.getElementById('progress-text');
  const progressBar = document.getElementById('progress-bar-fill');

  const approved = parseInt(data.totalApproved || 0, 10);
  const kwh = parseFloat(data.savedKWh || 0);
  const carbon = parseFloat(data.savedCarbonKG || 0);

  animateValue('approved-count', 0, Math.min(approved, TOTAL_TILES), 800);
  animateValue('saved-kwh', 0, kwh, 800);
  animateValue('saved-carbon', 0, carbon, 800);

  const unlockCount = Math.min(approved, TOTAL_TILES);
  const percentage = Math.round((unlockCount / TOTAL_TILES) * 100);

  const progressPercent = document.getElementById('progress-percent');

  if (progressText) {
    progressText.innerText = `已解鎖 ${unlockCount} / ${TOTAL_TILES} 塊 (${percentage}%)`;
  }
  if (progressPercent) {
    progressPercent.innerText = `${percentage}%`;
  }
  if (progressBar) {
    progressBar.style.width = `${percentage}%`;
  }

  // 先清空所有已解鎖狀態（確保未審核通過前全部遮蔽）
  for (let i = 0; i < TOTAL_TILES; i++) {
    const tile = document.getElementById(`tile-${i}`);
    if (tile) {
      tile.classList.remove('unlocked');
    }
  }

  // 僅針對審核通過之數量依序點亮
  for (let i = 0; i < unlockCount; i++) {
    const tile = document.getElementById(`tile-${i}`);
    if (tile) {
      setTimeout(() => {
        tile.classList.add('unlocked');
      }, i * 70);
    }
  }
}

/**
 * 數字平滑滾動遞增動畫
 */
function animateValue(id, start, end, duration) {
  const element = document.getElementById(id);
  if (!element) return;
  const isFloat = end % 1 !== 0;
  let startTimestamp = null;

  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    const currentValue = progress * (end - start) + start;
    
    element.innerText = isFloat ? currentValue.toFixed(1) : Math.floor(currentValue);

    if (progress < 1) {
      window.requestAnimationFrame(step);
    } else {
      element.innerText = isFloat ? end.toFixed(1) : end;
    }
  };

  window.requestAnimationFrame(step);
}
