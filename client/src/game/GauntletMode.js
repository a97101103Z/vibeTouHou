/**
 * GauntletMode — Play a single opponent pattern individually.
 */

import {
  NO_PATTERNS_TITLE, NO_PATTERNS_SUB,
  GAUNTLET_MODE_TITLE, GAUNTLET_MODE_SUB,
  BTN_PLAY_AGAIN, BTN_BACK_TO_LIST,
  HITS_DISPLAY, HUD_HITS_INIT,
  PATTERN_HITS_DISPLAY,
  SCORE_POINTS,
  PERFECT_GAUNTLET_TITLE,
  PERFECT_RESULT_SUB, HITS_RESULT_SUB, ZERO_POINTS_SUB,
  TOAST_VIDEO_ERROR,
} from "../strings.js";

export function initGauntlet(hud, gauntletWidget, toast, onDone) {
  let engine = null;
  let running = false;
  let currentIdx = 0;
  let trajectory = [];

  function stopEngine() {
    if (engine) {
      engine.stop();
      engine = null;
    }
    hud.stopTimerSync();
  }

  async function run(idx) {
    if (running) return;
    if (idx == null || !gauntletWidget.patterns[idx]) {
      hud.showOverlay(NO_PATTERNS_TITLE, NO_PATTERNS_SUB, []);
      onDone?.("blocked");
      return;
    }

    running = true;
    currentIdx = idx;
    trajectory = [];

    hud.showOverlay(GAUNTLET_MODE_TITLE, GAUNTLET_MODE_SUB, []);
    await hud.startCountdown();
    startGame();
  }

  async function startGame() {
    stopEngine();
    hud.setHits(HUD_HITS_INIT);
    hud.setModeIndicator("gauntlet");
    hud.setPattern(`${currentIdx + 1} / ${gauntletWidget.patterns.length}`);
    hud.setPatternVisible(true);
    hud.hideOverlay();

    const p = gauntletWidget.patterns[currentIdx];
    gauntletWidget.activatePatternItem(currentIdx);

    const nextEngine = hud.createRealEngine(p.video_url);
    try { await nextEngine.loadVideo(); } catch (_) {}

    stopEngine();
    engine = nextEngine;

    engine.addEventListener("hit", (e) => {
      hud.setHits(HITS_DISPLAY(e.detail.hits));
    });

    engine.addEventListener("finish", (e) => {
      trajectory = e.detail.trajectory || [];
      onPatternFinish();
    });

    engine.addEventListener("restart", () => {
      startGame();
    });

    engine.addEventListener("videoerror", () => {
      stopEngine();
      toast?.toast(TOAST_VIDEO_ERROR, "error");
      backToList();
    });

    hud.syncTimer(engine.video);

    await engine.runTransition(1000, 'fade-in');
    engine.start().catch(() => onPatternFinish());
  }

  async function onPatternFinish() {
    const hits = engine ? engine.hits : 0;
    stopEngine();

    await submitScore(hits);
    await gauntletWidget.refreshScores();

    const points = hits <= 2 ? [3, 2, 1][hits] : 0;
    const summary = `
      <div class="summary-list">
        <span>#${currentIdx + 1} ${gauntletWidget.patterns[currentIdx]?.slot || ""}</span>
        <span class="summary-item ${hits === 0 ? "success" : hits <= 2 ? "" : "error"}">
          ${PATTERN_HITS_DISPLAY(hits)} · ${SCORE_POINTS(points)}
        </span>
      </div>
    `;

    const resultTitle = hits === 0
      ? PERFECT_GAUNTLET_TITLE
      : HITS_RESULT_SUB(hits, points);

    const resultSub = hits === 0
      ? PERFECT_RESULT_SUB(points)
      : points > 0 ? "" : ZERO_POINTS_SUB;

    hud.showOverlay(
      resultTitle,
      resultSub,
      [
        { text: BTN_PLAY_AGAIN, action: () => run(currentIdx) },
      ],
      summary,
    );

    running = false;
    onDone?.("finished");
  }

  async function submitScore(hits) {
    try {
      await fetch("/api/score", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pattern_index: gauntletWidget.patterns[currentIdx]?.index,
          hits: hits,
          trajectory: trajectory.length ? trajectory : [],
        }),
      });
    } catch (_) {}
  }

  return { run };
}
