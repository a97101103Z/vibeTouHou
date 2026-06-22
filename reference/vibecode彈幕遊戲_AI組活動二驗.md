# 🎯 vibecode 彈幕遊戲 ── 遊戲二驗說明書

**提案者：** 劉正惟 (a97)  
**日期：** 2026-06-22 

---

## 一、 遊戲配置

| 項目 | 規格說明 |
| :--- | :--- |
| **對抗規模** | 2 隊競爭（每隊約 12 人） |
| **彈幕規格** | 800 x 600 px / 10 秒影片 |
| **彈幕判定** | 純黑底色，像素亮度 Y > 128（亮度大於一半）處視為彈幕碰撞區 |
| **生成工具** | 透過網頁聊天機器人vibecode (以chatGPT/gemini/claude 寫出Python程式) |

---

## 二、 遊戲規則

1. **創作與驗證 (Verify-to-Publish)**：
   - 玩家撰寫 Python 腳本生成彈幕影片。
   - **手動通關校驗**：創作者必須在網頁端「親自無傷通關」該彈幕一次，系統才會允許上傳至題庫。
   - **軌跡錄製**：通關時需同步記錄玩家的移動軌跡（座標序列），供後端核對。

2. **對抗式闖關**：
   - 小隊成員需閃過對方設計的所有彈幕(12個)，可多次嘗試。
   - 系統取整組中「單次最佳紀錄受傷次數最少」者為小隊成績。

3. **無限模式 (Infinite Mode)**：
   - 若小隊無傷破台所有對手彈幕，則進入無限模式。
   - 挑戰隨機抽取的歷史彈幕庫，目標是在 3 次受傷前存活最久。

**勝利條件**：最佳紀錄受傷次數最少者獲勝；若平手，則以無限模式存活紀錄最久者獲勝。

---

## 三、 技術實踐架構

- **雲端渲染**：於伺服器 (ws1) 執行學員提交的 Python 腳本生成影片，避免學員端安裝環境。
- **軌跡驗證機制**：為防範玩家跳過前端判定直接發送「成功」訊號（類似 OWASP Juice Shop 類型的封包攻擊），伺服器端將會利用儲存的影片與上傳的移動軌跡進行「後端二次判定」，確認路徑中無像素碰撞。
- **挑戰驗證機制**：同樣的判定也被用於檢查玩家提交的。

---

針對你的三個問題，以下是詳細的解答：

### 1. 全重置要先 `docker compose down` 嗎？
**強烈建議先 `down`。**
你的流程 `down` ➔ `跑腳本` ➔ `up -d` 是**最完美且最安全**的做法。如果伺服器還在運作時強制搬移 `data` 資料夾，有可能會因為檔案正在被寫入而產生錯誤（尤其是 Windows 系統很容易卡 File Lock）。先 down 掉就可以確保所有檔案都解除佔用，安全乾淨地重置。

### 2. down、full reset、up之間，鎖定的程式會自動解鎖嗎？
**會自動解鎖。**
伺服器的狀態（包含現在是不是鎖定的 gauntlet 階段）會隨著 Docker 容器被 down 掉而清空記憶體。再加上 full reset 已經把 `data` 目錄整個換新了，所以當你重新 `up` 起來時，伺服器會完全回到剛啟動的預設狀態——也就是**所有人解鎖、可以自由寫程式的階段**。

### 3. 那些反斜線是 Windows 在用的吧？到時候架在 Linux 上還要嗎？
**你說到重點了！** 那些 `\"` 是為了在 Windows 的 CMD 裡面讓「雙引號包住雙引號」才妥協加上的。
如果之後架在 Linux 上（使用 bash 等終端機），最外層請直接改用**單引號 (`'`)**，裡面就**完全不用加反斜線了**，指令會變得超級乾淨！

---

這裡幫你把你整理的**「四、關主操作方式」**稍微微調一下，把 Linux 版乾淨的指令也放進去，你可以直接複製去更新你的 README：

```markdown
## 四、關主操作方式

### 每輪 / 輪跟輪之間大致步驟
1. 關閉伺服器：`docker compose down`
2. 執行全重置腳本
3. 啟動伺服器：`docker compose up -d`
4. (若有需要，中途可執行單獨帳號重置)
5. 程式寫得差不多後，打指令鎖定程式 (進入 Gauntlet 階段)
6. 實戰玩完後，把很酷的彈幕加進畫廊

### 具體指令

GitHub 上有把 Docker 環境建置好的說明：
https://github.com/a97101103Z/vibeTouHou/blob/main/deploy/README.md

記得去創一個 `.env` 並提供 Team Token，如以下示範：

```env
# .env
RED_TEAM_TOKEN=super_secret_red_key_123
BLUE_TEAM_TOKEN=super_secret_blue_key_456
ADMIN_TOKEN=super_secret_admin_key_789
```

建議每次對戰都獨立改一組 token，以免有人亂登、提早登，或登到別人隊的帳號。


一、遊戲告終的 Full Reset   
直接在 Host 機器上依序跑：
```bash
docker compose down
python reset_environment.py
docker compose up -d
```

二、某人搞事帳號炸了時的單 Slot Reset
直接在 Host 機器上跑：
```bash
python reset_slot.py --url http://localhost:12345
```

三、進實戰段落，程式不能再寫時的鎖定 (Gauntlet Phase)  
(注意：要把 `your_admin_secret_here` 換成你的 ADMIN_TOKEN)
```bash
# Linux / Mac ：
curl -X POST -H "Content-Type: application/json" -d '{"admin_token":"your_admin_secret_here","phase":"gauntlet"}' http://localhost:12345/api/admin/set-phase
```

四、假設鎖爛了，要重新開放寫程式 (Reset Phase)
(這個也要把 `your_admin_secret_here` 換成你的 ADMIN_TOKEN) 
```bash
# Linux / Mac：
curl -X POST -H "Content-Type: application/json" -d '{"admin_token":"your_admin_secret_here"}' http://localhost:12345/api/admin/reset-phase
```

五、把表現不錯的彈幕設計加入畫廊 (Gallery)
(注意：要填入標題 title、平均受傷次數 avg_hits、隊伍 team 與編號 index)
```bash
# Linux / Mac：
curl -X POST -H "Content-Type: application/json" -d '{"admin_token":"your_admin_secret_here","title":"RED-3","avg_hits":2.4,"team":"red","index":3}' http://localhost:12345/api/admin/gallery
```

六、撤回一組進畫廊的東西  
```bash
# Linux / Mac：
curl -X DELETE -H "Content-Type: application/json" -d '{"admin_token":"your_admin_secret_here","id":"abc123"}' http://localhost:12345/api/admin/gallery
```

--- 

## 六、 其餘細項

- 彈幕判定的 Y > 128 可能會於後期平衡的時候再滾動式調整。
- 影片壓縮可能會讓像素顏色改變、影響規模有待評估。
- 除ws1外、也有可能直接到時候用教室其中一台電腦架設伺服器
- **特別贊助**：莊沅翰