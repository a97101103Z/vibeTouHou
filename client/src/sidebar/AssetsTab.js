import { loadAssetList, uploadFile, deleteAsset } from "../helpers/assets.js";
import {
  LOADING, NO_ASSETS, ERR_LOAD_ASSETS,
  ASSETS_COUNT, DEL_BTN_TITLE, CONFIRM_DELETE,
  TOAST_DELETED, ERR_DELETE, TOAST_UPLOADED, TOAST_UPLOAD_FAIL,
} from "../strings.js";

/**
 * AssetsTab - Manages the assets tab in the sidebar.
 * @extends EventTarget
 */
export class AssetsTab extends EventTarget {
  #toastService;

  #assetsCountEl;
  #assetsSizeEl;
  #dropZone;
  #fileInput;
  #assetGallery;
  #btnRefreshAssets;
  #btnUploadAssets;

  /**
   * @param {import("../ToastService.js").ToastService} toastService
   */
  constructor(toastService) {
    super();
    this.#toastService = toastService;
  }

  init() {
    this.#cacheDOM();
    this.#setupAssetsListeners();
  }

  #cacheDOM() {
    this.#assetsCountEl = document.getElementById("assets-count");
    this.#assetsSizeEl = document.getElementById("assets-size");
    this.#dropZone = document.getElementById("drop-zone");
    this.#fileInput = document.getElementById("file-input");
    this.#assetGallery = document.getElementById("asset-gallery");
    this.#btnRefreshAssets = document.getElementById("btn-refresh-assets");
    this.#btnUploadAssets = document.getElementById("btn-upload-assets");
  }

  // ── Public ──────────────────────────────────────────────

  async loadGallery() {
    if (!this.#assetGallery) return;

    this.#assetGallery.innerHTML =
      `<div class="loading-message" style="grid-column:1/-1">${LOADING}</div>`;

    try {
      const data = await loadAssetList();
      if (!data.files.length) {
        this.#setAssetsCount(0);
        this.#setAssetsSize(0);
        this.#assetGallery.innerHTML =
          `<div class="loading-message" style="grid-column:1/-1">${NO_ASSETS}</div>`;
      } else {
        this.#assetGallery.innerHTML = "";
        data.files.forEach((f) => {
          this.#assetGallery.appendChild(this.#makeThumb(f));
        });
        this.#setAssetsCount(data.files.length);
        this.#setAssetsSize(
          data.files.reduce((sum, f) => sum + (f.size || 0), 0),
        );
      }
    } catch (_) {
      this.#setAssetsCount(0);
      this.#setAssetsSize(0);
      this.#assetGallery.innerHTML =
        `<div class="loading-message error" style="grid-column:1/-1">${ERR_LOAD_ASSETS}</div>`;
    }
  }

  // ── DOM side effects ───────────────────────────────────

  #setAssetsCount(value) {
    if (this.#assetsCountEl) {
      this.#assetsCountEl.textContent = ASSETS_COUNT(value);
    }
  }

  #setAssetsSize(value) {
    if (this.#assetsSizeEl) {
      const sizeMB = (value / (1024 * 1024)).toFixed(1);
      this.#assetsSizeEl.textContent = `(${sizeMB} MB)`;
    }
  }

  // ── Thumbnails ─────────────────────────────────────────

  #makeThumb({ name }) {
    const wrap = document.createElement("div");
    wrap.className = "asset-thumb";

    const img = document.createElement("img");
    img.src = `/api/assets/${encodeURIComponent(name)}`;
    img.alt = name;
    wrap.appendChild(img);

    const label = document.createElement("div");
    label.className = "asset-name";
    label.textContent = name;
    wrap.appendChild(label);

    const del = document.createElement("button");
    del.className = "asset-del";
    del.title = DEL_BTN_TITLE;
    del.textContent = "×";
    del.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!confirm(CONFIRM_DELETE(name))) return;
      const { ok: deleteOk } = await deleteAsset(name);
      if (deleteOk) {
        wrap.remove();
        this.#toastService.toast(TOAST_DELETED(name));
        await this.loadGallery();
      } else {
        this.#toastService.toast(
          ERR_DELETE,
          "error",
        );
      }
    });
    wrap.appendChild(del);

    return wrap;
  }

  async #uploadFiles(files) {
    for (const file of files) {
      try {
        const { ok, data } = await uploadFile(file);
        if (ok) {
          this.#toastService.toast(TOAST_UPLOADED(data.filename), "success");
        } else {
          this.#toastService.toast(`${file.name}: ${data.detail}`, "error");
        }
      } catch (_) {
        this.#toastService.toast(TOAST_UPLOAD_FAIL(file.name), "error");
      }
    }
    this.loadGallery();
    if (this.#fileInput) this.#fileInput.value = "";
  }

  // ── Listeners ──────────────────────────────────────────

  #setupAssetsListeners() {
    if (!this.#dropZone) return;

    this.#dropZone.addEventListener("click", () => this.#fileInput.click());
    this.#dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      this.#dropZone.classList.add("drag-over");
    });
    this.#dropZone.addEventListener("dragleave", () => {
      this.#dropZone.classList.remove("drag-over");
    });
    this.#dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      this.#dropZone.classList.remove("drag-over");
      this.#uploadFiles([...e.dataTransfer.files]);
    });

    this.#fileInput.addEventListener("change", () => {
      this.#uploadFiles([...this.#fileInput.files]);
    });

    this.#btnRefreshAssets.addEventListener("click", () => this.loadGallery());
    this.#btnUploadAssets.addEventListener("click", () =>
      this.#fileInput.click(),
    );
  }
}
