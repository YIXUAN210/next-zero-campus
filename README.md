# NEXT ZERO 校園永續社區拼圖系統

🌱 **日本永續參訪實踐專案 ｜ Serverless Jamstack 互動減碳平台**

---

## 專案特色
- **零主機成本 (Zero Cost)**：採用 GitHub Pages 託管前端，Google Forms + Sheets + GAS 實現無伺服器後端。
- **前台無縫直傳**：整合 HTML5 內嵌拍照上傳彈窗（Modal），直傳 Google Drive 與試算表，免跳轉頁面。
- **專屬管理後台**：提供 `admin.html` 視覺化審核面板，支援安全 Token 登入與一鍵「通過 / 退回」審核。
- **高自由度互動**：CSS Grid 動態拼圖遮罩，隨著全校師生減碳任務審核通過逐塊點亮。
- **數據實證可視化**：即時換算累積節電度數（kWh）與減碳量（kg CO₂e）。

---

## 專案目錄結構
```text
next-zero-campus/
├── index.html        # 前台拼圖主頁面與直傳彈窗
├── style.css         # 前台響應式 UI 與 CSS Grid 拼圖動畫
├── app.js            # 前台非同步 API 資料拉取與數字遞增動畫
├── puzzle.svg        # 向量拼圖底圖（綠色校園插畫）
├── admin.html        # 專屬管理審核後台
├── admin.css         # 管理後台樣式
├── admin.js          # 管理後台審核邏輯與狀態更新
├── README.md         # 專案說明文件
├── backend/
│   ├── Code.gs       # Google Apps Script 雲端全功能 API
│   └── test_api_response.json # API 測試範例 JSON
├── docs/             # 完整專案規格與技術手冊
│   ├── GITHUB_PAGES_部署詳細操作手冊.md
│   ├── NEXT_ZERO_GitHub_Pages多Agent專案執行規格與分工技術文件.md
│   ├── NEXT_ZERO_前台直傳與管理審核後台技術實作規格書.md
│   ├── NEXT_ZERO校園永續拼圖行動提案與技術分析報告.md
│   └── 實體雙語圖卡文宣與場域部署指南.md
└── tests/
    └── QA_E2E測試與減碳效益分析驗證報告.md # E2E 測試查檢表
```

---

## 快速開始 (Quick Start)

### 1. 本地預覽 (Local Preview)
直接使用瀏覽器開啟 `index.html` 或 `admin.html` 即可預覽（系統預設啟用展示 Demo 模式）。

### 2. 正式發布 (GitHub Pages)
進入 Repository ➔ **Settings** ➔ **Pages** ➔ 選擇 `Deploy from a branch` ➔ Branch 選擇 `main` / `/ (root)` ➔ 點擊 **Save**。

- **前台網址**：`https://yixuan210.github.io/next-zero-campus/`
- **管理後台**：`https://yixuan210.github.io/next-zero-campus/admin.html`

---

## 授權聲明
MIT License © 2026 NEXT ZERO Campus Sustainability Initiative
