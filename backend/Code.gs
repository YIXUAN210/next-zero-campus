/**
 * NEXT ZERO 校園永續拼圖 - 完整全功能後端 (Google Apps Script)
 * 模組支援：
 *  1. 公開即時數據統計 (GET: 預設)
 *  2. 前台使用者照片直傳 (POST: action=submit_task)
 *  3. 管理員待審核清單 (GET: action=get_admin_list)
 *  4. 管理員一鍵審核操作 (POST: action=audit_task)
 */

// 管理員安全驗證金鑰（請妥善保管，可自訂更換）
var ADMIN_SECRET_TOKEN = "NEXTZERO2026";

// Google Drive 照片存放資料夾名稱（系統會自動尋找或自動建立）
var DRIVE_FOLDER_NAME = "NEXT_ZERO_任務照片庫";

/**
 * 處理 GET 請求
 */
function doGet(e) {
  try {
    var params = e.parameter || {};
    var action = params.action || "get_stats";
    
    var sheet = getOrCreateSheet();
    var data = sheet.getDataRange().getValues();

    // 情況 A：管理員取得待審核清單
    if (action === "get_admin_list") {
      var token = params.token || "";
      if (token !== ADMIN_SECRET_TOKEN) {
        return jsonResponse({ status: "error", message: "管理員安全驗證失敗！" });
      }

      var submissions = [];
      for (var i = 1; i < data.length; i++) {
        var row = data[i];
        if (!row || (!row[0] && !row[1] && !row[2])) continue;
        submissions.push({
          rowId: i + 1, // 試算表實際列號 (1-indexed)
          timestamp: row[0],
          nickname: String(row[1] || "熱心同學"),
          taskType: String(row[2] || ""),
          photoUrl: String(row[3] || ""),
          status: String(row[4] || "待審核").trim() || "待審核"
        });
      }

      // 按時間倒序排列（最新的在最前）
      submissions.reverse();

      return jsonResponse({
        status: "success",
        submissions: submissions
      });
    }

    // 情況 B (預設)：公開即時減碳統計數據
    var totalApproved = 0;
    var taskCounts = { "task1": 0, "task2": 0, "task3": 0, "task4": 0, "task5": 0 };

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var taskText = String(row[2] || "");
      var auditStatus = String(row[4] || "");

      if (auditStatus.trim() === "通過") {
        totalApproved++;
        // 任務 1: 空調 26 度與隨手關閉電源
        if (taskText.indexOf("26") !== -1 || taskText.indexOf("空調") !== -1 || taskText.indexOf("冷氣") !== -1 || taskText.indexOf("任務 1") !== -1 || taskText.indexOf("任務A") !== -1) {
          taskCounts.task1++;
        }
        // 任務 2: 短程爬梯代替搭電梯
        else if (taskText.indexOf("爬梯") !== -1 || taskText.indexOf("樓梯") !== -1 || taskText.indexOf("電梯") !== -1 || taskText.indexOf("任務 2") !== -1 || taskText.indexOf("任務B") !== -1) {
          taskCounts.task2++;
        }
        // 任務 3: 出門時拔除待機電力
        else if (taskText.indexOf("待機") !== -1 || taskText.indexOf("拔除") !== -1 || taskText.indexOf("插頭") !== -1 || taskText.indexOf("任務 3") !== -1) {
          taskCounts.task3++;
        }
        // 任務 4: 自備環保容器與環保杯
        else if (taskText.indexOf("容器") !== -1 || taskText.indexOf("餐具") !== -1 || taskText.indexOf("環保杯") !== -1 || taskText.indexOf("自備") !== -1 || taskText.indexOf("任務 4") !== -1) {
          taskCounts.task4++;
        }
        // 任務 5: 數位節能與設備休眠 (或其它任務)
        else {
          taskCounts.task5++;
        }
      }
    }

    // 能源節省與碳排係數公式計算 (依經濟部能源署及環境部係數)
    // 任務 1: 1.0 kWh, 0.495 kg CO2e (空調節電)
    // 任務 2: 0.2 kWh, 0.099 kg CO2e (爬梯省電)
    // 任務 3: 0.3 kWh, 0.149 kg CO2e (拔除待機電力)
    // 任務 4: 0.1 kWh, 0.150 kg CO2e (自備容器減塑減碳)
    // 任務 5: 0.4 kWh, 0.198 kg CO2e (數位設備休眠)
    var rawKWh = (taskCounts.task1 * 1.0) + (taskCounts.task2 * 0.2) + (taskCounts.task3 * 0.3) + (taskCounts.task4 * 0.1) + (taskCounts.task5 * 0.4);
    var rawCarbon = (taskCounts.task1 * 0.495) + (taskCounts.task2 * 0.099) + (taskCounts.task3 * 0.149) + (taskCounts.task4 * 0.150) + (taskCounts.task5 * 0.198);

    return jsonResponse({
      status: "success",
      totalApproved: totalApproved,
      taskCounts: taskCounts,
      savedKWh: rawKWh.toFixed(1),
      savedCarbonKG: rawCarbon.toFixed(2),
      generatedAt: new Date().toISOString()
    });

  } catch (err) {
    return jsonResponse({ status: "error", message: err.toString() });
  }
}

/**
 * 處理 POST 請求
 */
function doPost(e) {
  try {
    var postData = {};
    if (e.postData && e.postData.contents) {
      postData = JSON.parse(e.postData.contents);
    } else {
      postData = e.parameter || {};
    }

    var action = postData.action || "";
    var sheet = getOrCreateSheet();

    // 1. 前台使用者上傳任務與照片
    if (action === "submit_task") {
      var nickname = String(postData.nickname || "熱心同學").trim();
      var taskType = String(postData.taskType || "任務A").trim();
      var imageBase64 = postData.imageBase64 || "";
      var imageName = postData.imageName || "photo.jpg";
      var photoUrl = "無照片佐證";

      // 儲存照片至 Google Drive
      if (imageBase64 && imageBase64.indexOf("base64,") !== -1) {
        var base64Data = imageBase64.split("base64,")[1];
        var contentType = imageBase64.split(";")[0].split(":")[1] || "image/jpeg";
        var decodedBytes = Utilities.base64Decode(base64Data);
        var blob = Utilities.newBlob(decodedBytes, contentType, new Date().getTime() + "_" + imageName);

        var folder = getOrCreateFolder(DRIVE_FOLDER_NAME);
        var file = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        photoUrl = file.getUrl();
      }

      // 新增列：時間戳記、暱稱、任務選項、照片URL、審核狀態
      var now = Utilities.formatDate(new Date(), "Asia/Taipei", "yyyy/MM/dd HH:mm:ss");
      sheet.appendRow([now, nickname, taskType, photoUrl, "待審核"]);

      return jsonResponse({
        status: "success",
        message: "任務佐證已成功上傳！待管理員審核通過後即會點亮全校拼圖。"
      });
    }

    // 2. 管理員執行單筆審核狀態更新
    if (action === "audit_task") {
      var token = postData.token || "";
      if (token !== ADMIN_SECRET_TOKEN) {
        return jsonResponse({ status: "error", message: "管理員安全驗證失敗！" });
      }

      var rowId = parseInt(postData.rowId, 10);
      var newStatus = String(postData.status || "待審核").trim();

      if (rowId >= 2 && rowId <= sheet.getLastRow()) {
        sheet.getRange(rowId, 5).setValue(newStatus);
        return jsonResponse({
          status: "success",
          message: "第 " + rowId + " 筆任務已更新為「" + newStatus + "」"
        });
      } else {
        return jsonResponse({ status: "error", message: "查無此資料列編號" });
      }
    }

    // 3. 管理員執行一鍵全部統一審核 (Batch Audit)
    if (action === "batch_audit") {
      var token = postData.token || "";
      if (token !== ADMIN_SECRET_TOKEN) {
        return jsonResponse({ status: "error", message: "管理員安全驗證失敗！" });
      }

      var targetStatus = String(postData.status || "通過").trim();
      var lastRow = sheet.getLastRow();
      var updatedCount = 0;

      for (var r = 2; r <= lastRow; r++) {
        var cur = String(sheet.getRange(r, 5).getValue() || "").trim();
        if (cur === "待審核" || cur === "") {
          sheet.getRange(r, 5).setValue(targetStatus);
          updatedCount++;
        }
      }

      return jsonResponse({
        status: "success",
        message: "已成功將 " + updatedCount + " 筆待審核案件統一更新為「" + targetStatus + "」"
      });
    }

    return jsonResponse({ status: "error", message: "未知的 action 操作指令" });

  } catch (err) {
    return jsonResponse({ status: "error", message: err.toString() });
  }
}

/**
 * 輔助函數：取得或建立 Google 試算表工作表
 */
function getOrCreateSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["時間戳記", "暱稱/系級", "執行的節能任務", "任務佐證照片", "審核狀態"]);
    sheet.getRange(1, 1, 1, 5).setFontWeight("bold").setBackground("#e8f5e9");
  }
  return sheet;
}

/**
 * 輔助函數：取得或建立 Google Drive 資料夾
 */
function getOrCreateFolder(folderName) {
  var folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  var newFolder = DriveApp.createFolder(folderName);
  newFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return newFolder;
}

/**
 * 輔助函數：格式化 JSON 回應 (含 CORS 支援)
 */
function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
