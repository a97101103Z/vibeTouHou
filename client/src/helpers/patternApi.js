/**
 * @param {string} script The pattern script to render
 * @returns {Promise<string>} Resolves with the video URL
 */
export async function render(script) {
  if (!script.trim()) {
    throw new Error("Editor is empty");
  }

  const res = await fetch("/api/render", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ script }),
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.detail || "Submission failed.");
  }

  return await pollRenderStatus();
}

/**
 * @returns {Promise<string>} - Resolves with the video URL
 */
async function pollRenderStatus() {
  while (true) {
    const res = await fetch("/api/render/status", {
      credentials: "include",
    });
    const data = await res.json();

    if (data.status === "done") {
      return data.video_url || "/api/video/my";
    } else if (data.status === "error") {
      throw new Error(data.stderr || "Render failed");
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

/**
 * Publish a pattern trajectory to the server.
 * @param {object} trajectory The trajectory data to publish
 * @returns {Promise<{ok: boolean, message: string}>}
 */
export async function publishPattern(trajectory) {
  const res = await fetch("/api/publish", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trajectory }),
  });
  const data = await res.json();

  if (res.ok) {
    return { ok: true, message: data.message || "Published!" };
  }
  return { ok: false, message: data.detail || "Validation failed." };
}