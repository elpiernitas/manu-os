// Datos del DJ en ESTE dispositivo (IndexedDB «manuos-dj»): catálogo de Spotify, tu historial
// importado (derivado, sin IP ni país), el registro de eventos del DJ, la semántica de tus playlists y
// tus etiquetas de idioma. Fuera del vault y de Tu nube; dentro de la copia completa cifrada.
const DB = "manuos-dj", STORE = "kv";
function open(idb = globalThis.indexedDB) {
  return new Promise((resolve, reject) => {
    if (!idb) { reject(new Error("Este navegador no guarda datos del DJ")); return; }
    const req = idb.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function tx(mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode); const r = fn(t.objectStore(STORE));
    t.oncomplete = () => { db.close(); resolve(r?.result); };
    t.onerror = () => { db.close(); reject(t.error); };
  }));
}
export const djGet = (k) => tx("readonly", (s) => s.get(k));
export const djSet = (k, v) => tx("readwrite", (s) => s.put(v, k));
export const djDel = (k) => tx("readwrite", (s) => s.delete(k));
export const DJ_DB = DB;
