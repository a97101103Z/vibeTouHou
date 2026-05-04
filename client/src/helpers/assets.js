export async function loadAssetList() {
  const res = await fetch("/api/assets/list", { credentials: "include" });
  return await res.json();
}

export async function uploadFile(file) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/assets/upload", {
    method: "POST",
    credentials: "include",
    body: fd,
  });
  return { ok: res.ok, data: await res.json() };
}

export async function deleteAsset(name) {
  const res = await fetch(`/api/assets/${encodeURIComponent(name)}`, {
    method: "DELETE",
    credentials: "include",
  });
  return { ok: res.ok, data: await res.json() };
}
