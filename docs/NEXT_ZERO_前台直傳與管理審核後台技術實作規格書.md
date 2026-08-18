# NEXT ZERO 前台直傳與專屬管理審核後台技術實作規格書

---

## 壹、 系統升級目標與架構定義

本規格書旨在補足專案營運所需的兩大核心模組：
1. **前台內嵌式照片直傳系統（In-Page Direct Upload Modal）**：使用者點擊按鈕即可於當前頁面選取照片、填寫資訊並直接非同步上傳至 Google Drive 與 Google Sheets，無須跳離網站。
2. **專屬視覺化管理審核後台（Admin Review Portal, `admin.html`）**：提供安全密碼認證、卡片式待審核清單、即時照片大圖預覽與一鍵「通過 / 退回」審核操作。

---

## 貳、 系統交互循序圖 (Sequence Diagram)

```mermaid
sequenceDiagram
    autonumber
    actor 師生 as 參與師生 (前台)
    actor 管理員 as 專案管理員 (後台)
    participant 前台 as index.html (直傳彈窗)
    participant 後台 as admin.html (審核管理)
    participant GAS as Google Apps Script (Web App)
    participant Drive as Google Drive (照片儲存庫)
    participant Sheet as Google 試算表 (資料庫)

    %% 使用者上傳流程
    Note over 師生,Sheet: 【前台使用者直傳流程】
    師生->>前台: 點擊「上傳節能任務」開啟 Modal
    師生->>前台: 填寫暱稱、選擇任務 A/B/C、選取相片
    前台->>前台: JavaScript FileReader 轉為 Base64 字串
    前台->>GAS: POST { action: "submit_task", nickname, taskType, imageBase64, imageName }
    GAS->>Drive: 將 Base64 解碼並儲存為實體圖片檔
    Drive-->>GAS: 回傳圖片雲端檢視 URL (viewUrl)
    GAS->>Sheet: 新增資料列 (時間、暱稱、任務、圖片URL、審核狀態="待審核")
    GAS-->>前台: 回傳 { status: "success", message: "上傳成功，等待審核！" }
    前台-->>師生: 顯示成功提示並自動關閉彈窗

    %% 管理員審核流程
    Note over 管理員,Sheet: 【管理員審核流程】
    管理員->>後台: 開啟 admin.html 並輸入管理金鑰 (TOKEN)
    後台->>GAS: GET ?action=get_admin_list&token=NEXTZERO2026
    GAS->>Sheet: 讀取所有「待審核」與「歷史審核」紀錄
    GAS-->>後台: 回傳 JSON 清單 (含照片URL、列號 rowId、時間、任務)
    後台-->>管理員: 渲染卡片式清單與照片縮圖
    管理員->>後台: 點擊特定卡片之「✅ 通過」或「❌ 退回」
    後台->>GAS: POST { action: "audit_task", rowId: 5, status: "通過", token: "..." }
    GAS->>Sheet: 修改第 5 列 E 欄為「通過」
    GAS-->>後台: 回傳 { status: "success" }
    後台-->>管理員: 該卡片即時標記為已審核，儀表板數字即時更新
```

---

## 參、 資料結構與 API 介面規格 (RESTful Schema)

### 一、 `POST` 端點：任務上傳 (`action: submit_task`)
- **請求格式 (Request Payload)**：
  ```json
  {
    "action": "submit_task",
    "nickname": "電機三甲 黃同學",
    "taskType": "任務A. 隨手關閉無人冷氣/電燈",
    "imageName": "task_photo.jpg",
    "imageBase64": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ..."
  }
  ```
- **回應格式 (Response Payload)**：
  ```json
  {
    "status": "success",
    "message": "任務已成功提交，待管理員審核通過後即會點亮拼圖！",
    "fileUrl": "https://drive.google.com/file/d/..."
  }
  ```

---

### 二、 `GET` 端點：管理後台列表 (`action: get_admin_list`)
- **請求參數 (Query Params)**：
  `?action=get_admin_list&token=NEXTZERO2026`
- **回應格式 (Response Payload)**：
  ```json
  {
    "status": "success",
    "submissions": [
      {
        "rowId": 2,
        "timestamp": "2026-08-18T14:30:00.000Z",
        "nickname": "電機三甲 黃同學",
        "taskType": "任務A. 隨手關閉無人冷氣/電燈",
        "photoUrl": "https://drive.google.com/uc?id=...",
        "status": "待審核"
      }
    ]
  }
  ```

---

### 三、 `POST` 端點：執行審核 (`action: audit_task`)
- **請求格式 (Request Payload)**：
  ```json
  {
    "action": "audit_task",
    "token": "NEXTZERO2026",
    "rowId": 2,
    "status": "通過" 
  }
  ```
- **回應格式 (Response Payload)**：
  ```json
  {
    "status": "success",
    "message": "第 2 筆紀錄已更新為 通過"
  }
  ```
