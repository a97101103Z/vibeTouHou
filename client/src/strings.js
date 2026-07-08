/**
 * strings.js — Unified UI string definitions.
 *
 * Every user-visible string lives here.
 * Each entry has an English and a Chinese slot.
 *
 * To translate: edit the SECOND argument of each t() or tf() call.
 *
 * LANG: 0 = English  |  1 = Chinese
 */

const LANG = 1;

/** Returns the active-language static string. */
function t(en, zh) { return LANG === 0 ? en : zh; }

/** Returns the active-language template function. */
function tf(enFn, zhFn) { return LANG === 0 ? enFn : zhFn; }


// ── Login ──────────────────────────────────────────────────────────────────────
export const LOGIN_TAGLINE         = t("Enter your team token to claim your slot.",          "輸入隊伍 Token 以開始遊戲。");
export const TOKEN_PLACEHOLDER     = t("Enter your team token",                               "輸入隊伍 Token");
export const TOKEN_ARIA_LABEL      = t("Team token",                                          "隊伍 Token");
export const CLAIM_BTN             = t("Claim Slot",                                          "開始遊戲");
export const TOAST_ENTER_TOKEN     = t("Please enter your team token.",                       "請輸入隊伍 Token。");
export const TOAST_CLAIM_FAIL      = t("Could not claim slot.",                               "警告:分配隊伍編號時發生錯誤。");
export const TOAST_ASSIGNED        = tf((slot) => `Assigned to ${slot}!`,                     (slot) => `已分配到 ${slot}！`);

// ── Sidebar layout ─────────────────────────────────────────────────────────────
export const SIDEBAR_TITLE         = t("My Pattern",                                          "我的彈幕");
export const SIDEBAR_EXPAND_ARIA   = t("Expand sidebar",                                      "展開");
export const TAB_PATTERN           = t("Pattern",                                              "彈幕");
export const TAB_ASSETS            = t("Assets",                                               "素材");

// ── Pattern tab ────────────────────────────────────────────────────────────────
export const BTN_PLAYTEST          = t("▶ Playtest",                                          "▶ 測試彈幕");
export const BTN_RENDER            = t("⬆ Render",                                            "⬆ 產生彈幕");
export const STATUS_NOT_TESTED     = t("Not tested",                                          "尚未測試");
export const STATUS_TESTED         = t("✓ Tested",                                            "✓ 測試成功");
export const RENDER_STATUS_IDLE    = t("● IDLE",                                              "● 閒置");
export const RENDER_STATUS_QUEUED  = t("◌ QUEUED",                                            "◌ 產生彈幕等待中…");
export const RENDER_STATUS_RUNNING = t("◉ RENDERING…",                                       "◉ 產生彈幕中…");
export const RENDER_STATUS_DONE    = t("✓ DONE",                                              "✓ 完成");
export const RENDER_STATUS_ERROR   = t("✗ ERROR",                                             "✗ 錯誤");
export const TOAST_RENDER_ERROR    = t("Error occured on render. Check the Pattern tab.",     "產生彈幕時發生錯誤，請檢查指令區取得錯誤訊息。");
export const TOAST_NETWORK_ERROR   = t("Network error.",                                      "網路錯誤。");
export const ERR_EDITOR_EMPTY      = t("Editor is empty",                                     "編輯器內沒有程式。");
export const ERR_SUBMISSION_FAIL   = t("Submission failed.",                                  "提交失敗。");
export const ERR_RENDER_TIMEOUT    = t("Render timed out. Try again later.",                  "產生彈幕用的程式執行逾時，請稍後再試。");
export const ERR_RENDER_FAIL       = t("Render failed",                                       "產生彈幕用的程式執行失敗。");
export const TOAST_PUBLISH_OK      = t("Published!",                                          "已成功提交彈幕！");
export const TOAST_VALIDATION_FAIL = t("Validation failed.",                                  "驗證失敗。");

// ── Assets tab ─────────────────────────────────────────────────────────────────
export const DROPZONE_TEXT_HTML    = t("Drag &amp; drop images here, or <strong>click to browse</strong>", "拖曳圖片至此，或<strong>點擊選取圖片</strong>");
export const ASSET_HINT            = t("PNG, JPG, GIF, BMP, WebP — max 10 MB each",          "PNG、JPG、GIF、BMP、WebP — 每個最大 10 MB");
export const YOUR_ASSETS           = t("Your Assets",                                         "我的素材");
export const BTN_REFRESH           = t("↻ Refresh",                                           "↻ 重新整理");
export const LOADING               = t("Loading…",                                            "載入中…");
export const NO_ASSETS             = t("No assets uploaded yet.",                             "尚未上傳任何素材。");
export const ERR_LOAD_ASSETS       = t("Could not load assets.",                              "無法載入素材。");
export const DEL_BTN_TITLE         = t("Delete",                                              "刪除素材");
export const ERR_DELETE            = t("Error occurred while deleting. Please try again later.", "刪除時發生錯誤，請稍後再試。");
export const ASSETS_COUNT          = tf((n) => `${n} asset${n !== 1 ? "s" : ""}`,            (n) => `${n} 個素材`);
export const CONFIRM_DELETE        = tf((name) => `Delete "${name}"?`,                        (name) => `確定要刪除「${name}」嗎？`);
export const TOAST_DELETED         = tf((name) => `Deleted ${name}.`,                         (name) => `已刪除 ${name}。`);
export const TOAST_UPLOADED        = tf((file) => `Uploaded ${file}`,                         (file) => `已上傳 ${file}`);
export const TOAST_UPLOAD_FAIL     = tf((name) => `Upload failed for ${name}.`,               (name) => `${name} 上傳失敗。`);
export const COPIED_LABEL          = t("Copied!",                                              "已複製！");
export const ASSETS_USAGE_HINT    = t("Use assets in your pattern code:",                   "在代碼中使用素材：");
export const ASSETS_CLICK_HINT    = t("Click an asset to copy its filename",                "點擊素材即可複製檔名");

// ── History tab ────────────────────────────────────────────────────────────────
export const TAB_HISTORY          = t("History",                                           "紀錄");
export const HIST_COPY_CODE       = t("Copy Code",                                         "複製程式");
export const HIST_PLAYTEST        = t("▶ Test",                                            "▶ 測試彈幕");
export const HIST_PUBLISH         = t("⬆ Publish",                                         "⬆ 提交彈幕");
export const HIST_ERROR_LINE      = tf((n) => `Error at line ${n}`,                         (n) => `錯誤位置：第 ${n} 行`);
export const HIST_EMPTY           = t("No render history yet.",                            "尚無渲染紀錄。");
export const HIST_LOADING         = t("Loading history…",                                  "載入歷史中…");
export const HIST_ERR_LOAD        = t("Could not load history.",                           "無法載入歷史。");
export const HIST_COPIED          = t("Copied!",                                           "已複製！");
export const HIST_STATUS_OK       = t("✓ Success",                                         "✓ 成功");
export const HIST_STATUS_ERR      = t("✗ Error",                                           "✗ 錯誤");
export const HIST_PUBLISH_OK      = t("Pattern published from history!",                   "已從歷史紀錄提交彈幕！");
export const HIST_PUBLISH_FAIL    = t("Could not publish from history.",                   "從歷史紀錄提交失敗。");
export const BTN_VIEW_RECORD      = t("View Records",                                      "查看紀錄");
export const BTN_COPY_ERROR       = t("Copy Error Message",                                "複製錯誤訊息");
export const ERR_RENDER_PREFIX    = t("Render Error from last submission:",                "上次提交渲染發生錯誤：");

// ── Collapsed sidebar ──────────────────────────────────────────────────────────
export const GALLERY_LABEL         = t("Gallery",                                             "彈幕畫廊");
export const CONTROLS_HINT         = t("SHIFT = focus · WASD / ↕↔ = move",                   "SHIFT = 集中 · WASD / ↕↔ = 移動");

// ── Gauntlet section ───────────────────────────────────────────────────────────
export const SECTION_GAUNTLET      = t("Gauntlet",                                            "實戰");
export const OPPONENT_PATTERNS     = t("Opponent Patterns",                                    "對手彈幕");
export const LEADERBOARD           = t("Leaderboard",                                          "排行榜");
export const NO_SCORES             = t("No scores yet.",                                       "尚無成績。");

// ── Gauntlet phase lock (injected as CSS variable) ─────────────────────────────
export const GAUNTLET_LOCKED_CSS   = t("🔒  Gauntlet locked \u2014 coding phase",             "🔒  彈幕實戰尚未開始 \n 目前仍於程式編輯階段");

// ── Gauntlet widget messages ───────────────────────────────────────────────────
export const COUNTDOWN_LABEL       = t("Gauntlet starts in",                                  "實戰開始倒數");
export const COUNTDOWN_SUB         = t("Finish what you're doing!",                           "趕快把手邊的事情做完！");
export const LOADING_OPP_VIDEOS    = t("⏳ Loading opponent videos…",                         "⏳ 載入對手影片中…");
export const NO_PATTERNS_YET       = t("No published patterns yet.",                          "對手尚未發布任何彈幕。");
export const ERR_LOAD_PATTERNS     = t("Could not load patterns.",                            "無法載入彈幕。");
export const LB_SCORE_HITS         = tf((h) => `${h} hit${h !== 1 ? "s" : ""}`,              (h) => `${h} 次`);

// ── Gallery widget ─────────────────────────────────────────────────────────────
export const NO_GALLERY_ENTRIES    = t("No entries yet.",                                     "尚無入選作品。");
export const GALLERY_VIDEO_LABEL   = tf((i) => `Video ${i}`,                                  (i) => `影片 ${i}`);

// ── Play area / HUD ────────────────────────────────────────────────────────────
export const SECTION_PLAY          = t("Play",                                                 "試玩");
export const OVERLAY_TITLE_DEFAULT = t("Play",                                                 "試玩");
export const OVERLAY_SUB_DEFAULT   = t("Select a mode to begin.",                             "選擇模式以開始。");
export const HUD_HITS_INIT         = t("Hits: 0",                                             "受傷次數：0");
export const HITS_DISPLAY          = tf((n) => `Hits: ${n}`,                                   (n) => `受傷次數：${n}`);
export const MODE_PLAYTEST         = t("PLAYTEST",                                            "試玩模式");
export const MODE_GAUNTLET         = t("GAUNTLET",                                            "實戰模式");

export const MODE_VIEW             = t("VIEW",                                                "畫廊模式");

// ── Playtest mode ──────────────────────────────────────────────────────────────
export const GAUNTLET_ACTIVE_TITLE = t("⚔️ Gauntlet Active",                                  "⚔️ 實戰進行中");
export const GAUNTLET_ACTIVE_SUB   = t("Coding phase is over. Head to the Gauntlet panel to play!", "程式編輯階段已結束，請前往彈幕實戰區域開始挑戰！");
export const NO_PATTERN_TITLE      = t("No Pattern",                                          "尚無彈幕");
export const NO_PATTERN_SUB        = t("Render your pattern first to generate a playtest URL.", "請先生成試玩用影片。");
export const PLAYTEST_TITLE        = t("Playtest Mode",                                       "試玩模式");
export const PLAYTEST_SUB          = t("Survive 10 seconds with zero hits to verify your pattern. Hitbox is slightly larger here.", "在不受到傷害的條件下存活 10 秒即可提交彈幕。試玩時碰撞箱比實戰時略大一些。");
export const VIDEO_ERR_TITLE       = t("Video Error",                                         "影片錯誤");
export const VIDEO_ERR_SUB_PT      = t("Could not load your pattern video.",                  "無法載入彈幕影片。");
export const ERR_TITLE             = t("Error",                                               "錯誤");
export const ERR_START_PLAYTEST    = t("Could not start playtest.",                           "無法啟動試玩。");
export const BTN_RETRY             = t("Retry",                                               "重試");
export const FLAWLESS_TITLE        = t("🎉 Flawless Clear!",                                  "🎉 完美過關！");
export const FLAWLESS_SUB          = t("Pattern confirmed survivable!",                       "彈幕已確認可以存活！");
export const BTN_REPLAY            = t("Replay",                                              "再玩一次");
export const BTN_PUBLISH           = t("Publish",                                             "提交彈幕");
export const TRY_AGAIN_SUB         = t("Try again to unlock Publish.",                        "再試一次，無傷通關以解鎖彈幕提交功能。");
export const HITS_TAKEN_TITLE      = tf((n) => `${n} Hit${n > 1 ? "s" : ""} Taken`,          (n) => `被打中 ${n} 次`);

// ── Gauntlet mode ──────────────────────────────────────────────────────────────
export const NO_PATTERNS_TITLE     = t("No Patterns",                                         "尚無彈幕");
export const NO_PATTERNS_SUB       = t("The opposing team has not published any patterns yet.", "對手隊伍尚未發布任何彈幕。");
export const GAUNTLET_MODE_TITLE   = t("Gauntlet Mode",                                       "實戰模式");
export const GAUNTLET_MODE_SUB     = t("Select a pattern to challenge. Real hitbox. No mercy.", "選擇彈幕進行挑戰。");
export const PERFECT_GAUNTLET_TITLE= t("🎉 Perfect!",                                         "🎉 完美！");

export const BTN_PLAY_AGAIN        = t("↩ Play Again",                                        "↩ 再玩一次");
export const BTN_BACK_TO_LIST      = t("← Back to List",                                      "← 返回列表");
export const SCORE_POINTS          = tf((p) => `${p} pt${p !== 1 ? "s" : ""}`,                (p) => `${p} 分`);
export const LB_TEAM_AVG           = tf((team, avg) => `${team.toUpperCase()} avg: ${avg} pts`, (team, avg) => `${team === "red" ? "紅" : "藍"}隊平均：${avg} 分`);
export const LB_MEMBER             = tf((slot, pts) => `${slot}: ${pts} pts`,                  (slot, pts) => `${slot}：${pts} 分`);
export const PATTERN_HITS_DISPLAY  = tf((h) => h === 0 ? "0 ★" : `${h}h`,                      (h) => h === 0 ? "0 ★" : `${h}次`);
export const PERFECT_RESULT_SUB    = tf((pts) => `Earned ${pts} pts!`,                          (pts) => `獲得 ${pts} 分！`);
export const HITS_RESULT_SUB       = tf((h, pts) => `${h} hit${h !== 1 ? "s" : ""}, ${pts} pts`, (h, pts) => `受傷 ${h} 次，獲得 ${pts} 分`);
export const ZERO_POINTS_SUB       = t("Too many hits — try again!",                           "被打中太多次了，再試一次！");
export const BTN_SELECT_PATTERN    = t("Play",                                                 "挑戰");


// ── View (Gallery) mode ────────────────────────────────────────────────────────
export const NO_VIDEO_TITLE        = t("No Video",                                            "畫廊內尚無彈幕");
export const NO_VIDEO_SUB          = t("No gallery video selected.",                          "尚未選擇畫廊內的彈幕。");
export const GALLERY_VIEW_TITLE    = t("🎬 Gallery View",                                     "🎬 彈幕畫廊試玩");
export const GALLERY_VIEW_SUB      = t("Watch this pattern — survive 10 seconds. No publish available.", "觀看並試玩此彈幕。");
export const VIDEO_ERR_SUB_VIEW    = t("Could not load gallery video.",                       "無法載入此畫廊內的彈幕。");
export const ERR_START_VIEW        = t("Could not start view mode.",                          "無法啟動彈幕畫廊試玩模式。");
export const VIEW_FLAWLESS_TITLE   = t("🎉 Flawless!",                                        "🎉 完美！");
export const VIEW_FLAWLESS_SUB     = t("You survived this pattern.",                          "你無傷通關了此彈幕。");
export const VIEW_RETRY_SUB        = t("Want to try again?",                                  "想再試一次嗎？");
export const BTN_VIEW_REPLAY       = t("Replay",                                              "再玩一次");

// ── Game widget ────────────────────────────────────────────────────────────────
export const TOAST_ALREADY_RUNNING = t("A game mode is already running.",                     "目前有其他正在執行中的彈幕。");
export const TOAST_VIDEO_ERROR     = t("Failed to load video. Returning to list.",          "讀取影片失敗。返回列表。");


