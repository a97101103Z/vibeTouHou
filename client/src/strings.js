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
export const BTN_UPLOAD            = t("⬆ Upload",                                            "⬆ 上傳");
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

// ── Collapsed sidebar ──────────────────────────────────────────────────────────
export const GALLERY_LABEL         = t("Gallery",                                             "彈幕畫廊");
export const CONTROLS_HINT         = t("SHIFT = focus · WASD / ↕↔ = move",                   "SHIFT = 集中 · WASD / ↕↔ = 移動");

// ── Gauntlet section ───────────────────────────────────────────────────────────
export const SECTION_GAUNTLET      = t("Gauntlet",                                            "實戰");
export const BTN_BEGIN             = t("▶ Begin",                                             "▶ 開始");
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
export const LB_SCORE_PERFECT      = tf((s) => `Perfect + ${s}s∞`,                           (s) => `完美 + ${s}s∞`);
export const LB_SCORE_HITS         = tf((h) => `${h} hit${h !== 1 ? "s" : ""}`,              (h) => `${h} 次`);

// ── Gallery widget ─────────────────────────────────────────────────────────────
export const NO_GALLERY_ENTRIES    = t("No entries yet.",                                     "尚無入選作品。");
export const GALLERY_VIDEO_LABEL   = tf((i) => `Video ${i}`,                                  (i) => `影片 ${i}`);
export const GALLERY_HITS_DISPLAY  = tf((h) => `${h}h`,                                       (h) => `${h} 次`);

// ── Play area / HUD ────────────────────────────────────────────────────────────
export const SECTION_PLAY          = t("Play",                                                 "試玩");
export const OVERLAY_TITLE_DEFAULT = t("Play",                                                 "試玩");
export const OVERLAY_SUB_DEFAULT   = t("Select a mode to begin.",                             "選擇模式以開始。");
export const HUD_HITS_INIT         = t("Hits: 0",                                             "受傷次數：0");
export const HITS_DISPLAY          = tf((n) => `Hits: ${n}`,                                   (n) => `受傷次數：${n}`);

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
export const BTN_PUBLISH           = t("Publish",                                             "發布");
export const TRY_AGAIN_SUB         = t("Try again to unlock Publish.",                        "再試一次以解鎖發布功能。");
export const HITS_TAKEN_TITLE      = tf((n) => `${n} Hit${n > 1 ? "s" : ""} Taken`,          (n) => `被打中 ${n} 次`);

// ── Gauntlet mode ──────────────────────────────────────────────────────────────
export const NO_PATTERNS_TITLE     = t("No Patterns",                                         "尚無彈幕");
export const NO_PATTERNS_SUB       = t("The opposing team has not published any patterns yet.", "對手隊伍尚未發布任何彈幕。");
export const GAUNTLET_MODE_TITLE   = t("Gauntlet Mode",                                       "實戰模式");
export const GAUNTLET_MODE_SUB     = t("Face every pattern published by the opposing team. Real hitbox. No mercy.", "挑戰對手隊伍發布的全部彈幕。盡可能無傷通關吧！");
export const PERFECT_GAUNTLET_TITLE= t("🎉 Perfect Gauntlet!",                               "🎉 完美通關！");
export const BTN_INFINITE          = t("♾ Infinite Mode",                                     "♾ 無盡模式");
export const BTN_RUN_AGAIN         = t("↩ Run Again",                                         "↩ 再挑一次");
export const IMPROVE_SCORE_SUB     = t("Run the gauntlet again to improve your score.<br><br>", "再挑一次以提升成績。<br><br>");
export const PERFECT_GAUNTLET_SUB  = tf((n) => `You took 0 hits across all ${n} patterns.<br><br>`, (n) => `全部 ${n} 個彈幕均零次受傷。<br><br>`);
export const TOTAL_HITS_TITLE      = tf((n) => `${n} Hit${n !== 1 ? "s" : ""} Total`,         (n) => `共被打中 ${n} 次`);
export const SUMMARY_HITS          = tf((h) => `${h}h`,                                        (h) => `${h} 次`);
export const SUMMARY_TOTAL         = tf((n) => `Total: ${n} hit${n !== 1 ? "s" : ""}`,        (n) => `共受傷 ${n} 次`);

// ── Infinite mode ──────────────────────────────────────────────────────────────
export const HP_DISPLAY            = tf((rem, max) => `HP: ${rem} / ${max}`,                  (rem, max) => `HP：${rem} / ${max}`);
export const INFINITE_SURVIVED     = tf((s) => `♾ ${s}s Survived`,                            (s) => `♾ 存活了 ${s} 秒`);
export const INFINITE_COMPLETE_SUB = t("Infinite Mode complete. Your score has been recorded.", "無盡模式結束，成績已記錄。");

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
