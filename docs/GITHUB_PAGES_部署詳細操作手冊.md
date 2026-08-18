# NEXT ZERO 校園永續拼圖系統：GitHub Pages 完整部署操作手冊

---

> **【手冊示範資訊】**  
> 本手冊全程以以下示範帳號與專案名稱為例進行教學：  
> - **GitHub 註冊/登入信箱**：`abc@abc.com`  
> - **GitHub 使用者名稱 (Username)**：`abc-user`  
> - **儲存庫名稱 (Repository)**：`next-zero-campus`  
> - **正式上線網址（前台）**：`https://abc-user.github.io/next-zero-campus/`  
> - **正式上線網址（管理後台）**：`https://abc-user.github.io/next-zero-campus/admin.html`

---

## 壹、 部署前準備與檔案確認

請先確認您的專案目錄（`C:\Users\eason\Documents\行動提案`）內已包含以下核心檔案：

```text
行動提案/
├── index.html        # 前台互動拼圖與直傳彈窗
├── style.css         # 前台樣式與動畫
├── app.js            # 前台非同步邏輯
├── puzzle.svg        # 向量拼圖底圖
├── admin.html        # 專屬管理審核後台
├── admin.css         # 後台樣式
├── admin.js          # 後台審核邏輯
└── README.md         # 專案說明文件
```

---

## 貳、 逐步部署操作指南 (Step-by-Step)

### 步驟 1：開啟 PowerShell 並切換至專案目錄
按鍵盤 `Win + X` 選擇 **「Windows PowerShell」** 或 **「終端機」**，執行以下指令切換至專案目錄：

```powershell
cd "C:\Users\eason\Documents\行動提案"
```

---

### 步驟 2：設定 Git 本地身分資訊（以 `abc@abc.com` 為例）
若是第一次使用 Git，請先設定您的提交者姓名與信箱：

```powershell
# 設定使用者名稱
git config --global user.name "abc-user"

# 設定使用者信箱（使用您的示範帳號）
git config --global user.email "abc@abc.com"
```

---

### 步驟 3：在 GitHub 網站上建立遠端儲存庫 (Repository)
1. 開啟瀏覽器前往 [https://github.com/login](https://github.com/login)，使用 `abc@abc.com` 登入您的 GitHub 帳號。
2. 登入後，點擊右上角的 **「+」號圖示** ➔ 選擇 **「New repository」**。
3. 填寫儲存庫資訊：
   - **Repository name**：輸入 `next-zero-campus`
   - **Description (選填)**：輸入 `NEXT ZERO 校園永續拼圖系統`
   - **Public / Private**：請務必選擇 **「Public」**（免費版 GitHub Pages 需設為公開儲存庫）。
   - **Initialize this repository with**：**不要勾選** 任何選項（保持完全空白）。
4. 點擊最下方的綠色按鈕 **「Create repository」**。

---

### 步驟 4：本地初始化並推送程式碼至 GitHub
回到剛才開啟的 PowerShell 視窗，依序複製並貼上執行以下指令：

```powershell
# 1. 初始化本地 Git 儲存庫
git init

# 2. 將所有檔案加入暫存區
git add .

# 3. 建立第一次版本提交
git commit -m "feat: 首次發布 NEXT ZERO 永續拼圖前台與管理後台"

# 4. 將預設分支重新命名為 main
git branch -M main

# 5. 連接至剛建立的 GitHub 遠端儲存庫 (請將 abc-user 替換為您的實際使用者名稱)
git remote add origin https://github.com/abc-user/next-zero-campus.git

# 6. 將程式碼推送至 GitHub 遠端儲存庫
git push -u origin main
```

> [!NOTE]
> **首次推送身分驗證提示**：  
> 當執行 `git push` 時，系統若跳出瀏覽器登入視窗，請點選 **「Sign in with your browser」** 並以 `abc@abc.com` 完成登入授權即可。

---

### 步驟 5：在 GitHub 上啟用 GitHub Pages 靜態網站服務
程式碼推送成功後，即可在 GitHub 上開啟免費的網站託管功能：

1. 在瀏覽器中回到您的 GitHub 儲存庫頁面（`https://github.com/abc-user/next-zero-campus`）。
2. 點擊儲存庫選單最右側的 **「⚙️ Settings」**（設定）。
3. 在左側導航欄中找到並點擊 **「Pages」**。
4. 在 **Build and deployment**（建置與部署）區塊中進行以下設定：
   - **Source**：選擇 `Deploy from a branch`
   - **Branch**：點擊下拉選單選擇 `main`，右側資料夾保持預設的 `/ (root)`。
5. 點擊 **「Save」** 按鈕儲存設定。

---

### 步驟 6：取得正式上線網址並進行線上驗證
1. 點擊「Save」後，GitHub Actions 會自動開始部署（通常耗時約 30 秒～ 1 分鐘）。
2. 重新整理 Pages 設定頁面，上方會出現綠色提示框，顯示您的專屬網站網址：
   $$\text{https://abc-user.github.io/next-zero-campus/}$$

3. **立即進行網頁線上驗證**：
   - **前台拼圖頁面**：開啟 `https://abc-user.github.io/next-zero-campus/`  
     ➔ 測試點擊「📸 點我上傳節能任務佐證」彈窗與拼圖動畫。
   - **管理審核後台**：開啟 `https://abc-user.github.io/next-zero-campus/admin.html`  
     ➔ 輸入預設金鑰 `NEXTZERO2026` 登入，測試一鍵審核功能。

---

## 參、 串接真實 Google 雲端後端 (GAS API) 之設定

當您在 Google 試算表與 Google Apps Script (GAS) 部署好 `Code.gs` 並取得 **Web App 網址** 後，只需兩步驟即可完成前後端連線：

1. **修改前台與後台的 API 網址**：
   - 開啟 `app.js`：將第 6 列修改為您的 GAS 網址：
     ```javascript
     const GAS_API_URL = "https://script.google.com/macros/s/AKfycb.../exec";
     ```
   - 開啟 `admin.js`：將第 6 列修改為相同的 GAS 網址：
     ```javascript
     const GAS_API_URL = "https://script.google.com/macros/s/AKfycb.../exec";
     ```

2. **將更新推送至 GitHub**：
   ```powershell
   git add app.js admin.js
   git commit -m "chore: 串接正式 Google Apps Script 後端 API"
   git push
   ```
   推送後約 30 秒，GitHub Pages 即會自動更新生效！

---

## 肆、 日常修改與更新發布 SOP

未來若有任何網頁內容、文案或樣式修改，只需在本地修改存檔後，於 PowerShell 執行以下標準 3 步驟指令：

```powershell
# 1. 追蹤所有修改過的檔案
git add .

# 2. 撰寫本次更新說明
git commit -m "update: 更新首頁文案與拼圖樣式"

# 3. 推送至 GitHub（系統將自動重新部署上線）
git push
```

---

## 伍、 常見問題與排錯指南 (Troubleshooting FAQ)

### Q1：開啟網址時出現「404 There isn't a GitHub Pages site here」？
- **原因**：GitHub Pages 首次建立通常需要 1~2 分鐘的建置時間。
- **解法**：請稍候 2 分鐘後按下 `Ctrl + F5` 強制重新整理頁面；或確認 Settings ➔ Pages 中的 Branch 是否已設定為 `main` 與 `/ (root)`。

### Q2：管理後台 `admin.html` 網址該如何分享給審核人員？
- 審核人員無需登入 GitHub，直接開啟網址 `https://abc-user.github.io/next-zero-campus/admin.html`，輸入安全金鑰 `NEXTZERO2026` 即可在手機或電腦上進行審核。

### Q3：如何更換管理員登入金鑰 (Token)？
- 前往 Google Apps Script 中的 `Code.gs` 修改 `ADMIN_SECRET_TOKEN` 變數數值，並點擊右上角「部署 ➔ 管理部署作業 ➔ 編輯 ➔ 新版本 ➔ 部署」即可。
