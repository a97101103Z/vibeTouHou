/**
 * Serialize async task execution. Concurrent triggers collapse into one pending rerun.
 * Useful for keyboard-spam restart actions that should not overlap.
 */
export function createSerialTaskRunner(task) {
  let running = false;
  let rerunRequested = false;

  async function runOnce() {
    running = true;
    try {
      await task();
    } finally {
      running = false;
      if (rerunRequested) {
        rerunRequested = false;
        void runOnce();
      }
    }
  }

  return function trigger() {
    if (running) {
      rerunRequested = true;
      return;
    }
    void runOnce();
  };
}
