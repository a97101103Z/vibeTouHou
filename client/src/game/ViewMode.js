/**
 * ViewMode — Watch a gallery pattern. Works like playtest (full hitbox, 10s)
 * but never shows Publish and is never blocked by the gauntlet phase lock.
 */
import {
  NO_VIDEO_TITLE, NO_VIDEO_SUB,
  GALLERY_VIEW_TITLE, GALLERY_VIEW_SUB,
  VIDEO_ERR_TITLE, VIDEO_ERR_SUB_VIEW,
  ERR_TITLE, ERR_START_VIEW,
  BTN_RETRY, BTN_VIEW_REPLAY,
  VIEW_FLAWLESS_TITLE, VIEW_FLAWLESS_SUB, VIEW_RETRY_SUB,
  HITS_TAKEN_TITLE,
  HITS_DISPLAY, HUD_HITS_INIT,
} from "../strings.js";

export function initView(hud, onDone) {
  let engine = null;
  let running = false;
  let currentUrl = "";

  function stopEngine() {
    if (engine) {
      engine.stop();
      engine = null;
    }
    hud.stopTimerSync();
  }

  async function run(url) {
    if (running) return;
    if (url) currentUrl = url;

    if (!currentUrl) {
      hud.showOverlay(NO_VIDEO_TITLE, NO_VIDEO_SUB, []);
      onDone?.("blocked");
      return;
    }

    running = true;
    hud.showOverlay(GALLERY_VIEW_TITLE, GALLERY_VIEW_SUB, []);
    await hud.startCountdown();
    startGame();
  }

  function startGame() {
    hud.setModeIndicator("view");
    hud.setPatternVisible(false);

    stopEngine();
    engine = hud.createRealEngine(currentUrl);

    engine.addEventListener("hit", (e) => {
      hud.setHits(HITS_DISPLAY(e.detail.hits));
    });

    engine.addEventListener("finish", (e) => {
      onFinish(e.detail.hits);
    });

    engine.addEventListener("restart", () => startGame());

    engine.addEventListener("videoerror", () => {
      running = false;
      hud.setPatternVisible(true);
      hud.showOverlay(VIDEO_ERR_TITLE, VIDEO_ERR_SUB_VIEW, [
        { text: BTN_RETRY, action: () => run() },
      ]);
      onDone?.("error");
    });

    engine.start().catch(() => {
      running = false;
      hud.setPatternVisible(true);
      hud.showOverlay(ERR_TITLE, ERR_START_VIEW, [
        { text: BTN_RETRY, action: () => run() },
      ]);
      onDone?.("error");
    });

    hud.hideOverlay();
    hud.setHits(HUD_HITS_INIT);
    hud.syncTimer(engine.video);
  }

  function onFinish(hits) {
    running = false;
    stopEngine();
    hud.setPatternVisible(true);

    if (hits === 0) {
      hud.showOverlay(
        VIEW_FLAWLESS_TITLE,
        VIEW_FLAWLESS_SUB,
        [{ text: BTN_VIEW_REPLAY, action: () => run() }],
      );
    } else {
      hud.showOverlay(
        HITS_TAKEN_TITLE(hits),
        VIEW_RETRY_SUB,
        [{ text: BTN_VIEW_REPLAY, action: () => run() }],
      );
    }

    onDone?.("finished");
  }

  return { run };
}
