/**
 * i18n.js — Applies strings from strings.js to the DOM.
 *
 * Handles:
 *   data-i18n="KEY"             → sets textContent
 *   data-i18n-placeholder="KEY" → sets placeholder attribute
 *   data-i18n-html="KEY"        → sets innerHTML (for elements with markup)
 *
 * Also sets CSS variables for ::after pseudo-element content.
 */

import * as S from "./strings.js";

export function applyStrings() {
  // Text content
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    if (typeof S[key] === "string") el.textContent = S[key];
  });

  // Placeholder attribute
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.dataset.i18nPlaceholder;
    if (typeof S[key] === "string") el.placeholder = S[key];
  });

  // HTML content (for elements containing inner markup like <strong>)
  document.querySelectorAll("[data-i18n-html]").forEach((el) => {
    const key = el.dataset.i18nHtml;
    if (typeof S[key] === "string") el.innerHTML = S[key];
  });
}
