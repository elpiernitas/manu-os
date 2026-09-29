// Screenshots attached to items live only on this device, in IndexedDB
// (localStorage is too small). They are not in exports or Drive backups.
const DB = "manuos-images", STORE = "images";

function open(idb = globalThis.indexedDB) {
  return new Promise((resolve, reject) => {
    if (!idb) { reject(new Error("Este navegador no guarda imágenes")); return; }
    const req = idb.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const out = fn(t.objectStore(STORE));
    t.oncomplete = () => { db.close(); resolve(out?.result); };
    t.onerror = () => { db.close(); reject(t.error); };
  }));
}

export const putImage = (id, dataUrl) => tx("readwrite", (s) => s.put(dataUrl, id));
export const getImage = (id) => tx("readonly", (s) => s.get(id));
export const deleteImage = (id) => tx("readwrite", (s) => s.delete(id));
export function clearImages(idb = globalThis.indexedDB) {
  return new Promise((resolve) => { try { const r = idb.deleteDatabase(DB); r.onsuccess = r.onerror = r.onblocked = () => resolve(); } catch { resolve(); } });
}
