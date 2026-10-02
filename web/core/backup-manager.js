// core/backup-manager.js — copia completa de MANU OS en un solo archivo.
//
// Qué guarda:
//   · localStorage: las claves «manuos.*» (el vault y ajustes del dispositivo),
//     EXCEPTO secretos: clave de Gemini, tokens y PKCE de Spotify, y cualquier
//     clave cuyo nombre parezca un secreto. El origen elpiernitas.github.io lo
//     comparten todas las páginas de GitHub Pages de la cuenta, así que nunca
//     se lee localStorage entero.
//   · IndexedDB: todas las bases «manuos-*» (hoy manuos-images y
//     manuos-archive), con todos sus object stores, índices y registros.
//
// Formato (texto JSON, un solo archivo .json):
//   {"format":"manuos-full-backup","version":1,"digest":"<sha-256 hex>","payload":{…}}
//   El digest es el SHA-256 del texto exacto de «payload»: detecta archivos
//   cortados o alterados antes de tocar nada.
//
// Restauración segura: primero se valida TODO (formato, digest, estructura,
// nombres permitidos y el vault con el validador de la app). Después se hace
// una instantánea en memoria del estado actual; si cualquier escritura falla,
// se vuelve a esa instantánea. Un archivo malo nunca llega a escribir.
//
// Sin dependencias. Módulos ES, async/await. La lectura va por lotes y cede el
// hilo entre lotes para no congelar la interfaz.

export const FORMAT = "manuos-full-backup";
export const VERSION = 1;

const LS_PREFIX = "manuos.";
const IDB_PREFIX = "manuos-";
// Bases conocidas: se usan si el navegador no tiene indexedDB.databases().
export const KNOWN_DATABASES = ["manuos-images", "manuos-archive"];
// Nunca salen del dispositivo ni se restauran desde un archivo.
const SECRET_KEYS = new Set(["manuos.gemini", "manuos.spotify.tokens", "manuos.spotify.pkce"]);
const SECRET_PATTERN = /(token|secret|password|passphrase|pkce|apikey|api-key|credential)/i;
// Copias dañadas que LocalStore aparta: no se copian (no son datos válidos).
const SKIP_PATTERN = /\.damaged$/;

const BATCH = 200;                    // registros por lote al leer y escribir
const MAX_FILE_BYTES = 512 * 1024 * 1024;

export const isSecretKey = (k) => SECRET_KEYS.has(k) || SECRET_PATTERN.test(k.slice(LS_PREFIX.length));
const isBackedUpKey = (k) => typeof k === "string" && k.startsWith(LS_PREFIX) && !isSecretKey(k) && !SKIP_PATTERN.test(k);
const isManuDb = (n) => typeof n === "string" && n.startsWith(IDB_PREFIX) && n.length <= 80;

// Cede el hilo principal entre lotes (scheduler.yield si existe).
const yieldToUi = () => (globalThis.scheduler?.yield ? globalThis.scheduler.yield() : new Promise((r) => setTimeout(r, 0)));
const noop = () => {};

// ---------------------------------------------------------------- IndexedDB

const req = (r) => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });

function openDb(idb, name, version) {
  return new Promise((resolve, reject) => {
    const r = version ? idb.open(name, version) : idb.open(name);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.onblocked = () => reject(new Error(`La base ${name} está abierta en otra pestaña. Ciérrala y vuelve a intentarlo.`));
  });
}

async function listDatabases(idb) {
  let names = [];
  if (typeof idb.databases === "function") {
    try { names = (await idb.databases()).map((d) => d.name).filter(isManuDb); } catch { names = []; }
  }
  return [...new Set([...names, ...KNOWN_DATABASES])];
}

// Abrir una base que no existe la crearía vacía: con databases() se evita;
// sin él, se detecta por versión 1 sin stores y se borra al cerrar.
async function openExisting(idb, name) {
  let created = false;
  const db = await new Promise((resolve, reject) => {
    const r = idb.open(name);
    r.onupgradeneeded = (e) => { if (e.oldVersion === 0) created = true; };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  if (created && db.objectStoreNames.length === 0) {
    db.close();
    await new Promise((res) => { const d = idb.deleteDatabase(name); d.onsuccess = d.onerror = d.onblocked = () => res(); });
    return null;
  }
  return db;
}

// Blob/File → objeto JSON; el resto de valores de MANU ya son JSON.
async function encodeValue(v) {
  if (typeof Blob !== "undefined" && v instanceof Blob) {
    const buf = new Uint8Array(await v.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { $manuBlob: { type: v.type, data: btoa(bin) } };
  }
  return v;
}
function decodeValue(v) {
  if (v && typeof v === "object" && v.$manuBlob && typeof v.$manuBlob.data === "string") {
    const bin = atob(v.$manuBlob.data);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: String(v.$manuBlob.type ?? "") });
  }
  return v;
}
const hasBlob = (records) => records.some(([, v]) => v && typeof v === "object" && v.$manuBlob);

// Lee un store por lotes: cada lote en su propia transacción (getAllKeys +
// getAll con el mismo rango devuelven el mismo orden), cediendo entre lotes.
async function readStore(db, storeName, onRecord) {
  let lower = null;
  for (;;) {
    const t = db.transaction(storeName, "readonly");
    const s = t.objectStore(storeName);
    const range = lower === null ? null : IDBKeyRange.lowerBound(lower, true);
    const [keys, values] = await Promise.all([req(s.getAllKeys(range, BATCH)), req(s.getAll(range, BATCH))]);
    for (let i = 0; i < keys.length; i++) await onRecord(keys[i], values[i]);
    if (keys.length < BATCH) return;
    lower = keys[keys.length - 1];
    await yieldToUi();
  }
}

function storeShape(store) {
  return {
    name: store.name,
    keyPath: store.keyPath,
    autoIncrement: store.autoIncrement,
    indexes: [...store.indexNames].map((n) => { const ix = store.index(n); return { name: ix.name, keyPath: ix.keyPath, unique: ix.unique, multiEntry: ix.multiEntry }; }),
  };
}

// Instantánea completa de una base, en memoria (para exportar y para deshacer).
async function snapshotDb(idb, name, onProgress = noop) {
  const db = await openExisting(idb, name);
  if (!db) return null;
  try {
    const out = { name, version: db.version, stores: [] };
    for (const storeName of [...db.objectStoreNames]) {
      const shape = storeShape(db.transaction(storeName, "readonly").objectStore(storeName));
      const records = [];
      await readStore(db, storeName, async (k, v) => { records.push([k, await encodeValue(v)]); });
      out.stores.push({ ...shape, records });
      onProgress({ phase: "read", db: name, store: storeName, count: records.length });
    }
    return out;
  } finally { db.close(); }
}

// Escribe una base completa: crea los stores que falten (subiendo la versión),
// y en UNA transacción por base vacía y rellena cada store. Los lotes se
// encadenan desde el onsuccess de la última escritura, así la transacción sigue
// viva y el hilo respira. Si algo falla, la transacción entera se deshace.
async function writeDb(idb, snap, onProgress = noop) {
  let db = await openDb(idb, snap.name);
  const missing = snap.stores.filter((s) => !db.objectStoreNames.contains(s.name));
  if (missing.length) {
    const next = Math.max(db.version + 1, snap.version);
    db.close();
    db = await new Promise((resolve, reject) => {
      const r = idb.open(snap.name, next);
      r.onupgradeneeded = () => {
        const d = r.result;
        for (const s of missing) {
          const st = d.createObjectStore(s.name, { keyPath: s.keyPath ?? undefined, autoIncrement: Boolean(s.autoIncrement) });
          for (const ix of s.indexes ?? []) st.createIndex(ix.name, ix.keyPath, { unique: ix.unique, multiEntry: ix.multiEntry });
        }
        // Los stores que ya no existen en la copia se vacían, no se borran:
        // la app actual podría usarlos.
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.onblocked = () => reject(new Error(`La base ${snap.name} está abierta en otra pestaña.`));
    });
  }
  const names = [...db.objectStoreNames];
  try {
    await new Promise((resolve, reject) => {
      const t = db.transaction(names, "readwrite");
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error ?? new Error("Error de escritura"));
      t.onabort = () => reject(t.error ?? new Error("Escritura cancelada"));
      const queue = [];
      for (const n of names) {
        const s = t.objectStore(n);
        s.clear();
        const def = snap.stores.find((x) => x.name === n);
        if (def) queue.push({ store: s, def, i: 0 });
      }
      const pump = () => {
        const job = queue[0];
        if (!job) return;
        const { store, def } = job;
        const end = Math.min(job.i + BATCH, def.records.length);
        let last = null;
        for (; job.i < end; job.i++) {
          const [k, v] = def.records[job.i];
          const value = decodeValue(v);
          last = store.keyPath === null ? store.put(value, k) : store.put(value);
        }
        onProgress({ phase: "write", db: snap.name, store: def.name, done: job.i, total: def.records.length });
        if (job.i >= def.records.length) queue.shift();
        if (last) last.onsuccess = pump; else pump();
      };
      pump();
    });
  } finally { db.close(); }
}

// ------------------------------------------------------------- localStorage

function readLocal(storage) {
  const out = {};
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (isBackedUpKey(k)) out[k] = storage.getItem(k);
  }
  return out;
}

// --------------------------------------------------------------- utilidades

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function header(digest) { return `{"format":"${FORMAT}","version":${VERSION},"digest":"${digest}","payload":`; }

function fail(reason) { return { ok: false, reason }; }

// Comprueba la estructura sin escribir nada. `validateVault` es el de
// core/storage.js (se inyecta para no acoplar este módulo a la app).
export function validatePayload(p, { validateVault = null } = {}) {
  if (!p || typeof p !== "object") return fail("La copia no tiene contenido.");
  if (!p.localStorage || typeof p.localStorage !== "object" || Array.isArray(p.localStorage)) return fail("Falta la sección localStorage.");
  for (const [k, v] of Object.entries(p.localStorage)) {
    if (!k.startsWith(LS_PREFIX)) return fail(`Clave no permitida: ${k.slice(0, 40)}`);
    if (isSecretKey(k)) return fail("La copia contiene un secreto; no se restaura.");
    if (typeof v !== "string") return fail(`Valor no válido en ${k}`);
  }
  const rawVault = p.localStorage["manuos.vault"];
  if (rawVault === undefined) return fail("La copia no contiene el vault de MANU.");
  let vault;
  try { vault = JSON.parse(rawVault); } catch { return fail("El vault de la copia está dañado."); }
  if (validateVault) { const r = validateVault(vault); if (!r.ok) return fail(`Vault no válido: ${r.reason}`); }
  if (!Array.isArray(p.indexedDB)) return fail("Falta la sección indexedDB.");
  const seenDb = new Set();
  for (const db of p.indexedDB) {
    if (!db || !isManuDb(db.name) || seenDb.has(db.name)) return fail("Hay una base de datos no permitida o repetida.");
    seenDb.add(db.name);
    if (!Number.isInteger(db.version) || db.version < 1 || !Array.isArray(db.stores)) return fail(`La base ${db.name} no es válida.`);
    const seenStore = new Set();
    for (const s of db.stores) {
      if (!s || typeof s.name !== "string" || !s.name || seenStore.has(s.name)) return fail(`Un almacén de ${db.name} no es válido.`);
      seenStore.add(s.name);
      if (!(s.keyPath === null || typeof s.keyPath === "string" || Array.isArray(s.keyPath))) return fail(`keyPath no válido en ${db.name}/${s.name}.`);
      if (!Array.isArray(s.records) || !s.records.every((r) => Array.isArray(r) && r.length === 2)) return fail(`Registros dañados en ${db.name}/${s.name}.`);
      if (!Array.isArray(s.indexes ?? [])) return fail(`Índices no válidos en ${db.name}/${s.name}.`);
    }
  }
  return { ok: true, vault };
}

// ------------------------------------------------------------------ exportar

/**
 * Crea la copia completa. Devuelve { blob, filename, counts }.
 * @param {object} [o]
 * @param {Storage} [o.storage=localStorage]
 * @param {IDBFactory} [o.idb=indexedDB]
 * @param {string} [o.appVersion]
 * @param {(p:object)=>void} [o.onProgress]
 */
export async function exportFullBackup({ storage = globalThis.localStorage, idb = globalThis.indexedDB, appVersion = null, onProgress = noop } = {}) {
  const local = readLocal(storage);
  if (local["manuos.vault"] === undefined) throw new Error("No hay datos de MANU en este dispositivo.");
  const dbs = [];
  if (idb) for (const name of await listDatabases(idb)) { const s = await snapshotDb(idb, name, onProgress); if (s) dbs.push(s); }
  // Se serializa store a store y se une una vez: el SHA-256 necesita el texto
  // completo (SubtleCrypto no admite resumen incremental).
  const parts = [`{"createdAt":${JSON.stringify(new Date().toISOString())},"appVersion":${JSON.stringify(appVersion)},"localStorage":${JSON.stringify(local)},"indexedDB":[`];
  dbs.forEach((db, di) => {
    parts.push(`${di ? "," : ""}{"name":${JSON.stringify(db.name)},"version":${db.version},"stores":[`);
    db.stores.forEach((s, si) => { parts.push(`${si ? "," : ""}${JSON.stringify(s)}`); });
    parts.push("]}");
  });
  parts.push("]}");
  const payloadText = parts.join("");
  onProgress({ phase: "digest" });
  const digest = await sha256Hex(payloadText);
  const blob = new Blob([header(digest), payloadText, "}"], { type: "application/json" });
  const counts = { localStorage: Object.keys(local).length, databases: Object.fromEntries(dbs.map((d) => [d.name, Object.fromEntries(d.stores.map((s) => [s.name, s.records.length]))])) };
  return { blob, filename: `manu-os-copia-completa-${new Date().toISOString().slice(0, 10)}.json`, counts, bytes: blob.size };
}

/** Descarga un Blob (en iPhone abre la hoja «Guardar en Archivos»). */
export function downloadBlob(blob, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}

// ------------------------------------------------------------------ importar

/**
 * Lee y valida un archivo de copia SIN escribir nada.
 * Devuelve { ok:true, payload, vault, counts } o { ok:false, reason }.
 */
export async function readBackupFile(file, { validateVault = null } = {}) {
  if (!file) return fail("No hay archivo.");
  if (file.size > MAX_FILE_BYTES) return fail("El archivo es demasiado grande para ser una copia de MANU.");
  let text;
  try { text = await file.text(); } catch { return fail("No he podido leer el archivo."); }
  const marker = ',"payload":';
  const at = text.indexOf(marker);
  if (!text.startsWith(`{"format":"${FORMAT}"`) || at < 0 || !text.endsWith("}")) {
    if (text.includes('"schema"') && text.includes('"inbox"')) return fail("Es una copia antigua (solo el vault): usa «Restaurar copia» de siempre.");
    return fail("Ese archivo no es una copia completa de MANU OS.");
  }
  let head;
  try { head = JSON.parse(`${text.slice(0, at)}}`); } catch { return fail("La cabecera de la copia está dañada."); }
  if (head.format !== FORMAT) return fail("Ese archivo no es una copia completa de MANU OS.");
  if (head.version !== VERSION) return fail(`Versión de copia no compatible (${head.version}).`);
  const payloadText = text.slice(at + marker.length, -1);
  text = null; // libera memoria antes de parsear
  if (typeof head.digest !== "string" || head.digest !== await sha256Hex(payloadText)) return fail("La copia está incompleta o dañada (no coincide su huella). No he tocado nada.");
  let payload;
  try { payload = JSON.parse(payloadText); } catch { return fail("La copia está dañada."); }
  const v = validatePayload(payload, { validateVault });
  if (!v.ok) return v;
  const counts = { localStorage: Object.keys(payload.localStorage).length, databases: Object.fromEntries(payload.indexedDB.map((d) => [d.name, Object.fromEntries(d.stores.map((s) => [s.name, s.records.length]))])) };
  return { ok: true, payload, vault: v.vault, counts, createdAt: payload.createdAt ?? null, appVersion: payload.appVersion ?? null };
}

/**
 * Restaura una copia ya validada con readBackupFile. Reemplaza los datos de
 * MANU del dispositivo (no toca secretos ni claves ajenas a MANU). Si algo
 * falla, deshace lo hecho y lanza el error. Después, recarga la app.
 */
export async function restoreFullBackup(checked, { storage = globalThis.localStorage, idb = globalThis.indexedDB, onProgress = noop } = {}) {
  if (!checked?.ok || !checked.payload) throw new Error("Primero valida la copia con readBackupFile.");
  const { payload } = checked;
  // 1. Instantánea del estado actual, para deshacer.
  onProgress({ phase: "snapshot" });
  const beforeLocal = readLocal(storage);
  const beforeDbs = [];
  const targets = idb ? [...new Set([...payload.indexedDB.map((d) => d.name), ...(await listDatabases(idb))])] : [];
  for (const name of targets) beforeDbs.push({ name, snap: await snapshotDb(idb, name) });
  const written = [];
  try {
    // 2. IndexedDB: una transacción por base; las bases que la copia no trae se vacían.
    for (const name of targets) {
      const fromBackup = payload.indexedDB.find((d) => d.name === name);
      const current = beforeDbs.find((b) => b.name === name)?.snap;
      const snap = fromBackup ?? (current ? { ...current, stores: current.stores.map((s) => ({ ...s, records: [] })) } : null);
      if (!snap) continue;
      await writeDb(idb, snap, onProgress);
      written.push(name);
      await yieldToUi();
    }
    // 3. localStorage al final (el vault es lo último que cambia).
    onProgress({ phase: "local" });
    for (const k of Object.keys(beforeLocal)) if (!(k in payload.localStorage)) storage.removeItem(k);
    const incoming = Object.entries(payload.localStorage).sort(([a], [b]) => (a === "manuos.vault") - (b === "manuos.vault"));
    for (const [k, v] of incoming) storage.setItem(k, v);
  } catch (err) {
    // 4. Deshacer: localStorage y las bases ya escritas vuelven a como estaban.
    onProgress({ phase: "rollback" });
    // Cada paso por separado: que uno falle no impide deshacer los demás. Los
    // fallos se cuentan: nunca se afirma «como estaban» si no es verdad
    // (QA ChatGPT 2026-10, #3). El vault se repone el último.
    const failed = [];
    for (const name of written) {
      const b = beforeDbs.find((x) => x.name === name)?.snap;
      try { if (b) await writeDb(idb, b); } catch { failed.push(name); }
    }
    const extra = [];
    try { for (let i = 0; i < storage.length; i++) { const k = storage.key(i); if (isBackedUpKey(k) && !(k in beforeLocal)) extra.push(k); } } catch { failed.push("localStorage"); }
    for (const k of extra) { try { storage.removeItem(k); } catch { failed.push(k); } }
    const vaultLast = Object.entries(beforeLocal).sort(([a], [b]) => (a === "manuos.vault") - (b === "manuos.vault"));
    for (const [k, v] of vaultLast) { try { storage.setItem(k, v); } catch { failed.push(k); } }
    const why = err?.message ?? err;
    if (failed.length) throw Object.assign(new Error(`No se ha podido restaurar (${why}) y tampoco he podido deshacerlo del todo (${failed.length} ${failed.length === 1 ? "parte" : "partes"}): tus datos pueden haber quedado a medias. No borres nada y vuelve a restaurar esta copia o la anterior.`), { cause: err, partial: failed });
    throw Object.assign(new Error(`No se ha podido restaurar (${why}). He dejado tus datos como estaban.`), { cause: err });
  }
  onProgress({ phase: "done" });
  return { restored: checked.counts };
}

// Para tests: detectar si una copia trae binarios.
export const _internals = { hasBlob, encodeValue, decodeValue, sha256Hex };
