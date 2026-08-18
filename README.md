# NEXT ZERO 校園永續社區拼圖系統

🌱 **日本永續參訪實踐專案 ｜ Serverless Jamstack 互動減碳平台**

---

## 專案特色
- **零主機成本 (Zero Cost)**：採用 GitHub Pages 託管前端，Google Forms + Sheets + GAS 實現無伺服器後端。
- **高自由度互動**：CSS Grid 動態拼圖遮罩，隨著全校師生減碳任務審核通過逐塊解鎖。
- **數據實證可視化**：即時換算累積節電度數（kWh）與減碳量（kg CO₂e）。

---

## 專案結構
```text
.
├── index.html          # 前端主頁面
├── style.css           # 響應式 UI 與 CSS Grid 拼圖動畫
├── app.js              # 非同步 API 資料拉取與數字遞增動畫
├── puzzle.svg          # 向量拼圖底圖（綠色校園插畫）
├── backend/
│   ├── Code.gs         # Google Apps Script 雲端 API
│   └── test_api_response.json # API 測試範例
├── docs/
│   └── 實體雙語圖卡文宣與場域部署指南.md # 3 款防水圖卡與 QR Code 規格
└── tests/
    └── QA_E2E測試與減碳效益分析驗證報告.md # 完整驗證查檢表
```

---

## 快速開始 (Quick Start)

### 1. 本地預覽
直接使用瀏覽器開啟 `index.html` 即可瀏覽。預設將啟用展示模式（Demo Mode）。

### 2. 部署到 GitHub Pages
1. 在 GitHub 建立一個公開儲存庫（如 `next-zero-campus`）。
2. 將專案根目錄下的 `index.html`、`style.css`、`app.js` 與 `puzzle.svg` 上傳。
3. 進入 Repository ➔ **Settings** ➔ **Pages**。
4. 在 **Build and deployment** 下選擇 `Deploy from a branch`，分支選擇 `main`，目錄選擇 `/ (root)`。
5. 點擊 **Save**，約 1 分鐘後即可取得專屬 HTTPS 網址！

---

## 授權聲明
MIT License © 2026 NEXT ZERO Campus Sustainability Initiative
