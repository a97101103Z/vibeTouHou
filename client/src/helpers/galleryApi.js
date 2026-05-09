/**
 * galleryApi.js — thin wrappers for the gallery REST endpoints.
 */

/**
 * Fetch all gallery entries.
 * @returns {Promise<Array<{id: string, title: string, avg_hits: number, filename: string}>>}
 */
export async function fetchGallery() {
  const res = await fetch("/api/gallery");
  if (!res.ok) throw new Error("Failed to load gallery.");
  const data = await res.json();
  return data.entries ?? [];
}

/**
 * Get the streaming URL for a gallery video.
 * @param {string} entryId
 * @returns {string}
 */
export function getGalleryVideoUrl(entryId) {
  return `/api/gallery/${entryId}/video`;
}
