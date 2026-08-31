/**
 * NEXT ZERO 校園永續拼圖 - 前端互動與直傳核心邏輯
 * 支援雙模架構：本地 LocalStorage 持久化引擎 (含智慧圖片壓縮) + Google Apps Script 雲端同步
 */

// Google Apps Script Web App URL（選填，若未填寫則自動啟用本地 LocalStorage 實時持久化引擎）
const GAS_API_URL = ""; 

const LOCAL_STORAGE_KEY = "NEXT_ZERO_SUBMISSIONS_STORAGE";
const TOTAL_TILES = 9; // 3x3 網格共 9 塊
let currentBase64Image = null;
let currentImageName = "";

document.addEventListener('DOMContentLoaded', () => {
  initGrid();
  loadProgressData();
  setupUploadModal();

  // 跨分頁即時監聽：當後台審核通過時，前台自動即時更新拼圖與數據
  window.addEventListener('storage', (e) => {
    if (e.key === LOCAL_STORAGE_KEY) {
      loadProgressData();
    }
  });
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
 * 智慧相片壓縮函數（將高畫質大圖自動壓縮至 800px 輕量化 JPEG，徹底解決 LocalStorage 容量上限問題）
 */
function compressImage(file, maxWidth = 800, maxHeight = 800, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedBase64);
      };
      img.onerror = (err) => reject(err);
      img.src = e.target.result;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
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

  // 監聽相片選擇與自動壓縮處理
  if (fileInput) {
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      currentImageName = file.name;
      try {
        // 執行自動壓縮
        currentBase64Image = await compressImage(file);
        if (previewImg && previewContainer) {
          previewImg.src = currentBase64Image;
          previewContainer.style.display = 'block';
        }
      } catch (err) {
        console.error("相片讀取或壓縮失敗:", err);
        alert("⚠️ 相片讀取失敗，請重新選取照片！");
      }
    });
  }

  // 表單送出處理（實時儲存真實案件）
  if (uploadForm) {
    uploadForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nickname = document.getElementById('input-nickname').value.trim();
      const taskType = document.getElementById('select-task').value;
      const btnSubmit = document.getElementById('btn-submit');
      const submitText = document.getElementById('submit-text');
      const submitSpinner = document.getElementById('submit-spinner');

      if (!currentBase64Image) {
        alert("📸 請選取或拍攝佐證照片！");
        return;
      }

      // 進入上傳中狀態
      if (btnSubmit) btnSubmit.disabled = true;
      if (submitText) submitText.innerText = "處理中...";
      if (submitSpinner) submitSpinner.style.display = "inline-block";

      const now = new Date();
      const timeStr = `${now.getFullYear()}/${String(now.getMonth()+1).padStart(2,'0')}/${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
      
      const newSubmission = {
        rowId: Date.now(),
        timestamp: timeStr,
        nickname: nickname,
        taskType: taskType,
        photoUrl: currentBase64Image,
        imageName: currentImageName,
        status: "待審核"
      };

      // 1. 寫入本地持久化引擎 (LocalStorage)
      let saveSuccess = false;
      try {
        let storedList = [];
        try {
          storedList = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || "[]");
        } catch (parseErr) {
          storedList = [];
        }
        storedList.unshift(newSubmission);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(storedList));
        saveSuccess = true;
      } catch (storageErr) {
        console.warn("LocalStorage 儲存警示 (嘗試二次超壓縮):", storageErr);
        // 若空間不足，嘗試以極致低佔用方式儲存
        try {
          let storedList = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || "[]");
          newSubmission.photoUrl = "puzzle.svg"; // 降級為預設圖示保留文字紀錄
          storedList.unshift(newSubmission);
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(storedList));
          saveSuccess = true;
        } catch (fatalErr) {
          console.error("無法寫入儲存空間:", fatalErr);
        }
      }

      // 2. 若有設定 Google Apps Script API，同步寫入雲端試算表與 Drive
      if (GAS_API_URL && GAS_API_URL !== "YOUR_GAS_WEB_APP_URL") {
        try {
          await fetch(GAS_API_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({
              action: "submit_task",
              nickname: nickname,
              taskType: taskType,
              imageName: currentImageName,
              imageBase64: currentBase64Image
            })
          });
        } catch (gasErr) {
          console.warn("GAS 雲端同步異常，已先保存在本地引擎:", gasErr);
        }
      }

      // 重設按鈕狀態並反饋使用者
      if (btnSubmit) btnSubmit.disabled = false;
      if (submitText) submitText.innerText = "確認送出";
      if (submitSpinner) submitSpinner.style.display = "none";
      
      if (saveSuccess) {
        alert(`🎉 任務佐證已成功送出！\n\n- 提交人：${nickname}\n- 任務項目：${taskType}\n- 狀態：【待審核】\n\n提示：請至管理後台點選「通過」審核，前台即會立即點亮拼圖並累計減碳數據！`);
        closeModal();
        loadProgressData();
      } else {
        alert("⚠️ 儲存發生異常，請重試！");
      }
    });
  }
}

/**
 * 載入審核進度與數據計算
 */
async function loadProgressData() {
  const progressText = document.getElementById('progress-text');
  const progressPercent = document.getElementById('progress-percent');
  const progressBar = document.getElementById('progress-bar-fill');

  // 若有部署 GAS API，優先嘗試向雲端拉取最新統計
  if (GAS_API_URL && GAS_API_URL !== "YOUR_GAS_WEB_APP_URL") {
    try {
      const response = await fetch(GAS_API_URL);
      if (response.ok) {
        const data = await response.json();
        if (data.status === "success") {
          renderData(data);
          return;
        }
      }
    } catch (err) {
      console.warn("GAS 連線暫時離線，自動回退至本地計算引擎:", err);
    }
  }

  // 本地計算引擎 (依據 LocalStorage 中真實通過之案件進行實質統計)
  let storedList = [];
  try {
    storedList = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || "[]");
  } catch (e) {
    storedList = [];
  }

  const approvedList = storedList.filter(item => item.status === "通過");
  
  let task1 = 0, task2 = 0, task3 = 0, task4 = 0, task5 = 0;
  approvedList.forEach(item => {
    const text = String(item.taskType || "");
    if (text.includes("26") || text.includes("空調") || text.includes("冷氣") || text.includes("任務 1")) {
      task1++;
    } else if (text.includes("爬梯") || text.includes("樓梯") || text.includes("電梯") || text.includes("任務 2")) {
      task2++;
    } else if (text.includes("待機") || text.includes("拔除") || text.includes("插頭") || text.includes("任務 3")) {
      task3++;
    } else if (text.includes("容器") || text.includes("餐具") || text.includes("環保杯") || text.includes("任務 4")) {
      task4++;
    } else {
      task5++;
    }
  });

  // 精準加權減碳與省電公式換算 (5大任務係數)
  const savedKWh = (task1 * 1.0 + task2 * 0.2 + task3 * 0.3 + task4 * 0.1 + task5 * 0.4).toFixed(1);
  const savedCarbonKG = (task1 * 0.495 + task2 * 0.099 + task3 * 0.149 + task4 * 0.150 + task5 * 0.198).toFixed(2);

  const calculatedData = {
    totalApproved: approvedList.length,
    savedKWh: savedKWh,
    savedCarbonKG: savedCarbonKG
  };

  renderData(calculatedData);
}

/**
 * 渲染數據與解鎖拼圖
 */
function renderData(data) {
  const progressText = document.getElementById('progress-text');
  const progressPercent = document.getElementById('progress-percent');
  const progressBar = document.getElementById('progress-bar-fill');

  const approved = parseInt(data.totalApproved || 0, 10);
  const kwh = parseFloat(data.savedKWh || 0);
  const carbon = parseFloat(data.savedCarbonKG || 0);

  animateValue('approved-count', 0, Math.min(approved, TOTAL_TILES), 600);
  animateValue('saved-kwh', 0, kwh, 600);
  animateValue('saved-carbon', 0, carbon, 600);

  const unlockCount = Math.min(approved, TOTAL_TILES);
  const percentage = Math.round((unlockCount / TOTAL_TILES) * 100);

  if (progressText) {
    progressText.innerText = `已解鎖 ${unlockCount} / ${TOTAL_TILES} 塊 (${percentage}%)`;
  }
  if (progressPercent) {
    progressPercent.innerText = `${percentage}%`;
  }
  if (progressBar) {
    progressBar.style.width = `${percentage}%`;
  }

  // 先清空所有已解鎖狀態（確保未審核通過前保持遮罩覆蓋）
  for (let i = 0; i < TOTAL_TILES; i++) {
    const tile = document.getElementById(`tile-${i}`);
    if (tile) {
      tile.classList.remove('unlocked');
    }
  }

  // 僅針對真實審核通過之數量逐塊點亮
  for (let i = 0; i < unlockCount; i++) {
    const tile = document.getElementById(`tile-${i}`);
    if (tile) {
      setTimeout(() => {
        tile.classList.add('unlocked');
      }, i * 60);
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
    const currentVal = start + progress * (end - start);
    element.innerText = isFloat ? currentVal.toFixed(isFloat ? (String(end).split('.')[1] || '').length : 0) : Math.floor(currentVal);
    if (progress < 1) {
      window.requestAnimationFrame(step);
    } else {
      element.innerText = isFloat ? end.toFixed((String(end).split('.')[1] || '').length) : end;
    }
  };
  window.requestAnimationFrame(step);
}
