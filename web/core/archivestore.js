// «Tu archivo» lives only on this device, in IndexedDB (too big for
// localStorage). Not in the vault, exports or Drive backups.
const DB = "manuos-archive", STORE = "docs";

function open(idb = globalThis.indexedDB) {
  return new Promise((resolve, reject) => {
    if (!idb) { reject(new Error("Este navegador no puede guardar el archivo")); return; }
    const req = idb.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
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

// Re-importing the same export replaces documents with the same id.
export const putDocs = (docs) => tx("readwrite", (s) => { for (const d of docs) s.put(d); });
export const allDocs = () => tx("readonly", (s) => s.getAll());
export const deleteSource = async (source) => {
  const ids = (await allDocs()).filter((d) => d.source === source).map((d) => d.id);
  return tx("readwrite", (s) => { for (const id of ids) s.delete(id); });
};
export function clearArchive(idb = globalThis.indexedDB) {
  return new Promise((resolve) => { try { const r = idb.deleteDatabase(DB); r.onsuccess = r.onerror = r.onblocked = () => resolve(); } catch { resolve(); } });
}
