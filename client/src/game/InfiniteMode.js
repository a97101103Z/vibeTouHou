/**
 * InfiniteMode — Survive through an endless shuffled loop of opponent patterns.
 */
export function initInfinite(hud, gauntletWidget, onDone) {
  const INFINITE_MAX_HITS = 3;

  let engine = null;
  let running = false;
  let hits = 0;
  let totalTime = 0;
  let queue = [];
  let queueIdx = 0;

  function stopEngine() {
    if (engine) {
      engine.stop();
      engine = null;
    }
    hud.stopTimerSync();
  }

  function begin() {
    if (running) return;
    if (!gauntletWidget.patterns.length) {
      hud.showOverlay(
        "No Patterns",
        "The opposing team has not published any patterns yet.",
        [],
      );
      onDone?.("blocked");
      return;
    }
    running = true;
    hits = 0;
    totalTime = 0;
    queueIdx = 0;
    queue = [...gauntletWidget.patterns].sort(() => Math.random() - 0.5);

    hud.setModeIndicator("infinite");
    hud.hideOverlay();
    hud.setHits(`HP: ${INFINITE_MAX_HITS} / ${INFINITE_MAX_HITS}`);
    hud.setPattern("\u221e");

    playPattern(null);
  }

  function playPattern(initialPlayer) {
    if (hits >= INFINITE_MAX_HITS) {
      endInfinite();
      return;
    }

    const p = queue[queueIdx % queue.length];

    stopEngine();
    engine = hud.createRealEngine(p.video_url, initialPlayer);

    engine.addEventListener("hit", () => {
      hits++;
      const remaining = Math.max(0, INFINITE_MAX_HITS - hits);
      hud.setHits(`HP: ${remaining} / ${INFINITE_MAX_HITS}`);
      if (hits >= INFINITE_MAX_HITS) {
        engine.stop();
        endInfinite();
      }
    });

    engine.addEventListener("finish", async () => {
      totalTime += 10;
      const savedPlayer = { x: engine.player.x, y: engine.player.y };
      await engine.runGrace(750);
      stopEngine();
      queueIdx++;
      playPattern(savedPlayer);
    });

    engine.addEventListener("restart", () => {
      running = false;
      begin();
    });

    engine.addEventListener("videoerror", () => {
      queueIdx++;
      const savedPlayer = engine
        ? { x: engine.player.x, y: engine.player.y }
        : null;
      stopEngine();
      playPattern(savedPlayer);
    });

    engine.start().catch(() => {
      queueIdx++;
      stopEngine();
      playPattern(initialPlayer);
    });

    hud.syncTimer(engine.video);
  }

  function endInfinite() {
    running = false;
    stopEngine();
    submitScore();

    hud.showOverlay(
      `\u267e ${totalTime.toFixed(1)}s Survived`,
      "Infinite Mode complete. Your score has been recorded.",
      [{ text: "\u21a9 Run Again", action: () => startGauntlet() }],
    );

    onDone?.("finished");
  }

  function startGauntlet() {
    // dispatches to GameWidget via gauntletWidget
    gauntletWidget.dispatchEvent(new CustomEvent("startGauntlet"));
  }

  async function submitScore() {
    try {
      await fetch("/api/score", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hits: 0, infinite_time: totalTime }),
      });
    } catch (_) {}
  }

  return { begin };
}
