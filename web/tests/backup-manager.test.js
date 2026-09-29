import test from "node:test";
import assert from "node:assert/strict";
import { exportFullBackup, readBackupFile, validatePayload, isSecretKey, FORMAT } from "../core/backup-manager.js";
import { validateVault, emptyVault } from "../core/storage.js";
import { encryptBackup, decryptBackup } from "../core/crypto.js";

// A Storage-like object (localStorage is not in Node).
function storage(entries) {
  const m = new Map(Object.entries(entries));
  return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), map: m };
}
const vault = () => { const v = emptyVault(); v.inbox.push({ id: "i1", text: "Idea demo", status: "IDEA", at: "2026-09-29T10:00:00Z" }); return v; };
const seeded = () => storage({ "manuos.vault": JSON.stringify(vault()), "manuos.tab": "hoy", "manuos.gemini": "AIzaSECRETO", "manuos.gemini.remember": "1", "manuos.spotify.tokens": "{}", "manuos.spotify.pkce": "x", "manuos.vault.damaged": "{x", "otro-proyecto.clave": "ajeno" });

test("WEB-44: secrets and other sites' keys never go in the copy", async () => {
  assert.ok(isSecretKey("manuos.gemini"));
  assert.ok(isSecretKey("manuos.spotify.tokens"));
  assert.ok(isSecretKey("manuos.algo.token"));
  assert.ok(!isSecretKey("manuos.vault"));
  const exp = await exportFullBackup({ storage: seeded(), idb: null, appVersion: "44" });
  const text = await exp.blob.text();
  assert.ok(text.startsWith(`{"format":"${FORMAT}","version":1,"digest":"`));
  for (const bad of ["AIzaSECRETO", "manuos.spotify", "otro-proyecto", "vault.damaged"]) assert.ok(!text.includes(bad), bad);
  assert.deepEqual(Object.keys(exp.counts.databases), []);
  assert.equal(exp.counts.localStorage, 3); // vault, tab, gemini.remember (a preference, not the key)
});

test("WEB-44: a good copy validates; altered, cut, old or foreign files are refused", async () => {
  const text = await (await exportFullBackup({ storage: seeded(), idb: null })).blob.text();
  const read = (t) => readBackupFile(new Blob([t]), { validateVault });
  const good = await read(text);
  assert.equal(good.ok, true);
  assert.equal(good.vault.inbox[0].text, "Idea demo");
  assert.match((await read(text.replace("Idea demo", "Idea dema"))).reason, /huella/);
  assert.equal((await read(text.slice(0, -40))).ok, false);
  assert.match((await read(JSON.stringify(vault()))).reason, /antigua/);
  assert.equal((await read("hola")).ok, false);
  assert.equal((await readBackupFile(null)).ok, false);
});

test("WEB-44: the payload is checked before anything is written", () => {
  const base = () => ({ localStorage: { "manuos.vault": JSON.stringify(vault()) }, indexedDB: [{ name: "manuos-images", version: 1, stores: [{ name: "images", keyPath: null, autoIncrement: false, indexes: [], records: [["a", "data:x"]] }] }] });
  assert.equal(validatePayload(base(), { validateVault }).ok, true);
  const p1 = base(); p1.localStorage["manuos.gemini"] = "AIza"; assert.match(validatePayload(p1).reason, /secreto/);
  const p2 = base(); p2.localStorage["otra.app"] = "x"; assert.match(validatePayload(p2).reason, /no permitida/);
  const p3 = base(); p3.indexedDB[0].name = "otra-base"; assert.match(validatePayload(p3).reason, /no permitida/);
  const p4 = base(); p4.indexedDB[0].stores[0].records = [["solo-clave"]]; assert.match(validatePayload(p4).reason, /dañados/);
  const p5 = base(); p5.localStorage["manuos.vault"] = "{roto"; assert.match(validatePayload(p5).reason, /dañado/);
  const p6 = base(); p6.localStorage["manuos.vault"] = JSON.stringify({ schema: 1, inbox: [], spending: [{ id: "x", cents: -5 }], chat: [] });
  assert.match(validatePayload(p6, { validateVault }).reason, /Vault no válido/);
  const p7 = base(); delete p7.localStorage["manuos.vault"]; assert.match(validatePayload(p7).reason, /no contiene el vault/);
});

test("WEB-44: an encrypted full copy (several MB) round-trips; a wrong phrase opens nothing", async () => {
  const st = seeded();
  const v = vault(); v.inbox.push(...Array.from({ length: 3000 }, (_, i) => ({ id: `n${i}`, text: "nota ".repeat(200), status: "IDEA", at: "2026-09-29T10:00:00Z" })));
  st.setItem("manuos.vault", JSON.stringify(v));
  const text = await (await exportFullBackup({ storage: st, idb: null })).blob.text();
  assert.ok(text.length > 3_000_000);
  const env = await encryptBackup(text, "una frase larga de prueba", { iterations: 100000 });
  assert.ok(!JSON.stringify(env).includes("nota nota"));
  const back = await decryptBackup(env, "una frase larga de prueba");
  assert.equal(back, text);
  assert.equal((await readBackupFile(new Blob([back]), { validateVault })).vault.inbox.length, 3001);
  await assert.rejects(decryptBackup(env, "otra frase distinta"), /Frase incorrecta/);
});
