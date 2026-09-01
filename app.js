/**
 * NEXT ZERO 校園永續拼圖 - 前端互動與直傳核心邏輯 (v12 終極高相容版)
 * 支援：同步輕量持久化 + 非阻塞非同步 IndexedDB + 雲端同步 + 零卡頓保護
 */

const DEFAULT_GAS_API_URL = "https://script.google.com/macros/s/AKfycbxyCYnR-geEtHPLadoAgXqGZB_H66MVsEr8PojrriLkQmOjSPtYyxR9Cm-dMe2o3pkO/exec"; 
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
  try {
    return localStorage.getItem(GAS_URL_KEY) || DEFAULT_GAS_API_URL || "";
  } catch (e) {
    return DEFAULT_GAS_API_URL || "";
  }
}

/**
 * ==========================================================================
 * EcoDB: 極速同步 LocalStorage + 背景 IndexedDB 永不卡頓儲存庫
 * ==========================================================================
 */
const EcoDB = {
  // 從 LocalStorage 獲取案件清單 (極速同步，相容所有手機與無痕模式)
  getAll() {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.warn("LocalStorage 讀取警告:", e);
      return [];
    }
  },

  // 新增案件 (立即寫入 LocalStorage，並在背景寫入 IndexedDB)
  async add(item) {
    // 1. 同步寫入 LocalStorage (確保 0 毫秒立即完成，絕不卡死)
    try {
      let list = this.getAll();
      list.unshift(item);
      // 若超過 50 筆，保留最新 50 筆確保效能
      if (list.length > 50) list = list.slice(0, 50);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
    } catch (storageErr) {
      console.warn("LocalStorage 儲存警示 (縮小快取):", storageErr);
      try {
        // 若空間不足，縮小照片只保留縮圖
        let list = this.getAll();
        const compactItem = Object.assign({}, item, { photoUrl: "puzzle.svg" });
        list.unshift(compactItem);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list.slice(0, 20)));
      } catch (e) {}
    }

    // 2. 背景非阻塞寫入 IndexedDB (帶超時保護，避免手機無痕模式掛起)
    try {
      if (window.indexedDB) {
        const idbPromise = new Promise((resolve) => {
          const req = indexedDB.open(DB_NAME, 1);
          req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
              db.createObjectStore(STORE_NAME, { keyPath: "rowId" });
            }
          };
          req.onsuccess = (e) => {
            try {
              const db = e.target.result;
              const tx = db.transaction(STORE_NAME, "readwrite");
              tx.objectStore(STORE_NAME).put(item);
              resolve();
            } catch (err) {
              resolve();
            }
          };
          req.onerror = () => resolve();
        });
        
        // 最多等待 500ms，超時直接跳過，絕不阻塞使用者
        await Promise.race([
          idbPromise,
          new Promise(r => setTimeout(r, 500))
        ]);
      }
    } catch (idbErr) {
      console.warn("IndexedDB 背景儲存略過:", idbErr);
    }

    // 觸發自訂廣播事件
    try {
      window.dispatchEvent(new CustomEvent("eco-data-changed"));
    } catch (e) {}
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
 * 智慧相片壓縮函數（快速將相片壓縮至 600px 輕量化 JPEG，大小僅約 30KB～50KB）
 */
function compressImage(file, maxWidth = 600, maxHeight = 600, quality = 0.7) {
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

        try {
          const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedBase64);
        } catch (canvasErr) {
          resolve(e.target.result);
        }
      };
      img.onerror = () => resolve(e.target.result);
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

  // 監聽相片選擇
  if (fileInput) {
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      currentImageName = file.name || "photo.jpg";
      try {
        currentBase64Image = await compressImage(file);
        if (previewImg && previewContainer) {
          previewImg.src = currentBase64Image;
          previewContainer.style.display = 'block';
        }
      } catch (err) {
        console.error("相片處理異常:", err);
      }
    });
  }

  // 表單送出處理 (含完整的超時與按鈕狀態還原保護)
  if (uploadForm) {
    uploadForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nicknameInput = document.getElementById('input-nickname');
      const taskSelect = document.getElementById('select-task');
      const btnSubmit = document.getElementById('btn-submit');
      const submitText = document.getElementById('submit-text');
      const submitSpinner = document.getElementById('submit-spinner');

      const nickname = nicknameInput ? nicknameInput.value.trim() : "同學";
      const taskType = taskSelect ? taskSelect.value : "節能任務";

      if (!currentBase64Image) {
        alert("📸 請選取或拍攝佐證照片！");
        return;
      }

      // 進入處理中狀態
      if (btnSubmit) btnSubmit.disabled = true;
      if (submitText) submitText.innerText = "正在儲存案件...";
      if (submitSpinner) submitSpinner.style.display = "inline-block";

      try {
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

        // 1. 本地立即儲存 (0 毫秒極速寫入)
        await EcoDB.add(newSubmission);

        // 2. 若有設定 Google Apps Script API，背景同步雲端 (設定 3.5 秒超時，絕不卡住網頁)
        const gasUrl = getActiveGasUrl();
        if (gasUrl && gasUrl !== "YOUR_GAS_WEB_APP_URL") {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3500);
            await fetch(gasUrl, {
              method: "POST",
              headers: { "Content-Type": "text/plain;charset=utf-8" },
              body: JSON.stringify({
                action: "submit_task",
                nickname: nickname,
                taskType: taskType,
                imageName: currentImageName,
                imageBase64: currentBase64Image
              }),
              signal: controller.signal
            });
            clearTimeout(timeoutId);
          } catch (gasErr) {
            console.warn("GAS 雲端同步背景處理中或超時:", gasErr);
          }
        }

        // 3. 成功提示與關閉彈窗
        alert(`🎉 任務佐證已成功送出！\n\n- 提交人：${nickname}\n- 任務項目：${taskType}\n- 當前狀態：【待審核】\n\n等待審核後就會點亮拼圖！`);
        closeModal();
        loadProgressData();

      } catch (err) {
        console.error("送出過程中發生錯誤:", err);
        alert("⚠️ 儲存時發生異常，請重試！");
      } finally {
        // 無論成功或失敗，必定還原按鈕狀態！
        if (btnSubmit) btnSubmit.disabled = false;
        if (submitText) submitText.innerText = "確認送出";
        if (submitSpinner) submitSpinner.style.display = "none";
      }
    });
  }
}

/**
 * 載入審核進度與數據計算
 */
async function loadProgressData() {
  const gasUrl = getActiveGasUrl();

  // 情況 1：若有部署 GAS 雲端 API，向雲端拉取
  if (gasUrl && gasUrl !== "YOUR_GAS_WEB_APP_URL") {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const response = await fetch(gasUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (response.ok) {
        const data = await response.json();
        if (data.status === "success") {
          renderData(data);
          return;
        }
      }
    } catch (err) {
      console.warn("GAS 雲端連線略過，自動使用本地計算引擎:", err);
    }
  }

  // 情況 2：從 EcoDB 讀取真實通過之案件
  const storedList = EcoDB.getAll();
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

  const puzzleContainer = document.getElementById('puzzle-container');
  if (puzzleContainer) {
    if (unlockCount >= TOTAL_TILES && TOTAL_TILES > 0) {
      puzzleContainer.classList.add('celebrating');
    } else {
      puzzleContainer.classList.remove('celebrating');
    }
  }

  // 先清空所有已解鎖狀態
  for (let i = 0; i < TOTAL_TILES; i++) {
    const tile = document.getElementById(`tile-${i}`);
    if (tile) {
      tile.classList.remove('unlocked');
    }
  }

  // 僅針對真實審核通過之數量逐塊以 3D 翻轉與能量光暈點亮
  for (let i = 0; i < unlockCount; i++) {
    const tile = document.getElementById(`tile-${i}`);
    if (tile) {
      setTimeout(() => {
        tile.classList.add('unlocked');
      }, 100 + i * 110);
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
