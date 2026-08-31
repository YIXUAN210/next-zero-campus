/**
 * NEXT ZERO 校園永續拼圖 - 前端互動與直傳核心邏輯 (v8 旗艦穩定版)
 * 整合 IndexedDB + LocalStorage 雙核心持久化引擎 + Google Apps Script 雲端雙向同步
 */

// 預設 Google Apps Script Web App URL（亦可由後台介面動態設定）
const DEFAULT_GAS_API_URL = ""; 
const TOTAL_TILES = 9; // 3x3 網格共 9 塊
const LOCAL_STORAGE_KEY = "NEXT_ZERO_SUBMISSIONS_STORAGE";
const GAS_URL_KEY = "NEXT_ZERO_GAS_URL";
const DB_NAME = "NextZeroCampusDB";
const STORE_NAME = "submissions";

let currentBase64Image = null;
let currentImageName = "";

/**
 * 取得當前生效的 GAS API URL
 */
function getActiveGasUrl() {
  return localStorage.getItem(GAS_URL_KEY) || DEFAULT_GAS_API_URL || "";
}

/**
 * ==========================================================================
 * EcoDB: 瀏覽器 IndexedDB + LocalStorage 雙層無上限儲存引擎
 * ==========================================================================
 */
const EcoDB = {
  // 開啟 IndexedDB
  open() {
    return new Promise((resolve, reject) => {
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

  // 取得所有案件
  async getAll() {
    // 優先讀取 IndexedDB
    try {
      const db = await this.open();
      if (db) {
        return new Promise((resolve) => {
          const tx = db.transaction(STORE_NAME, "readonly");
          const store = tx.objectStore(STORE_NAME);
          const req = store.getAll();
          req.onsuccess = () => {
            const list = req.result || [];
            // 若 IndexedDB 有資料，同步至 LocalStorage
            if (list.length > 0) {
              this.syncToLocalStorage(list);
              resolve(list.sort((a, b) => b.rowId - a.rowId));
              return;
            }
            // 若 IndexedDB 為空，回退讀取 LocalStorage
            resolve(this.getFromLocalStorage());
          };
          req.onerror = () => resolve(this.getFromLocalStorage());
        });
      }
    } catch (e) {
      console.warn("IndexedDB 讀取異常，回退至 LocalStorage:", e);
    }
    return this.getFromLocalStorage();
  },

  // 從 LocalStorage 讀取
  getFromLocalStorage() {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  },

  // 同步輕量摘要至 LocalStorage (供即時跨分頁事件監聽)
  syncToLocalStorage(list) {
    try {
      // 為避免 LocalStorage 5MB 限制，照片超過 100KB 時以縮圖字串快取
      const lightList = list.map(item => ({
        rowId: item.rowId,
        timestamp: item.timestamp,
        nickname: item.nickname,
        taskType: item.taskType,
        status: item.status,
        photoUrl: item.photoUrl && item.photoUrl.length > 200000 ? "puzzle.svg" : item.photoUrl,
        imageName: item.imageName
      }));
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(lightList));
    } catch (e) {
      console.warn("LocalStorage 同步快取警示:", e);
    }
  },

  // 新增案件
  async add(item) {
    // 寫入 IndexedDB
    try {
      const db = await this.open();
      if (db) {
        await new Promise((resolve) => {
          const tx = db.transaction(STORE_NAME, "readwrite");
          const store = tx.objectStore(STORE_NAME);
          store.put(item);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        });
      }
    } catch (e) {
      console.warn("IndexedDB 寫入異常:", e);
    }

    // 寫入 LocalStorage
    let localList = this.getFromLocalStorage();
    localList.unshift(item);
    this.syncToLocalStorage(localList);

    // 發送廣播事件
    window.dispatchEvent(new CustomEvent("eco-data-changed"));
  }
};

/**
 * DOM 載入初始化
 */
document.addEventListener('DOMContentLoaded', () => {
  initGrid();
  loadProgressData();
  setupUploadModal();

  // 跨分頁與同分頁實時監聽
  window.addEventListener('storage', (e) => {
    if (e.key === LOCAL_STORAGE_KEY) {
      loadProgressData();
    }
  });
  window.addEventListener('eco-data-changed', loadProgressData);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) loadProgressData();
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
 * 智慧相片壓縮函數（將高畫質大圖自動壓縮至 800px 輕量化 JPEG）
 */
function compressImage(file, maxWidth = 800, maxHeight = 800, quality = 0.75) {
  return new Promise((resolve) => {
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
      img.onerror = () => {
        // 若圖片無法被 canvas 解碼 (如特殊格式)，直接回傳原始 Base64
        resolve(e.target.result);
      };
      img.src = e.target.result;
    };
    reader.onerror = () => resolve("puzzle.svg");
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
        currentBase64Image = await compressImage(file);
        if (previewImg && previewContainer) {
          previewImg.src = currentBase64Image;
          previewContainer.style.display = 'block';
        }
      } catch (err) {
        console.error("相片讀取失敗:", err);
      }
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
        alert("📸 請選取或拍攝佐證照片！");
        return;
      }

      // 進入上傳中狀態
      if (btnSubmit) btnSubmit.disabled = true;
      if (submitText) submitText.innerText = "正在儲存案件...";
      if (submitSpinner) submitSpinner.style.display = "inline-block";

      const now = new Date();
      const timeStr = `${now.getFullYear()}/${String(now.getMonth()+1).padStart(2,'0')}/${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
      
      const newSubmission = {
        rowId: Date.now(),
        timestamp: timeStr,
        nickname: nickname || "熱心同學",
        taskType: taskType,
        photoUrl: currentBase64Image,
        imageName: currentImageName || "photo.jpg",
        status: "待審核"
      };

      // 1. 寫入本地雙核心儲存庫 (IndexedDB + LocalStorage)
      await EcoDB.add(newSubmission);

      // 2. 若有設定 Google Apps Script API，同步寫入雲端
      const gasUrl = getActiveGasUrl();
      if (gasUrl && gasUrl !== "YOUR_GAS_WEB_APP_URL") {
        try {
          await fetch(gasUrl, {
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
      
      alert(`🎉 任務佐證已成功送出！\n\n- 提交人：${nickname}\n- 任務項目：${taskType}\n- 當前狀態：【待審核】\n\n等待審核後就會點亮拼圖！`);
      closeModal();
      loadProgressData();
    });
  }
}

/**
 * 載入審核進度與數據計算
 */
async function loadProgressData() {
  const gasUrl = getActiveGasUrl();

  // 情況 1：若有部署 GAS 雲端 API，優先向雲端拉取
  if (gasUrl && gasUrl !== "YOUR_GAS_WEB_APP_URL") {
    try {
      const response = await fetch(gasUrl);
      if (response.ok) {
        const data = await response.json();
        if (data.status === "success") {
          renderData(data);
          return;
        }
      }
    } catch (err) {
      console.warn("GAS 雲端暫時離線，自動由本地雙核心引擎計算:", err);
    }
  }

  // 情況 2：從 EcoDB 讀取真實通過之案件
  const storedList = await EcoDB.getAll();
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

  // 5 大任務公式換算
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
