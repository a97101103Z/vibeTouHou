/**
 * ToastManager - Displays toast notifications.
 */
export class ToastManager {
  #container;

  constructor() {
    this.#container = document.createElement("div");
    this.#container.id = "toast-container";
    document.body.appendChild(this.#container);
  }

  /**
   * @param {string} msg
   * @param {'success'|'error'|''} [type='']
   */
  toast(msg, type = "") {
    const el = document.createElement("div");
    el.className = `toast${type ? " toast-" + type : ""}`;
    el.textContent = msg;
    this.#container.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }
}
