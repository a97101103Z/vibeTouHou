/**
 * GauntletMode — Face every pattern published by the opposing team.
 */
import {
  NO_PATTERNS_TITLE, NO_PATTERNS_SUB,
  GAUNTLET_MODE_TITLE, GAUNTLET_MODE_SUB,
  PERFECT_GAUNTLET_TITLE, PERFECT_GAUNTLET_SUB,
  TOTAL_HITS_TITLE, IMPROVE_SCORE_SUB,
  BTN_INFINITE, BTN_RUN_AGAIN,
  SUMMARY_HITS, SUMMARY_TOTAL,
  HITS_DISPLAY, HUD_HITS_INIT,
} from "../strings.js";

export function initGauntlet(hud, gauntletWidget, onDone) {
  let engine = null;
  let running = false;
  let currentIdx = 0;
  let totalHits = 0;
  let hitsPerPattern = [];

  function stopEngine() {
    if (engine) {
      engine.stop();
      engine = null;
    }
    hud.stopTimerSync();
  }

  async function run(idx) {
    if (running) return;
    if (!gauntletWidget.patterns.length) {
      hud.showOverlay(NO_PATTERNS_TITLE, NO_PATTERNS_SUB, []);
      onDone?.("blocked");
      return;
    }

    running = true;

    hud.showOverlay(GAUNTLET_MODE_TITLE, GAUNTLET_MODE_SUB, []);
    await hud.startCountdown();
    startGame(idx);
  }

  function startGame(idx) {
    stopEngine(); // Ensure current engine/transitions are halted immediately on restart
    currentIdx = idx ?? 0;
    totalHits = 0;
    hitsPerPattern = new Array(gauntletWidget.patterns.length).fill(null);

    hud.setModeIndicator("gauntlet");
    gauntletWidget.resetAllPatternItems();

    playPattern(currentIdx, null, true);
  }

  async function playPattern(idx, initialPlayer, isFirst = false) {
    const p = gauntletWidget.patterns[idx];
    if (!p) {
      endGauntlet();
      return;
    }

    gauntletWidget.activatePatternItem(idx, hitsPerPattern);
    hud.setPattern(`${idx + 1} / ${gauntletWidget.patterns.length}`);
    hud.setPatternVisible(true);
    hud.hideOverlay();

    const nextEngine = hud.createRealEngine(p.video_url, initialPlayer);
    try { await nextEngine.loadVideo(); } catch (_) { }

    stopEngine();
    engine = nextEngine;

    engine.addEventListener("hit", (e) => {
      hud.setHits(HITS_DISPLAY(e.detail.hits));
    });
    engine.addEventListener("finish", () => onPatternFinish(idx));
    engine.addEventListener("restart", () => startGame());
    engine.addEventListener("videoerror", () => {
      hitsPerPattern[idx] = 99;
      gauntletWidget.setPatternItemHits(idx, 99);
      onPatternFinish(idx);
    });

    hud.syncTimer(engine.video);

    if (!isFirst) {
      await engine.runTransition(750, 'black');
    }
    await engine.runTransition(1000, 'fade-in');

    engine.start().catch(() => onPatternFinish(idx));
  }

  async function onPatternFinish(idx) {
    const hits = engine ? engine.hits : 0;
    if (hitsPerPattern[idx] === null || hitsPerPattern[idx] === undefined) {
      hitsPerPattern[idx] = hits;
    }
    const finalHits = hitsPerPattern[idx];
    if (finalHits !== 99) totalHits += finalHits;

    gauntletWidget.deactivatePatternItem(idx);
    gauntletWidget.setPatternItemHits(idx, finalHits);

    if (idx + 1 < gauntletWidget.patterns.length) {
      if (engine) {
        await engine.runTransition(1000, 'fade-out');
        engine.runTransition(999999, 'black');
      }
      playPattern(idx + 1, engine ? engine.player : null, false);
    } else {
      if (engine) await engine.runTransition(1000, 'fade-out');
      stopEngine();
      endGauntlet();
    }
  }

  function endGauntlet() {
    running = false;
    hud.setPatternVisible(false);  // hide pattern counter on result screen

    submitScore();

    const patternsSummary = gauntletWidget.patterns
      .map((p, i) => {
        const h = hitsPerPattern[i];
        return `<div class="summary-list">
                  <span>#${i + 1} ${p.slot}</span>
                  <span class="summary-item ${h === 0 ? "success" : "error"}">${SUMMARY_HITS(h)}</span>
                </div>`;
      })
      .join("");
    const summaryContainer = `
      <div>
        ${patternsSummary}
        <div class="summary-item" style="margin-top: 10px">
          ${SUMMARY_TOTAL(totalHits)}
        </div>
      </div>`;

    if (totalHits === 0) {
      hud.showOverlay(
        PERFECT_GAUNTLET_TITLE,
        PERFECT_GAUNTLET_SUB(gauntletWidget.patterns.length),
        [
          {
            text: BTN_INFINITE,
            action: () => gauntletWidget.dispatchEvent(new CustomEvent("beginInfinite")),
          },
          { text: BTN_RUN_AGAIN, action: () => run() },
        ],
        summaryContainer,
      );
    } else {
      hud.showOverlay(
        TOTAL_HITS_TITLE(totalHits),
        IMPROVE_SCORE_SUB,
        [{ text: BTN_RUN_AGAIN, action: () => run() }],
        summaryContainer,
      );
    }

    onDone?.("finished");
  }

  async function submitScore() {
    try {
      await fetch("/api/score", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hits: totalHits, infinite_time: null }),
      });
    } catch (_) { }
  }

  return { run };
}
