export const API_BASE = import.meta.env.VITE_API_BASE || "/api";
export const BASE_PATH = import.meta.env.VITE_BASE_PATH || "/";

export function apiFetch(input, init) {
  if (typeof input === "string" && input.startsWith("/api/")) {
    return fetch(API_BASE + input.slice(4), init);
  }
  return fetch(input, init);
}
